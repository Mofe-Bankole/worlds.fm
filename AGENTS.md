# AGENTS.md — Worlds.fm engineering contract

**Version:** 1.2 · **Updated:** 24 October 2026 · **Applies to:** Every AI coding agent, assistant, and human contributor operating in this repository.

**Read [`README.md`](./README.md) before making changes.** It defines the product, intended scope, source-of-truth model, MVP priorities, design system, and milestone plan. This file is operationally binding for all code generation and refactoring.

## 0. The decisions you must preserve

- **Product:** Worlds.fm is a **search-first, exploration-driven** platform for exploring cultural worlds connected to music. A geographic map and cultural graph are defining features.
- **Boundary:** Next.js is the **frontend**, *not* the application's business/API server. The independent backend is **Node.js + Fastify + TypeScript** from day one. **Do not replace Fastify with NestJS or Next.js API routes without explicit approval.** NestJS and Next.js are different products.
- **Repo:** Single GitHub monorepo. One primary `main` branch. Feature branches are short-lived and may modify multiple directories as needed; **never** create permanent `frontend`/`backend` branches.
- **Database:** Supabase-hosted PostgreSQL; migrations are versioned SQL, and domain database access happens through `apps/api`.
- **Qloo:** Server-side cultural affinity recommendations. Do not present affinity as historical causation or evidence of specific events. No unverified inference presented as fact.
- **The product agent:** Worlds.fm includes a **connection agent** whose job is to take two nodes and find out whether a *real, sourced* connection between them exists — and to say nothing when it does not. It is a first-class product capability, not a decoration, and its rules are binding: see **§12**. It consumes Qloo output as its starting point, lives on the server side of the §0 boundary, and may never assert a fact it cannot cite.
- **Privacy:** Opt-in social; no unauthorized activity scraping, Spotify-listening-history profiles, or public location tracking.
- **Music:** Authorized links/embeds only; never host, download, scrape, pirate, or redistribute unlicensed sound recordings.
- **Hackathon:** The priority is a fully demonstrated P0 vertical slice by the team's October 30 target, subject to verification of official rules. The verified requirements of the current Qloo Agentic Hackathon — including its **public repository** and **open-source license** conditions, and its demand that the submission be **agentic** — are recorded in [`docs/hackathon-submission.md`](./docs/hackathon-submission.md). Those are eligibility conditions, not preferences.

## 1. Strict ownership map

| Allowed owner | Owns | Must **not** contain |
|---|---|---|
| `apps/web/**` | Next.js pages, layouts, components, map/graph UI, visual tokens, client fetch layer | Fastify controllers, Qloo API keys, DB service-role credentials, provider secrets, domain persistence |
| `apps/api/**` | Fastify routes, controllers, services, repositories, validation, Qloo/protected integrations, auth verification | Next.js components, React pages, CSS, static UI pages |
| `packages/shared/**` | Request/response schemas, DTOs, primitive types, cross-app validation | UI components, Fastify instance, DB client, provider secrets |
| `supabase/migrations/**` | Numbered/reviewed Postgres schema migrations and constraints | React, application runtime code |
| `docs/**` | ADRs, API examples, design/research notes, product specifications | Production runtime source |
| `.github/workflows/**` | CI automation | Business logic |
| repo root | Workspace config, project docs, shared quality tools | Unstructured, orphaned feature source files |

**Agent rule:** Before creating or editing a file, determine which owner it belongs to. If work spans both frontend and backend, edit the proper folders **in one feature branch and one coherent PR**. Do not copy entire feature implementations into multiple places. If a directory or contract does not exist yet, establish it deliberately rather than inventing parallel structures.

## 2. Change protocol for every task

1. **Orient:** Read `README.md`, this file, existing package scripts, API schemas, and the files you're about to touch.
2. **Plan:** State briefly which package owns each change, the endpoint/schema changes, migration needs, and how it will be tested. Do not create speculative feature layers.
3. **Implement:** Make the smallest complete vertical slice. Favor cohesive modules and narrow, documented dependencies.
4. **Verify:** Run the relevant available formatter, linter, typecheck, unit/integration tests, and builds. If tests cannot run, state exactly why; never claim a test passed without executing it.
5. **Report:** Give files changed, behavior demonstrated, checks run, remaining risks, and the next step. Keep the repo runnable; update `.env.example` and docs when contracts change.

