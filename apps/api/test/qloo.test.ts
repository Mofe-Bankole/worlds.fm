import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  qlooArtistImagesResponseSchema,
  qlooInsightsResponseSchema,
  qlooSearchResponseSchema
} from "@worlds/shared";

import { buildTestApp } from "./helpers.js";
import {
  callsMatching,
  createStubFetch,
  hangingFetch,
  jsonResponse,
  statusResponse
} from "./fixtures.js";

/**
 * MOCK QLOO FIXTURES. Hand-written payloads for automated tests only.
 *
 * The Insights shape follows the public Qloo reference example
 * (results.entities[] with entity_id, name, type, subtype, popularity, tags,
 * query). The `/search` body and `query.affinity` are NOT shown in the public
 * reference, so those parts are assumptions pending a live check. Names and
 * IDs below are invented test values, not real Qloo output and not real facts.
 */
const TEST_KEY = "test-qloo-key-DO-NOT-LEAK-7f3a";
const AVICII_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const BRAND_ID = "33333333-3333-4333-8333-333333333333";

function entity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Mock Artist",
    entity_id: AVICII_ID,
    type: "urn:entity",
    subtype: "urn:entity:artist",
    popularity: 0.91,
    disambiguation: "mock disambiguation",
    properties: { description: "A mock description.", akas: [{ value: "x", languages: ["en"] }] },
    tags: [{ id: "urn:tag:genre:music:mock", name: "Mock Genre", type: "urn:tag:genre:music" }],
    query: { affinity: 0.42 },
    ...overrides
  };
}

const searchBody = (entities: unknown[]) => ({ success: true, results: entities });
const insightsBody = (entities: unknown[]) => ({
  success: true,
  results: { entities },
  duration: 12
});

const isSearch = (url: string) => url.includes("/search?");
const isInsights = (url: string) => url.includes("/v2/insights?");

let apps: FastifyInstance[] = [];

async function makeApp(options: {
  env?: Record<string, string>;
  handlers: Parameters<typeof createStubFetch>[0];
  withKey?: boolean;
}) {
  const { fetchFn, calls } = createStubFetch(options.handlers);
  const app = await buildTestApp({
    env: {
      ...(options.withKey === false ? {} : { QLOO_API_KEY: TEST_KEY }),
      QLOO_HTTP_RETRIES: "0",
      ...options.env
    },
    fetchFn
  });
  apps.push(app);
  return { app, calls };
}

beforeEach(() => {
  apps = [];
});

afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

