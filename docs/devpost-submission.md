# Worlds.fm: Devpost submission text

**Tagline:** Explore the world around the artists you love, with only what can be proven.

## Inspiration

I've always wanted to know more about the artists I love: who they played with, where their sound came from, and what else their fans care about. Streaming apps tell you what to play next. They don't tell you how an artist fits into the world. The rest of the web mixes facts with guesses and rarely shows its sources.

## What it does

Search any artist and Worlds.fm builds their cultural world:

- **A constellation** of related artists, brands and destinations, ranked by Qloo's cultural affinity.
- **Artist paths:** "Where could Femi Kuti lead?" Each path shows the Qloo affinity score and states plainly that a shared audience is not evidence that two artists worked together.
- **Sourced connections.** When a connection is documented, the card shows how we know it: **1 · Qloo selected** the pair, **2 · the agent checked** primary sources, and **3 · an editor approved** the finding. Every claim links to its source.
- **Honest declines.** If no source supports a connection, Worlds.fm says "no documented connection found" instead of making something up.
- A full **discography** with authorized Spotify links, plus a shareable link for every world and song.

## How Qloo and the agent work together

There are 250M+ entities in Qloo and effectively infinite pairs. **Qloo decides what is worth investigating.** It ranks the pairs that real audiences care about. **The agent decides what can honestly be said.** It takes a Qloo-ranked pair, queries MusicBrainz relationship data, and returns either a cited statement or a decline. It can't publish its own work. A human editor approves each finding before readers see it.

Example from the live site: Qloo ranks Seun Kuti first for Femi Kuti (affinity 0.97). The agent found the MusicBrainz "sibling" relation and cited it, and an editor approved the finding. For Orlando Julius (affinity 0.96), the agent found no documented relation and declined, and that decline was also approved.

Remove Qloo and the agent researches pairs nobody asked about. Remove the agent and Worlds.fm can only say that two audiences overlap.

## How we built it

- **Frontend:** Next.js on Vercel.
- **API:** an independent Fastify + TypeScript service on Northflank. It holds every key; none reach the browser.
- **Qloo:** entity search, Insights for artists, brands and destinations, and images, all server-side, with retries, timeouts and rate limits.
- **Agent:** a provider-agnostic tool-use loop (Factory Droid SDK) with bounded MusicBrainz tools. It runs offline in batches, so no page waits on a model, and every run has a hard budget.
- **Shared Zod contracts** between the web app and the API. A "documented" connection without a citation fails validation and can't ship.
- Other sources: MusicBrainz (CC0), Wikipedia and Spotify, each with attribution.

## Challenges

Keeping the agent honest. Models are good at sounding sure. We made "cite or decline" a schema rule rather than a prompt request, treat all fetched text as untrusted data, and require human approval. We also had to stop affinity from reading as fact, which meant labelling every Qloo edge as a "cultural affinity".

## Accomplishments

- A live, end-to-end loop: Qloo selection, then agent research, then editorial approval, then a cited connection on the public site.
- Declines are shown as a correct answer, not an error.
- 320 automated tests across the API and web app.

## What's next

- Research more featured worlds and add more source tools (Discogs, Wikidata, venue archives).
- Let fans suggest pairs for the agent to check.

## Who it's for and the business model

- **Curious fans (main audience):** free.
- **Writers, curators and researchers:** a paid research tier with on-demand agent checks and exportable citations.
- **Labels and promoters:** audience insights built on Qloo affinity, for example which artists, brands and cities share an audience, to inform lineups and tours.
- **Venues and music travel:** partnerships that turn an artist's world into places to visit and shows to see.

## Links

- Live demo: https://worlds-fm.vercel.app
- Code (MIT): https://github.com/Mofe-Bankole/worlds.fm