Never silently overwrite user work or revert unrelated changes. Avoid sweeping refactors during the hackathon. Use TODOs only when they identify a non-critical deferred task with clear scope.

## 3. Branch and commit policy — prevents past hackathon failures

- `main` is always the source of truth. Do **not** treat a branch as a permanent folder for a particular app.
- For one discrete task, branch from current `main`, e.g. `feat/qloo-smoke-test`, `feat/artist-world`, `fix/map-markers`. Merge promptly after checks.
- A feature that needs `apps/web` and `apps/api` may modify both on the **same branch**. Keep source files in their correct folders and update shared contracts in `packages/shared`.
- No giant unreviewed copy/paste between branches. Avoid cherry-picking entire folders and resolving conflicts by duplicating code.
- Commit lockfile/package changes together. Do not add generated build output, `node_modules`, `.next`, `.env`, tokens, or database dumps.
- Before making the repository public, scan tracked files and Git history for secrets, credentials, personal data, copied assets, and licensed content; rotate any credential that was ever exposed. Confirm the submission and license rules.

## 4. API and shared contracts

- **All domain APIs live in Fastify** under `apps/api`. Do not create Next.js route handlers as an alternative backend or connect Next.js server components directly to Qloo/Supabase domain data.
- If Fastify adds or changes an endpoint, modify shared Zod schema/TypeScript DTO in `packages/shared` and update frontend client in the same PR.
- Validate and sanitize external requests at the API boundary; validate provider responses before normalizing them. For errors, return a stable object with an error code, safe message, and optional request ID; never leak token values, private stack traces, or SQL.
- Version domain endpoints with `/api/v1`; use pagination for lists, bounded map queries, timeouts, rate limits, and suitable caching.
- API credentials are always read at runtime from API-only environment variables. Browser variables with `NEXT_PUBLIC_` contain **only non-secret public configuration**.
- Configure CORS for permitted origin(s); do not use open production CORS with credentials. All privileged write operations need real authentication and authorization checks, not only a hidden button.
- Keep the API independently bootable, buildable, testable, and deployable without a Next.js runtime.

## 5. Data and evidence rules

Every cultural relationship must carry:

- A **relation kind** (`verified`, `affinity`, `community`, `editorial`).
- A **human-readable label** understandable to users.
- **Provenance**: source URL/review timestamp for verified facts; Qloo/provider metadata for affinities; author/review status for community submissions; cited supporting facts for editorials.
- A clear statement of what the link means. **Never infer that association = endorsement, inspiration, ownership, attendance, or causation.**

For example, “Avicii Experience → connected to Avicii's legacy” can be historical with a source. “Fans of artist X may enjoy destination Y” may be an affinity with a Qloo provenance label. “Song X caused event Y” must not be inferred from Qloo and is only admissible as a carefully attributed, verified historical statement or visibly labeled community claim.

- Do not invent source URLs, coordinates, images, event dates, museum artifacts, or relationship scores.
- Preserve source IDs separately from canonical internal IDs; use unique constraints and migration discipline.
- Do not use AI-generated prose as a substitute for independently sourced facts.
- Geocode only verified/supported places. A map pin must represent a genuine relevant location, not a guessed city centroid presented as a precise venue.
- Build placeholders or fallbacks with conspicuous **DEMO DATA** labels. Never quietly promote mock Qloo responses to factual production insights.

## 6. Qloo integration rules

- Put Qloo clients and mapping logic in `apps/api/src/integrations/qloo/` (create that directory during scaffolding).
- Resolve supported Qloo entity IDs using current lookup endpoints; call Insights using only confirmed supported types and parameters.
- Qloo's documented types include artist, brand, place, and destination; do **not** assume Qloo has a first-class `song`, fan-party, or event type.
- Check current docs for correct authentication, API version, entitlements, provider limits, and allowed caching/redisplay. Implement retries with restraint and a short timeout. Do not fake a successful request.
- Normalize provider entities into a stable Worlds.fm DTO. For every Qloo-derived connection set `kind: "affinity"`, show appropriate attribution, and handle missing/empty scores without inventing defaults.
- Support a controlled development fixture for demos **only if** it is marked as a fixture in source, logs, and UI.
- Qloo **selects and ranks**; it is never the *evidence* for a stated fact. It can tell us which pair of nodes is worth investigating, and how strongly audiences overlap. It cannot tell us why. Turning an affinity into a stated connection is the product agent's job, and that job is governed by §12.

