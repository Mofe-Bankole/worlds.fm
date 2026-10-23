import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { culturalDiscoveryResponseSchema, discoveryArtistQuerySchema } from "@worlds/shared";

import { qlooNotConfigured } from "../integrations/qloo/errors.js";
import { ApiError, summarizeValidationIssues } from "../lib/errors.js";
import type { CulturalDiscoveryService } from "../services/cultural-discovery.js";

export interface GraphRoutesOptions {
  service: CulturalDiscoveryService;
  /** One exploration can spend up to four Qloo requests, so this is lower than the Qloo route limit. */
  rateLimitPerMinute: number;
}

/**
 * Cultural Discovery (B1.3). Every edge in the returned graph is
 * `qloo_affinity`: a cultural recommendation, never verified history.
 */
export async function graphRoutes(app: FastifyInstance, options: GraphRoutesOptions): Promise<void> {
  const { service } = options;

  await app.register(rateLimit, {
    max: options.rateLimitPerMinute,
    timeWindow: "1 minute",
    errorResponseBuilder: () =>
      new ApiError(429, "rate_limited", "Too many graph requests. Try again in a minute.")
  });

  app.get("/api/v1/graph/artist", async (request, reply) => {
    const parsed = discoveryArtistQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(parsed.error.issues));
    }
    if (!service.isEnabled) {
      throw qlooNotConfigured();
    }
    const { body, cacheHit } = await service.discoverArtist(parsed.data);
    const validated = culturalDiscoveryResponseSchema.parse(body);
    reply.header("x-worlds-cache", cacheHit ? "hit" : "miss");
    if (validated.status === "not_found") {
      return reply.status(404).send(validated);
    }
    reply.header("cache-control", "private, max-age=60");
    return validated;
  });
}
