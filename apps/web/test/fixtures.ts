import { culturalDiscoveryResponseSchema, culturalGraphSchema, type CulturalDiscoveryResponse } from "@worlds/shared";

/**
 * TEST FIXTURE. Invented names and IDs, never real Qloo output. Used only by
 * automated tests; the explorer UI never imports this file.
 */
const AT = "2026-10-23T10:00:00.000Z";
const ROOT = "qloo:00000000-0000-4000-8000-0000000000a1";

function node(id: string, name: string, category: string, eligible = category === "artist") {
  return {
    id: `qloo:${id}`,
    name,
    category,
    provider: "qloo",
    externalId: id.toUpperCase(),
    description: null,
    popularity: null,
    tags: [],
    geo: null,
    image: null,
    expansion: { eligible, reason: "fixture", targetCategories: eligible ? ["artist"] : [] },
  };
}

function edge(target: string, affinity: number | null, label: string) {
  return {
    id: `${ROOT}|affinity_recommendation|qloo:${target}`,
    source: ROOT,
    target: `qloo:${target}`,
    relationship: "affinity_recommendation",
    evidence: "qloo_affinity",
    provenance: { provider: "qloo", endpoint: "/v2/insights", mode: "live", environment: "hackathon", retrievedAt: AT },
    affinity,
    references: [],
    label,
  };
}

const N = [
  node("00000000-0000-4000-8000-0000000000a1", "Mock Artist", "artist"),
  node("00000000-0000-4000-8000-0000000000b1", "Mock Artist B", "artist"),
  node("00000000-0000-4000-8000-0000000000b2", "Mock Brand", "brand"),
  node("00000000-0000-4000-8000-0000000000b3", "Mock Destination", "destination"),
  node("00000000-0000-4000-8000-0000000000b4", "No Score Artist", "artist"),
];

export const FIXTURE_GRAPH = culturalGraphSchema.parse({
  rootId: ROOT,
  nodes: N,
  edges: [
    edge("00000000-0000-4000-8000-0000000000b2", 0.98, "Qloo cultural affinity: Mock Brand."),
    edge("00000000-0000-4000-8000-0000000000b1", 0.9, "Qloo cultural affinity: Mock Artist B."),
    edge("00000000-0000-4000-8000-0000000000b3", 0.8, "Qloo cultural affinity: Mock Destination. A recommendation, not a verified location."),
    edge("00000000-0000-4000-8000-0000000000b4", null, "Qloo cultural affinity: No Score Artist."),
  ],
  retrieval: {
    retrievedAt: AT,
    providers: ["qloo"],
    limits: { maxNodes: 16, maxPerCategory: 5 },
    nodeCount: 5,
    edgeCount: 4,
    nodesByCategory: { artist: 3, brand: 1, destination: 1 },
    edgesByEvidence: { qloo_affinity: 4 },
  },
  warnings: [],
  limitations: ["fixture"],
});

export function fixtureResponse(over: Partial<CulturalDiscoveryResponse> = {}): CulturalDiscoveryResponse {
  return culturalDiscoveryResponseSchema.parse({
    status: "complete",
    query: "Mock Artist",
    resolution: "exact",
    root: { id: "00000000-0000-4000-8000-0000000000A1", name: "Mock Artist", type: "urn:entity:artist", popularity: null, description: null, disambiguation: null, tags: [] },
    candidates: [],
    graph: FIXTURE_GRAPH,
    categories: [],
    warnings: [],
    retrievedAt: AT,
    ...over,
  });
}
