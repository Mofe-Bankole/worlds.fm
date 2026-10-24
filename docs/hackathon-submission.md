# Qloo Agentic Hackathon — requirements and submission state

**Verified:** 24 October 2026, from <https://qloo.devpost.com/>. Re-check the page
before relying on any detail here; deadlines and bonus prizes have already
changed once during this event.

## The event

| | |
|---|---|
| Name | **Qloo Agentic Hackathon** — "Agents, but with taste." |
| Deadline | **30 October 2026, 11:45pm EDT** |
| Prize pool | $25,000 cash: 1st $15,000 · 2nd $6,000 · 3rd $4,000 |
| Bonus | Jason Calacanis will **personally invest an additional $25,000** into his favourite entry |
| Participants | 2,274 registered |
| Finals | Top 3 appear on air **5 November** with Jason Calacanis, Cedric the Entertainer and Alex Elias, who pick the winner in real time. Finalists must be able to appear and to prepare beforehand. |
| Judges | Jason Calacanis; Mike Diolosa (CTO, Qloo); Nicole Seligman (OpenAI board); Todd Boehly (Eldridge); Cedric the Entertainer; Michael Abrams (EVP Strategic Initiatives, Live Nation) |
| API key | <https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key> |

## What they are asking for

The framing is explicit: *"Agents are getting smarter, but they're culturally
blind. They can reason, plan, and execute — but ask them what to recommend, what
to build, or what people actually want, and they're guessing."*

Build an agentic tool, an agent-powered app, or wire Qloo into an existing agent,
using the taste graph (250M+ entities) so the result *"can do more than 'answer
well'"*.

Two sentences decide whether an entry is even aimed correctly:

> "We're not looking for demos of what LLMs can already do."

> "If your submission would work the same without Qloo, you're building the wrong
> thing."

The second one is the sharpest constraint in the brief. It rules out an LLM
feature bolted onto a Qloo page, and it rules out a Qloo page with an LLM
narration. The dependency has to run both ways.

## Judging criteria

| Criterion | What it asks | What that means here |
|---|---|---|
| **Technological Implementation** | How thoroughly and skilfully does it use Qloo? Genuine effort, non-trivial working implementation? | Qloo must *drive* the agent, not decorate it. Depth of integration is scored. |
| **Design** | A complete, coherent product experience, not a technical proof of concept. | The agent must land as a product surface, not a chat box beside the app. |
| **Potential Impact** | A credible, specific case for a real problem for a real audience — and does the demo actually address it? | The claim must be demonstrated, not asserted. |
| **Quality of the Idea** | Creative, non-obvious use of Qloo; genuine understanding of the space. | Using an agent to **verify** rather than to generate is the non-obvious move. |

## Submission requirements

All five are mandatory. Missing any one is ineligibility, not a deduction.

| # | Requirement | State |
|---|---|---|
| 1 | Link to a **functional demo application**, live and end-to-end | ✅ <https://worlds-fm.vercel.app>, API on Northflank. Verified live 24 Oct. |
| 2 | URL to a **public** code repository | ❌ **BLOCKER — the repository is private** (`gh repo view` reports `isPrivate: true`). |
| 3 | Text description of what it does and what makes it Qloo-powered | ❌ Not written. |
| 4 | **Externally hosted and fully published**; local-only or private-access submissions do not qualify | ✅ Vercel + Northflank, both public. |
| 5 | **Open-source license**, with the file visible in the repo's About section | ⚠️ `LICENSE` is MIT and GitHub detects it as `mit`, but the About section cannot show it until the repo is public. |

Demo videos are explicitly **not** required. Judges are given something they can
use instead, which raises the bar on the live demo being genuinely usable.

## The gap that matters

Requirements 2 and 5 are mechanical. The substantive gap is the brief itself:
**the submission must be agentic, and Worlds.fm currently has no agent.**

What exists is a deterministic graph: Qloo returns affinities, a resolver labels
each edge with the strongest basis it can support, and the UI shows it. There is
no LLM, no agent loop and no tool use anywhere in `apps/api` or `apps/web`.
`README.md` currently describes the hosted LLM as *"optional"* and *"never a
required dependency for the initial journey"* — which was a reasonable product
stance, and is now in direct tension with the event being judged.

The fix is not to add an LLM feature. It is to build the one capability the
existing design was already shaped around and never had an actor for: an agent
that takes two nodes and establishes whether a **real, sourced** connection
between them exists. `AGENTS.md` §12 defines it, and
[`backend/connection-agent.md`](./backend/connection-agent.md) designs it.

That is also the strongest answer to *"would this work the same without Qloo?"* —
it would not. Without Qloo there is no way to know which of the effectively
infinite pairs is worth researching.

## Before submitting

- [ ] **Make the repository public**, after the secret and licence scan in
      `AGENTS.md` §3. This is a hard requirement and it gates requirement 5 too.
      Note that history is included: rotate anything ever committed, not just
      what is currently tracked.
- [ ] Confirm the MIT `LICENSE` appears in the repo's About section.
- [ ] Write the Devpost text description: what it does, and specifically what
      makes it Qloo-powered.
- [ ] Re-verify the live demo end-to-end on the deployed URL, not locally.
- [ ] Re-read <https://qloo.devpost.com/rules> — the summary above is from the
      public page, not the full rules.
- [ ] Confirm the eligibility terms for the team's countries of residence.
