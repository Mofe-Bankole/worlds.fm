import { culturalGraphSchema, type QlooEntity, type QlooInsightsResponse } from "@worlds/shared";
import { describe, expect, it } from "vitest";

import { buildCulturalGraph, qlooNodeId } from "../src/graph/cultural-graph-builder.js";

/**
 * MOCK FIXTURES. Hand-written, network-free inputs shaped like the B1.1
 * normalized Qloo contracts. IDs are made up and not real Qloo entities.
 */
const RETRIEVED_AT = "2026-10-22T10:00:00.000Z";
const ROOT_ID = "AAAAAAAA-0000-4000-8000-000000000001";

function entity(over: Partial<QlooEntity> & { id: string; name: string }): QlooEntity {
  return {
    type: "urn:entity:artist",
    popularity: 0.5,
    description: null,
    disambiguation: null,
    tags: [],
    ...over
  };
}

const root = entity({ id: ROOT_ID, name: "Mock Artist", tags: [{ id: "t1", name: "House", type: null }] });

function insights(
  targetType: QlooInsightsResponse["targetType"],
  results: Array<{ entity: unknown; affinity: number | null }>,
  retrievedAt = RETRIEVED_AT
): QlooInsightsResponse {
  return {
    source: { entityId: ROOT_ID },
    targetType,
    kind: "affinity",
    notice: "mock",
    results: results as QlooInsightsResponse["results"],
    provenance: { provider: "qloo", mode: "live", environment: "hackathon", retrievedAt }
  };
}

const artistB = entity({ id: "BBBBBBBB-0000-4000-8000-000000000002", name: "Mock Artist B" });
const brandC = entity({
  id: "CCCCCCCC-0000-4000-8000-000000000003",
  name: "Mock Brand C",
  type: "urn:entity:brand"
});
const destD = entity({
  id: "DDDDDDDD-0000-4000-8000-000000000004",
  name: "Mock Destination D",
  type: "urn:entity:destination"
});

