import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { FetchLike } from "../src/lib/http-client.js";

/**
 * Test app factory: deterministic config (no provider network restrictions,
 * fast timeouts) with an injected stub fetch. No test ever reaches the real
 * network — `createStubFetch` throws on unmatched URLs.
 */
export async function buildTestApp(options: {
  env?: Record<string, string>;
  fetchFn?: FetchLike;
}): Promise<FastifyInstance> {
  const config = loadConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    MUSICBRAINZ_MIN_INTERVAL_MS: "0",
    MEDIA_HTTP_TIMEOUT_MS: "2000",
    MEDIA_HTTP_RETRY_BASE_MS: "25",
    ...options.env
  });
  return buildApp({
    config,
    ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
    logger: false
  });
}
