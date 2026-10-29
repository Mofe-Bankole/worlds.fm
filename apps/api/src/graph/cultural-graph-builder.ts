import {
  CULTURAL_GRAPH_LIMITATIONS,
  QLOO_ENTITY_TYPES,
  culturalGraphSchema,
  qlooEntitySchema,
  type CulturalCategory,
  type CulturalEdge,
  type CulturalGraph,
  type CulturalNode,
  type EdgeBasis,
  type GraphWarning,
  type QlooEntity,
  type QlooInsightsResponse
} from "@worlds/shared";

import { explainConnection, type RootTraits } from "./connection-explanation.js";
import type { ConnectionFindingsIndex } from "../services/connection-findings.js";

export const DEFAULT_MAX_NODES = 25;
export const DEFAULT_MAX_PER_CATEGORY = 10;

export interface BuildCulturalGraphInput {
  /** Normalized B1.1 root entity (typically from the search route). */
  root: QlooEntity;
  /** Normalized B1.1 Insights responses anchored on `root`. */
  insights: readonly QlooInsightsResponse[];
  /**
   * The root's traits from another source. The provider's search endpoint
   * returns no genres, so without this no root-to-node trait could be shared.
   */
  rootTraits?: RootTraits | null;
  /**
   * Precomputed connection research (AGENTS.md §12). When a pair has a cited
   * finding, its edge reaches the `documented` rung instead of stopping at an
   * affinity. Absent, every edge falls back to the weaker rungs, which is the
   * correct degradation: no citation, no documented claim.
   */
  findings?: ConnectionFindingsIndex | null;
}

export interface BuildCulturalGraphOptions {
  /** Total nodes including the root. */
  maxNodes?: number;
  maxPerCategory?: number;
  /** Used only when no Insights response supplies a retrieval time. */
  retrievedAt?: string;
}

const KNOWN_CATEGORIES: ReadonlySet<string> = new Set(QLOO_ENTITY_TYPES);

/** Stable node ID: provider-namespaced, case-insensitive on the Qloo UUID. */
export function qlooNodeId(externalId: string): string {
  return `qloo:${externalId.trim().toLowerCase()}`;
}

export function affinityEdgeId(sourceId: string, targetId: string): string {
  return `${sourceId}|affinity_recommendation|${targetId}`;
}

/** Maps `urn:entity:artist` style types. Anything unconfirmed becomes `unknown`. */
export function categoryFromQlooType(type: string | null): CulturalCategory {
  if (!type) return "unknown";
  const name = type.toLowerCase().replace(/^urn:entity:/, "");
  return KNOWN_CATEGORIES.has(name) ? (name as CulturalCategory) : "unknown";
}

function toNode(entity: QlooEntity): CulturalNode {
  const category = categoryFromQlooType(entity.type);
  const eligible = category === "artist";
  return {
    id: qlooNodeId(entity.id),
    name: entity.name,
    category,
    provider: "qloo",
    externalId: entity.id,
    description: entity.description,
    popularity: entity.popularity,
    tags: [
      ...new Set(entity.tags.map((tag) => tag.name).filter((n): n is string => !!n))
    ].sort(compareText),
    // Affinity results never carry coordinates; geo needs independent sources.
    geo: null,
    image: entity.imageUrl ? { url: entity.imageUrl, provider: "qloo" } : null,
    expansion: eligible
      ? {
          eligible: true,
          reason: "Qloo Insights was confirmed live with artist entities as the signal.",
          targetCategories: ["artist", "brand", "destination", "place"]
        }
      : {
          eligible: false,
          reason: "Expansion from this category is not confirmed in B1.2.",
          targetCategories: []
        }
  };
}

/**
 * The edge's label is what the link is based on, which is what a reader needs
 * in order to weigh it. The affinity notice stays on the evidence kind and in
 * the graph limitations, so it is stated once per graph rather than repeated
 * on every edge. A place target keeps its own caveat inline, because a
 * recommendation must never read as a verified location.
 */
function edgeLabel(basis: EdgeBasis, target: CulturalNode): string {
  const placeCaveat =
    target.category === "place" || target.category === "destination"
      ? " A recommendation, not a verified location."
      : "";
  return `${basis.statement}${placeCaveat}`;
}
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface Candidate {
  node: CulturalNode;
  edge: CulturalEdge;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const aa = a.edge.affinity;
  const ba = b.edge.affinity;
  if (aa !== ba) {
    if (aa === null) return 1;
    if (ba === null) return -1;
    return ba - aa;
  }
  return compareText(a.node.name, b.node.name) || compareText(a.node.id, b.node.id);
}

function positiveInt(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : fallback;
}

/**
 * Pure and deterministic: same input and options give the same graph. It
 * never calls a provider, never invents evidence kinds beyond `qloo_affinity`,
 * and never assigns coordinates.
 */
