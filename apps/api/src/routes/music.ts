import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import {
  discographyQuerySchema,
  discographyResponseSchema,
  recordingStoryParamsSchema,
  recordingStoryResponseSchema,
  releaseTracksParamsSchema,
  releaseTracksQuerySchema,
  releaseTracksResponseSchema
} from "@worlds/shared";

import { ApiError, summarizeValidationIssues } from "../lib/errors.js";
import type { MusicCatalogService } from "../services/music-catalog.js";

export interface MusicRoutesOptions {
  service: MusicCatalogService;
  rateLimitPerMinute: number;
}

/**
 * Music catalogue: discography, track lists and track stories.
 * MusicBrainz is the source of truth; Spotify only adds covers and links.
 */
export async function musicRoutes(app: FastifyInstance, options: MusicRoutesOptions): Promise<void> {
  const { service } = options;

  await app.register(rateLimit, {
    max: options.rateLimitPerMinute,
    timeWindow: "1 minute",
    errorResponseBuilder: () =>
      new ApiError(429, "rate_limited", "Too many music requests. Try again in a minute.")
  });

  app.get("/api/v1/music/discography", async (request, reply) => {
    const parsed = discographyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(parsed.error.issues));
    }
    const body = discographyResponseSchema.parse(await service.discography(parsed.data));
    if (body.status === "not_found") return reply.status(404).send(body);
    reply.header("cache-control", "public, max-age=600");
    return body;
  });

  app.get("/api/v1/music/releases/:id/tracks", async (request, reply) => {
    const params = releaseTracksParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ApiError(400, "invalid_params", summarizeValidationIssues(params.error.issues));
    }
    const query = releaseTracksQuerySchema.safeParse(request.query);
    if (!query.success) {
      throw new ApiError(400, "invalid_query", summarizeValidationIssues(query.error.issues));
    }
    const body = await service.releaseTracks(params.data.id, query.data.spotifyAlbumId);
    reply.header("cache-control", "public, max-age=3600");
    return releaseTracksResponseSchema.parse(body);
  });

  app.get("/api/v1/music/recordings/:mbid/story", async (request, reply) => {
    const params = recordingStoryParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ApiError(400, "invalid_params", summarizeValidationIssues(params.error.issues));
    }
    const body = await service.recordingStory(params.data.mbid);
    reply.header("cache-control", "public, max-age=3600");
    return recordingStoryResponseSchema.parse(body);
  });
}
