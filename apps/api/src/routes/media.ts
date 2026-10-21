import type { FastifyInstance } from "fastify";
import {
  albumMediaQuerySchema,
  albumMediaResponseSchema,
  artistMediaQuerySchema,
  artistMediaResponseSchema
} from "@worlds/shared";

import { ApiError, summarizeValidationIssues } from "../lib/errors.js";
import type { MediaResolver } from "../services/media-resolver.js";

export interface MediaRoutesOptions {
  resolver: MediaResolver;
}

/**
 * Media discovery endpoints (Backend Phase 0).
 *
 * Responses are validated against the shared contracts before being sent,
 * so a contract drift fails loudly server-side instead of leaking to clients.
 */
export async function mediaRoutes(
  app: FastifyInstance,
  options: MediaRoutesOptions
): Promise<void> {
  const { resolver } = options;

  app.get("/api/v1/media/artist", async (request, reply) => {
    const parsed = artistMediaQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(parsed.error.issues));
    }
    const result = await resolver.resolveArtistMedia(parsed.data);
    reply.header("cache-control", "public, max-age=300");
    return artistMediaResponseSchema.parse(result);
  });

  app.get("/api/v1/media/album", async (request, reply) => {
    const parsed = albumMediaQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(parsed.error.issues));
    }
    const result = await resolver.resolveAlbumMedia(parsed.data);
    reply.header("cache-control", "public, max-age=300");
    return albumMediaResponseSchema.parse(result);
  });
}
