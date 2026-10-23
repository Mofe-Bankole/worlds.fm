# Cultural Discovery API (B1.3)

**Endpoint:** `GET /api/v1/graph/artist`
**Code:** `apps/api/src/services/cultural-discovery.ts`, `apps/api/src/routes/graph.ts`, contracts in `packages/shared/src/cultural-discovery.ts`.
It orchestrates the B1.1 Qloo adapter and the B1.2 `buildCulturalGraph`. It adds no data of its own. See [qloo-api.md](./qloo-api.md) and [cultural-graph.md](./cultural-graph.md).

## Request

| Parameter | Rules |
|---|---|
| `query` | Required artist name, trimmed, 1 to 100 characters. |
| `limit` | Optional results per category, 1 to 5, default 5. |

```bash
pnpm --filter @worlds/api dev            # needs QLOO_API_KEY in apps/api/.env
curl -s -G "localhost:4000/api/v1/graph/artist" --data-urlencode "query=Avicii"
```

`entityId` is not supported yet (see "Future expansion").

## Workflow

1. Validate the query with Zod (400 `invalid_query`).
2. Qloo Search for type `artist` (1 request).
3. Resolution check. Only an `exact` match becomes the root. `ambiguous` and `fuzzy` results return candidates and **no graph**.
4. Qloo Insights for `artist`, `brand`, `destination`, in parallel, with `limit` results each (3 requests).
5. `buildCulturalGraph` with `maxNodes: 16` (root plus 15 neighbours) and `maxPerCategory: limit`.
6. Validate against `culturalGraphSchema` and `culturalDiscoveryResponseSchema`.

At most 4 Qloo requests per exploration. Place, podcast and video_game are not requested.

## Response

`CulturalDiscoveryResponse`: `status`, `query`, `resolution`, `root`, `candidates`, `graph`, `categories`, `warnings`, `retrievedAt`.

| `status` | HTTP | Meaning | `graph` |
|---|---|---|---|
| `complete` | 200 | All categories answered (possibly empty, reported per category). | present |
| `partial` | 200 | At least one category failed; the graph holds the others. `warnings` names each failed category with a stable `errorCode`. | present |
| `needs_disambiguation` | 200 | Name is ambiguous or only fuzzily matched. `candidates` lists Qloo's closest matches. No Insights call is made. | `null` |
| `not_found` | 404 | Qloo has no matching artist. | `null` |

`categories[]` reports `category`, `status` (`ok`, `empty`, `failed`), `count` and `errorCode`.

### Errors (standard envelope `{ "error": { code, message, requestId } }`)

| Code | HTTP | When |
|---|---|---|
| `invalid_query` | 400 | Bad or missing parameters. |
| `rate_limited` | 429 | Per-client graph limit exceeded. |
| `qloo_rate_limited` | 429 | Qloo throttled the request (also when every category was throttled). |
| `qloo_unauthorized` / `qloo_forbidden` | 502 | Qloo rejected the key or entity type. |
| `qloo_unavailable`, `qloo_timeout`, `qloo_invalid_response` | 502/504 | Search failed, or every category failed with the same cause. |
| `discovery_unavailable` | 502 | Every category failed with different causes. |
| `qloo_not_configured` | 503 | `QLOO_API_KEY` is not set. |

Messages are fixed strings. Upstream bodies, URLs, headers and the key are never echoed. A total Insights failure is an error, never an empty graph.

## Provenance guarantees

- Every edge is `evidence: "qloo_affinity"` with `relationship: "affinity_recommendation"`, Qloo provenance, the original Qloo affinity (or `null`), and empty `references`.
- Qloo entity IDs are preserved as `externalId`. Node IDs are `qloo:<lowercased id>`.
- Destination labels read "A recommendation, not a verified location." No node has coordinates (`geo` is `null`).
- Nothing says an artist performed, lived, collaborated, influenced, endorsed or attended. Affinity is audience overlap, not an individual's preference probability.

## Caching and limits

- The service caches whole responses in memory, keyed by normalized query and `limit`: `complete` and `needs_disambiguation` for `QLOO_CACHE_TTL_MS` (1 hour), `partial` and `not_found` for `QLOO_NEGATIVE_CACHE_TTL_MS` (5 minutes). The `x-worlds-cache` header reports `hit` or `miss`.
- Errors and total outages are **not** cached. A repeat request retries Qloo.
- The adapter also caches search and Insights calls, so after a partial failure expires only the failed category is re-requested.
- Identical concurrent requests share one exploration.
- Rate limit: `GRAPH_RATE_LIMIT_PER_MINUTE` (default 10) per client, separate from the Qloo routes. Client IP comes from the socket unless `TRUST_PROXY` names trusted proxies (`TRUST_PROXY=true` is rejected), so a spoofed `X-Forwarded-For` cannot evade it.
- Each Qloo request uses `QLOO_HTTP_TIMEOUT_MS` (8 s) and `QLOO_HTTP_RETRIES` (1). There is no overall deadline: the worst case is one search followed by one parallel Insights round, each with retries.
- The cache is per process and lost on restart. No Redis or queue was added.

## Live verification (2026-10-22, hackathon host, real key, real Fastify HTTP)

Run against the built server (`node dist/server.js`). 17 Qloo-bound requests in total (4 explorations plus one not-found search). Findings below are live; automated tests use mock fixtures only (`apps/api/test/graph.test.ts`).

| Artist | HTTP | Resolution | Nodes | Edges | Categories (nodes) | Warnings | Valid |
|---|---|---|---|---|---|---|---|
| Avicii | 200 `complete` | exact | 16 | 15 | artist 6, brand 5, destination 5 | none | yes |
| Fela Kuti | 200 `complete` | exact | 16 | 15 | artist 6, brand 5, destination 5 | none | yes |
| Rihanna | 200 `complete` | exact | 16 | 15 | artist 6, brand 5, destination 5 | none | yes |
| Bob Marley | 200 `complete` | exact | 16 | 15 | artist 6, brand 5, destination 5 | none | yes |

- All edges were `qloo_affinity` and every `geo` was `null`. Validation used `culturalDiscoveryResponseSchema` on the saved responses.
- A repeated Avicii request returned `x-worlds-cache: hit`.
- A nonsense name returned 404 `not_found` with an empty `candidates` list.
- The API key did not appear in any response.
- Not exercised live: ambiguous names, partial failure and total failure. Those are covered by mock tests only.

## Future expansion

- `entityId` expansion: B1.1 can fetch Insights by ID but has no reliable entity-by-ID lookup, so the root's name and identity cannot be confirmed from an ID. It is deferred rather than fabricated. A later milestone could accept the `candidates` ID plus the name the client received, or add a verified lookup.
- Later hops should reuse node `expansion.eligible` (artists only) and the same bounded limits.
- A shared cache (for example Redis) would be needed for multiple API instances.
- `place` is excluded because its live quality was weak for some artists.