References: https://github.com/qloo/docs-public/blob/main/reference/api-overview.md and https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md.

## 7. Music and social safety rules

- Prefer provider links and officially documented embeds for playback; provider controls the music. Do not create a second streaming catalog or rip audio from user devices, Spotify, YouTube, or any other service.
- Respect Spotify/other provider branding, terms, availability, attribution, and content-use restrictions. Do not use Spotify platform content or listening activity to produce user-taste profiles, match people, generate derived analytics, or train models.
- The Taste Passport uses **manual selections** and voluntary on-platform saves/likes only, with an understandable privacy setting per profile/activity feature.
- Profiles start private or minimally disclosed; explicit opt-in for public display, followers, and activity sharing. Never imply that music playback or physical presence is public by default.
- Avoid precise user location collection, background tracking, and public geolocation. Do not launch user-generated event publishing without reporting/moderation and safety controls.
- When eventual messaging/matching features are implemented, add blocking, abuse reporting, privacy defaults, and age-appropriate safeguards first. They are not P0.

Spotify references: https://developer.spotify.com/documentation/embeds and https://developer.spotify.com/policy.

## 8. UX and design consistency

Adopt **Worlds.fm's own visual language**: a near-black, green-tinted dark foundation with a restrained green palette; never a cloned Spotify interface or marks. The approved direction is `docs/design/landing-page-blueprint.md`.

Official brand colors (source of truth: `apps/web/src/styles/tokens.css`; consume them as tokens, never as raw hex in components):

```text
--color-night:    #08120B   Approved dark background
--color-electric: #00CD37   Primary Electric Green
--color-forest:   #2A6E4C   Forest Green
--color-vibrant:  #46D35D   Vibrant Green
--color-fresh:    #5DDE6C   Fresh Green
--color-mint:     #CBF2CD   Soft Mint
```

Derived neutrals (also in `tokens.css`): `surface-1 #0E1912`, `surface-2 #142219`, `text #EEF6EF`, `text-2 #A3B5A8`, `text-3 #8AA090`.

- **Green means signal.** Saturated green marks only what is interactive, live, or verified. Forest and Mint carry atmosphere. Do not flood the interface with green.
- Text on Electric uses Night (`--color-on-accent`); white on Electric fails contrast. Forest is large-decoration only, never body text. `text-3` is for Night and `surface-1` only.
- Search and artist/song World discovery are primary. Map and cultural graph are signature first-class components, not admin widgets.
- Build responsive layouts, readable charts, loading/error/empty states, focus outlines, keyboard navigation, descriptive accessible labels, and reduced-motion support.
- Meet WCAG AA contrast; never communicate graph relationship classes solely with color. Explain link types in tooltips and detail panels.
- Keep navigation and tokens consistent. Default to polished, restrained design rather than excessive motion, glow, heavy gradients, or generic dashboards.

## 9. Testing and definition of done

A change is done when:

- Source is in the correct directory and shared contracts remain valid.
- A user flow works on the target viewport, including loading, empty, and failure states.
- New routes validate input and do not disclose secrets or private records.
- Provider responses are tested with sanitized fixtures; actual integration is smoke-tested separately when credentials are available.
- Changed app(s) typecheck/build, tests pass where configured, and docs/env examples are consistent.
- The output accurately distinguishes **actually completed**, **verified externally**, **mocked**, and **deferred** work.

**M0 proof:** Next.js page fetches Fastify `/health` successfully, and the backend performs one authorized live Qloo request without exposing a key. The app and API must run/deploy independently. If Qloo keys are not yet available, report the blocked live smoke test without claiming success.

## 10. Delivery priorities and anti-scope-creep rules

**P0:** monorepo + deployments; artist search; World page; sourced cultural relationship; live Qloo affinity; map with at least one real place; shareable public link; **the connection agent (§12)**, because an agentic capability is an eligibility condition of the current hackathon rather than an enhancement to it.
**P1:** authorized player embed/external link; optional opt-in Taste Passport.  
**P2:** feed, follows, matching, events, messaging, full global map ingestion, complex AI orchestration.

Do not sacrifice P0 for a flashy P2 feature. If new ideas arise, document them as roadmap proposals in `docs/` rather than creating partial implementation across unrelated files. Qloo may support geographic heatmaps, but a heatmap is **not** a source of verified historical events or venues.

