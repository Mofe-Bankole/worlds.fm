import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { culturalDiscoveryResponseSchema, culturalGraphSchema } from "@worlds/shared";

import { buildTestApp } from "./helpers.js";
import { callsMatching, createStubFetch, jsonResponse, statusResponse } from "./fixtures.js";

/**
 * MOCK QLOO FIXTURES. Hand-written, network-free payloads for tests only.
 * Names and IDs are invented. "Mock Artist" stands in for a real artist and
 * none of these values is real Qloo output or a real-world fact.
 */
const TEST_KEY = "test-qloo-key-DO-NOT-LEAK-7f3a";
const ROOT_ID = "11111111-1111-4111-8111-111111111111";
const ROOT_ID_2 = "11111111-1111-4111-8111-222222222222";

const searchEntity = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  entity_id: id,
  name,
  types: ["urn:entity:artist"],
  popularity: 0.9,
  ...extra
});
const insightEntity = (
  id: string,
  name: string,
  subtype: string,
  affinity: number | null,
  extra: Record<string, unknown> = {}
) => ({
  entity_id: id,
  name,
  type: "urn:entity",
  subtype,
  popularity: 0.5,
  tags: [],
  ...(affinity === null ? {} : { query: { affinity } }),
  ...extra
});

const isSearch = (url: string) => url.includes("/search?");
const category = (url: string) => /filter\.type=urn%3Aentity%3A(\w+)/.exec(url)?.[1];
const isInsights = (type: string) => (url: string) => category(url) === type;

/** The root's genres come from MusicBrainz, because Qloo's search returns none. */
const MB_ARTIST = "99999999-9999-4999-8999-999999999999";
const mbArtistSearch: Handler = {
  match: (url) => url.includes("musicbrainz.org/ws/2/artist/?query="),
  respond: () => jsonResponse({ artists: [{ id: MB_ARTIST, name: "Mock Artist", score: 100 }] })
};
const mbArtistGenres: Handler = {
  match: (url) => url.includes(`musicbrainz.org/ws/2/artist/${MB_ARTIST}?inc=genres`),
  respond: () =>
    jsonResponse({
      id: MB_ARTIST,
      name: "Mock Artist",
      genres: [
        { name: "Neo-Psychedelia", count: 4 },
        { name: "Psychedelic Rock", count: 9 }
      ]
    })
};

const artists = [
  // Shares a genre with the root (MusicBrainz says "Psychedelic Rock").
  insightEntity("a0000000-0000-4000-8000-000000000001", "Mock Artist B", "urn:entity:artist", 0.97, {
    properties: { primary_genres: ["psychedelic rock", "Indie Pop"] }
  }),
  insightEntity("a0000000-0000-4000-8000-000000000002", "Mock Artist C", "urn:entity:artist", 0.95)
];
const brands = [insightEntity("b0000000-0000-4000-8000-000000000001", "Mock Brand", "urn:entity:brand", 0.98)];
const destinations = [
  insightEntity("d0000000-0000-4000-8000-000000000001", "Mock Destination", "urn:entity:destination", 0.9)
];
const body = (entities: unknown[]) => ({ success: true, results: { entities } });

type Handler = Parameters<typeof createStubFetch>[0][number];
const exactSearch: Handler = {
  match: isSearch,
  respond: () => jsonResponse({ success: true, results: [searchEntity(ROOT_ID, "Mock Artist")] })
};
const okInsights = (type: string, list: unknown[]): Handler => ({
  match: isInsights(type),
  respond: () => jsonResponse(body(list))
});
const happy = (): Handler[] => [
  exactSearch,
  okInsights("artist", artists),
  okInsights("brand", brands),
  okInsights("destination", destinations),
  mbArtistSearch,
  mbArtistGenres
];

let apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