describe("GET /api/v1/qloo/search", () => {
  it("resolves an exact artist and keeps the Qloo entity ID", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: isSearch,
          respond: () =>
            jsonResponse(
              searchBody([
                entity({ name: "Mock Artist Tribute", entity_id: OTHER_ID }),
                entity({ name: "Mock Artist" })
              ])
            )
        }
      ]
    });

    const res = await app.inject("/api/v1/qloo/search?query=mock%20artist");
    expect(res.statusCode).toBe(200);
    const body = qlooSearchResponseSchema.parse(res.json());
    expect(body.resolution).toBe("exact");
    expect(body.bestMatchId).toBe(AVICII_ID);
    expect(body.results[0]?.id).toBe(AVICII_ID);
    expect(body.results[0]?.type).toBe("urn:entity:artist");
    expect(body.results[0]?.tags[0]?.id).toBe("urn:tag:genre:music:mock");
    expect(body.provenance).toMatchObject({ provider: "qloo", mode: "live", environment: "hackathon" });

    const url = new URL(calls[0]?.url ?? "");
    expect(url.origin).toBe("https://hackathon.api.qloo.com");
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("types")).toBe("urn:entity:artist");
    expect(url.searchParams.get("query")).toBe("mock artist");
    expect(url.searchParams.get("take")).toBe("5");
    expect(url.search).not.toContain(TEST_KEY);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(TEST_KEY);
  });

  it("reads the search entity shape observed live (types array, tag_id)", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: isSearch,
          respond: () =>
            jsonResponse(
              searchBody([
                {
                  name: "Mock Artist",
                  entity_id: AVICII_ID,
                  types: ["urn:entity:artist"],
                  popularity: 0.5,
                  properties: { short_description: "A mock short description." },
                  tags: [{ tag_id: "urn:tag:genre:mock", name: "Mock", type: "urn:tag:genre" }]
                }
              ])
            )
        }
      ]
    });
    const body = (await app.inject("/api/v1/qloo/search?query=Mock%20Artist")).json();
    expect(body.results[0]).toMatchObject({
      type: "urn:entity:artist",
      description: "A mock short description.",
      tags: [{ id: "urn:tag:genre:mock", name: "Mock" }]
    });
  });

  it("also accepts a results.entities envelope", async () => {
    const { app } = await makeApp({
      handlers: [
        { match: isSearch, respond: () => jsonResponse(insightsBody([entity()])) }
      ]
    });
    const res = await app.inject("/api/v1/qloo/search?query=Mock%20Artist");
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(1);
  });

  it("does not present a fuzzy neighbour as the requested artist", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: isSearch,
          respond: () => jsonResponse(searchBody([entity({ name: "Mock Artists United" })]))
        }
      ]
    });
    const body = (await app.inject("/api/v1/qloo/search?query=Mock%20Artist")).json();
    expect(body.resolution).toBe("fuzzy");
    expect(body.bestMatchId).toBeNull();
  });

  it("reports ambiguity when several entities share the exact name", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: isSearch,
          respond: () =>
            jsonResponse(searchBody([entity(), entity({ entity_id: OTHER_ID })]))
        }
      ]
    });
    const body = (await app.inject("/api/v1/qloo/search?query=Mock%20Artist")).json();
    expect(body.resolution).toBe("ambiguous");
    expect(body.bestMatchId).toBeNull();
    expect(body.results).toHaveLength(2);
  });

  it("treats a 404 as an empty result, not an error", async () => {
    const { app } = await makeApp({
      handlers: [{ match: isSearch, respond: () => statusResponse(404, { message: "none" }) }]
    });
    const res = await app.inject("/api/v1/qloo/search?query=Nobody%20Known");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ resolution: "none", bestMatchId: null, results: [] });
  });

  it("returns an empty list for an empty upstream result set", async () => {
    const { app } = await makeApp({
      handlers: [{ match: isSearch, respond: () => jsonResponse(searchBody([])) }]
    });
    const res = await app.inject("/api/v1/qloo/search?query=Nobody");
    expect(res.json()).toMatchObject({ resolution: "none", results: [] });
  });

  it("rejects invalid input before any upstream call", async () => {
    const { app, calls } = await makeApp({ handlers: [] });
    const cases = [
      "/api/v1/qloo/search",
      "/api/v1/qloo/search?query=",
      `/api/v1/qloo/search?query=${"a".repeat(101)}`,
      "/api/v1/qloo/search?query=Avicii&type=song",
      "/api/v1/qloo/search?query=Avicii&type=urn:entity:album",
      "/api/v1/qloo/search?query=Avicii&limit=500",
      "/api/v1/qloo/search?query=Avicii&limit=0"
    ];
    for (const url of cases) {
      const res = await app.inject(url);
      expect(res.statusCode, url).toBe(400);
      expect(res.json().error.code).toBe("invalid_query");
    }
    expect(calls).toHaveLength(0);
  });

  it("serves repeat searches from cache, normalizing the query", async () => {
    const { app, calls } = await makeApp({
      handlers: [{ match: isSearch, respond: () => jsonResponse(searchBody([entity()])) }]
    });
    await app.inject("/api/v1/qloo/search?query=Mock%20Artist");
    await app.inject("/api/v1/qloo/search?query=%20mock%20%20ARTIST%20");
    expect(callsMatching(calls, "/search?")).toHaveLength(1);
    await app.inject("/api/v1/qloo/search?query=Mock%20Artist&limit=3");
    expect(callsMatching(calls, "/search?")).toHaveLength(2);
  });

  it("caches empty results for the negative TTL", async () => {
    const { app, calls } = await makeApp({
      handlers: [{ match: isSearch, respond: () => jsonResponse(searchBody([])) }]
    });
    await app.inject("/api/v1/qloo/search?query=Nobody");
    await app.inject("/api/v1/qloo/search?query=Nobody");
    expect(callsMatching(calls, "/search?")).toHaveLength(1);
  });
});

