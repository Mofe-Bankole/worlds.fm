import { culturalDiscoveryResponseSchema, type CulturalDiscoveryResponse } from "@worlds/shared";

const at = "2026-10-24T10:00:00.000Z";
const id = (suffix: string) => `aaaaaaaa-0000-4000-8000-00000000000${suffix}`;
const node = (suffix: string, name: string, category: "artist" | "brand") => ({
  id: `qloo:${id(suffix)}`, externalId: id(suffix), name, category, provider: "qloo",
  description: null, popularity: null, tags: [], geo: null, image: null,
  expansion: { eligible: category === "artist", reason: "mock", targetCategories: [] }
});
const nodes = [node("1", "Mock Artist", "artist"), node("2", "Mock Artist B", "artist"),
  node("3", "Mock Artist C", "artist"), node("4", "Mock Brand", "brand")];
const edges = nodes.slice(1).map((target, i) => ({
  id: `${nodes[0]?.id}|affinity_recommendation|${target.id}`,
  source: nodes[0]?.id, target: target.id, relationship: "affinity_recommendation",
  evidence: "qloo_affinity", researchStatus: "unresearched", affinity: [0.91, 0.7, 0.99][i],
  provenance: { provider: "qloo", endpoint: "/v2/insights", mode: "live", environment: "hackathon", retrievedAt: at },
  references: [], label: "mock affinity",
  basis: { kind: "audience_overlap", statement: "mock affinity", shared: [], sourceLabel: "Qloo", sourceUrl: null }
}));
export function fixtureResponse(): CulturalDiscoveryResponse {
  return culturalDiscoveryResponseSchema.parse({
    status: "complete", query: "Mock Artist", resolution: "exact",
    root: { id: id("1"), name: "Mock Artist", type: "urn:entity:artist", popularity: null,
      description: null, disambiguation: null, tags: [], attributes: {
        genres: [], themes: [], audienceTraits: [], influences: [], collaborators: [], brands: [], origin: null, foundedYear: null
      } },
    candidates: [], categories: [], warnings: [], retrievedAt: at,
    graph: {
      rootId: nodes[0]?.id, nodes, edges,
      retrieval: { retrievedAt: at, providers: ["qloo"], limits: { maxNodes: 5, maxPerCategory: 5 },
        nodeCount: 4, edgeCount: 3, nodesByCategory: { artist: 3, brand: 1 }, edgesByEvidence: { qloo_affinity: 3 } },
      warnings: [], limitations: ["mock"]
    }
  });
}
