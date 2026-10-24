import {
  EMPTY_QLOO_ATTRIBUTES,
  culturalEdgeSchema,
  type QlooEntity,
  type QlooEntityAttributes
} from "@worlds/shared";
import { describe, expect, it } from "vitest";

import { explainConnection, formatNames } from "../src/graph/connection-explanation.js";

/**
 * MOCK FIXTURES. Hand-written, network-free entities. Names and values are
 * invented; the attribute *shapes* were live-checked against Qloo on
 * 2026-10-24 (primary_genres, lyrical_themes, influenced_by, collaborators,
 * associated_brands, place_of_birth, and `urn:tag:audience:*` tags).
 */
function entity(
  name: string,
  attributes: Partial<QlooEntityAttributes> = {},
  type = "urn:entity:artist"
): QlooEntity {
  return {
    id: `id-${name}`,
    name,
    type,
    popularity: null,
    description: null,
    disambiguation: null,
    tags: [],
    attributes: { ...EMPTY_QLOO_ATTRIBUTES, ...attributes }
  };
}

/** Artist-to-artist is the common case; the place cases call the resolver directly. */
const explain = (root: QlooEntity, target: QlooEntity) =>
  explainConnection({ root, target, rootCategory: "artist", targetCategory: "artist" });

describe("explainConnection: the evidence ladder", () => {
  it("uses a supplied citation for the documented rung and keeps its source", () => {
    const basis = explainConnection({
      root: entity("Mock Artist"),
      target: entity("Mock Peer"),
      rootCategory: "artist",
      targetCategory: "artist",
      documented: {
        statement: "Mock Artist produced Mock Peer's debut.",
        sourceLabel: "MusicBrainz",
        sourceUrl: "https://musicbrainz.org/artist/mock"
      }
    });
    expect(basis.kind).toBe("documented");
    expect(basis.statement).toContain("produced");
    expect(basis.sourceLabel).toBe("MusicBrainz");
    expect(basis.sourceUrl).toBe("https://musicbrainz.org/artist/mock");
  });

  it("never reaches the documented rung from Qloo data alone", () => {
    // Even when everything else matches, no citation means no documented rung.
    const basis = explain(
      entity("Mock Artist", { genres: ["Pop"], influences: ["Mock Peer"] }),
      entity("Mock Peer", { genres: ["Pop"], influences: ["Mock Artist"] })
    );
    expect(basis.kind).toBe("provider_attribute");
  });

  it("reads a stated influence in either direction, and attributes it to Qloo", () => {
    const forward = explain(
      entity("Mock Root", { genres: ["Pop"] }),
      entity("Mock Target", { influences: ["Mock Root", "Someone Else"] })
    );
    expect(forward.kind).toBe("provider_attribute");
    expect(forward.statement).toBe("Qloo lists Mock Root among Mock Target's influences.");
    expect(forward.sourceLabel).toBe("Qloo");
    expect(forward.shared).toEqual(["Mock Root"]);

    const backward = explain(
      entity("Mock Root", { influences: ["Mock Target"] }),
      entity("Mock Target", { genres: ["Pop"] })
    );
    expect(backward.kind).toBe("provider_attribute");
    expect(backward.statement).toBe("Qloo lists Mock Target among Mock Root's influences.");
  });

  it("matches a stated name despite case, accents and punctuation", () => {
    const basis = explain(
      entity("Beyoncé"),
      entity("Mock Target", { influences: ["beyonce"] })
    );
    expect(basis.kind).toBe("provider_attribute");
    expect(basis.statement).toContain("Beyoncé");
  });

  it("reads a stated label or brand as a relationship", () => {
    const basis = explain(
      entity("Mock Artist", { brands: ["Mock Records", "Other Label"] }),
      entity("Mock Records", {}, "urn:entity:brand")
    );
    expect(basis.kind).toBe("provider_attribute");
    expect(basis.statement).toBe("Qloo lists Mock Records among Mock Artist's labels and brands.");
  });

  it("matches a place to a stated origin on a word boundary only", () => {
    const toPlace = (root: QlooEntity, target: QlooEntity) =>
      explainConnection({ root, target, rootCategory: "artist", targetCategory: "destination" });

    const matched = toPlace(
      entity("Mock Artist", { origin: "East Finchley, Barnet, London" }),
      entity("London", {}, "urn:entity:destination")
    );
    expect(matched.kind).toBe("provider_attribute");
    expect(matched.statement).toBe("Qloo gives London as part of Mock Artist's origin.");

    // "Rome" must not be found inside "Romeo".
    const notMatched = toPlace(
      entity("Mock Artist", { origin: "Romeo, Michigan" }),
      entity("Rome", {}, "urn:entity:destination")
    );
    expect(notMatched.kind).not.toBe("provider_attribute");
  });

  it("falls back to shared traits, naming the values", () => {
    const basis = explain(
      entity("Mock Root", { genres: ["Pop", "R&B", "Jazz"] }),
      entity("Mock Target", { genres: ["r&b", "Pop"] })
    );
    expect(basis.kind).toBe("shared_attribute");
    expect(basis.statement).toBe("Both are tagged Pop and R&B.");
    expect(basis.shared).toEqual(["Pop", "R&B"]);
  });

  it("adds shared audience descriptions to a shared-trait statement", () => {
    const basis = explain(
      entity("Mock Root", { genres: ["Pop"], audienceTraits: ["Devoted", "Diverse"] }),
      entity("Mock Target", { genres: ["Pop"], audienceTraits: ["Devoted"] })
    );
    expect(basis.kind).toBe("shared_attribute");
    expect(basis.statement).toBe("Both are tagged Pop. Qloo describes both audiences as Devoted.");
    expect(basis.shared).toEqual(["Pop", "Devoted"]);
  });

  it("falls back to audience overlap and says plainly that nothing else was found", () => {
    const basis = explain(
      entity("Mock Root", { genres: ["Pop"] }),
      entity("Mock Target", { genres: ["Death Metal"] })
    );
    expect(basis.kind).toBe("audience_overlap");
    expect(basis.shared).toEqual([]);
    expect(basis.statement).toContain("no documented link and no shared trait");
    expect(basis.statement).toContain("Mock Root");
    expect(basis.statement).toContain("Mock Target");
    // The rung's name belongs to the badge, not repeated in every sentence.
    expect(basis.statement).not.toContain("audience overlap only");
  });

  it("never claims endorsement, inspiration or causation", () => {
    const inputs = [
      explain(entity("A", { genres: ["Pop"] }), entity("B", { genres: ["Pop"] })),
      explain(entity("A", { influences: ["B"] }), entity("B")),
      explain(entity("A"), entity("B"))
    ];
    for (const basis of inputs) {
      expect(basis.statement.toLowerCase()).not.toMatch(/endorse|inspired|influenced by|caused|proof/);
    }
  });

  it("is deterministic for the same input", () => {
    const build = () => explain(entity("A", { genres: ["Pop"] }), entity("B", { genres: ["Pop"] }));
    expect(build()).toEqual(build());
  });
});

