# Shareable links

Users share a **World** (an artist's cultural graph), individual **artists**
inside it, and individual **songs**. This document records the URL contract,
what a link contains, and how link previews are produced.

## The URL contract

```text
/explore?q=<artist name>     an artist's World
/song/<recording MBID>       one song
```

A World is addressed by artist name in a **query parameter**, not a path
segment. Artist names are arbitrary, and a few contain characters that do not
survive a path segment: an encoded `/` in `AC/DC` is rejected or rewritten by
many servers and proxies. The query form round-trips every name the API can
return, and `apps/web/test/share.test.ts` asserts that for names including
`AC/DC`, `$uicideboy$`, `Sunn O)))`, `100% Pure` and non-Latin scripts.

A song is addressed by **MusicBrainz recording ID in a path segment**. An ID is
a UUID, so it needs neither encoding nor normalization, and the path form is
what makes it a plain, permanent address. The two destinations therefore use the
form each one actually needs rather than forcing one shape onto both.

The artist name is normalized before encoding: trimmed, internal whitespace
collapsed, control characters removed, and capped at the 100-character search
limit. So `"  Tame   Impala "` and `"Tame Impala"` produce the same link. An ID
is validated instead: `isSongId()` accepts only a well-formed UUID, and anything
else is a 404 rather than a lookup.

All link building goes through `apps/web/src/lib/share.ts`. The featured-world
carousel uses `worldPath()` too, so carousel links and share links cannot drift
apart.

## What a link contains

Only the artist name. `worldPath()` takes a name and nothing else, and a test
asserts the produced query string has exactly one key, `q`.

There are no accounts or profiles yet, so a shared link cannot leak personal
data even by accident. When profiles and saved journeys arrive, keep this
property: a share link must not be able to encode anything the visitor did not
explicitly choose to share (AGENTS.md §7, "opt-in social").

## Sharing from the interface

`components/share/share-control.tsx` renders the controls. It takes a `subject`
(for labels) and a `buildTarget(origin)` function, so one component serves every
destination without knowing which one it is. It appears in four places:

- **World card** (`RootCard`) — shares the resolved artist name, so a link
  reopens this same world rather than the raw search text.
- **Artist node card** (`NodeCard`) — shares that artist's world. Only artists
  get a control, because only artists have a World to open; a brand or
  destination node has no world of its own.
- **Track story panel**, inside the explorer — shares the song being described.
- **Song page header** — shares the page it is on.

Behaviour:

- **Copy link** always works. The URL is built on demand from the origin and the
  subject, so nothing about the visitor or the deployment is baked in.
- **Share…** is offered only where `navigator.share` exists (mobile and some
  desktop browsers). Capability is read through `useSyncExternalStore`, so the
  server and first client render agree and there is no hydration mismatch.
- **Fallback.** If the clipboard is unavailable (an insecure origin, or a denied
  permission) the link is revealed in a labelled, focused, read-only field
  instead of failing silently.
- Dismissing the OS share sheet is treated as a normal outcome, not an error.

## Song pages

`app/song/[mbid]/page.tsx` renders one song. It reuses the endpoint the explorer
already had (`GET /api/v1/music/recordings/:id/story`), so there is no second
source of truth and no new contract: the page is a new address for existing
data, not a new API.

- **Rendered on the server.** The title, credits, samples and sources are in the
  first HTML response, because a shared link is often the first thing anyone
  sees. `SongView` adds only the interactive parts.
- **Read once per request.** `generateMetadata` and the page both need the
  story, so the lookup is wrapped in React's `cache()`. Without it each one pays
  for a cold MusicBrainz lookup, and a slow one leaves the page titled "A song"
  while the body renders the real title. Measured: a cold page render now costs
  about one lookup (3.0-3.4s), not two.
- **Bounded.** A cold story costs several MusicBrainz requests, which are
  throttled to one a second (measured 2.6-4.5s). The lookup is bounded at 10s, so
  a hung catalogue cannot hold the page open.
- **Two different failures.** `recording_not_found` from the API is a real 404,
  because the recording does not exist. A timeout, rate limit or provider
  failure renders a labelled "not available right now" state with a retry and a
  MusicBrainz link, because the ID may still be perfectly good. Neither case
  invents a title, and both are marked `robots: { index: false }` so a transient
  failure is not indexed.
- **Reachable from the explorer.** Every track title in a release is a link to
  its song page, and the story panel links to it as well. Without that the pages
  would exist but nothing would point at them.

## Link previews

Sharing a link into a chat app unfurls a card naming the artist or the song.

| Piece | Where |
|---|---|
| Title, description, canonical URL | `generateMetadata` in `app/explore/page.tsx` and `app/song/[mbid]/page.tsx` |
| Preview image, World | `app/og/world?name=<artist>` |
| Preview image, song | `app/og/song?title=<title>&artist=<artist>` |
| Site-wide default card | `/og/world` with no name |
| `metadataBase` | `app/layout.tsx`, from `lib/site.ts` |

Both cards are drawn by one component, `components/og/share-card.tsx`, so the
two destinations cannot drift apart visually. The World card is a **route
handler**, not the `opengraph-image` convention: the World lives at
`/explore?q=`, so the name is a query parameter and there is no path segment for
the convention to key on. The convention would need a duplicate `/world/[name]`
route purely to satisfy the file layout.

`/og/world` and `/og/song` are presentation assets, not a domain API. They read
their text from the URL, call no provider and touch no database, so the API
contract is untouched and they are served from `apps/web` like any other image.
They are deterministic for given text, so they cache (`max-age=3600,
s-maxage=86400`). Both accept empty parameters and still produce the site card,
so a malformed URL never renders a broken preview.

**The cards state nothing about the artist or the song.** The World card draws
the name, "Cultural world", and "Every link shows what it is based on." The song
card draws the title and artist and "Every fact cites its source." No affinity,
genre or fact is rendered, because a card cannot verify anything: it is drawn
from URL parameters before any provider is consulted. Verification and
labelling happen on the page the link opens (AGENTS.md §5).
`worldDescription()` and `songDescription()` are tested to make no claim of
endorsement, inspiration, influence or causation.

## Origins

Two different needs, two functions in `apps/web/src/lib/site.ts` and `share.ts`:

- **Share links in the browser** use `window.location.origin`
  (`resolveShareOrigin`), which is always correct for the deployment being
  viewed.
- **Canonical tags and OG image URLs** are rendered on the server
  (`siteUrlFromRequest`). Precedence: `NEXT_PUBLIC_SITE_URL`, then
  `VERCEL_PROJECT_PRODUCTION_URL`, then the request's own host, then a localhost
  default. Using the request host means a canonical tag never claims localhost
  on a real deployment.
- **Sitemap and robots** (`siteUrl`) cannot read request headers, so they use the
  build-time value only.

Set `NEXT_PUBLIC_SITE_URL` to the real domain (for example `https://worlds.fm`)
so a link copied from a preview deployment still points at the canonical site. A
preview URL is often behind deployment protection, and its origin may not be in
the API's `CORS_ALLOWED_ORIGIN`. This variable is public: it is inlined into the
browser bundle, so it must never hold a secret. See `.env.example`.

## Crawling

`app/sitemap.ts` lists the home page and the ten featured Worlds. Arbitrary
`/explore?q=` URLs are deliberately excluded: they are generated on demand and
have no unique content of their own until a visitor arrives. Song pages are
excluded for a different reason: there is no list of recording IDs to enumerate
from, and guessing them would mean inventing URLs. Add them if the catalogue
ever gains an index of its own.

`app/robots.ts` allows everything except `/design`, which is a development
reference page.

## Tests

`apps/web/test/share.test.ts` and `apps/web/test/site.test.ts` cover
normalization, encoding round-trips, the single-key property, song ID
validation and path building, both share payloads, origin precedence and the
host fallback, card helpers, and that neither description makes an unsupported
claim. They are pure functions with no network access.

Verified manually in a browser against the running app:

- The controls render and copy, and each one copies the right URL: the World
  card `http://localhost:3000/explore?q=Tame+Impala`, an artist node card
  `.../explore?q=Mac+DeMarco`, and the track story panel
  `.../song/b85f7f6d-813a-4ebc-8a1d-5998ab02be9a`.
- The fallback field appears when the clipboard is unavailable, and an artist
  node produces an encoded name (`Melody%27s+Echo+Chamber`).
- Opening a shared World link restores that artist's world with the matching
  title and canonical URL.
- A song page renders its title, credits, samples and sources in the server
  HTML; its `<title>`, canonical URL and `/og/song` image all name the song and
  artist. `/og/song` returns a real 1200×630 PNG with and without parameters.
- An unknown-but-valid ID is a 404; a malformed ID never reaches the API.
- The explorer's track titles link to song pages (13 of 13 on Currents), and the
  story panel's "Open this song's page" navigates there.
- No horizontal overflow at 390px, including with a story panel open and with a
  deliberately over-long title.

## Not included

- **No share buttons on the landing carousel.** That surface is marketing; the
  carousel's "Explore this world" already leads to the world, where sharing
  lives. Add it there if the carousel becomes a primary browsing surface.
- **No per-node permalinks** (for example sharing a specific brand node). The
  explorer has no selection-in-URL state yet; adding it means `?q=` plus a node
  identifier, and it should wait until the graph's node IDs are stable public
  identifiers. Songs are a different case: they already have a stable public
  identifier from MusicBrainz, which is why they have pages and nodes do not.
- **No song index, browse or search.** A song page is reachable from its album
  and from a shared link. A song-first browse experience is a product decision,
  not a URL one.
- **No server-side share records, counters or analytics.** Sharing is a link,
  not a tracked event.