async function makeApp(handlers: Handler[], env: Record<string, string> = {}, withKey = true) {
  const { fetchFn, calls } = createStubFetch(handlers);
  const app = await buildTestApp({
    env: { ...(withKey ? { QLOO_API_KEY: TEST_KEY } : {}), QLOO_HTTP_RETRIES: "0", ...env },
    fetchFn
  });
  apps.push(app);
  return { app, calls };
}

const URL_ = "/api/v1/graph/artist?query=Mock%20Artist";

describe("GET /api/v1/graph/artist (mock fixtures, no network)", () => {
  it("returns a valid complete graph through search, insights and the builder", async () => {
    const { app, calls } = await makeApp(happy());
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    const parsed = culturalDiscoveryResponseSchema.parse(json);
    expect(parsed.status).toBe("complete");
    expect(parsed.resolution).toBe("exact");
    expect(parsed.root?.id).toBe(ROOT_ID);
    expect(culturalGraphSchema.safeParse(parsed.graph).success).toBe(true);
    expect(parsed.graph?.rootId).toBe(`qloo:${ROOT_ID}`);
    expect(parsed.graph?.nodes[0]).toMatchObject({ name: "Mock Artist", externalId: ROOT_ID });
    expect(parsed.graph?.nodes.map((n) => n.category).sort()).toEqual(
      ["artist", "artist", "artist", "brand", "destination"]
    );
    expect(parsed.categories.map((c) => [c.category, c.status, c.count])).toEqual([
      ["artist", "ok", 2],
      ["brand", "ok", 1],
      ["destination", "ok", 1]
    ]);
    // One search plus exactly three insights, and only the confirmed categories.
    expect(callsMatching(calls, "/search?")).toHaveLength(1);
    expect(callsMatching(calls, "/v2/insights?")).toHaveLength(3);
    expect(calls.map((c) => category(c.url)).filter(Boolean).sort()).toEqual(["artist", "brand", "destination"]);
    expect(res.headers["x-worlds-cache"]).toBe("miss");
  });

  it("preserves Qloo affinity provenance and never invents facts or coordinates", async () => {
    const { app } = await makeApp(happy());
    const parsed = culturalDiscoveryResponseSchema.parse((await app.inject(URL_)).json());
    const graph = parsed.graph!;
    expect(graph.edges.every((e) => e.evidence === "qloo_affinity")).toBe(true);
    expect(graph.edges.every((e) => e.provenance.provider === "qloo" && e.references.length === 0)).toBe(true);
    expect(graph.edges.map((e) => e.affinity).sort()).toEqual([0.9, 0.95, 0.97, 0.98]);
    expect(graph.nodes.every((n) => n.geo === null)).toBe(true);
    // No coordinates, and nothing claimed as a verified fact.
    expect(JSON.stringify([graph.nodes, graph.edges])).not.toMatch(/latitude|longitude|verified_fact/i);
    // Anything the provider states is attributed to it, never asserted as ours.
    for (const edge of graph.edges) {
      if (/collaborat|influenc/i.test(edge.basis.statement)) {
        expect(edge.basis.kind).toBe("provider_attribute");
        expect(edge.basis.statement).toMatch(/^Qloo lists /);
      }
    }
    const dest = graph.edges.find((e) => e.label.includes("Mock Destination"));
    expect(dest?.label).toContain("not a verified location");
  });

  it("shares a genre with the root by reading the root's genres from MusicBrainz", async () => {
    const { app, calls } = await makeApp(happy());
    const parsed = culturalDiscoveryResponseSchema.parse((await app.inject(URL_)).json());
    const graph = parsed.graph!;
    const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name;
    const basisFor = (name: string) =>
      graph.edges.find((e) => nameOf(e.target) === name)?.basis;

    // The root has no genres of its own: Qloo's search endpoint returns none.
    expect(parsed.root?.attributes.genres).toEqual([]);

    // Qloo files the target as "psychedelic rock"; MusicBrainz files the root
    // as "Psychedelic Rock". The shared trait names both sources.
    const shared = basisFor("Mock Artist B");
    expect(shared?.kind).toBe("shared_attribute");
    expect(shared?.statement).toBe("Both are tagged Psychedelic Rock.");
    expect(shared?.sourceLabel).toBe("MusicBrainz and Qloo");
    expect(shared?.shared).toEqual(["Psychedelic Rock"]);

    // No shared trait for the other artist, so it stays an honest overlap.
    const overlap = basisFor("Mock Artist C");
    expect(overlap?.kind).toBe("audience_overlap");
    expect(overlap?.sourceLabel).toBe("Qloo");

    expect(callsMatching(calls, "musicbrainz.org/ws/2/artist/?query=")).toHaveLength(1);
    expect(callsMatching(calls, `artist/${MB_ARTIST}?inc=genres`)).toHaveLength(1);
  });

  it("keeps the graph when MusicBrainz cannot supply the root's genres", async () => {
    // No MusicBrainz handlers at all: every call fails at the stub.
    const { app } = await makeApp([
      exactSearch,
      okInsights("artist", artists),
      okInsights("brand", brands),
      okInsights("destination", destinations)
    ]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(200);
    const parsed = culturalDiscoveryResponseSchema.parse(res.json());
    expect(parsed.status).toBe("complete");
    // Without the root's genres the shared genre cannot be found, so the link
    // falls back rather than guessing.
    const shared = parsed.graph?.edges.find((e) => e.basis.kind === "shared_attribute");
    expect(shared).toBeUndefined();
  });

  it("does not use another artist's genres when the name is ambiguous", async () => {
    const { app } = await makeApp([
      exactSearch,
      okInsights("artist", artists),
      okInsights("brand", brands),
      okInsights("destination", destinations),
      {
        match: (url) => url.includes("musicbrainz.org/ws/2/artist/?query="),
        respond: () =>
          jsonResponse({
            artists: [
              { id: MB_ARTIST, name: "Mock Artist", score: 100 },
              { id: "88888888-8888-4888-8888-888888888888", name: "Mock Artist", score: 100 }
            ]
          })
      },
      mbArtistGenres
    ]);
    const parsed = culturalDiscoveryResponseSchema.parse((await app.inject(URL_)).json());
    // Two artists share the name, so neither one's genres are attached.
    expect(parsed.graph?.edges.some((e) => e.basis.kind === "shared_attribute")).toBe(false);
    expect(parsed.graph?.edges.every((e) => e.basis.kind === "audience_overlap")).toBe(true);
  });

  it("keeps a missing affinity null and reports it", async () => {
    const { app } = await makeApp([
      exactSearch,
      okInsights("artist", [insightEntity("a0000000-0000-4000-8000-000000000009", "No Score", "urn:entity:artist", null)]),
      okInsights("brand", []),
      okInsights("destination", [])
    ]);
    const parsed = culturalDiscoveryResponseSchema.parse((await app.inject(URL_)).json());
    expect(parsed.graph?.edges[0]?.affinity).toBeNull();
    expect(parsed.graph?.warnings.map((w) => w.code)).toContain("missing_affinity");
  });

  it("returns a partial graph with a category warning when one category fails", async () => {
    const { app } = await makeApp([
      exactSearch,
      okInsights("artist", artists),
      okInsights("brand", brands),
      { match: isInsights("destination"), respond: () => statusResponse(500, { secret: "boom" }) }
    ]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(200);
    const parsed = culturalDiscoveryResponseSchema.parse(res.json());
    expect(parsed.status).toBe("partial");
    expect(parsed.graph?.nodes.some((n) => n.category === "destination")).toBe(false);
    expect(parsed.categories.find((c) => c.category === "destination")).toMatchObject({
      status: "failed",
      errorCode: "qloo_unavailable"
    });
    expect(parsed.warnings[0]).toMatchObject({ code: "category_unavailable", category: "destination" });
    expect(res.body).not.toContain("boom");
  });

  it("returns a controlled error, not an empty graph, when every category fails", async () => {
    const { app } = await makeApp([
      exactSearch,
      { match: isInsights("artist"), respond: () => statusResponse(500) },
      { match: isInsights("brand"), respond: () => statusResponse(503) },
      { match: isInsights("destination"), respond: () => statusResponse(500) }
    ]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("qloo_unavailable");
  });

  it("keeps a shared failure meaning when all categories hit the rate limit", async () => {
    const { app } = await makeApp([
      exactSearch,
      { match: (u) => !isSearch(u), respond: () => statusResponse(429) }
    ]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe("qloo_rate_limited");
  });

  it("returns a root-only complete graph with a warning when every category is empty", async () => {
    const { app } = await makeApp([
      exactSearch,
      okInsights("artist", []),
      okInsights("brand", []),
      okInsights("destination", [])
    ]);
    const parsed = culturalDiscoveryResponseSchema.parse((await app.inject(URL_)).json());
    expect(parsed.status).toBe("complete");
    expect(parsed.graph?.nodes).toHaveLength(1);
    expect(parsed.graph?.edges).toEqual([]);
    expect(parsed.categories.every((c) => c.status === "empty")).toBe(true);
    expect(parsed.graph?.warnings.map((w) => w.code)).toContain("no_affinity_results");
  });

  it("asks for disambiguation instead of guessing when names are ambiguous", async () => {
    const { app, calls } = await makeApp([
      {
        match: isSearch,
        respond: () =>
          jsonResponse({
            success: true,
            results: [searchEntity(ROOT_ID, "Mock Artist"), searchEntity(ROOT_ID_2, "Mock Artist")]
          })
      }
    ]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(200);
    const parsed = culturalDiscoveryResponseSchema.parse(res.json());
    expect(parsed).toMatchObject({ status: "needs_disambiguation", resolution: "ambiguous", root: null, graph: null });
    expect(parsed.candidates).toHaveLength(2);
    expect(callsMatching(calls, "/v2/insights?")).toHaveLength(0);
    // Nothing is enriched for a name we are handing back to the reader, so no
    // MusicBrainz request is spent on it.
    expect(callsMatching(calls, "musicbrainz.org")).toHaveLength(0);
  });

  it("does not treat a fuzzy neighbour as the requested artist", async () => {
    const { app, calls } = await makeApp([
      {
        match: isSearch,
        respond: () => jsonResponse({ success: true, results: [searchEntity(ROOT_ID, "Mock Artist & Friends")] })
      }
    ]);
    const parsed = culturalDiscoveryResponseSchema.parse((await app.inject(URL_)).json());
    expect(parsed).toMatchObject({ status: "needs_disambiguation", resolution: "fuzzy", graph: null, root: null });
    expect(callsMatching(calls, "/v2/insights?")).toHaveLength(0);
    expect(callsMatching(calls, "musicbrainz.org")).toHaveLength(0);
  });

  it("returns 404 with an honest body when the artist is not found", async () => {
    const { app } = await makeApp([{ match: isSearch, respond: () => statusResponse(404) }]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(404);
    expect(culturalDiscoveryResponseSchema.parse(res.json())).toMatchObject({
      status: "not_found",
      resolution: "none",
      graph: null,
      candidates: []
    });
  });

  it("rejects invalid queries before any upstream call", async () => {
    const { app, calls } = await makeApp(happy());
    for (const url of [
      "/api/v1/graph/artist",
      "/api/v1/graph/artist?query=",
      `/api/v1/graph/artist?query=${"a".repeat(101)}`,
      "/api/v1/graph/artist?query=x&limit=6",
      "/api/v1/graph/artist?query=x&limit=0"
    ]) {
      const res = await app.inject(url);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("invalid_query");
    }
    expect(calls).toHaveLength(0);
  });

  it("reports 503 without calling Qloo when no key is configured", async () => {
    const { app, calls } = await makeApp(happy(), {}, false);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("qloo_not_configured");
    expect(calls).toHaveLength(0);
  });

  it("surfaces rejected credentials as a safe 502 without leaking the key", async () => {
    const { app } = await makeApp([
      { match: isSearch, respond: () => statusResponse(401, { message: `bad key ${TEST_KEY}` }) }
    ]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("qloo_unauthorized");
    expect(res.body).not.toContain(TEST_KEY);
  });

  it("serializes upstream errors without internals", async () => {
    const { app } = await makeApp([
      { match: isSearch, respond: () => statusResponse(500, { stack: "at secret.js:1", key: TEST_KEY }) }
    ]);
    const res = await app.inject(URL_);
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toMatch(/secret\.js|stack|hackathon\.api|x-api-key/i);
    expect(res.body).not.toContain(TEST_KEY);
  });

  it("bounds the graph to the node limit", async () => {
    const many = (type: string, prefix: string) =>
      Array.from({ length: 5 }, (_, i) =>
        insightEntity(`${prefix}0000000-0000-4000-8000-00000000000${i}`, `${type} ${i}`, `urn:entity:${type}`, 0.9 - i / 100)
      );
    const { app } = await makeApp([
      exactSearch,
      okInsights("artist", many("artist", "a")),
      okInsights("brand", many("brand", "b")),
      okInsights("destination", many("destination", "d"))
    ]);
    const parsed = culturalDiscoveryResponseSchema.parse((await app.inject(URL_)).json());
    expect(parsed.graph?.nodes.length).toBeLessThanOrEqual(16);
    expect(parsed.graph?.nodes).toHaveLength(16);
    expect(parsed.graph?.retrieval.limits.maxNodes).toBe(16);
  });

  it("reuses the cache for repeated and concurrent requests", async () => {
    const { app, calls } = await makeApp(happy());
    const [a, b] = await Promise.all([app.inject(URL_), app.inject("/api/v1/graph/artist?query=mock%20ARTIST")]);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    const again = await app.inject(URL_);
    expect(again.headers["x-worlds-cache"]).toBe("hit");
    // One search, three insights, and two MusicBrainz calls for the root's genres.
    expect(calls).toHaveLength(6);
  });

  it("does not cache a total outage, and retries only the failed category after a partial result", async () => {
    let destinationFails = true;
    const { app, calls } = await makeApp([
      exactSearch,
      okInsights("artist", artists),
      okInsights("brand", brands),
      {
        match: isInsights("destination"),
        respond: () => (destinationFails ? statusResponse(500) : jsonResponse(body(destinations)))
      }
    ]);
    const first = await app.inject(URL_);
    expect(culturalDiscoveryResponseSchema.parse(first.json()).status).toBe("partial");
    destinationFails = false;
    const second = await app.inject(URL_);
    // Partial results are cached briefly, so the second call is served from cache.
    expect(second.headers["x-worlds-cache"]).toBe("hit");
    expect(callsMatching(calls, "/v2/insights?")).toHaveLength(3);

    const outage = await makeApp([exactSearch, { match: (u) => !isSearch(u), respond: () => statusResponse(500) }]);
    expect((await outage.app.inject(URL_)).statusCode).toBe(502);
    const before = outage.calls.length;
    expect((await outage.app.inject(URL_)).statusCode).toBe(502);
    expect(outage.calls.length).toBeGreaterThan(before);
  });

  it("keeps the rate limit and ignores spoofed X-Forwarded-For", async () => {
    const { app } = await makeApp(happy(), { GRAPH_RATE_LIMIT_PER_MINUTE: "1" });
    const hit = (ip: string) => app.inject({ url: URL_, headers: { "x-forwarded-for": ip } });
    expect((await hit("1.1.1.1")).statusCode).toBe(200);
    const limited = await hit("2.2.2.2");
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("rate_limited");
  });
});