describe("buildCulturalGraph (mock fixtures, no network)", () => {
  it("creates the root artist node first and sets the root ID", () => {
    const graph = buildCulturalGraph({ root, insights: [insights("artist", [{ entity: artistB, affinity: 0.9 }])] });
    expect(graph.rootId).toBe(`qloo:${ROOT_ID.toLowerCase()}`);
    expect(graph.nodes[0]).toMatchObject({
      id: graph.rootId,
      name: "Mock Artist",
      category: "artist",
      provider: "qloo",
      externalId: ROOT_ID,
      tags: ["House"],
      expansion: { eligible: true }
    });
  });

  it("normalizes artist, brand and destination nodes with Qloo IDs and scores preserved", () => {
    const graph = buildCulturalGraph({
      root,
      insights: [
        insights("artist", [{ entity: artistB, affinity: 0.9 }]),
        insights("brand", [{ entity: brandC, affinity: 0.8 }]),
        insights("destination", [{ entity: destD, affinity: 0.7 }])
      ]
    });
    expect(graph.nodes.map((n) => [n.category, n.externalId])).toEqual([
      ["artist", ROOT_ID],
      ["artist", artistB.id],
      ["brand", brandC.id],
      ["destination", destD.id]
    ]);
    expect(graph.edges.map((e) => e.affinity)).toEqual([0.9, 0.8, 0.7]);
    const dest = graph.nodes.find((n) => n.category === "destination");
    expect(dest?.expansion.eligible).toBe(false);
    expect(graph.edges.find((e) => e.target === dest?.id)?.label).toContain("not a verified location");
    expect(graph.retrieval.nodesByCategory).toEqual({ artist: 2, brand: 1, destination: 1 });
  });

  it("keeps every edge directed, provenance-backed and labelled qloo_affinity", () => {
    const graph = buildCulturalGraph({
      root,
      insights: [insights("artist", [{ entity: artistB, affinity: 0.9 }])]
    });
    const [edge] = graph.edges;
    expect(edge).toMatchObject({
      source: graph.rootId,
      target: qlooNodeId(artistB.id),
      relationship: "affinity_recommendation",
      evidence: "qloo_affinity",
      references: [],
      provenance: { provider: "qloo", endpoint: "/v2/insights", mode: "live", retrievedAt: RETRIEVED_AT }
    });
    expect(graph.retrieval.edgesByEvidence).toEqual({ qloo_affinity: 1 });
    expect(culturalGraphSchema.safeParse(graph).success).toBe(true);
  });

  it("uses stable, case-insensitive IDs and deduplicates by ID, not name", () => {
    const upper = entity({ id: "EEEEEEEE-0000-4000-8000-000000000005", name: "Same Name" });
    const lower = { ...upper, id: upper.id.toLowerCase() };
    const sameNameOtherId = entity({ id: "FFFFFFFF-0000-4000-8000-000000000006", name: "Same Name" });
    const graph = buildCulturalGraph({
      root,
      insights: [
        insights("artist", [
          { entity: upper, affinity: 0.5 },
          { entity: lower, affinity: 0.6 },
          { entity: sameNameOtherId, affinity: 0.4 }
        ])
      ]
    });
    expect(graph.edges).toHaveLength(2);
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(graph.nodes.length);
    expect(graph.edges.find((e) => e.target === qlooNodeId(upper.id))?.affinity).toBe(0.6);
    expect(graph.edges[0]?.id).toBe(`${graph.rootId}|affinity_recommendation|${qlooNodeId(upper.id)}`);
  });

  it("deduplicates a relationship repeated across Insights responses", () => {
    const graph = buildCulturalGraph({
      root,
      insights: [
        insights("artist", [{ entity: artistB, affinity: 0.9 }]),
        insights("artist", [{ entity: artistB, affinity: 0.9 }])
      ]
    });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it("skips malformed entities with a warning and keeps the rest", () => {
    const graph = buildCulturalGraph({
      root,
      insights: [
        insights("artist", [
          { entity: { name: "No id" }, affinity: 0.9 },
          { entity: null, affinity: 0.9 },
          { entity: { ...artistB, name: "" }, affinity: 0.9 },
          { entity: artistB, affinity: 0.5 }
        ])
      ]
    });
    expect(graph.edges).toHaveLength(1);
    expect(graph.warnings.map((w) => w.code)).toContain("invalid_entity_skipped");
  });

  it("rejects an invalid root", () => {
    expect(() => buildCulturalGraph({ root: { ...root, id: "" }, insights: [] })).toThrow();
  });

  it("returns a root-only graph with a warning for empty Insights", () => {
    const empty = buildCulturalGraph({ root, insights: [] }, { retrievedAt: RETRIEVED_AT });
    expect(empty.nodes).toHaveLength(1);
    expect(empty.edges).toEqual([]);
    expect(empty.warnings.map((w) => w.code)).toEqual(["no_affinity_results"]);
    expect(empty.retrieval.retrievedAt).toBe(RETRIEVED_AT);
    const emptyResponse = buildCulturalGraph({ root, insights: [insights("artist", [])] });
    expect(emptyResponse.edges).toEqual([]);
    expect(emptyResponse.retrieval.edgesByEvidence).toEqual({});
  });

  it("bounds results per category and in total with warnings", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      entity: entity({ id: `0000000${i}-0000-4000-8000-00000000000a`, name: `Artist ${i}` }),
      affinity: 0.9 - i * 0.01
    }));
    const capped = buildCulturalGraph({ root, insights: [insights("artist", many)] }, { maxPerCategory: 2 });
    expect(capped.edges).toHaveLength(2);
    expect(capped.warnings.map((w) => w.code)).toContain("category_truncated");

    const small = buildCulturalGraph({ root, insights: [insights("artist", many)] }, { maxNodes: 3 });
    expect(small.nodes).toHaveLength(3);
    expect(small.warnings.map((w) => w.code)).toContain("graph_truncated");
    expect(buildCulturalGraph({ root, insights: [insights("artist", many)] }, { maxNodes: 1 }).edges).toEqual([]);
  });

  it("orders by affinity, then name, then ID, with missing scores last, regardless of input order", () => {
    const a = entity({ id: "00000001-0000-4000-8000-00000000000b", name: "Alpha" });
    const b = entity({ id: "00000002-0000-4000-8000-00000000000b", name: "Beta" });
    const c = entity({ id: "00000003-0000-4000-8000-00000000000b", name: "Gamma" });
    const d = entity({ id: "00000004-0000-4000-8000-00000000000b", name: "Delta" });
    const items = [
      { entity: d, affinity: null },
      { entity: b, affinity: 0.8 },
      { entity: c, affinity: 0.9 },
      { entity: a, affinity: 0.8 }
    ];
    const one = buildCulturalGraph({ root, insights: [insights("artist", items)] });
    const two = buildCulturalGraph({ root, insights: [insights("artist", [...items].reverse())] });
    expect(one.nodes.map((n) => n.name)).toEqual(["Mock Artist", "Gamma", "Alpha", "Beta", "Delta"]);
    expect(two).toEqual(one);
  });

  it("keeps missing scores null, warns, and never invents one", () => {
    const graph = buildCulturalGraph({
      root,
      insights: [insights("artist", [{ entity: artistB, affinity: null }])]
    });
    expect(graph.edges[0]?.affinity).toBeNull();
    expect(graph.warnings.map((w) => w.code)).toContain("missing_affinity");
  });

  it("maps unsupported categories to unknown and skips the root echoed back", () => {
    const odd = entity({ id: "99999999-0000-4000-8000-000000000009", name: "Odd", type: "urn:entity:spaceship" });
    const untyped = entity({ id: "88888888-0000-4000-8000-000000000008", name: "Untyped", type: null });
    const graph = buildCulturalGraph({
      root,
      insights: [
        insights("artist", [
          { entity: odd, affinity: 0.5 },
          { entity: untyped, affinity: 0.4 },
          { entity: root, affinity: 0.99 }
        ])
      ]
    });
    expect(graph.nodes.filter((n) => n.category === "unknown")).toHaveLength(2);
    expect(graph.nodes.every((n) => n.category !== "unknown" || !n.expansion.eligible)).toBe(true);
    expect(graph.warnings.map((w) => w.code)).toContain("self_reference_skipped");
    expect(graph.edges.every((e) => e.target !== graph.rootId)).toBe(true);
  });

  it("never fabricates verified relationships, references or coordinates", () => {
    const placeE = entity({
      id: "77777777-0000-4000-8000-000000000007",
      name: "Mock Place",
      type: "urn:entity:place"
    });
    const graph = buildCulturalGraph({
      root,
      insights: [
        insights("place", [{ entity: placeE, affinity: 0.9 }]),
        insights("destination", [{ entity: destD, affinity: 0.8 }])
      ]
    });
    expect(graph.edges.every((e) => e.evidence === "qloo_affinity")).toBe(true);
    expect(graph.edges.every((e) => e.references.length === 0)).toBe(true);
    expect(graph.nodes.every((n) => n.geo === null)).toBe(true);
    expect(JSON.stringify(graph)).not.toMatch(/latitude|longitude|verified_fact/);
    expect(graph.limitations.join(" ")).toMatch(/not verified locations/);
  });

  it("is rejected by the contract if a verified or scored non-Qloo edge lacks support", () => {
    const graph = buildCulturalGraph({
      root,
      insights: [insights("artist", [{ entity: artistB, affinity: 0.9 }])]
    });
    const bad = structuredClone(graph);
    bad.edges[0]!.evidence = "verified_fact";
    expect(culturalGraphSchema.safeParse(bad).success).toBe(false);
  });

  it("is deterministic for identical input", () => {
    const input = { root, insights: [insights("artist", [{ entity: artistB, affinity: 0.9 }])] };
    expect(buildCulturalGraph(input)).toEqual(buildCulturalGraph(input));
  });
});

describe("node images", () => {
  it("passes a Qloo image through and leaves missing images null", () => {
    const withImage = entity({
      id: "EEEEEEEE-0000-4000-8000-000000000005",
      name: "Mock Artist E",
      imageUrl: "https://images.qloo.com/i/mock.jpg"
    });
    const graph = buildCulturalGraph({
      root,
      insights: [insights("artist", [{ entity: withImage, affinity: 0.9 }, { entity: destD, affinity: 0.8 }])]
    });
    expect(graph.nodes.find((n) => n.name === "Mock Artist E")?.image).toEqual({
      url: "https://images.qloo.com/i/mock.jpg",
      provider: "qloo"
    });
    expect(graph.nodes.find((n) => n.name === "Mock Destination D")?.image).toBeNull();
    expect(graph.nodes[0]?.image).toBeNull();
  });
});
