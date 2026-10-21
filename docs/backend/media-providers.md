# Media providers — TheAudioDB, Fanart.tv, MusicBrainz, Cover Art Archive

Phase 0 music metadata and image discovery. Adapters live under
`apps/api/src/integrations/<provider>/`; each one isolates its provider's
payload shape and returns normalized `@worlds/shared` contracts.

## Provider matrix

| Provider | Used for | Auth | Rate policy | Adapter |
|---|---|---|---|---|
| TheAudioDB (v1) | artist search/identity, artist images, album search, album art fallback | key in URL path; documented free dev key `123` | 30 requests/min (free), 429 on breach | `integrations/theaudiodb/` |
| Fanart.tv (v3.2) | artist images by MusicBrainz ID | `?api_key=` query param from `FANART_API_KEY` | no published hard limit; be conservative | `integrations/fanart/` |
| MusicBrainz (ws/2) | artist + release-group identity (source of truth for MBIDs) | identifying `User-Agent` required | 1 request/second (enforced via `MUSICBRAINZ_MIN_INTERVAL_MS`) | `integrations/musicbrainz/` |
| Cover Art Archive | album front covers by release/release-group MBID | none (UA sent anyway) | archive.org-backed; be polite | `integrations/coverartarchive/` |

## Endpoint reference (as implemented)

- TheAudioDB base: `https://www.theaudiodb.com/api/v1/json/{key}`
  - `search.php?s={name}` — artist search (returned records already include all image fields, so no second request is needed for images)
  - `artist-mb.php?i={mbid}` — artist lookup by MusicBrainz ID
  - `searchalbum.php?s={artist}&a={title}` — album search (exact artist+title verified client-side)
  - `album-mb.php?i={releaseGroupMbid}` — album lookup by MB release-group ID
  - Preview derivatives exist at `{imageUrl}/small|/medium` (documented in their API page)
- Fanart: `GET https://webservice.fanart.tv/v3.2/music/{artist-mbid}?api_key={key}`
  - 401 responses with `{"error": "invalid API key"}` for bad credentials, `{"error": "missing api_key..."}` when absent — both handled without retrying
  - 404 when an MBID has no artwork on file → treated as a definitive negative
  - Artist fields consumed: `artistthumb`, `artistbackground`, `hdmusiclogo`, `musiclogo`, `musicbanner`
- MusicBrainz base: `https://musicbrainz.org/ws/2` (`&fmt=json`)
  - `artist/?query=artist:"{name}"` / `artist/{mbid}` / `release-group/?query=releasegroup:"{title}" AND arid:{artist-mbid}` (falls back to `artist:"{name}"`)
- Cover Art Archive: `GET https://coverartarchive.org/release/{mbid}` and `/release-group/{mbid}`
  - Only `front: true` images are taken in Phase 0 (see rights notes below)
  - The API frequently 307-redirects to `archive.org/download/mbid-*/index.json`; the HTTP client follows redirects

## Environment configuration

All names are in `.env.example` at the repo root. Never commit real values.

| Variable | Default | Purpose |
|---|---|---|
| `THEAUDIODB_API_KEY` | `123` (documented free key) | TheAudioDB v1 key |
| `FANART_API_KEY` | unset → adapter disabled | Fanart.tv personal key |
| `MEDIA_USER_AGENT` | `worlds-fm/0.1 (+https://worlds.fm)` | UA for all providers (MusicBrainz requirement) |
| `MEDIA_ARTIST_PROVIDER_ORDER` | `theaudiodb,fanart` | Artist image discovery order |
| `MEDIA_ALBUM_PROVIDER_ORDER` | `coverartarchive,theaudiodb` | Album art discovery order |
| `MEDIA_HTTP_TIMEOUT_MS` | `8000` | Per-request timeout |
| `MEDIA_HTTP_RETRIES` | `2` | Conservative retries (network, 5xx, timeouts, 429) |
| `MEDIA_HTTP_RETRY_BASE_MS` | `300` | Backoff base (2× per attempt + jitter) |
| `MUSICBRAINZ_MIN_INTERVAL_MS` | `1100` | MusicBrainz politeness throttle |
| `MEDIA_CACHE_TTL_MS` | `86400000` | Positive cache TTL |
| `MEDIA_NEGATIVE_CACHE_TTL_MS` | `300000` | Miss/partial-failure TTL |
| `MEDIA_CACHE_MAX_ENTRIES` | `1000` | Cache bound |

