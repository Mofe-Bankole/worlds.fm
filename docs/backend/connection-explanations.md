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
| `shared_attribute` | The two share a trait the provider records for both: a genre, a theme, or an audience description. | Yes |
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

## Known limitation: the root entity has thin properties

The root entity comes from `GET /search`, which returns a much smaller
`properties` object than `GET /v2/insights`. Measured live on 2026-10-24:

| Endpoint | `properties` keys | `primary_genres` |
|---|---|---|
| `/search` | 5 | absent |
| `/v2/insights` | 29–33 | present |

So a root artist currently has no genres, and a shared-genre statement can
never be produced between the root and a node. Shared **audience** traits still
work, because `/search` does return `urn:tag:audience:*` tags, which is why
live graphs still produce specific statements for artists.

Options for closing this, none implemented yet:

1. Add `genres` or `tags` to the existing MusicBrainz artist lookup and use it
   for the root. Free in requests when the artist is already looked up, but the
   graph route does not currently consult MusicBrainz, and its 1 request/second
   limit would apply.
2. Resolve the root's full entity through `/v2/insights` (one extra Qloo call,
   and the root is not guaranteed to appear among its own neighbours).
3. Leave it: the ladder already falls back honestly.

## Verified live

Against live Qloo on 2026-10-24, a Tame Impala graph produced 15 edges: 1
`provider_attribute` ("Qloo lists Tame Impala among Pond's collaborators"), 3
`shared_attribute` (naming audience traits such as Dedicated and Eclectic), and
11 `audience_overlap`. No `documented` edge, as expected.

## Tests

`apps/api/test/connection-explanation.test.ts` covers each rung, both
directions of a stated relationship, accent- and case-insensitive name
matching, whole-word place matching ("Rome" must not match "Romeo"), the
contract rule that a `documented` basis needs a source, determinism, and that
no statement claims endorsement, inspiration or causation.
`apps/web/test/basis.test.ts` checks every rung has display metadata and that
the rungs stay distinguishable without color.
