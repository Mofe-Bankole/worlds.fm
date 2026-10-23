# Cultural graph (B1.2)

**Status:** implemented and tested with mock fixtures only. No live Qloo call is made by the builder.
**Code:** contracts in `packages/shared/src/cultural-graph.ts`, builder in `apps/api/src/graph/cultural-graph-builder.ts`.
**Input:** the normalized B1.1 shapes (`QlooEntity`, `QlooInsightsResponse`), see [qloo-api.md](./qloo-api.md).

The builder is a pure function. It performs no I/O, so the same input and options always give the same graph. There is no route yet (see "Recommended B1.3").

## Contracts

`CulturalNode`

| Field | Meaning |
|---|---|
| `id` | `qloo:<lowercased Qloo UUID>`. Stable across requests. |
| `name`, `category` | `artist, book, brand, destination, movie, person, place, podcast, tv_show, video_game`, or `unknown`. |
| `provider`, `externalId` | Provider and its original ID, preserved exactly as received. |
| `description`, `popularity`, `tags` | Optional provider metadata. `popularity` is not an affinity. |
| `geo` | `null` unless independently verified with a cited source URL. The builder always sets `null`. |
| `image` | `{ url, provider: "qloo" }` from Qloo `properties.image.url`, accepted only as HTTPS on `images.qloo.com`; otherwise `null`. Illustrates the entity only, never evidence for a link. Qloo returned images for artists and brands but not destinations (observed live 2026-10-23). |
| `expansion` | `eligible`, `reason`, `targetCategories`. Only artists are eligible: that is what B1.1 confirmed live. |

`CulturalEdge`

| Field | Meaning |
|---|---|
| `id` | `<source id>\|<relationship>\|<target id>`. Stable across requests. |
| `source`, `target` | Node IDs. Direction runs from the root to the recommended entity. |
| `relationship` | `affinity_recommendation` (Qloo) or `related_to` (reserved). |
| `evidence` | `verified_fact`, `qloo_affinity`, `community_report`, `editorial_interpretation`. Only `qloo_affinity` is produced. |
| `provenance` | `provider`, `endpoint`, `mode: "live"`, `environment`, `retrievedAt`. |
| `affinity` | Qloo's original score, or `null` when missing. Never defaulted. |
| `references` | Source references. Empty for Qloo edges; no URLs are invented. |
| `label` | Human-readable meaning of the link. |

`CulturalGraph`: `rootId`, `nodes`, `edges`, `retrieval` (time, providers, limits, counts, `nodesByCategory`, `edgesByEvidence`), `warnings`, `limitations`.

The edge schema enforces the evidence rules: `qloo_affinity` edges must be Qloo `affinity_recommendation` links, a `verified_fact` needs at least one source reference, and only `qloo_affinity` edges may carry a score.

## Transformation rules

1. The root entity must be valid. Otherwise the builder throws.
2. Each Insights result is validated again. Unreadable entities are skipped with `invalid_entity_skipped`.
3. The category comes from the entity's own Qloo type (`urn:entity:artist` becomes `artist`). Anything unrecognized or missing becomes `unknown`, which is never expansion-eligible.
4. Nodes are deduplicated by provider-namespaced ID (case-insensitive), never by name. Two entities with the same name stay separate.
5. Edges are deduplicated by ID. When a link repeats, the one that sorts first is kept (higher score).
6. If Qloo returns the root among its own results, it is skipped (`self_reference_skipped`).
7. Order is affinity descending (missing scores last), then name, then node ID. Input order does not matter. The root node is always first.
8. Limits: `maxPerCategory` (default 10) is applied first, then `maxNodes` (default 25, includes the root). Omissions produce `category_truncated` or `graph_truncated`.
9. No coordinates, references or non-Qloo evidence kinds are ever created.

Warning codes: `no_affinity_results`, `missing_affinity`, `invalid_entity_skipped`, `self_reference_skipped`, `category_truncated`, `graph_truncated`.

## For the frontend

- Any node with `expansion.eligible` can be the root of a later request.
- Filter with `node.category` and `edge.evidence`. Neighbors of a node are the edges where it is `source` or `target`.
- Use `limits` and the bounded options for progressive discovery.
- The graph holds no layout, coordinates or animation data. Those belong to the frontend.