describe("the contract rejects a documented basis with nothing behind it", () => {
  const edge = (basis: unknown) => ({
    id: "a|affinity_recommendation|b",
    source: "a",
    target: "b",
    relationship: "affinity_recommendation",
    evidence: "qloo_affinity",
    provenance: {
      provider: "qloo",
      endpoint: "/v2/insights",
      mode: "live",
      environment: "hackathon",
      retrievedAt: "2026-10-24T00:00:00.000Z"
    },
    affinity: 0.9,
    references: [],
    label: "mock",
    basis
  });

  it("accepts a provider-stated basis without references", () => {
    const result = culturalEdgeSchema.safeParse(
      edge({ kind: "provider_attribute", statement: "mock", shared: [], sourceLabel: "Qloo", sourceUrl: null })
    );
    expect(result.success).toBe(true);
  });

  it("rejects a documented basis that carries no source reference", () => {
    const result = culturalEdgeSchema.safeParse(
      edge({ kind: "documented", statement: "mock", shared: [], sourceLabel: "MusicBrainz", sourceUrl: null })
    );
    expect(result.success).toBe(false);
  });
});

describe("formatNames", () => {
  it("reads naturally and caps the list", () => {
    expect(formatNames(["Pop"])).toBe("Pop");
    expect(formatNames(["Pop", "R&B"])).toBe("Pop and R&B");
    expect(formatNames(["Pop", "R&B", "Jazz"])).toBe("Pop, R&B and Jazz");
    expect(formatNames(["a", "b", "c", "d", "e"])).toBe("a, b and c");
  });
});
