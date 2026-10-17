# AGENTS.md — Worlds.fm engineering contract

**Version:** 1.1 · **Updated:** 17 October 2026 · **Applies to:** Every AI coding agent, assistant, and human contributor operating in this repository.

**Read [`README.md`](./README.md) before making changes.** It defines the product, intended scope, source-of-truth model, MVP priorities, design system, and milestone plan. This file is operationally binding for all code generation and refactoring.

## 0. The decisions you must preserve

- **Product:** Worlds.fm is a **search-first, exploration-driven** platform for exploring cultural worlds connected to music. A geographic map and cultural graph are defining features.
- **Boundary:** Next.js is the **frontend**, *not* the application's business/API server. The independent backend is **Node.js + Fastify + TypeScript** from day one. **Do not replace Fastify with NestJS or Next.js API routes without explicit approval.** NestJS and Next.js are different products.
- **Repo:** Single GitHub monorepo. One primary `main` branch. Feature branches are short-lived and may modify multiple directories as needed; **never** create permanent `frontend`/`backend` branches.
- **Database:** Supabase-hosted PostgreSQL; migrations are versioned SQL, and domain database access happens through `apps/api`.
- **Qloo:** Server-side cultural affinity recommendations. Do not present affinity as historical causation or evidence of specific events. No unverified inference presented as fact.
- **Privacy:** Opt-in social; no unauthorized activity scraping, Spotify-listening-history profiles, or public location tracking.
- **Music:** Authorized links/embeds only; never host, download, scrape, pirate, or redistribute unlicensed sound recordings.
- **Hackathon:** The priority is a fully demonstrated P0 vertical slice by the team's October 30 target, subject to verification of official rules.

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

Adopt **Worlds.fm's own visual language**: Spotify-inspired dark foundation, never cloned Spotify interface or marks.

```text
--worlds-midnight: #0B100E
--worlds-surface:  #1A2420
--worlds-green:    #55E6A5
--worlds-cloud:    #F5F7F5
--worlds-muted:    #A8B7AE
```

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

**P0:** monorepo + deployments; artist search; World page; sourced cultural relationship; live Qloo affinity; map with at least one real place; shareable public link.  
**P1:** authorized player embed/external link; optional opt-in Taste Passport.  
**P2:** feed, follows, matching, events, messaging, full global map ingestion, complex AI orchestration.

Do not sacrifice P0 for a flashy P2 feature. If new ideas arise, document them as roadmap proposals in `docs/` rather than creating partial implementation across unrelated files. Qloo may support geographic heatmaps, but a heatmap is **not** a source of verified historical events or venues.

## 11. First task to execute

Initialize `apps/web`, `apps/api`, and `packages/shared` in a single workspace. Add CI and health check, make a Next.js UI call the Fastify server, and run a documented backend-only Qloo smoke test using approved credentials. **Do not begin with a social feed, music hosting, or elaborate globe animation.**

---

**For AI agents:** If an instruction conflicts with repository structure or documented provider terms, flag the conflict, propose the smallest safe compliant implementation, and preserve the chosen architecture until a human explicitly approves a change.
