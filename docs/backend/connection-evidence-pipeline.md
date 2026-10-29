# Connection evidence pipeline and the agentic feature

**Status:** design observation, 25 October 2026. This is a proposed organization
of the connection workflow, not a claim that the whole pipeline is implemented.
The binding behavior and current implementation live in
[the connection agent](./connection-agent.md) and `AGENTS.md` §12.

## Observation from Spotify's public product descriptions

Spotify describes separate inputs for [expanded Song Credits and SongDNA](https://artists.spotify.com/en/blog/spotlighting-the-people-connections-and-stories-behind-your-music)
and for About the Song: labels and distributors deliver credits, WhoSampled
supplies sample/cover knowledge, and third parties source deeper stories.
This illustrates a useful **separation of credits, discovery and storytelling**;
it does not document Spotify's internal architecture or grant us access to its
data. Do not assume Spotify's restricted Related Artists or Recommendations
endpoints are available to new apps; see [Spotify's Web API changes](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api).
Use only data and images we are authorized to display.

## Worlds.fm's smaller, evidence-first version

| Concern | Decision and owner | What it cannot establish |
|---|---|---|
| Discovery | Qloo ranks supported artists for the searched artist, with provider provenance and identity resolution in `apps/api`. The web displays the affinity as a suggestion. | Collaboration, credits, biography, influence or causation. |
| Research | The server-side connection agent spends a bounded source/tool budget on a **Qloo-selected pair** and records the selection, observations and decision in an unreviewed draft. | Publication or an assertion that no connection exists anywhere. |
| Evidence | Track-level credits or attributed reporting support **specific claims**; retain source label/URL, provider ID, consulted record, and license where relevant. A model cannot supply its own evidence. | A story beyond what each cited source actually says. |
| Editorial gate | A human checks identities, each claim, source rights, wording and source reachability before admitting a finding to the published artifact. | Automatic promotion from model output to a verified story. |
| Presentation | `apps/web` shows the pair, Qloo suggestion separately from a cited documented finding, or a precise status for missing evidence. | Turning an affinity card into a documented edge by UI copy alone. |

This is **not** a proposal to ingest Spotify listening histories, scrape
credits, or introduce a database now. Today the precomputed corpus in
`apps/api/src/content/connection-findings.ts` is versioned source, not a
Postgres graph; its existing entries were machine-checked, **not human signed
off**. The pair-story lookup labels these `pending_review`. Distinguish
`unresearched`, human-approved `declined`, and provider/budget
`unavailable`. A decline means this bounded investigation found no citable
support, **not** proof the artists never interacted.

## Where the agent is indispensable

```text
searched artist → live Qloo-ranked artist pair (candidate, not fact)
  → bounded agent decisions: identity lookup → source inspection → cited draft
     or decline/unavailable
  → human review → published documented finding or reviewed decline
  → user sees the source, or an honest weaker affinity/status
```

The agent is the *research decision-maker*, not a chat narrator for Qloo.
Qloo decides **which** pair merits investigation; the agent decides **whether
anything can honestly be said about it**. The editorial gate decides whether
that result may be published. This is the meaningful agentic step to demonstrate
for the [Qloo Agentic Hackathon](https://qloo.devpost.com/): show the actual
Qloo-selected pair, tool decisions and source evidence, plus an unsupported or
failed path. A prewritten cited story and pictured recommendations alone do
**not** demonstrate a running agent or prove Qloo changed its choices.

**Demo target, not shipped behavior:** search Clams Casino; show pictured
Qloo-ranked candidate A$AP Rocky *if live Qloo actually returns that pair*;
open a human-reviewed story that cites [Pitchfork's “LVL” and “Hell” production
credits](https://pitchfork.com/news/48925-skrillex-clams-casino-danger-mouse-more-produced-beats-for-aap-rockys-longliveaap/)
and, for any interview claim, [the XXL interview](https://www.xxlmag.com/production-credit-clams-casino-talks-working-with-aap-rocky-mac-miller-havoc/).
If Qloo does not select the pair, do not call it Qloo-selected. Show another
candidate as `unresearched`, or a genuinely reviewed decline, without conflating
those statuses. Do not attribute a hand-researched seed to the agent.

**Current gap (25 October 2026):** the offline Factory-backed runner executed
real source-tool decisions in a local Opus 5 attempt, but exhausted its source
budget and produced no finding. No agent-produced story has passed human review
or been published, and no live user-selected research path is implemented.
The offline runner is not part of the deployed request path. Before claiming
this demo proves the agentic contribution, obtain a reproducible, successful
Qloo → agent → sourced draft run, review it, publish it, and demonstrate its
decision trace and a negative path. Preserve the failure as `unavailable`, not
a fabricated decline.

## Implementation status and latency boundary (27 October 2026)

- The new artist-path cards use artist candidates already returned by Qloo's
  existing graph request. Missing images load separately. Opening a pair reads
  `/api/v1/graph/artist-connection` from the precomputed corpus; that route
  calls neither Qloo nor the model. The graph and geographic exploration remain.
- Each published story claim has its own citation. A `documented` claim without
  a citation fails the shared schema. The current corpus has only machine-
  checked entries, **not human-approved editorial stories**, and does not
  contain a Clams Casino/A$AP Rocky finding.
- Offline MusicBrainz research can now follow an artist's recording relation
  to a named track and inspect that recording's performer and producer credits
  with resolved artist IDs. It still cannot source an interview or assert that
  such a recording credit exists for Clams/Rocky; ambiguous or failed lookups
  return unavailable. The extra recording search and lookup count against the
  five-request per-pair cap. The runner can also produce a sanitized summary
  of selected pair, tool names, source URLs and result. This **unreviewed**
  summary is not automatically served to the public.
- Keep performance metrics separate: graph/search cache hit vs miss, candidate
  render, pair-detail lookup, image load, and offline run duration/success.
  Do not optimize page latency by publishing unreviewed agent output.
  Fastify sends `Server-Timing: graph;dur=…` and `pair;dur=…` plus the
  existing `x-worlds-cache` graph header for comparison in network tools;
  browser image and render timings still need an end-to-end measurement.

No authenticated successful agent finding, editorial approval, live
Clams/Rocky Qloo selection or deployed smoke test has been demonstrated by
this change. Do not show a fixture trace as live evidence.

**27 October live check:** a bounded Clams Casino search selected
**Suicideyear**, not A$AP Rocky, as its highest eligible Qloo research
candidate. The source lookup failed on the first MusicBrainz request and the
model repeated that request. The ignored private draft records an
`unavailable` result, **not a finding**. Subsequent code now stops immediately
on a source-tool failure instead of spending another model turn on it.
MusicBrainz's public artist search responded to an independent read, but
that does not establish why the runner's source call failed. Do not use this
attempt as proof of successful agent research or of Clams/Rocky Qloo selection.
Two further capped runs selected the same Qloo candidate and resolved both
artist names, but the Clams Casino relationship request failed even after the
offline timeout was raised to 15 seconds. An isolated direct call to that
relationship tool did succeed and returned 80 bounded lines; the cause of the
runner failure is not established. Later drafts now stop at the first source
failure. Future private drafts record only a safe error category to help
diagnose this without exposing upstream response bodies or credentials.
