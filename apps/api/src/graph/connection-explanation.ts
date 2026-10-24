import type { CulturalCategory, EdgeBasis, QlooEntity, QlooEntityAttributes } from "@worlds/shared";
import { EMPTY_QLOO_ATTRIBUTES } from "@worlds/shared";

import { namesMatch, normalizeName } from "../lib/matching.js";

/**
 * Works out what a connection is based on, and how strong that basis is.
 *
 * The rungs are tried strongest first and the first one that has evidence
 * wins, so a link is never described more weakly than it can be:
 *
 * 1. `documented` — a cited source states the relationship. Nothing in a Qloo
 *    response can reach this rung: Qloo output is a recommendation signal, and
 *    turning it into a documented fact is exactly what AGENTS.md §5 and §6
 *    forbid. It is reached only when a caller supplies a cited relationship,
 *    which is where a verified-source adapter (MusicBrainz artist relations,
 *    Wikidata) will plug in.
 * 2. `provider_attribute` — the provider itself states a relationship between
 *    the two, such as one listing the other among its influences. This is
 *    still the provider's description, so the statement attributes it to Qloo
 *    rather than asserting it as history.
 * 3. `shared_attribute` — the two entities share a trait the provider records.
 * 4. `audience_overlap` — nothing but the affinity score.
 *
 * Pure and deterministic: no provider calls, no clock, no randomness.
 */

const QLOO = "Qloo";
const MAX_NAMED = 3;

/** A relationship the provider states between the two entities. */
interface StatedRelation {
  /** Sentence naming the relationship. */
  statement: string;
  /** The values that carry it, for display. */
  shared: string[];
}

export interface ExplainConnectionInput {
  root: QlooEntity;
  target: QlooEntity;
  /** Categories drive which attributes are worth comparing. */
  rootCategory: CulturalCategory;
  targetCategory: CulturalCategory;
  /** A relationship already established from a cited source, if any. */
  documented?: { statement: string; sourceLabel: string; sourceUrl: string } | null;
}

export function explainConnection(input: ExplainConnectionInput): EdgeBasis {
  const { root, target } = input;

  if (input.documented) {
    return {
      kind: "documented",
      statement: input.documented.statement,
      shared: [],
      sourceLabel: input.documented.sourceLabel,
      sourceUrl: input.documented.sourceUrl
    };
  }

  const stated = statedRelation(root, target, input.rootCategory, input.targetCategory);
  if (stated) {
    return { kind: "provider_attribute", statement: stated.statement, shared: stated.shared, sourceLabel: QLOO, sourceUrl: null };
  }

  const shared = sharedTraits(root, target);
  if (shared) {
    return { kind: "shared_attribute", statement: shared.statement, shared: shared.shared, sourceLabel: QLOO, sourceUrl: null };
  }

  return {
    kind: "audience_overlap",
    // The badge already says "Audience overlap", so the sentence says what was
    // looked for and not found rather than repeating the rung's name.
    statement: `Qloo found no documented link and no shared trait between ${root.name} and ${target.name}.`,
    shared: [],
    sourceLabel: QLOO,
    sourceUrl: null
  };
}

/* ------------------------------- Rung 2: stated ------------------------------- */

/**
 * Looks for the provider stating a relationship, in both directions, since
 * which side records it is arbitrary. Names are compared after normalization
 * so a spelling variant does not hide a real match.
 */
function statedRelation(
  root: QlooEntity,
  target: QlooEntity,
  rootCategory: CulturalCategory,
  targetCategory: CulturalCategory
): StatedRelation | null {
  const named = (values: string[], name: string): boolean =>
    values.some((value) => namesMatch(value, name));

  // One side listing the other as an influence, a collaborator or a label.
  const directional: Array<{ values: string[]; subject: QlooEntity; object: QlooEntity; noun: string }> = [
    { values: target.attributes.influences, subject: target, object: root, noun: "influences" },
    { values: root.attributes.influences, subject: root, object: target, noun: "influences" },
    { values: target.attributes.collaborators, subject: target, object: root, noun: "collaborators" },
    { values: root.attributes.collaborators, subject: root, object: target, noun: "collaborators" },
    { values: target.attributes.brands, subject: target, object: root, noun: "labels and brands" },
    { values: root.attributes.brands, subject: root, object: target, noun: "labels and brands" }
  ];

  for (const relation of directional) {
    if (!named(relation.values, relation.object.name)) continue;
    const matched = relation.values.filter((value) => namesMatch(value, relation.object.name));
    return {
      statement: `Qloo lists ${relation.object.name} among ${relation.subject.name}'s ${relation.noun}.`,
      shared: matched.slice(0, MAX_NAMED)
    };
  }

  // A place the provider gives as an entity's origin, matching a place node.
  // Word-boundary matching only: "Rome" must not match "Romeo".
  const placeName =
    targetCategory === "place" || targetCategory === "destination"
      ? target.name
      : rootCategory === "place" || rootCategory === "destination"
        ? root.name
        : null;
  if (placeName) {
    for (const owner of [root, target]) {
      const origin = owner.attributes.origin;
      if (origin && containsPlace(origin, placeName)) {
        return {
          statement: `Qloo gives ${placeName} as part of ${owner.name}'s origin.`,
          shared: [origin]
        };
      }
    }
  }

  return null;
}

/** Whole-word, accent-insensitive containment. */
function containsPlace(haystack: string, needle: string): boolean {
  const target = normalizeName(needle);
  if (!target) return false;
  return normalizeName(haystack)
    .split(" ")
    .includes(target);
}

/* ------------------------------- Rung 3: shared ------------------------------- */

function sharedTraits(root: QlooEntity, target: QlooEntity): { statement: string; shared: string[] } | null {
  const a = attributesOf(root);
  const b = attributesOf(target);

  const genres = intersect(a.genres, b.genres);
  const themes = intersect(a.themes, b.themes);
  const audiences = intersect(a.audienceTraits, b.audienceTraits);

  const tagged = [...genres, ...themes];
  if (tagged.length === 0 && audiences.length === 0) return null;

  const sentences: string[] = [];
  if (tagged.length > 0) {
    sentences.push(`Both are tagged ${formatNames(tagged)}.`);
  }
  if (audiences.length > 0) {
    sentences.push(`Qloo describes both audiences as ${formatNames(audiences)}.`);
  }
  return { statement: sentences.join(" "), shared: [...tagged, ...audiences] };
}

function attributesOf(entity: QlooEntity): QlooEntityAttributes {
  return entity.attributes ?? EMPTY_QLOO_ATTRIBUTES;
}

/** Values present in both lists, case-insensitively, in the first list's order. */
function intersect(a: string[], b: string[]): string[] {
  const keys = new Set(b.map((value) => value.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of a) {
    const key = value.toLowerCase();
    if (!keys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** "Pop, R&B and Dance" — an Oxford-free list that reads naturally. */
export function formatNames(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED);
  if (shown.length <= 1) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}
