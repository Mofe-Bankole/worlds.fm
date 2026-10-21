# Qloo integration (B1.1) — reference

Fastify backend (`apps/api`). Contracts live in `packages/shared/src/qloo.ts`; the
adapter is `apps/api/src/integrations/qloo/`; routes are `apps/api/src/routes/qloo.ts`.

Qloo output is a **cultural affinity signal**. It is never verified history, and an
affinity value is a population-level ranking signal, not the probability that an
individual will like something. Every Insights response says so in `notice` and is
tagged `kind: "affinity"`.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `QLOO_API_KEY` | _(unset)_ | Server only. Sent as the `X-Api-Key` header. Blank = Qloo disabled. |
| `QLOO_API_BASE_URL` | `https://hackathon.api.qloo.com` | Hackathon keys work **only** on this host (staging and production return 401). |
| `QLOO_HTTP_TIMEOUT_MS` | `8000` | Per attempt. |
| `QLOO_HTTP_RETRIES` | `1` | Network errors, timeouts, 5xx and 429 (honours `Retry-After`, capped at 10 s). |
| `QLOO_CACHE_TTL_MS` | `3600000` | In-memory, private cache. Empty results use the negative TTL. |
| `QLOO_NEGATIVE_CACHE_TTL_MS` | `300000` | |
| `QLOO_CACHE_MAX_ENTRIES` | `500` | FIFO eviction. |
| `QLOO_RATE_LIMIT_PER_MINUTE` | `20` | Per client IP, `/api/v1/qloo/*` only. |

Put the key in `apps/api/.env` (git-ignored). Never use a `NEXT_PUBLIC_*` variable.
With no key the routes answer `503 qloo_not_configured`; the API still boots.

## Verified against Qloo's documentation

Source: <https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide> and the
linked reference pages, read on 2026-10-21.

- Host `https://hackathon.api.qloo.com`; auth header `X-Api-Key` (not a query parameter, not Bearer).
- `GET /search` with `query`, `types`, `take`; documented statuses 200, 404 (no results), 429.
- `GET /v2/insights` with `filter.type` (required), `signal.interests.entities`, `take` (1–50, default 20). Query string only; POST bodies and `/recs`, `/recommendations` are not supported.
- Insights entity types: `urn:entity:artist|book|brand|destination|movie|person|place|podcast|tv_show|video_game`. Unsupported types answer 403.
- `urn:entity:destination` requires `signal.interests.entities`, which this adapter always sends.
- Invalid parameters are silently ignored by Qloo, so an empty 200 can mean "bad parameter" or "no data".
- Private server-side caching is allowed; do not store Qloo data in a public repository.

Unauthenticated probe on 2026-10-21 (no credential involved): both `/search` and
`/v2/insights` on the hackathon host answered `401 "No API key found in request"`,
which confirms the host and both paths exist.

### Documentation differences and gaps

- The Insights Deep Dive enum lists `videogame`; the hackathon guide and the parameter guide say `video_game`. The adapter follows the **hackathon guide**. Live: `video_game` returned 400 (see findings).
- The public reference shows an Insights response sample (`results.entities[]` with `entity_id`, `name`, `type`, `subtype`, `properties`, `popularity`, `tags`, `query`, `disambiguation`) but **no `/search` response body** and no entity-level `query.affinity` value. The adapter therefore:
  - accepts `results: []` or `results: { entities: [] }`,
  - reads `query.affinity` only if it is a number, otherwise `affinity: null`,
  - skips entities lacking `entity_id` or `name`, and fails with `qloo_invalid_response` if every entity is unreadable.
- The `/search` `types` enum is collapsed in the public page (12 values). The routes only offer the 10 Insights types above.
- `docs/ARCHITECTURE.md` was referenced by the task but does not exist in this repository.

## Endpoints

### `GET /api/v1/qloo/search?query=Avicii[&type=artist][&limit=5]`

- `query`: 1–100 chars. `type`: one of the entity types above, default `artist`. `limit`: 1–10, default 5.

```jsonc
{
  "query": "Avicii",
  "type": "artist",
  "resolution": "exact",        // exact | ambiguous | fuzzy | none
  "bestMatchId": "<qloo entity_id>",   // only when resolution is "exact"
  "results": [
    { "id": "<qloo entity_id>", "name": "…", "type": "urn:entity:artist",
      "popularity": 0.9, "description": null, "disambiguation": null,
      "tags": [{ "id": "urn:tag:…", "name": "…", "type": "urn:tag:…" }] }
  ],
  "provenance": { "provider": "qloo", "mode": "live", "environment": "hackathon",
                  "retrievedAt": "2026-10-21T00:00:00.000Z" }
}
```

Exact normalized-name matches rank first. A fuzzy neighbour never produces a
`bestMatchId`, and several exact matches report `ambiguous` so the caller picks.

### `GET /api/v1/qloo/insights?entityId=<uuid>&targetType=brand[&limit=10]`

- `entityId`: a Qloo entity UUID from search. `targetType`: an entity type above. `limit`: 1–20, default 10.

