import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { artistConnectionQuerySchema, artistConnectionResponseSchema, culturalDiscoveryResponseSchema, discoveryArtistQuerySchema } from "@worlds/shared";

import { qlooNotConfigured } from "../integrations/qloo/errors.js";
import { ApiError, summarizeValidationIssues } from "../lib/errors.js";
import type { CulturalDiscoveryService } from "../services/cultural-discovery.js";
import type { ConnectionFindingsIndex } from "../services/connection-findings.js";

export interface GraphRoutesOptions {
  service: CulturalDiscoveryService;
  findings: ConnectionFindingsIndex;
  /** One exploration can spend up to four Qloo requests, so this is lower than the Qloo route limit. */
  rateLimitPerMinute: number;
}

/**
 * Cultural Discovery (B1.3). Every edge in the returned graph is
 * `qloo_affinity`: a cultural recommendation, never verified history.
 */
export async function graphRoutes(app: FastifyInstance, options: GraphRoutesOptions): Promise<void> {
  const { service, findings } = options;

  await app.register(rateLimit, {
    max: options.rateLimitPerMinute,
    timeWindow: "1 minute",
    errorResponseBuilder: () =>
      new ApiError(429, "rate_limited", "Too many graph requests. Try again in a minute.")
  });

  app.get("/api/v1/graph/artist", async (request, reply) => {
    const startedAt = performance.now();
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
    reply.header("server-timing", `graph;dur=${(performance.now() - startedAt).toFixed(1)}`);
    if (validated.status === "not_found") {
      return reply.status(404).send(validated);
    }
    reply.header("cache-control", "private, max-age=60");
    return validated;
  });

  // A published story lookup is never allowed to trigger provider or agent work.
  app.get("/api/v1/graph/artist-connection", async (request, reply) => {
    const startedAt = performance.now();
    const parsed = artistConnectionQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(parsed.error.issues));
    }
    const connection = artistConnectionResponseSchema.parse(
      findings.artistConnection(parsed.data.subject, parsed.data.target)
    );
    reply.header("cache-control", "public, max-age=300");
    reply.header("server-timing", `pair;dur=${(performance.now() - startedAt).toFixed(1)}`);
    return connection;
  });
}
