# Media API — reference

Fastify backend (`apps/api`). Schemas are the source of truth in
`packages/shared/src/media.ts`; responses are validated against them before sending.

## Running locally

```bash
pnpm install
# Copy the "apps/api" section of .env.example into apps/api/.env
# (only FANART_API_KEY needs a real value; everything else has safe defaults)
pnpm --filter @worlds/api dev     # tsx watch, loads apps/api/.env, defaults to :4000
```

Tests / checks: `pnpm --filter @worlds/api test` (vitest, no network),
`typecheck`, `lint`, `build` (tsup → `dist/`), `start` (runs `dist/server.js`).

## Endpoints

### `GET /health`

`{"status":"ok","service":"worlds-api"}` — no secrets, no providers.

### `GET /api/v1/media/artist?name=Fela%20Kuti[&mbid=<uuid>]`

Artist image discovery. `mbid` (verified MusicBrainz artist ID) skips name
matching entirely.

### `GET /api/v1/media/album?artist=Rihanna&title=ANTI[&artistMbid=<uuid>][&releaseMbid=<uuid>][&releaseGroupMbid=<uuid>]`

Album cover discovery. Supplying `releaseMbid` and/or `releaseGroupMbid`
skips identity search and queries Cover Art Archive directly.

## Response shape (shared contract)

```jsonc
{
  "subjectType": "album",
  "query": { "artist": "Rihanna", "title": "ANTI", "artistMbid": null, "releaseMbid": null, "releaseGroupMbid": null },
  "status": "resolved",                    // resolved | ambiguous | not_found
  "album": {
    "title": "ANTI", "artistName": "Rihanna",
    "artistMbid": "73e5e69d-3554-40d8-8516-00cb38737a1c",
    "releaseMbid": null,
    "releaseGroupMbid": "0c482acd-35a2-466b-b833-ef5f2f1297d4",
    "theAudioDbAlbumId": "2257888"
  },
  "matches": [],                           // populated only when ambiguous
  "candidates": [                          // EXPLORATORY: never display unchecked
    {
      "url": "https://coverartarchive.org/release/b8fdf8b5-…/32325572219.jpg",
      "provider": "coverartarchive",
      "sourcePageUrl": "https://musicbrainz.org/release-group/0c482acd-…",
      "artistName": "Rihanna", "albumTitle": "Anti",
      "artistMbid": "73e5e69d-…", "releaseMbid": null, "releaseGroupMbid": "0c482acd-…",
      "imageType": "album", "width": null, "height": null,
      "attribution": "Cover Art Archive / MusicBrainz community",
      "copyrightHolder": null, "licenseUrl": null,
      "rightsStatus": "unverified"
    }
  ],
  "approvedImages": [],                    // rights-cleared only (Phase 0: empty)
  "fallback": { "reason": "rights_unverified", "message": "…render a neutral placeholder…" },
  "providers": [
    { "provider": "musicbrainz", "status": "ok", "detail": "release-group search by MusicBrainz artist ID" },
    { "provider": "coverartarchive", "status": "ok", "detail": "1 front image(s)" },
    { "provider": "theaudiodb", "status": "ok" }
  ],
  "cached": false,
  "generatedAt": "2026-10-20T00:40:12.006Z"
}
```

Status semantics:

| `status` | Meaning | Client behavior |
|---|---|---|
| `resolved` | Exactly one confident identity match | Use identity + read `fallback` for display guidance |
| `ambiguous` | Several same-name matches | Offer `matches`; ask for a refinement or explicit MBID |
| `not_found` | No verified match (or providers unavailable) | Neutral placeholder; see `fallback.reason` |

`fallback.reason`: `unresolved` · `providers_unavailable` · `ambiguous` · `no_images` ·
`rights_unverified`. `approvedImages` only ever contains `rightsStatus: "cleared"` assets;
render `fallback` guidance whenever it is empty. **`candidates` must not be made publicly
visible without a rights decision.**

Provider reports: `ok` · `no_results` · `error` (see `detail`) · `skipped`
(precondition missing, e.g. no MBID for fanart) · `disabled` (e.g. no `FANART_API_KEY`).

## Errors

Stable envelope, never leaking keys/stacks:

```json
{ "error": { "code": "invalid_query", "message": "name: Too small: expected string to have >=2 characters", "requestId": "req-7" } }
```

`400 invalid_query` — validation failed (length limits: artist/name ≤ 120 chars,
title ≤ 200, MBIDs must be UUIDs, unknown query keys rejected).
`404 not_found` — unknown route. `500 internal_error` — unexpected.

## Example curls (verified live, 2026-10-20)

```bash
curl "http://localhost:4000/health"
curl "http://localhost:4000/api/v1/media/artist?name=Fela%20Kuti"
curl "http://localhost:4000/api/v1/media/artist?name=Fela%20Kuti&mbid=6514cffa-fbe0-4965-ad88-e998ead8a82a"
curl "http://localhost:4000/api/v1/media/album?artist=Rihanna&title=ANTI"
curl "http://localhost:4000/api/v1/media/album?artist=Bob%20Marley%20%26%20The%20Wailers&title=Exodus"
curl "http://localhost:4000/api/v1/media/album?artist=Avicii&title=True&releaseGroupMbid=61180839-f4a7-407f-b86f-24c48eef4066"
```

Live spot-checks: Fela Kuti, Bob Marley, Rihanna, Avicii all `resolved` with
TheAudioDB imagery + MusicBrainz IDs (fanart `disabled` without a key). Albums
Zombie/Exodus/ANTI/True resolve to their canonical MusicBrainz release groups
with Cover Art Archive fronts; callers can re-request immediately and get
`cached: true`. Header `Cache-Control: public, max-age=300` is sent on success.