```jsonc
{
  "source": { "entityId": "<uuid>" },
  "targetType": "brand",
  "kind": "affinity",
  "notice": "Cultural affinity signal from Qloo. It is not evidence of history, …",
  "results": [ { "entity": { /* as above */ }, "affinity": null } ],
  "provenance": { /* as above */ }
}
```

## Errors

All errors use the standard envelope `{ "error": { "code", "message", "requestId" } }`.
Messages are fixed strings; upstream bodies, URLs and headers are never echoed.

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_query` | Bad or missing parameters (no upstream call is made). |
| 400 | `qloo_request_rejected` | Qloo answered 400 (for example an unknown `entityId`). |
| 404 | `qloo_not_found` | Insights lookup answered 404. (Search 404 is an empty result.) |
| 429 | `rate_limited` | Per-client cap on these routes exceeded. |
| 429 | `qloo_rate_limited` | Qloo answered 429 after the bounded retry. |
| 502 | `qloo_unauthorized` | Qloo answered 401: wrong key or wrong host. |
| 502 | `qloo_forbidden` | Qloo answered 403: entity type or endpoint not permitted. |
| 502 | `qloo_invalid_response` | Malformed or unexpected upstream payload. |
| 502 | `qloo_unavailable` | Network error or upstream 5xx. |
| 503 | `qloo_not_configured` | `QLOO_API_KEY` is not set. |
| 504 | `qloo_timeout` | Qloo did not answer within `QLOO_HTTP_TIMEOUT_MS`. |

## Safeguards

- Client IPs for rate limiting come from the socket unless `TRUST_PROXY` names trusted proxies (hop count or IP/CIDR list). `TRUST_PROXY=true` is rejected, so spoofed `X-Forwarded-For` headers cannot evade the limit. Set it to your platform's hop count when deployed behind a proxy.
- Result counts are capped (search 10, insights 20), queries are capped at 100 characters, and entity types are an allow-list.
- Responses are cached privately in memory; repeated lookups do not spend quota.
- `/api/v1/qloo/*` is rate limited per client IP (`trustProxy` is on, so run the API behind a proxy that sets `X-Forwarded-For` and does not let clients forge it). These are integration routes; put authentication in front before public launch.
- The key travels only in the `X-Api-Key` header, is never logged, and never appears in a URL or response (covered by tests).

## Live smoke test

See "Live smoke-test findings" below. Run it yourself with a key in `apps/api/.env`:

```bash
pnpm --filter @worlds/api dev
curl -s "localhost:4000/api/v1/qloo/search?query=Avicii&limit=3"
curl -s "localhost:4000/api/v1/qloo/insights?entityId=<id from search>&targetType=place&limit=5"
```

### Live smoke-test findings

Run on 2026-10-21 against `https://hackathon.api.qloo.com` with a real key (never recorded here).
Names and affinity scores below are Qloo output, not Worlds.fm claims. Affinity is audience
overlap, not influence, history, or endorsement.

- **Auth:** `X-Api-Key` accepted on `/search` and `/v2/insights`.
- **Search:** Avicii, Fela Kuti, Rihanna and Bob Marley each returned HTTP 200 with resolution `exact`.
  Other results are collaborations or related artists (e.g. "Avicii & Nicky Romero", "Femi Kuti").
- **Insights, type `artist`:** 200 and populated for all four (e.g. Avicii: Swedish House Mafia 0.975).
- **Insights, type `brand`:** 200 for Avicii (Nike, Beats Electronics, Adidas).
- **Insights, type `destination`:** 200 for all four (Fela Kuti: Accra, Addis Ababa, Kampala, Lagos; Bob Marley: Port of Spain, Kingston, Negril).
- **Insights, type `place`:** 200 for all four, but quality varies. Avicii, Rihanna and Bob Marley gave plausible
  places; Fela Kuti's results (e.g. "Sony Music Entertainment", "Purgatory Creek") are not clearly meaningful.
  Treat `place` as low-confidence and do not map-pin it without independent verification.
- **Insights, type `podcast`:** 200 (Avicii returned sports podcasts, so cross-domain results can be tangential).
- **Insights, type `video_game`:** **400** from Qloo (surfaced as `qloo_request_rejected`).
  The Deep Dive spelling `videogame` was not tried; treat `video_game` as unsupported until confirmed.

Observed shapes that differ from the docs or are undocumented:

- `/search` entities use `types: ["urn:entity:artist"]` (no `type`), `tags[].tag_id`, and `properties.short_description`.
- `/v2/insights` entities use `type: "urn:entity"` plus `subtype`, `tags[].id`, and `query.affinity`.
- The adapter handles both shapes and a test covers the search shape.

## Known limitations

- `video_game` returned 400 live; `videogame` untested. `place` results can be weak for some artists.
- The cache is per process and in memory; it is lost on restart and not shared between instances.
- No Qloo tags, audiences or location signals are used yet; Insights is anchored on one entity.
- Routes are unauthenticated test endpoints.
