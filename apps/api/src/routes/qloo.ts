import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import {
  qlooInsightsQuerySchema,
  qlooInsightsResponseSchema,
  qlooSearchQuerySchema,
  qlooSearchResponseSchema
} from "@worlds/shared";

import { mapQlooError, qlooNotConfigured } from "../integrations/qloo/errors.js";
import type { QlooAdapter } from "../integrations/qloo/index.js";
import { ApiError, summarizeValidationIssues } from "../lib/errors.js";

export interface QlooRoutesOptions {
  adapter: QlooAdapter;
  /** Requests per minute per client. Each request can spend Qloo quota. */
  rateLimitPerMinute: number;
}

/**
 * Qloo integration endpoints (B1.1). These are test and integration routes:
 * they are rate limited per client and cap result counts, because every call
 * can spend upstream quota. Responses are validated against the shared
 * contracts and are always labelled as affinity, never as verified history.
 */
export async function qlooRoutes(
  app: FastifyInstance,
  options: QlooRoutesOptions
): Promise<void> {
  const { adapter } = options;

  // Registered inside this plugin so the limit applies to Qloo routes only.
  await app.register(rateLimit, {
    max: options.rateLimitPerMinute,
    timeWindow: "1 minute",
    errorResponseBuilder: () =>
      new ApiError(429, "rate_limited", "Too many Qloo requests. Try again in a minute.")
  });

  app.get("/api/v1/qloo/search", async (request, reply) => {
    const parsed = qlooSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(parsed.error.issues));
    }
    if (!adapter.isEnabled) {
      throw qlooNotConfigured();
    }
    try {
      const result = await adapter.searchEntities(parsed.data);
      reply.header("cache-control", "private, max-age=60");
      return qlooSearchResponseSchema.parse(result);
    } catch (error) {
      throw mapQlooError(error);
    }
  });

  app.get("/api/v1/qloo/insights", async (request, reply) => {
    const parsed = qlooInsightsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(parsed.error.issues));
    }
    if (!adapter.isEnabled) {
      throw qlooNotConfigured();
    }
    try {
      const result = await adapter.getInsights(parsed.data);
      reply.header("cache-control", "private, max-age=60");
      return qlooInsightsResponseSchema.parse(result);
    } catch (error) {
      throw mapQlooError(error);
    }
  });
}
