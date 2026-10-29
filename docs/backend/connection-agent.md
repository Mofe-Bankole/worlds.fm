# The connection agent

**Status (27 October 2026):** precomputed lookup is built; an offline
tool-use runner and a Factory SDK decision adapter have fixture tests.
Authenticated bounded research attempts have executed, but produced **no
model finding**. The existing corpus was hand-authored and machine-checked,
not human editorially approved. The new pair-story surface withholds those
entries as pending review; the existing graph's documented rungs still show
their machine-checked citations and require a separate editorial audit.
Binding rules: `AGENTS.md` §12.

The evidence-first separation of Qloo discovery, agent research, per-claim
sources, human publication review and UI status is recorded in
[Connection evidence pipeline](./connection-evidence-pipeline.md). This is a
design observation, not an additional implemented provider or live research
path.

| Piece | State |
|---|---|
| Findings contract and citation rules | ✅ `packages/shared/src/connection-agent.ts` |
| Machine-checked findings artifact, pending human approval | ✅ `apps/api/src/content/connection-findings.ts` |
| Pair lookup | ✅ `apps/api/src/services/connection-findings.ts` |
| Reaches graph edges as `documented` | ✅ `cultural-graph-builder.ts` |
| Provider-agnostic model seam | ✅ `apps/api/src/integrations/research/index.ts` |
| Local offline model adapter | ✅ Factory SDK, explicitly selected Opus 5 in private local config; not deployed |
| Live research at request time | ❌ **deliberately not built** (see *Decisions*) |
| Qloo-selected offline runner | ✅ `apps/api/src/services/connection-research.ts`, fixture-tested only |
| Source tools and bounded model-action loop | ✅ `apps/api/src/integrations/research/{musicbrainz-tools,agent}.ts` |
| UI for a reviewed decline | ✅ distinct `researchStatus` on a graph edge |
| Factory SDK model adapter and executable CLI | ✅ mock-tested, disabled until private key + model ID + `--live` |
| Authenticated Qloo → Factory → source-tools run | ⚠️ attempted; no successful finding or approved publication |

The read-only `/api/v1/graph/artist-connection` response uses explicit
`editorialApproval` on a finding before showing cited story claims. Machine
checks and model drafts alone cannot mark a story approved. Story reads never
invoke a provider or model. Artist-path cards render from the current graph;
images load separately. A safe trace summarizer exists for a future approved
demo, but no real trace is currently public.

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

A reviewed **decline** leaves the edge on its weaker Qloo rung, with a separate
`researchStatus: "declined"`. An unresearched pair remains `unresearched`.
Neither Qloo nor a search of one source can establish that no relationship
exists elsewhere.

The graph and card now make this distinction explicit without changing affinity.

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

## Offline runner and review boundary

`selectResearchCandidates` only accepts edges returned by Qloo Insights and
skips artist pairs already in the reviewed corpus. A run is capped at three
pairs. `ResearchDecisionModel.next` asks to `search_artist`,
`artist_relations`, `recording_credits`, or `finish`; the runner allows six turns and five source
requests per pair. MusicBrainz's artist-relationship tool supplies short,
bounded relation records and source URLs, not raw web pages. The runner rejects
ambiguous identities, unsearched IDs, invented citations, unsupported
statements, source failures, and unfinished searches. It cannot research
brands or places yet.

`draftReport(run)` creates an `UNREVIEWED_RESEARCH_DRAFT` audit object with the
Qloo-ranked selection, tool observations, and model decisions. Nothing
automatically copies that draft into `connection-findings.ts`, and no API
endpoint runs a model. Before publication a human must check the cited source,
the meaning of its relation, and the limits of any declined search, then
manually add an approved finding under their own reviewer name. A model's
`draft:*` marker is never a human sign-off.

### Running the Factory adapter

Factory's `@factory/droid-sdk` authenticates with `FACTORY_API_KEY`; it is not
a generic model inference API. A single isolated, one-shot SDK call returns a
structured JSON action. The adapter uses autonomy Off, rejects permission
requests, disables built-in skills, and **rejects any tool activity**. The
model sees only the bounded turn; our server code executes the allowlisted
MusicBrainz tools. The SDK runs in a temporary directory outside the repo.
It needs the `droid` CLI on `PATH`, a valid Factory account, and an available
model ID that you explicitly choose; a default model is intentionally not
used. It does not run in the production Fastify API.

Store `FACTORY_API_KEY`, `FACTORY_RESEARCH_MODEL_ID`, and `QLOO_API_KEY` in a
private local environment. From the repository root:

```sh
pnpm --dir apps/api research:factory -- --artist "Tame Impala" --max-pairs 1 --live
```

The `--live` flag and `--max-pairs 1` are explicit cost guards; each pair can
invoke at most six Factory SDK decisions and five MusicBrainz source requests
(the recording credit tool uses two),
plus the bounded Qloo discovery requests. The CLI permits only named featured
artists. No run occurs when keys or the model ID are absent. Output is written
with restrictive permissions under ignored `apps/api/research-drafts/` as an
`UNREVIEWED_RESEARCH_DRAFT`; it is never imported automatically. **Before an
authenticated run**, confirm Factory model availability, usage/credit policy,
and approval for the resulting spend. A passing mock test is not a paid/live
verification or acceptance by hackathon judges. MusicBrainz uses an
identifying User-Agent and >=1.1-second per-host throttle.

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

The existing graph contract enforced `references` for a documented basis.
`researchStatus` now also distinguishes a reviewed decline from an
unresearched pair; the offline runner is not wired into production.

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
2. **Provider: deferred behind a seam.** `ResearchDecisionModel.next` is the
   offline tool-use interface. The legacy `ConnectionResearchModel` seam
   remains but has no provider; the new interface also has no hosted adapter.
3. **Placement: inside `apps/api`.** No new service. Research is offline, so it
   needs no runtime the API cannot provide, and `AGENTS.md` §0 keeps the Fastify
   boundary.

The UI now distinguishes an existing reviewed decline from an unresearched pair.

## Failure modes

| Failure | Required behaviour |
|---|---|
| Model provider times out or errors | Edge keeps its previous rung. Never an error page, never an empty card. |
| Budget exhausted | Refuse locally without spending a call, like the Spotify `cooldownUntil` path. Cached results keep serving. |
| Provider returns a claim with no citation | Rejected as `unavailable`, not misrepresented as a declined search. |
| Source contains injected instructions | Only bounded structured MusicBrainz relation fields reach the model; still untrusted and never followed as instructions. |
| Two nodes with no cited relation after both are checked | May produce an unreviewed decline draft; editorial review controls publication. |
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
- [x] A local offline Factory adapter is implemented and has made bounded authenticated attempts; no successful model finding exists yet.
- [x] An existing reviewed decline is surfaced as such; model drafts are not published.
- [ ] The corpus covers more than two featured Worlds.
