# Deploying the API

The Worlds.fm API is an independent Fastify service. It builds and runs without
Next.js, and the web app reaches it over `NEXT_PUBLIC_API_BASE_URL`.

Target platform: **Northflank**, free Sandbox plan. The service is built from
[`apps/api/Dockerfile`](../api/Dockerfile), which Northflank builds on its own
builders.

## Live deployment

| | |
|---|---|
| API URL | `https://p01--worlds-backend--5j54dgljzm8n.code.run` |
| Health | `https://p01--worlds-backend--5j54dgljzm8n.code.run/health` |
| Deployed | 23 October 2026 |

Verified against the live service on that date: `/health` returns
`{"status":"ok","service":"worlds-api"}`; a live Qloo graph request for Avicii
returns `complete` with 16 nodes and 15 edges; a live discography returns
`spotifyStatus: "linked"` with 5 albums, 2 EPs and 36 singles; the Qloo image
endpoint returns `provenance.mode: "live"`; a recording story returns credits,
sampled-by and other-version links plus a Wikipedia summary. Rate-limit headers
report the configured caps (graph 10, Qloo images 20, music 30 per minute), the
error envelope carries a `requestId` with no stack trace, and no credential
appears in any response body.

**Known gap:** `CORS_ALLOWED_ORIGIN` on this service still holds the default
`http://localhost:3000`, so the deployed web app cannot read API responses. A
request carrying `Origin: http://localhost:3000` receives
`access-control-allow-origin`, while `https://worlds-fm.vercel.app` does not.
Add the web origin in the dashboard and the service restarts with it.

## Why Northflank

| Requirement | How Northflank meets it |
|---|---|
| No credit card | The Sandbox plan is free and needs no card |
| No cold starts | Sandbox services are "always on, no sleeping" |
| Free allowance | Up to $20/month of resources across 2 services, 2 jobs and 1 database |
| Build from GitHub | Connects to the repository and redeploys on push |
| No local Docker | The image is built remotely, so a full local disk does not matter |

A small always-on service (about 0.2 vCPU and 512 MB) costs roughly $3/month of
the $20 allowance, which leaves room to raise the size during a demo.

## One-time setup

1. Sign up at <https://app.northflank.com/signup> (no card required).
2. Create a project.
3. **Create service → Build from Git repository**, connect GitHub, and pick
   `Mofe-Bankole/worlds.fm`.
4. Set the branch to deploy (`main`).
5. Set the build options:

   | Setting | Value |
   |---|---|
   | Build type | Dockerfile |
   | Dockerfile path | `apps/api/Dockerfile` |
   | Build context | `/` (the repository root) |

   The build context must be the repository root: the image needs
   `pnpm-lock.yaml` and `packages/shared`, not just `apps/api`.

6. Choose the smallest compute plan that fits the allowance.
7. Add a public HTTP port of **4000** with a health check on `/health`. The
   Dockerfile exposes 4000 and `config.ts` reads `PORT` from the environment, so
   the app listens on whatever port the platform assigns.
8. Add the environment variables below, then deploy.

## Environment variables

Set these on the service. Only the credentials are secret; the rest are plain
configuration.

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `HOST` | `0.0.0.0` | Required for the platform to reach the process |
| `PORT` | `4000` | Must match the public port configured above |
| `TRUST_PROXY` | `1` | One trusted hop. See below. |
| `LOG_LEVEL` | `info` | |
| `CORS_ALLOWED_ORIGIN` | `https://worlds-fm.vercel.app` | **Required.** Comma-separate several. |
| `MEDIA_USER_AGENT` | `worlds-fm/0.1 (+https://github.com/Mofe-Bankole/worlds.fm)` | MusicBrainz requires a contact URL |
| `QLOO_API_KEY` | from Qloo | Secret. Empty keeps affinity features disabled. |
| `QLOO_API_BASE_URL` | `https://hackathon.api.qloo.com` | |
| `SPOTIFY_CLIENT_ID` | from Spotify | Secret. Empty means no covers or Spotify links. |
| `SPOTIFY_CLIENT_SECRET` | from Spotify | Secret |
| `THEAUDIODB_API_KEY` | `123` | TheAudioDB's documented free development key |

