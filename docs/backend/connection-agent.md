# The connection agent

**Status:** the **precomputed half is built and live**; the model is a seam with
no provider behind it yet. Binding rules: `AGENTS.md` §12.

| Piece | State |
|---|---|
| Findings contract and citation rules | ✅ `packages/shared/src/connection-agent.ts` |
| Reviewed findings artifact | ✅ `apps/api/src/content/connection-findings.ts` |
| Pair lookup | ✅ `apps/api/src/services/connection-findings.ts` |
| Reaches graph edges as `documented` | ✅ `cultural-graph-builder.ts` |
| Provider-agnostic model seam | ✅ `apps/api/src/integrations/research/index.ts` |
| A model provider | ❌ **not chosen** — the seam returns `not_configured` |
| Live research at request time | ❌ **deliberately not built** (see *Decisions*) |
| UI for a *researched decline* | ❌ open; a decline currently looks like an unresearched pair |

## The problem

A Worlds.fm graph currently shows *what Qloo knows* and cannot say *why*. Every
edge is labelled with the strongest basis it can support, and the ladder has four
rungs (see [`connection-explanations.md`](./connection-explanations.md)). The top
rung, `documented`, is deliberately unreachable: `explainConnection()` accepts a
citation from its caller and refuses to invent one, and the shared contract
rejects a `documented` basis that carries no `references`.

So the ladder was built around an actor that never existed. This is that actor.

## The two halves, and why neither works alone

| | Decides | Cannot |
|---|---|---|
| **Qloo** | Which pair is worth investigating, and how strongly the audiences overlap | Say why. Affinity is a recommendation signal, not evidence (`AGENTS.md` §6). |
| **The agent** | Whether a real, citable connection exists, and what it is | Know which of the effectively infinite pairs matters |

There are 250M+ entities in the taste graph. Cross-researching pairs is not a
budget problem, it is a combinatorics problem: 250M entities give on the order of
10^16 pairs. Qloo collapses that to the handful a real audience would care about.
The agent then spends real research effort on those few, and either finds a
citation or declines.

This is the honest reading of the hackathon's *"if your submission would work the
same without Qloo, you're building the wrong thing"*: remove Qloo and the agent
researches arbitrary pairs nobody asked about. Remove the agent and the product
can only report that two audiences overlap.

## What it produces

Nothing new in the contract is needed for the happy path. A resolved connection is
an edge whose `basis.kind` is `documented`, with `references` populated and
`sourceLabel` / `sourceUrl` naming where the statement came from. That is exactly
the input `explainConnection()` already accepts, and the shape the schema already
validates.

