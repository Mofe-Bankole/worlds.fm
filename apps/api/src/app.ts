import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import { loadConfig, type AppConfig } from "./config.js";
import { ApiError, type ApiErrorBody } from "./lib/errors.js";
import { ProviderHttpClient, type FetchLike } from "./lib/http-client.js";
import { TheAudioDbAdapter } from "./integrations/theaudiodb/index.js";
import { FanartAdapter } from "./integrations/fanart/index.js";
import { MusicBrainzAdapter, MusicBrainzCatalog } from "./integrations/musicbrainz/index.js";
import { SpotifyAdapter } from "./integrations/spotify/index.js";
import { WikimediaAdapter } from "./integrations/wikimedia/index.js";
import { CoverArtArchiveAdapter } from "./integrations/coverartarchive/index.js";
import { QlooAdapter } from "./integrations/qloo/index.js";
import { MediaResolver } from "./services/media-resolver.js";
import { healthRoutes } from "./routes/health.js";
import { mediaRoutes } from "./routes/media.js";
import { qlooRoutes } from "./routes/qloo.js";
import { graphRoutes } from "./routes/graph.js";
import { musicRoutes } from "./routes/music.js";
import { MusicCatalogService } from "./services/music-catalog.js";
import { CulturalDiscoveryService } from "./services/cultural-discovery.js";
import { ConnectionFindingsIndex } from "./services/connection-findings.js";

export interface BuildAppOptions {
  config?: AppConfig;
  /** Injectable fetch for tests; production uses the global fetch. */
  fetchFn?: FetchLike;
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();

  const app = Fastify({
    logger: options.logger ?? { level: config.logLevel },
    requestIdHeader: "x-request-id",
    trustProxy: config.trustProxy as unknown as NonNullable<FastifyServerOptions["trustProxy"]>
  });

  await app.register(cors, {
    origin: config.corsAllowedOrigin,
    credentials: false
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(errorBody(error.code, error.message, request.id));
    }
    const fastifyError = error as { statusCode?: number; code?: string; message?: string };
    const statusCode = typeof fastifyError.statusCode === "number" ? fastifyError.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled request error");
      return reply
        .status(500)
        .send(errorBody("internal_error", "An unexpected error occurred.", request.id));
    }
    const code = fastifyError.code ?? "bad_request";
    return reply
      .status(statusCode)
      .send(errorBody(code, fastifyError.message ?? "The request could not be processed.", request.id));
  });

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(errorBody("not_found", `Route ${request.method} ${request.url} was not found.`, request.id));
  });

  const http = buildProviderClients(config, options.fetchFn);
  const cacheOptions = {
    ttlMs: config.mediaCacheTtlMs,
    negativeTtlMs: config.mediaNegativeCacheTtlMs,
    maxEntries: config.mediaCacheMaxEntries
  };
  const resolver = buildMediaResolver(config, http);
  // One catalogue shared by the graph and music routes, so both read the same
  // cached artist lookups instead of fetching the same artist twice.
  const musicBrainz = new MusicBrainzCatalog({ http: http.musicBrainz, cache: cacheOptions });
  // Built once: the findings artifact is static and validated at import, so
  // this is a read-only lookup table, not per-request work.
  const findings = new ConnectionFindingsIndex();
  await app.register(healthRoutes);
  await app.register(mediaRoutes, { resolver });
  const qlooAdapter = buildQlooAdapter(config, options.fetchFn);
  await app.register(qlooRoutes, {
    adapter: qlooAdapter,
    rateLimitPerMinute: config.qlooRateLimitPerMinute
  });
  await app.register(graphRoutes, {
    findings,
    service: new CulturalDiscoveryService({
      adapter: qlooAdapter,
      musicBrainz,
      findings,
      cache: {
        ttlMs: config.qlooCacheTtlMs,
        negativeTtlMs: config.qlooNegativeCacheTtlMs,
        maxEntries: config.qlooCacheMaxEntries
      }
    }),
    rateLimitPerMinute: config.graphRateLimitPerMinute
  });
  await app.register(musicRoutes, {
    service: new MusicCatalogService({
      musicBrainz,
      spotify: new SpotifyAdapter({
        http: http.provider,
        ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
        clientId: config.spotifyClientId,
        clientSecret: config.spotifyClientSecret,
        timeoutMs: config.mediaHttpTimeoutMs,
        cache: cacheOptions
      }),
      wikimedia: new WikimediaAdapter({ http: http.provider, cache: cacheOptions }),
      log: app.log
    }),
    rateLimitPerMinute: config.musicRateLimitPerMinute
  });

  return app;
}

function errorBody(code: string, message: string, requestId: string): ApiErrorBody {
  return { error: { code, message, requestId } };
}

interface ProviderClients {
  provider: ProviderHttpClient;
  /** Shared by every MusicBrainz caller so the 1 request/second throttle holds process-wide. */
  musicBrainz: ProviderHttpClient;
}

function buildProviderClients(config: AppConfig, fetchFn?: FetchLike): ProviderClients {
  const provider = new ProviderHttpClient({
    ...(fetchFn !== undefined ? { fetchFn } : {}),
    timeoutMs: config.mediaHttpTimeoutMs,
    retries: config.mediaHttpRetries,
    retryBaseDelayMs: config.mediaHttpRetryBaseMs,
    userAgent: config.mediaUserAgent
  });
  const musicBrainz = new ProviderHttpClient({
    ...(fetchFn !== undefined ? { fetchFn } : {}),
    timeoutMs: config.mediaHttpTimeoutMs,
    retries: config.mediaHttpRetries,
    retryBaseDelayMs: config.mediaHttpRetryBaseMs,
    userAgent: config.mediaUserAgent,
    // MusicBrainz asks API clients for ~1 request/second.
    minIntervalMs: config.musicBrainzMinIntervalMs
  });
  return { provider, musicBrainz };
}

function buildMediaResolver(config: AppConfig, http: ProviderClients): MediaResolver {
  const cacheOptions = {
    ttlMs: config.mediaCacheTtlMs,
    negativeTtlMs: config.mediaNegativeCacheTtlMs,
    maxEntries: config.mediaCacheMaxEntries
  };
  const providerHttp = http.provider;
  const musicBrainzHttp = http.musicBrainz;
  return new MediaResolver({
    config,
    theAudioDb: new TheAudioDbAdapter({
      http: providerHttp,
      apiKey: config.theAudioDbApiKey,
      cache: cacheOptions
    }),
    fanart: new FanartAdapter({
      http: providerHttp,
      apiKey: config.fanartApiKey,
      cache: cacheOptions
    }),
    musicBrainz: new MusicBrainzAdapter({ http: musicBrainzHttp, cache: cacheOptions }),
    coverArt: new CoverArtArchiveAdapter({ http: providerHttp, cache: cacheOptions })
  });
}

function buildQlooAdapter(config: AppConfig, fetchFn?: FetchLike): QlooAdapter {
  return new QlooAdapter({
    http: new ProviderHttpClient({
      ...(fetchFn !== undefined ? { fetchFn } : {}),
      timeoutMs: config.qlooHttpTimeoutMs,
      retries: config.qlooHttpRetries,
      retryBaseDelayMs: config.mediaHttpRetryBaseMs,
      userAgent: config.mediaUserAgent
    }),
    baseUrl: config.qlooApiBaseUrl,
    apiKey: config.qlooApiKey,
    cache: {
      ttlMs: config.qlooCacheTtlMs,
      negativeTtlMs: config.qlooNegativeCacheTtlMs,
      maxEntries: config.qlooCacheMaxEntries
    }
  });
}
