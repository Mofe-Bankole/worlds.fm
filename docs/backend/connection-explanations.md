# Connection explanations

Every link in a cultural graph states **what it is based on**, and which rung of
a strength ladder that basis sits on. The product claim this serves: a reader
can always tell a documented relationship from a shared trait from a bare
audience overlap, and a link is never described more weakly than it can be.

The API computes this once, in `apps/api/src/graph/connection-explanation.ts`,
and ships it on each edge as `basis`. The web app renders it and never derives
its own explanation.

## The ladder

Tried strongest first; the first rung with evidence wins.

| Rung | Meaning | Reached from Qloo? |
|---|---|---|
| `documented` | A cited source states the relationship. Requires `references`. | **No** — see below |
| `provider_attribute` | The provider states a relationship between the two, such as one listing the other among its influences, collaborators or labels. | Yes |
| `shared_attribute` | The two share a trait recorded for both: a genre, a theme, or an audience description. The sources that recorded it are named on the edge. | Yes, and with MusicBrainz for genres |
| `audience_overlap` | Nothing but the affinity score. | Yes |

`documented` is deliberately unreachable from a Qloo response. Qloo output is a
recommendation signal, and promoting it to a documented fact is what AGENTS.md
§5 and §6 forbid. The resolver accepts a citation from its caller, so a
verified-source adapter (MusicBrainz artist relations, Wikidata statements) can
reach that rung without the Qloo path ever touching it. The shared contract
enforces this: a `documented` basis with no `references` fails validation.

## What the provider supplies

Qloo's `properties` and typed tags carry the traits the middle two rungs need.
The adapter keeps a bounded, de-duplicated subset on each entity
(`attributes`): `genres`, `themes`, `audienceTraits`, `influences`,
`collaborators`, `brands`, `origin`, `foundedYear`. Provider order is preserved,
because Qloo lists values most- to least-characteristic, and each list is capped
at six so one node cannot bloat a graph response.

Statements attribute these to Qloo rather than asserting them as history:
"Qloo lists Tame Impala among Pond's collaborators", not "Tame Impala
collaborated with Pond".

## Where the root's genres come from

The root entity comes from `GET /search`, which returns a much smaller
`properties` object than `GET /v2/insights`. Measured live on 2026-10-24:

| Endpoint | `properties` keys | `primary_genres` |
|---|---|---|
| `/search` | 5 | absent |
| `/v2/insights` | 29–33 | present |

So the root artist has no genres of its own, and a shared-**genre** statement
between the root and a node could never be produced. Shared **audience** traits
still worked, because `/search` does return `urn:tag:audience:*` tags.

This is now closed with **MusicBrainz**, not with another Qloo call:
`resolveRootTraits()` in `cultural-discovery.ts` looks the root up by name and
reads `?inc=genres`, a curated taxonomy that returns clean genres
("psychedelic rock") rather than the folksonomy noise ("australian",
"favourite") that `tags` carries. Genres are sorted by how many releases
MusicBrainz counts for them, capped at six.

Three properties matter:

- **It never fails the graph.** Any MusicBrainz error, timeout or empty result
  resolves to `null`, and the ladder falls back to the weaker rungs. A failed
  lookup costs the reader a stronger statement, never a working page.
- **It refuses to guess.** Only a *single exact-name* match is accepted. Names
  that are ambiguous on MusicBrainz get no genres at all rather than another
  artist's genres. This is not hypothetical: "Michael Jackson" has **seven**
  exact-name matches (the singer, a poet, a photographer, a mashups act, and
  three more), so his world uses audience traits only. "Tame Impala" has one.
- **It does not slow the graph down.** The lookup starts as soon as the root
  is resolved and runs alongside the insights, which are the bulk of the wait.
  It is awaited only after them, because MusicBrainz is throttled to one
  request a second: awaiting it earlier serialises that delay in front of the
  insights and added 3.4s to every cold graph in an earlier revision (7.99s
  against 4.56s once corrected). Starting it *before* the Qloo search instead
  was also rejected, because a name we hand back for disambiguation would then
  cost two MusicBrainz requests for nothing. That path is covered by a test.

Because the root's genres and a node's genres come from different providers,
the resulting statement names both: "Both are tagged psychedelic rock,
neo-psychedelia and alternative rock" carries
`sourceLabel: "MusicBrainz and Qloo"`. Audience-only matches still credit Qloo
alone.

## Verified live

Against live Qloo on 2026-10-24, a Tame Impala graph produced 15 edges:

| Basis | Count | Example |
|---|---|---|
| `provider_attribute` | 1 | "Qloo lists Tame Impala among Pond's collaborators." |
| `shared_attribute` | 4 | "Both are tagged psychedelic rock, neo-psychedelia and alternative rock." |
| `audience_overlap` | 10 | "Qloo recommends Patagonia to fans of Tame Impala; no specific connection is established here." |

No `documented` edge, as expected. Cold graph 4.56s, cached graph 2ms.
These were observations from the earlier run, not a new live verification.

## Tests

`apps/api/test/connection-explanation.test.ts` covers each rung, both
directions of a stated relationship, accent- and case-insensitive name
matching, whole-word place matching ("Rome" must not match "Romeo"), the
contract rule that a `documented` basis needs a source, determinism, and that
no statement claims endorsement, inspiration or causation.

`apps/api/test/graph.test.ts` covers the root-traits path end to end: a genre
shared between MusicBrainz (root) and Qloo (node) produces a
`shared_attribute` crediting both sources; a failed MusicBrainz lookup still
returns a complete graph with no invented shared trait; and an ambiguous name
yields no `shared_attribute` edges at all. It also pins the call budget, so a
future change that adds a provider request to the graph route has to say so.

`apps/web/test/basis.test.ts` checks every rung has display metadata, that the
rungs stay distinguishable without color, and that the `shared_attribute` copy
does not credit a single source now that more than one can supply a trait.