A **decline** is equally well served today: the agent finds nothing citable, and
the edge keeps the weaker rung it already had. The existing fallback statement
already reads honestly ("Qloo found no documented link and no shared trait
between X and Y").

One question is genuinely open — see *Open decisions*, item 4 — whether the
product should also *record that the agent looked*, so a reader can tell "we
checked and there is nothing" from "we never checked". That would be a small
contract addition, not a redesign, and it should be decided deliberately rather
than smuggled in.

## What already exists to build on

| Piece | Where | Why it helps |
|---|---|---|
| Evidence ladder and `documented` rung | `apps/api/src/graph/connection-explanation.ts` | The resolver already takes a citation; the agent is its caller |
| `references` enforcement | `packages/shared/src/cultural-graph.ts` (`superRefine`) | The type system already refuses an uncited `documented` edge |
| Adapter pattern | `apps/api/src/integrations/{qloo,musicbrainz,spotify}/` | The model belongs behind the same shape: schema-validated, injectable fetch, typed errors |
| Caching with TTL + negative TTL | `apps/api/src/lib/cache.ts` | An agent call is expensive; caching is the difference between usable and not |
| Rate limiting | `apps/api/src/routes/*` | Per-client caps already exist for graph, media and music routes |
| Graceful quota degradation | Spotify `cooldownUntil` path | The pattern for "we are out of budget, keep serving what we have" |
| Stable error envelope | `apps/api/src/lib/errors.ts` | Agent failures must map onto the same `{ code, message, requestId }` |

## Product surface

The shape the reader sees, in the terms they already understand:

1. Two nodes are selected in a World (the root artist and a brand, a place, or
   another artist).
2. If a documented connection exists, the edge shows it, cited, above the
   affinity rungs.
3. If not, the edge keeps its weaker basis and says so plainly.

The interaction must not read as a chat box. A chat surface would put the burden
on the reader to know what to ask, and it would score badly against "Design —
a complete, coherent product experience, not just a technical proof of concept".
The agent's output should look like the rest of the graph: a statement, a badge,
and a source link.

## Remaining open question

### Recording a decline in the interface

Whether "we checked and found nothing" should be distinguishable from "we never
checked". The **data** already distinguishes them — `hasResearched()` returns
true for a decline while `documented()` returns null — but the graph does not
surface it, so today both render as the same weaker rung.

This is a real trade-off, not an oversight. Saying "we researched this and found
nothing" is more honest, but it also makes the interface noisier and draws
attention to absences. It needs a UI decision, and a small contract addition if
the distinction should survive to the client.

Note on persistence, which was open in the first draft: the precomputed corpus
needs **no database**. It is a reviewed source file, versioned in git, validated
at import. There is still no database code in `apps/api` and
`supabase/migrations` is empty, and this design did not change that. A corpus
large enough to need Postgres would be a different decision.

## How a finding reaches the screen

```text
connection-findings.ts (reviewed artifact, validated at import)
        │
        ▼
ConnectionFindingsIndex ── pairKey(subject, target), order-insensitive
        │
        ▼
cultural-graph-builder ── documented() → explainConnection({ documented })
        │
        ▼
edge.basis.kind = "documented"  +  edge.references[]  +  edge.basis.sourceUrl
        │
        ▼
BasisBadge renders "DOCUMENTED" and links the citation
```

Nothing new was needed in the graph contract: `explainConnection()` already
accepted a citation, and the schema already required `references` for a
`documented` basis. The agent is the caller that was missing.

## What was verified live

Against live Qloo on 2026-10-24, with the artifact in place:

| World | `documented` | Other rungs |
|---|---|---|
| Bob Marley | **4** (Ziggy, Stephen, Damian Marley, Bob Marley & The Wailers) | 1 provider attribute, 10 audience overlap |
| Tame Impala | **1** (Pond, citing three MusicBrainz pages) | 4 shared trait, 10 audience overlap |

The four cited MusicBrainz artist pages were each fetched and returned HTTP 200.
`GoPro` and `Melbourne`, which have `declined` findings, stayed on
`audience_overlap` — a decline does not become an edge.

In the browser, Bob Marley's nodes read "Ziggy Marley, Artist, **Documented**,
affinity 0.96", and the node card shows the statement, the `DOCUMENTED` badge and
a working citation link (`https://musicbrainz.org/artist/ed2ac1e9-…`). axe-core
reported 0 violations.

## Decisions taken

The three questions left open in the first draft of this document are now
answered for the built half.

1. **Execution model: precomputed.** Research runs offline and the result is a
   versioned artifact read at request time. The reason is not performance: it is
   that the claim being judged is "these statements are sourced", and a
   precomputed corpus can be **read and checked before submission**. Research
   done live during judging cannot be reviewed in advance and fails visibly if a
   provider is slow.
2. **Provider: deferred behind a seam.** `ConnectionResearchModel` is the only
   thing a provider must implement. The seam is testable today with no provider,
   which is why it was built first. The default implementation reports
   `not_configured` instead of throwing.
3. **Placement: inside `apps/api`.** No new service. Research is offline, so it
   needs no runtime the API cannot provide, and `AGENTS.md` §0 keeps the Fastify
   boundary.

Still open: whether a *researched decline* should be distinguishable in the UI
from an unresearched pair (the data already distinguishes them —
`hasResearched()` versus `documented()` — but nothing surfaces it yet).

## Failure modes

| Failure | Required behaviour |
|---|---|
| Model provider times out or errors | Edge keeps its previous rung. Never an error page, never an empty card. |
| Budget exhausted | Refuse locally without spending a call, like the Spotify `cooldownUntil` path. Cached results keep serving. |
| Provider returns a claim with no citation | Rejected. Treated as a decline, not stored. |
| Fetched page contains injected instructions | Treated as data. Output is schema-validated before it is stored or returned. |
| Two nodes with no plausible connection | A correct decline, displayed as such. |
| Citation URL later 404s | The statement is attributed to a named source; a dead link is a source problem to surface, not a reason to drop the provenance. |

## Acceptance criteria

Met, and covered by tests or live checks:

- [x] A resolved connection renders as a `documented` edge with a working source
      link, above the affinity rungs, and the badge explains what that means.
      *(Live: Bob Marley ×4, Tame Impala ×1; all four cited pages returned 200.)*
- [x] A declined pair renders as its previous, weaker basis with no error state.
      *(Live: `GoPro` and `Melbourne` stayed on `audience_overlap`.)*
- [x] No page load waits on the agent; research is precomputed, so there is
      nothing to wait for.
- [x] No model key, model name or prompt is present in the browser bundle, and
      none is read by the API either: the seam is not wired into `app.ts`.
- [x] An uncited claim cannot reach the graph: the schema rejects it, and a model
      reply that claims a link without a citation is discarded as
      `invalid_output`.
- [x] A near-miss name cannot inherit another entity's citation
      (`Mock Artist` ≠ `Mock Artists`), and category is part of the pair key.
- [x] A duplicate pair is refused rather than resolved by file order.

Still open:

- [ ] **A human has read the findings against their sources.** The statements are
      verified against live MusicBrainz output, but that is machine verification,
      not editorial review. This is the same caveat the featured-world facts
      already carry, and it is the one thing standing between these edges and
      being signed off.
- [ ] A model provider is chosen, and the seam implemented.
- [ ] A researched decline is surfaced as such (see *Remaining open question*).
- [ ] The corpus covers more than two featured Worlds.
