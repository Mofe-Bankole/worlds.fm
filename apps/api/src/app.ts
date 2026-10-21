import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import { loadConfig, type AppConfig } from "./config.js";
import { ApiError, type ApiErrorBody } from "./lib/errors.js";
import { ProviderHttpClient, type FetchLike } from "./lib/http-client.js";
import { TheAudioDbAdapter } from "./integrations/theaudiodb/index.js";
import { FanartAdapter } from "./integrations/fanart/index.js";
import { MusicBrainzAdapter } from "./integrations/musicbrainz/index.js";
import { CoverArtArchiveAdapter } from "./integrations/coverartarchive/index.js";
import { MediaResolver } from "./services/media-resolver.js";
import { healthRoutes } from "./routes/health.js";
import { mediaRoutes } from "./routes/media.js";

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
    trustProxy: true
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

  const resolver = buildMediaResolver(config, options.fetchFn);
  await app.register(healthRoutes);
  await app.register(mediaRoutes, { resolver });

  return app;
}

function errorBody(code: string, message: string, requestId: string): ApiErrorBody {
  return { error: { code, message, requestId } };
}

function buildMediaResolver(config: AppConfig, fetchFn?: FetchLike): MediaResolver {
  const cacheOptions = {
    ttlMs: config.mediaCacheTtlMs,
    negativeTtlMs: config.mediaNegativeCacheTtlMs,
    maxEntries: config.mediaCacheMaxEntries
  };
  const providerHttp = new ProviderHttpClient({
    ...(fetchFn !== undefined ? { fetchFn } : {}),
    timeoutMs: config.mediaHttpTimeoutMs,
    retries: config.mediaHttpRetries,
    retryBaseDelayMs: config.mediaHttpRetryBaseMs,
    userAgent: config.mediaUserAgent
  });
  const musicBrainzHttp = new ProviderHttpClient({
    ...(fetchFn !== undefined ? { fetchFn } : {}),
    timeoutMs: config.mediaHttpTimeoutMs,
    retries: config.mediaHttpRetries,
    retryBaseDelayMs: config.mediaHttpRetryBaseMs,
    userAgent: config.mediaUserAgent,
    // MusicBrainz asks API clients for ~1 request/second.
    minIntervalMs: config.musicBrainzMinIntervalMs
  });

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
