# syntax=docker/dockerfile:1

# Worlds.fm API (Fastify).
#
# The build context is the REPOSITORY ROOT, because the workspace lockfile and
# packages/shared are needed to build this one package. The image is built on
# the host's builders (Northflank, or any container host), never locally:
#
#   docker build -f apps/api/Dockerfile -t worlds-fm-api .
#
# On Northflank set: build type Dockerfile, Dockerfile path apps/api/Dockerfile,
# build context `/`. See docs/backend/deployment.md.

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Stage 1: build. Dev dependencies (tsup, TypeScript) live only here.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Pinned to the workspace's packageManager field. corepack is avoided because
# its signing keys need network refreshes that fail inside locked-down builders.
RUN npm install --global pnpm@10.34.7

WORKDIR /repo

# Manifests first, so dependency installation is cached independently of source.
# Every workspace manifest must be present for pnpm to resolve the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Only @worlds/api and its workspace dependency (@worlds/shared) are installed;
# the Next.js app is not built in this image.
RUN pnpm install --frozen-lockfile --filter "@worlds/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api

# tsup bundles @worlds/shared into dist/server.js, so the runtime image needs
# neither the shared source nor a build step for it.
RUN pnpm --filter @worlds/api build

# ---------------------------------------------------------------------------
# Stage 2: runtime. Production dependencies only, no toolchain, non-root.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
RUN npm install --global pnpm@10.34.7

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter "@worlds/api..." \
  && pnpm store prune

COPY --from=build /repo/apps/api/dist apps/api/dist

# HOST defaults to 0.0.0.0 in config.ts. PORT is read from the environment, so
# the service follows whatever port the platform assigns.
ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000

# The image has no curl or wget, so the probe uses the runtime's own fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "apps/api/dist/server.js"]