describe("GET /api/v1/qloo/insights", () => {
  it("returns normalized affinities labelled as affinity, not history", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: isInsights,
          respond: () =>
            jsonResponse(
              insightsBody([
                entity({
                  name: "Mock Brand",
                  entity_id: BRAND_ID,
                  subtype: "urn:entity:brand",
                  query: { affinity: 0.87 }
                }),
                entity({ name: "No Affinity Brand", entity_id: OTHER_ID, query: undefined })
              ])
            )
        }
      ]
    });

    const res = await app.inject(
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=brand&limit=2`
    );
    expect(res.statusCode).toBe(200);
    const body = qlooInsightsResponseSchema.parse(res.json());
    expect(body.kind).toBe("affinity");
    expect(body.notice).toMatch(/not evidence of history/i);
    expect(body.notice).toMatch(/not the probability that an individual/i);
    expect(body.source.entityId).toBe(AVICII_ID);
    expect(body.results[0]).toMatchObject({
      affinity: 0.87,
      entity: { id: BRAND_ID, name: "Mock Brand", type: "urn:entity:brand" }
    });
    expect(body.results[1]?.affinity).toBeNull();

    const url = new URL(calls[0]?.url ?? "");
    expect(url.pathname).toBe("/v2/insights");
    expect(url.searchParams.get("filter.type")).toBe("urn:entity:brand");
    expect(url.searchParams.get("signal.interests.entities")).toBe(AVICII_ID);
    expect(url.searchParams.get("take")).toBe("2");
  });

  it("returns an empty list when Qloo has no affinities", async () => {
    const { app } = await makeApp({
      handlers: [{ match: isInsights, respond: () => jsonResponse(insightsBody([])) }]
    });
    const res = await app.inject(
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=destination`
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([]);
  });

  it("rejects invalid IDs, unsupported types and oversized limits", async () => {
    const { app, calls } = await makeApp({ handlers: [] });
    const cases = [
      "/api/v1/qloo/insights",
      "/api/v1/qloo/insights?entityId=not-a-uuid&targetType=brand",
      `/api/v1/qloo/insights?entityId=${AVICII_ID}`,
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=music`,
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=heatmap`,
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=brand&limit=51`
    ];
    for (const url of cases) {
      const res = await app.inject(url);
      expect(res.statusCode, url).toBe(400);
      expect(res.json().error.code).toBe("invalid_query");
    }
    expect(calls).toHaveLength(0);
  });

  it("caches repeated insight lookups", async () => {
    const { app, calls } = await makeApp({
      handlers: [{ match: isInsights, respond: () => jsonResponse(insightsBody([entity()])) }]
    });
    const url = `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=place`;
    await app.inject(url);
    await app.inject(url);
    expect(callsMatching(calls, "/v2/insights?")).toHaveLength(1);
  });
});

describe("credentials and upstream failures", () => {
  it("reports a safe 503 when no key is configured, without calling Qloo", async () => {
    const { app, calls } = await makeApp({ handlers: [], withKey: false });
    const res = await app.inject("/api/v1/qloo/search?query=Avicii");
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("qloo_not_configured");
    expect(calls).toHaveLength(0);
  });

  it("maps an upstream 401 without leaking the key", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: isSearch,
          respond: () => statusResponse(401, { message: `bad key ${TEST_KEY}` })
        }
      ]
    });
    const res = await app.inject("/api/v1/qloo/search?query=Avicii");
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("qloo_unauthorized");
    expect(res.payload).not.toContain(TEST_KEY);
  });

  it("maps an upstream 403 to a forbidden error for the entity type", async () => {
    const { app } = await makeApp({
      handlers: [{ match: isInsights, respond: () => statusResponse(403, { message: "no" }) }]
    });
    const res = await app.inject(
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=person`
    );
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("qloo_forbidden");
  });

  it("maps an upstream 400 and a missing insights entity", async () => {
    const bad = await makeApp({
      handlers: [{ match: isInsights, respond: () => statusResponse(400, { message: "x" }) }]
    });
    const badRes = await bad.app.inject(
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=brand`
    );
    expect(badRes.statusCode).toBe(400);
    expect(badRes.json().error.code).toBe("qloo_request_rejected");

    const missing = await makeApp({
      handlers: [{ match: isInsights, respond: () => statusResponse(404, {}) }]
    });
    const missingRes = await missing.app.inject(
      `/api/v1/qloo/insights?entityId=${AVICII_ID}&targetType=brand`
    );
    expect(missingRes.statusCode).toBe(404);
    expect(missingRes.json().error.code).toBe("qloo_not_found");
  });

  it("times out a stalled provider", async () => {
    const hang = hangingFetch();
    const { app } = await makeApp({
      env: { QLOO_HTTP_TIMEOUT_MS: "150" },
      handlers: [{ match: isSearch, respond: (_url, init) => hang("", init) }]
    });
    const res = await app.inject("/api/v1/qloo/search?query=Avicii");
    expect(res.statusCode).toBe(504);
    expect(res.json().error.code).toBe("qloo_timeout");
  });

  it("surfaces upstream rate limiting as 429 after a bounded retry", async () => {
    const { app, calls } = await makeApp({
      env: { QLOO_HTTP_RETRIES: "1" },
      handlers: [
        {
          match: isSearch,
          respond: () => statusResponse(429, { message: "slow down" }, { "retry-after": "0" })
        }
      ]
    });
    const res = await app.inject("/api/v1/qloo/search?query=Avicii");
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe("qloo_rate_limited");
    expect(callsMatching(calls, "/search?")).toHaveLength(2);
  });

  it("rejects malformed upstream payloads", async () => {
    const cases: Array<() => Response> = [
      () => new Response("<html>oops</html>", { status: 200 }),
      () => jsonResponse({ success: true }),
      () => jsonResponse({ results: "nope" }),
      () => jsonResponse(searchBody([{ not: "an entity" }]))
    ];
    for (const respond of cases) {
      const { app } = await makeApp({ handlers: [{ match: isSearch, respond }] });
      const res = await app.inject("/api/v1/qloo/search?query=Avicii");
      expect(res.statusCode).toBe(502);
      expect(res.json().error.code).toBe("qloo_invalid_response");
    }
  });

  it("skips individual entities that lack an id or name", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: isSearch,
          respond: () => jsonResponse(searchBody([{ name: "No id" }, entity()]))
        }
      ]
    });
    const res = await app.inject("/api/v1/qloo/search?query=Mock%20Artist");
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(1);
  });

  it("never logs or serializes the API key", async () => {
    const lines: string[] = [];
    const { fetchFn } = createStubFetch([
      { match: isSearch, respond: () => statusResponse(500, { message: TEST_KEY }) }
    ]);
    const { buildApp } = await import("../src/app.js");
    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig({
      NODE_ENV: "test",
      QLOO_API_KEY: TEST_KEY,
      QLOO_HTTP_RETRIES: "0",
      MEDIA_HTTP_RETRY_BASE_MS: "25"
    });
    const app = await buildApp({
      config,
      fetchFn,
      logger: {
        level: "trace",
        stream: { write: (line: string) => void lines.push(line) }
      }
    });
    apps.push(app);
    const res = await app.inject("/api/v1/qloo/search?query=Avicii");
    expect(res.statusCode).toBe(502);
    expect(res.payload).not.toContain(TEST_KEY);
    expect(lines.join("\n")).not.toContain(TEST_KEY);
  });
});

describe("route rate limiting", () => {
  it("returns 429 in the standard envelope once the per-minute cap is exceeded", async () => {
    const { app, calls } = await makeApp({
      env: { QLOO_RATE_LIMIT_PER_MINUTE: "2" },
      handlers: [{ match: isSearch, respond: () => jsonResponse(searchBody([entity()])) }]
    });
    expect((await app.inject("/api/v1/qloo/search?query=a")).statusCode).toBe(200);
    expect((await app.inject("/api/v1/qloo/search?query=b")).statusCode).toBe(200);
    const limited = await app.inject("/api/v1/qloo/search?query=c");
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("rate_limited");
    expect(limited.json().error.requestId).toBeTruthy();
    expect(calls).toHaveLength(2);
  });

  it("ignores spoofed X-Forwarded-For unless a proxy is trusted", async () => {
    const { app } = await makeApp({
      env: { QLOO_RATE_LIMIT_PER_MINUTE: "1" },
      handlers: [{ match: isSearch, respond: () => jsonResponse(searchBody([entity()])) }]
    });
    const hit = (ip: string, q: string) =>
      app.inject({ url: `/api/v1/qloo/search?query=${q}`, headers: { "x-forwarded-for": ip } });
    expect((await hit("1.1.1.1", "a")).statusCode).toBe(200);
    expect((await hit("2.2.2.2", "b")).statusCode).toBe(429);
  });

  it("does not rate limit other routes", async () => {
    const { app } = await makeApp({
      env: { QLOO_RATE_LIMIT_PER_MINUTE: "1" },
      handlers: []
    });
    for (let i = 0; i < 3; i += 1) {
      expect((await app.inject("/health")).statusCode).toBe(200);
    }
  });
});

describe("Qloo entity images", () => {
  it("keeps HTTPS images on the Qloo image host and drops anything else", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: isSearch,
          respond: () =>
            jsonResponse(
              searchBody([
                entity({ properties: { image: { url: "https://images.qloo.com/i/mock-420x-auto.jpg" } } }),
                entity({
                  name: "Mock Artist Two",
                  entity_id: OTHER_ID,
                  properties: { image: { url: "https://evil.example.com/x.jpg" } }
                }),
                entity({
                  name: "Mock Artist Three",
                  entity_id: BRAND_ID,
                  properties: { image: { url: "http://images.qloo.com/i/x.jpg" } }
                })
              ])
            )
        }
      ]
    });
    const body = qlooSearchResponseSchema.parse(
      (await app.inject("/api/v1/qloo/search?query=Mock%20Artist")).json()
    );
    expect(body.results.map((r) => r.imageUrl)).toEqual([
      "https://images.qloo.com/i/mock-420x-auto.jpg",
      null,
      null
    ]);
  });
});

describe("GET /api/v1/qloo/artist-images", () => {
  const img = (n: string) => `https://images.qloo.com/i/${n}.jpg`;

  it("returns exact-match images for several names in one request", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: (url) => isSearch(url) && url.includes("query=Mock+Artist&"),
          respond: () => jsonResponse(searchBody([entity({ properties: { image: { url: img("a") } } })]))
        },
        {
          match: (url) => isSearch(url) && url.includes("query=Other"),
          respond: () =>
            jsonResponse(searchBody([entity({ name: "Other Band", entity_id: OTHER_ID, properties: { image: { url: img("b") } } })]))
        },
        {
          match: (url) => isSearch(url) && url.includes("query=Fuzzy"),
          respond: () => jsonResponse(searchBody([entity({ name: "Fuzzy Match Band", entity_id: BRAND_ID })]))
        }
      ]
    });
    const res = await app.inject("/api/v1/qloo/artist-images?names=Mock%20Artist,Other%20Band,Fuzzy,mock%20artist");
    expect(res.statusCode).toBe(200);
    const body = qlooArtistImagesResponseSchema.parse(res.json());
    expect(body.images).toEqual([
      { name: "Mock Artist", imageUrl: img("a") },
      { name: "Other Band", imageUrl: img("b") },
      { name: "Fuzzy", imageUrl: null }
    ]);
    expect(res.headers["cache-control"]).toContain("public, max-age=3600");
    // The case-insensitive duplicate is not searched twice.
    expect(calls.filter((c) => isSearch(c.url))).toHaveLength(3);
  });

  it("returns null for a failed name instead of failing the batch, and is not cached", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: (url) => isSearch(url) && url.includes("query=Mock+Artist&"),
          respond: () => jsonResponse(searchBody([entity({ properties: { image: { url: img("a") } } })]))
        },
        { match: (url) => isSearch(url) && url.includes("query=Broken"), respond: () => statusResponse(500) }
      ]
    });
    const res = await app.inject("/api/v1/qloo/artist-images?names=Mock%20Artist,Broken");
    expect(res.statusCode).toBe(200);
    expect(res.json().images).toEqual([
      { name: "Mock Artist", imageUrl: img("a") },
      { name: "Broken", imageUrl: null }
    ]);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("maps a total failure to the usual error envelope", async () => {
    const { app } = await makeApp({ handlers: [{ match: isSearch, respond: () => statusResponse(500) }] });
    const res = await app.inject("/api/v1/qloo/artist-images?names=A,B");
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.json().error.code).toMatch(/^qloo_/);
  });

  it("rejects empty and oversized batches", async () => {
    const { app } = await makeApp({ handlers: [] });
    expect((await app.inject("/api/v1/qloo/artist-images?names=,%20,")).statusCode).toBe(400);
    const many = Array.from({ length: 13 }, (_, i) => `Artist ${i}`).join(",");
    expect((await app.inject(`/api/v1/qloo/artist-images?names=${encodeURIComponent(many)}`)).statusCode).toBe(400);
    expect((await app.inject("/api/v1/qloo/artist-images")).statusCode).toBe(400);
  });
});