`FANART_API_KEY` empty or unset **disables the adapter gracefully** — requests then report
`{"provider": "fanart", "status": "disabled"}`; nothing crashes.

## Identity & matching strategy

Ambiguity must surface, never be guessed away:

1. **Artist**: exact normalized-name match against TheAudioDB results (name or documented
   alternate). One exact match resolves; several with distinct MusicBrainz IDs → `ambiguous`
   with candidate `matches`. Zero → exact-match MusicBrainz artist search as backstop.
2. **Album**: the artist's MusicBrainz ID is resolved first (TheAudioDB exact artist match,
   then MusicBrainz). Release-group search then uses the alias-proof `arid:{mbid}` filter —
   this finds albums credited to aliases (verified live: “Zombie” is credited to “Fẹla”,
   which a name-only search misses). If the `arid` search yields nothing, a name-based search
   retries (covers RGs credited to a band entity when the artist resolved to the person).
3. **Duplicate release groups**: among exact title+artist matches, `primary-type: Album` is
   preferred; remaining duplicates resolve to the earliest `first-release-date` (original
   over reissue). A tie is reported as `ambiguous` — never silently picked.
4. Partial matches are always rejected (`"Fela Kuti"` ≠ `"Fela Kuti & Egypt 80"`).

## Normalization & provenance

Every image becomes a `MediaImageCandidate` (`packages/shared/src/media.ts`):

- `provider` + `sourcePageUrl`: TheAudioDB artist/album page, `fanart.tv/artist/{mbid}`,
  or the `musicbrainz.org/release(-group)/{mbid}` page.
- IDs kept distinct: `artistMbid`, `releaseMbid`, `releaseGroupMbid` are never conflated
  (release vs release-group art is queried separately).
- `width`/`height`: `null` in Phase 0 — none of these APIs return per-image dimensions.
- `attribution`: provider community string (e.g. “Fanart.tv community (fanart.tv)”).

## Copyright and usage-rights limitations

**None of these providers return machine-readable license evidence.** Artist photos and
album covers are typically label/photographer copyright; fanart/TheAudioDB content is
community-contributed fan art. Therefore:

- Every candidate normalizes as `rightsStatus: "unverified"`. Nothing is auto-`cleared`.
- `approvedImages` is empty in Phase 0 by design; clients must render the `fallback`
  placeholder guidance (`reason: rights_unverified` / `no_images` / `unresolved` / `ambiguous`).
- Cover Art Archive responses additionally limit Phase 0 to `front` images only —
  booklet/back scans add rights surface without product value.
- Promotion to `cleared` requires an explicit rights review workflow (Phase 1+).

## Reliability behavior

- In-memory TTL cache per provider (positive + negative entries) and a resolution-level
  cache; healthy results use the long TTL, misses and partially-failed results the short one.
- Authoritative misses (provider answered, nothing matched) are negative-cached;
  miss-when-every-provider-failed is **not** cached and reports `providers_unavailable`.
- HTTP 429 honors `Retry-After` (capped at 10s), then uses bounded exponential backoff.
- HTTP 401/403/404 never retry. MusicBrainz requests serialize at ~1/second.

## Useful links

- https://www.theaudiodb.com/free_music_api
- https://api.fanart.tv/
- https://musicbrainz.org/doc/MusicBrainz_API
- https://musicbrainz.org/doc/Cover_Art_Archive/API
