# The connection agent

**Status:** designed, **not built**. No agent, LLM client or tool loop exists in
the repository yet. The binding rules are in `AGENTS.md` §12.

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

## Open decisions

These are recorded rather than assumed. `AGENTS.md` §12 deliberately does not fix
them.

### 1. Execution model

| Option | For | Against |
|---|---|---|
| **On demand** — a reader asks about a specific pair | Cheap, no storage, always current, trivially bounded per request | Latency is visible; the same pair is re-researched; a demo depends on live provider latency |
| **Precomputed** — run for featured worlds ahead of time | Instant, reviewable, no live cost during judging, quality can be checked by a human | Needs storage and a job runner; the corpus is only as large as what was precomputed |
| **Hybrid** — precompute the featured worlds, allow on-demand for the rest | Best demo, bounded live cost | Most moving parts, and the most to get wrong in the time available |

Worth noting for the demo: a precomputed corpus is *reviewable before submission*,
which matters when the claim being judged is "these statements are sourced". An
on-demand-only agent cannot be checked in advance and will fail visibly if a
provider is slow during judging.

### 2. Model provider

Deliberately open. `AGENTS.md` §12 requires the adapter to be provider-agnostic
and server-only, so this is a configuration decision, not an architectural one.

### 3. Placement

`AGENTS.md` §0 fixes the Fastify boundary, so the default is a module inside
`apps/api` (`src/integrations/<provider>/` plus a service and a route). A separate
service is only justified if the agent needs a runtime that `apps/api` cannot
provide, and that has not been established. Do not add a second service by
assumption.

### 4. Recording a decline

Whether "we checked and found nothing" is distinguishable from "we never
checked". Today they look identical on the graph. Deciding this needs a small
contract change and a UI decision.

### 5. Persistence

There is currently **no database code in `apps/api` at all** and
`supabase/migrations` is empty. An on-demand agent with an in-process cache needs
none. A precomputed corpus does, and that is the first thing in this project that
would genuinely need the Supabase layer the README already specifies.

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

- [ ] A resolved connection renders as a `documented` edge with a working source
      link, above the affinity rungs, and the badge explains what that means.
- [ ] A declined pair renders as its previous, weaker basis with no error state.
- [ ] No page load waits on the agent; a failed agent never breaks a World.
- [ ] The same pair, asked twice, is served from cache and does not re-spend.
- [ ] No model key, model name or prompt is present in the browser bundle.
- [ ] An uncited claim cannot reach the graph: the schema rejects it.
- [ ] Tests use sanitized provider fixtures; the live provider is smoke-tested
      separately, per `AGENTS.md` §9.
- [ ] The agent's output for at least one featured World has been read and
      verified by a human against its sources.