Never place any of these in a `NEXT_PUBLIC_*` variable, and never commit a real
value. `.env.example` lists names only.

### CORS

The browser refuses a response whose origin is not allowlisted, so the API is
unusable from the deployed web app until `CORS_ALLOWED_ORIGIN` names that exact
origin (`scheme://host`, no trailing slash, no path). Keep
`http://localhost:3000` in the list while developing locally, separated by a
comma. A Vercel preview deployment has its own origin and must be added
separately if you want to test from a preview URL.

### TRUST_PROXY

The platform terminates TLS and appends the visitor's address to
`X-Forwarded-For`. `TRUST_PROXY=1` tells Fastify to trust exactly one hop, so
per-client rate limiting sees the visitor's IP rather than the proxy's.
`TRUST_PROXY=true` is rejected by `config.ts` because it would let a client
forge the header and evade the limit.

## Verifying a deployment

Replace `<api>` with the service URL Northflank shows.

```bash
# Health. Needs no credentials.
curl -sS https://<api>/health
# {"status":"ok","service":"worlds-api"}

# Live Qloo affinity (requires QLOO_API_KEY).
curl -sS "https://<api>/api/v1/graph/artist?query=Avicii" | head -c 200

# Live discography (requires the Spotify credentials for covers and links).
curl -sS "https://<api>/api/v1/music/discography?name=Tame%20Impala"
```

Read the response for the honest degradation markers rather than assuming
success:

- `"spotifyStatus":"not_configured"` means the Spotify credentials are missing,
  so MusicBrainz data is returned with Cover Art Archive covers.
- `"spotifyStatus":"unavailable"` means Spotify was reached but failed.
- `qloo_not_configured` means `QLOO_API_KEY` is missing.

Check the CORS header from the web origin, which is what the browser needs:

```bash
curl -sS -o /dev/null -D - -X OPTIONS "https://<api>/api/v1/music/discography?name=x" \
  -H "Origin: https://worlds-fm.vercel.app" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control
```

## Pointing the web app at the deployed API

Set `NEXT_PUBLIC_API_BASE_URL` in the Vercel project to the API URL, and make
sure this service's `CORS_ALLOWED_ORIGIN` lists the web origin. Both are needed:
one for the request to be made, the other for the response to be readable.

`NEXT_PUBLIC_*` values are inlined into the browser bundle **at build time**, so
changing this URL requires a rebuild and redeploy of the web app, not just a
restart.

## Operational notes

- The service is always on, so there are no cold starts to warm up before a demo.
- The cache is in-memory and resets on every redeploy. Repeat views of a
  discography are fast only while the instance stays up.
- `MEDIA_CACHE_*` and `QLOO_CACHE_*` tune that cache. It is disposable, so no
  persistent volume is needed.
- The Sandbox allowance is a monthly resource budget, not a hard request cap.
  Keep the compute plan small and raise it only for the demo.

## Rate limits

`QLOO_RATE_LIMIT_PER_MINUTE`, `GRAPH_RATE_LIMIT_PER_MINUTE` and
`MUSIC_RATE_LIMIT_PER_MINUTE` cap requests per client IP. A graph exploration
can spend up to four Qloo requests, which is why the graph limit is the lowest.
Raise them deliberately: one discography request makes several MusicBrainz
calls, and MusicBrainz allows about one request per second.

## Alternative hosts, and why they were not chosen

| Host | Blocker |
|---|---|
| Render | Free tier fits, but the account is suspended |
| Railway | Free trial credit already spent; the $1/month Free plan keeps almost nothing running |
| Vercel | Would make the API serverless, so in-memory caching, the Spotify token cache, the MusicBrainz throttle and rate limiting all become per-instance. Fastify is also a poorer fit than a long-lived process. |
| Fly.io | No free allowance since 2024; card required |
| Koyeb | Card with a $29 hold required since February 2026 |
| Google Cloud Run | Generous always-free tier, but a billing account and card are required |
| Cloudflare Workers | Cannot run Fastify: no Node HTTP server and a 10 ms CPU budget per request |
| Deno Deploy | Runs Deno, not Node; Fastify needs a Node HTTP server |
| SnapDeploy / Back4App | Container hosts with no card, but they sleep after 15 minutes and cap hours (100/month) or runtime per deploy (60 minutes) |
