# Music catalogue API

Discographies, track lists and track stories for the explorer's **Discography** section.

| Source | Role | Licence / terms |
|---|---|---|
| MusicBrainz ws/2 | Source of truth: artist identity, release types (Album, EP, Single), track lists, credits, samples, other versions | CC0 data; 1 request/second, identifying User-Agent |
| Spotify Web API (Client Credentials) | Cover art, album/track/artist links, explicit flags | Covers shown unaltered and linked back to Spotify; no user data |
| Cover Art Archive | Fallback covers when Spotify has no match | Linked back to the MusicBrainz release group |
| Wikidata | Awards and nominations for the song (work) | CC0 |
| English Wikipedia | Page summary for the song, quoted as published | CC BY-SA 4.0, cited with the licence |

Nothing is generated or inferred. An empty source shows as empty.

## Configuration

`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (API-only, see `.env.example`). Leave them blank and the API still returns MusicBrainz data with Cover Art Archive covers (`spotifyStatus: "not_configured"`). `MUSIC_RATE_LIMIT_PER_MINUTE` (default 30) caps each client.

All MusicBrainz callers (media resolver and music catalogue) share one throttled HTTP client, so the 1 request/second limit holds for the whole process. Answers are cached in memory with the `MEDIA_CACHE_*` settings.

## Endpoints

### `GET /api/v1/music/discography?name=<artist>` or `?mbid=<uuid>`

- Finds MusicBrainz artists whose name matches exactly. Two exact matches with the same score return `status: "ambiguous"` with `candidates`; the client then asks again with `mbid`.
- No exact match returns **404** with `status: "not_found"`.
- Release groups are browsed with `release-group-status=website-default`, which drops groups that only have bootleg releases (as musicbrainz.org does).
- Live, compilation, remix and other secondary types are left out; Soundtrack and Mixtape/Street are kept and labelled.
- Spotify is consulted only through the Spotify artist link MusicBrainz holds. Albums are matched by title (after removing edition, guest and tie-in labels such as "Deluxe Edition" or "feat. X") within one year of the MusicBrainz date. A Spotify failure returns `spotifyStatus: "unavailable"` and keeps the MusicBrainz list.

### `GET /api/v1/music/releases/:id/tracks?spotifyAlbumId=<id>`

`:id` is a MusicBrainz release-group ID. The API picks one official release (prefers digital, worldwide, and the same track count as the Spotify album) and returns its tracks with disc, printed number, duration, credit, featured artists, ISRC and recording MBID. `spotifyAlbumId` is used only if the Spotify album's title matches the release group; tracks are matched by disc, position and title.

### `GET /api/v1/music/recordings/:mbid/story`

Credits (written, produced, performed, mixed, engineered by), `samples`, `sampledBy`, `otherVersions` (same work, other artists, up to 8), and `facts`: the Wikipedia summary (with licence) and Wikidata awards/nominations. Wikimedia failures return empty `facts`.

## Errors

Stable envelope `{ error: { code, message, requestId } }`:

| Status | Code | When |
|---|---|---|
| 400 | `invalid_query` / `invalid_params` | Bad name, MBID or Spotify ID, or unknown query keys |
| 404 | `release_not_found` / `recording_not_found` | MusicBrainz has no such entity |
| 429 | `rate_limited` | Per-client cap reached |
| 429 | `music_rate_limited` | MusicBrainz asked us to slow down |
| 502 | `music_unavailable` / `music_invalid_response` | MusicBrainz down or unreadable |
| 504 | `music_timeout` | MusicBrainz did not answer in time |

## Spotify Development Mode limits (checked 2026-10-23)

- `GET /artists/{id}/albums` rejects `limit` above 10, so the adapter reads up to 10 pages of 10 in parallel after the first.
- Batch endpoints (`GET /albums`, `/tracks`, `/artists`), top tracks and new releases are unavailable; they are not used.
- Spotify does not list many older singles, so those keep Cover Art Archive covers.

## Tests

`apps/api/test/music.test.ts` uses invented, network-free fixtures and checks typing, Spotify joins, token reuse, degraded modes, error mapping and that credentials never appear in responses. `apps/web/test/music.test.ts` covers the browser client and formatting.
