# Shareable World links

Users share a **World** (an artist's cultural graph) and individual **artists**
inside it. This document records the URL contract, what a link contains, and how
link previews are produced.

## The URL contract

```text
/explore?q=<artist name>
```

A World is addressed by artist name in a **query parameter**, not a path
segment. Artist names are arbitrary, and a few contain characters that do not
survive a path segment: an encoded `/` in `AC/DC` is rejected or rewritten by
many servers and proxies. The query form round-trips every name the API can
return, and `apps/web/test/share.test.ts` asserts that for names including
`AC/DC`, `$uicideboy$`, `Sunn O)))`, `100% Pure` and non-Latin scripts.

The name is normalized before encoding: trimmed, internal whitespace collapsed,
control characters removed, and capped at the 100-character search limit. So
`"  Tame   Impala "` and `"Tame Impala"` produce the same link.

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

`components/share/share-control.tsx` renders the controls and appears in two
places:

- **World card** (`RootCard`) — shares the resolved artist name, so a link
  reopens this same world rather than the raw search text.
- **Artist node card** (`NodeCard`) — shares that artist's world. Only artists
  get a control, because only artists have a World to open; a brand or
  destination node has no world of its own.

Behaviour:

- **Copy link** always works. The URL is built on demand from the name.
- **Share…** is offered only where `navigator.share` exists (mobile and some
  desktop browsers). Capability is read through `useSyncExternalStore`, so the
  server and first client render agree and there is no hydration mismatch.
- **Fallback.** If the clipboard is unavailable (an insecure origin, or a denied
  permission) the link is revealed in a labelled, focused, read-only field
  instead of failing silently.
- Dismissing the OS share sheet is treated as a normal outcome, not an error.

## Link previews

Sharing a link into a chat app unfurls a card naming the artist.

| Piece | Where |
|---|---|
| Title, description, canonical URL | `generateMetadata` in `app/explore/page.tsx` |
| Preview image | `app/og/world?name=<artist>` |
| Site-wide default card | `/og/world` with no name |
| `metadataBase` | `app/layout.tsx`, from `lib/site.ts` |

The image is a **route handler**, not the `opengraph-image` convention: the
World lives at `/explore?q=`, so the name is a query parameter and there is no
path segment for the convention to key on. The convention would need a duplicate
`/world/[name]` route purely to satisfy the file layout.

`/og/world` is a presentation asset, not a domain API. It reads the name from
the URL, calls no provider and touches no database, so the API contract is
untouched and it is served from `apps/web` like any other image. It is
deterministic for a given name, so it caches (`max-age=3600, s-maxage=86400`).

**The card states nothing about the artist.** It draws the name, "Cultural
world", and "Every link shows what it is based on." No affinity, genre or fact
is rendered, because the card cannot verify anything: it is drawn from a URL
parameter before any provider is consulted. Verification and labelling happen on
the page the link opens (AGENTS.md §5). `worldDescription()` is tested to make no
claim of endorsement, inspiration, influence or causation.

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
have no unique content of their own until a visitor arrives.

`app/robots.ts` allows everything except `/design`, which is a development
reference page.

## Tests

`apps/web/test/share.test.ts` and `apps/web/test/site.test.ts` cover
normalization, encoding round-trips, the single-key property, origin precedence
and the host fallback, the share payload, card helpers, and that the description
makes no unsupported claim. They are pure functions with no network access.

Verified manually in a browser against the production build: the controls render
and copy, the fallback field appears when the clipboard is unavailable, an
artist node produces an encoded name (`Melody%27s+Echo+Chamber`), and opening a
shared link restores that artist's world with the matching title and canonical
URL.

## Not included

- **No share buttons on the landing carousel.** That surface is marketing; the
  carousel's "Explore this world" already leads to the world, where sharing
  lives. Add it there if the carousel becomes a primary browsing surface.
- **No per-node permalinks** (for example sharing a specific brand node). The
  explorer has no selection-in-URL state yet; adding it means `?q=` plus a node
  identifier, and it should wait until the graph's node IDs are stable public
  identifiers.
- **No server-side share records, counters or analytics.** Sharing is a link,
  not a tracked event.