## Provenance and meaning

Every Qloo link means only: audiences who like the root also show cultural affinity for the target. It is not verified history, influence, collaboration, endorsement or causation. A score ranks items for a population; it is not an individual's preference probability. Place and destination links are recommendations, not verified locations, so the builder never creates map pins from them.

## Example (ILLUSTRATIVE FIXTURE, not live data)

IDs and names other than "Avicii" are made up, and the third link shows a missing score. It was produced by the builder from mock input. Real Qloo output must not be committed to a public repository.

```json
{
  "rootId": "qloo:00000000-0000-4000-8000-0000000000a1",
  "nodes": [
    { "id": "qloo:00000000-0000-4000-8000-0000000000a1", "name": "Avicii", "category": "artist", "provider": "qloo",
      "externalId": "00000000-0000-4000-8000-0000000000a1", "geo": null, "expansion": { "eligible": true } },
    { "id": "qloo:00000000-0000-4000-8000-0000000000a2", "name": "Example Artist", "category": "artist", "geo": null, "expansion": { "eligible": true } },
    { "id": "qloo:00000000-0000-4000-8000-0000000000a3", "name": "Example Brand", "category": "brand", "geo": null, "expansion": { "eligible": false } },
    { "id": "qloo:00000000-0000-4000-8000-0000000000a4", "name": "Example Destination", "category": "destination", "geo": null, "expansion": { "eligible": false } }
  ],
  "edges": [
    { "id": "qloo:…a1|affinity_recommendation|qloo:…a2", "source": "qloo:…a1", "target": "qloo:…a2",
      "relationship": "affinity_recommendation", "evidence": "qloo_affinity", "affinity": 0.9, "references": [],
      "provenance": { "provider": "qloo", "endpoint": "/v2/insights", "mode": "live", "environment": "hackathon", "retrievedAt": "2026-10-22T10:00:00.000Z" },
      "label": "Qloo cultural affinity: audiences of Avicii also show affinity for Example Artist." },
    { "id": "qloo:…a1|affinity_recommendation|qloo:…a3", "affinity": 0.8, "evidence": "qloo_affinity",
      "label": "Qloo cultural affinity: audiences of Avicii also show affinity for Example Brand." },
    { "id": "qloo:…a1|affinity_recommendation|qloo:…a4", "affinity": null, "evidence": "qloo_affinity",
      "label": "Qloo cultural affinity: audiences of Avicii also show affinity for Example Destination. A recommendation, not a verified location." }
  ],
  "retrieval": { "providers": ["qloo"], "limits": { "maxNodes": 25, "maxPerCategory": 10 }, "nodeCount": 4, "edgeCount": 3,
    "nodesByCategory": { "artist": 2, "brand": 1, "destination": 1 }, "edgesByEvidence": { "qloo_affinity": 3 } },
  "warnings": [{ "code": "missing_affinity", "message": "1 link has no Qloo affinity score; none was invented." }]
}
```

The example is abridged: `…` stands for the shared ID prefix, and some fields (`description`, `popularity`, `tags`, repeated provenance, `limitations`) are omitted for length.

## Limitations

- Only Qloo affinity is transformed. `verified_fact`, `community_report` and `editorial_interpretation` are contract-only until verified-source adapters exist.
- The graph is one hop: root to recommended entities. Multi-hop paths come from repeated expansion requests.
- Expansion eligibility is limited to artists. Other categories as Insights signals are untested.
- Node `popularity` is provider data, not a Worlds.fm score.
- `place` results were weak for some artists in the B1.1 smoke test.

## Recommended B1.3

`GET /api/v1/graph/artist?query=<name>` (or `?entityId=<uuid>`): resolve the artist with the B1.1 search (return the `ambiguous`/`fuzzy` candidates instead of guessing), call Insights for `artist`, `brand` and `destination` with small limits, run `buildCulturalGraph`, and validate the response with `culturalGraphSchema`. Rate limit it with the Qloo limiter, cache per entity, and return partial graphs with warnings when one Insights type fails.