export function buildCulturalGraph(
  input: BuildCulturalGraphInput,
  options: BuildCulturalGraphOptions = {}
): CulturalGraph {
  const parsedRoot = qlooEntitySchema.safeParse(input.root);
  if (!parsedRoot.success) {
    throw new Error("Cannot build a cultural graph without a valid root entity.");
  }
  const maxNodes = positiveInt(options.maxNodes, DEFAULT_MAX_NODES);
  const maxPerCategory = positiveInt(options.maxPerCategory, DEFAULT_MAX_PER_CATEGORY);

  const rootNode = toNode(parsedRoot.data);
  const warnings: GraphWarning[] = [];
  const candidates = new Map<string, Candidate>();
  let invalid = 0;
  let selfRefs = 0;

  const timestamps = input.insights.map((r) => r.provenance.retrievedAt).sort(compareText);
  const retrievedAt =
    timestamps[timestamps.length - 1] ?? options.retrievedAt ?? new Date().toISOString();

  for (const response of input.insights) {
    for (const item of response.results) {
      const parsed = qlooEntitySchema.safeParse(item?.entity);
      if (!parsed.success) {
        invalid += 1;
        continue;
      }
      const node = toNode(parsed.data);
      if (node.id === rootNode.id) {
        selfRefs += 1;
        continue;
      }
      const affinity =
        typeof item.affinity === "number" && Number.isFinite(item.affinity) ? item.affinity : null;
      const pairA = { name: rootNode.name, category: rootNode.category };
      const pairB = { name: node.name, category: node.category };
      const finding = input.findings?.find(pairA, pairB);
      const documented = input.findings?.documented(pairA, pairB) ?? null;
      const basis = explainConnection({
        root: parsedRoot.data,
        target: parsed.data,
        rootCategory: rootNode.category,
        targetCategory: node.category,
        documented,
        rootTraits: input.rootTraits ?? null
      });
      const edge: CulturalEdge = {
        id: affinityEdgeId(rootNode.id, node.id),
        source: rootNode.id,
        target: node.id,
        relationship: "affinity_recommendation",
        // The edge exists because Qloo recommended the pair, and carries its
        // score. `basis` says how specific the explanation can be, which is
        // where a cited relationship is recorded.
        evidence: "qloo_affinity",
        provenance: {
          provider: "qloo",
          endpoint: "/v2/insights",
          mode: response.provenance.mode,
          environment: response.provenance.environment,
          retrievedAt: response.provenance.retrievedAt
        },
        affinity,
        researchStatus: finding?.outcome ?? "unresearched",
        // Non-empty exactly when the basis is `documented`; the schema rejects
        // a documented basis without them.
        references: documented?.references ?? [],
        label: edgeLabel(basis, node),
        basis
      };
      const existing = candidates.get(edge.id);
      if (!existing || compareCandidates({ node, edge }, existing) < 0) {
        candidates.set(edge.id, { node, edge });
      }
    }
  }

  const sorted = [...candidates.values()].sort(compareCandidates);

  const perCategory = new Map<CulturalCategory, number>();
  const kept: Candidate[] = [];
  let categoryTruncated = 0;
  let graphTruncated = 0;
  for (const candidate of sorted) {
    const count = perCategory.get(candidate.node.category) ?? 0;
    if (count >= maxPerCategory) {
      categoryTruncated += 1;
      continue;
    }
    if (kept.length + 1 >= maxNodes) {
      graphTruncated += 1;
      continue;
    }
    perCategory.set(candidate.node.category, count + 1);
    kept.push(candidate);
  }

  const missingAffinity = kept.filter((c) => c.edge.affinity === null).length;

  if (invalid > 0) {
    warnings.push({
      code: "invalid_entity_skipped",
      message: `${invalid} unreadable Qloo entit${invalid === 1 ? "y was" : "ies were"} skipped.`
    });
  }
  if (selfRefs > 0) {
    warnings.push({
      code: "self_reference_skipped",
      message: "Qloo returned the root entity among its own results; it was skipped."
    });
  }
  if (kept.length === 0) {
    warnings.push({
      code: "no_affinity_results",
      message: "Qloo returned no usable affinity results for this entity."
    });
  }
  if (missingAffinity > 0) {
    warnings.push({
      code: "missing_affinity",
      message: `${missingAffinity} link${missingAffinity === 1 ? " has" : "s have"} no Qloo affinity score; none was invented.`
    });
  }
  if (categoryTruncated > 0) {
    warnings.push({
      code: "category_truncated",
      message: `${categoryTruncated} result(s) were omitted by the per-category limit of ${maxPerCategory}.`
    });
  }
  if (graphTruncated > 0) {
    warnings.push({
      code: "graph_truncated",
      message: `${graphTruncated} result(s) were omitted by the graph limit of ${maxNodes} nodes.`
    });
  }

  const nodes = [rootNode, ...kept.map((c) => c.node)];
  const edges = kept.map((c) => c.edge);
  const nodesByCategory: Record<string, number> = {};
  for (const node of nodes) {
    nodesByCategory[node.category] = (nodesByCategory[node.category] ?? 0) + 1;
  }

  return culturalGraphSchema.parse({
    rootId: rootNode.id,
    nodes,
    edges,
    retrieval: {
      retrievedAt,
      providers: ["qloo"],
      limits: { maxNodes, maxPerCategory },
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodesByCategory,
      edgesByEvidence: edges.length > 0 ? { qloo_affinity: edges.length } : {}
    },
    warnings,
    limitations: [...CULTURAL_GRAPH_LIMITATIONS]
  });
}