## 11. First task to execute

Initialize `apps/web`, `apps/api`, and `packages/shared` in a single workspace. Add CI and health check, make a Next.js UI call the Fastify server, and run a documented backend-only Qloo smoke test using approved credentials. **Do not begin with a social feed, music hosting, or elaborate globe animation.**

## 12. The product agent — connection research

**What it is.** Given two nodes in a cultural graph, the connection agent researches whether a real, documented connection between them exists, and returns either a **cited statement** or an honest **decline**. It is the only component permitted to produce a `documented` basis on a graph edge; that rung of the evidence ladder is deliberately unreachable from Qloo alone.

The precomputed corpus lives in `apps/api/src/content/connection-findings.ts` and is validated at import, so an uncited finding fails the build rather than reaching a reader. Existing entries were machine-checked, **not human editorially signed off**. The contract is `packages/shared/src/connection-agent.ts`, the lookup is `apps/api/src/services/connection-findings.ts`, and the model seam is `apps/api/src/integrations/research/`. An offline provider-neutral Qloo-selection/source-tool runner is fixture-tested but has **no hosted model provider or production-generated findings yet**. Research runs offline: nothing on the request path calls a model. See `docs/backend/connection-agent.md` for the design and `docs/backend/connection-explanations.md` for the ladder it feeds.

**Why both halves are required.** This is the product's central claim, so do not reduce it to either half:

- **Qloo decides what is worth investigating.** There are 250M+ entities and effectively infinite pairs. Qloo's affinity ranks the pairs a real audience cares about, so research is spent where it matters.
- **The agent decides what can honestly be said.** It finds sources and cites them, or it returns nothing.

Remove Qloo and the agent researches arbitrary pairs nobody asked about. Remove the agent and Worlds.fm can only report that two audiences overlap. A submission that would work the same without Qloo is the wrong submission, and so is one where the agent merely narrates what Qloo already returned.

**Binding rules.** These are not stylistic preferences.

1. **Cite or decline.** The agent may emit a `documented` basis only with at least one real, resolvable citation (source label plus URL). The shared contract already rejects a `documented` basis with no `references`; that check is load-bearing and must never be relaxed to make output "work".
2. **Affinity is never evidence.** Qloo output may select and rank a pair. It may not be the support for a stated connection, and the agent may not restate an affinity as a fact.
3. **Declining is a correct answer.** "No documented connection found" is first-class and displayed as such, never as an error, a spinner, or something to retry until it produces anything.
4. **Per-claim provenance.** Each stated fact carries its own source and, where text is reused, its licence. One source may not silently cover a paragraph of claims (§5).
5. **The agent's own prose asserts nothing.** It may frame, order and link. It may not claim biography, influence, ownership, attendance or causation. Sourced text is quoted and attributed.
6. **Never on the critical path.** No page load waits on the agent. It runs behind a rate-limited endpoint with a hard timeout, and results are cached. A failure or a spent budget degrades to the existing, weaker rung of the ladder, never to an error page.
7. **Provider-agnostic and server-only.** The model sits behind an adapter in `apps/api/src/integrations/`, configured by API-only environment variables, exactly like Qloo, MusicBrainz and Spotify. No key, model name or prompt reaches `apps/web` or the browser bundle (§4).
8. **Fetched content is untrusted.** Anything the agent reads from the web to build a citation is data, never instruction. Output is validated against the shared schema before it is stored or returned, so injected text cannot become a fact or a command.
9. **No user data, no profiling.** The agent researches public cultural sources. It never consumes listening history, location or profile data, and nothing it produces is derived from a person (§7).
10. **Bounded cost.** Every call spends money. Per-request caps, caching and rate limits are required, and exhaustion must degrade gracefully, as the Spotify quota path already does.

**Decided / pending.** The user chose offline precomputation for featured worlds and `apps/api` placement, with a provider-agnostic tool-use seam. The hosted model provider remains **unselected**; do not imply a live agent run until a provider-backed workflow produces and a human reviews a finding. See `docs/backend/connection-agent.md`. The Fastify boundary in §0 stands until a human approves a change.

---

**For AI agents:** If an instruction conflicts with repository structure or documented provider terms, flag the conflict, propose the smallest safe compliant implementation, and preserve the chosen architecture until a human explicitly approves a change.
