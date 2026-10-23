import { z } from "zod";

import { culturalGraphSchema } from "./cultural-graph.js";
import { QLOO_MAX_QUERY_LENGTH, qlooEntitySchema, qlooEntityTypeSchema } from "./qloo.js";

/**
 * Cultural Discovery contracts for Backend Milestone B1.3.
 *
 * `GET /api/v1/graph/artist?query=<name>` resolves an artist through Qloo
 * Search, retrieves bounded Qloo Insights and returns a cultural graph. Every
 * Qloo link stays `qloo_affinity`: never verified history, collaboration,
 * influence, endorsement, or a confirmed place.
 */

/** Categories retrieved in B1.3. Place, podcast and video_game are excluded. */
export const DISCOVERY_CATEGORIES = ["artist", "brand", "destination"] as const;
export const discoveryCategorySchema = z.enum(DISCOVERY_CATEGORIES);
export type DiscoveryCategory = z.infer<typeof discoveryCategorySchema>;

export const DISCOVERY_MAX_PER_CATEGORY = 5;

export const discoveryArtistQuerySchema = z.object({
  query: z.string().trim().min(1).max(QLOO_MAX_QUERY_LENGTH),
  /** Results requested per category. Bounded to protect Qloo quota. */
  limit: z.coerce.number().int().min(1).max(DISCOVERY_MAX_PER_CATEGORY).default(DISCOVERY_MAX_PER_CATEGORY)
});
export type DiscoveryArtistQuery = z.infer<typeof discoveryArtistQuerySchema>;

/**
 * - `complete`: every category answered (possibly with no results).
 * - `partial`: at least one category failed; the graph holds the rest.
 * - `needs_disambiguation`: the name did not identify exactly one artist.
 *   No graph is returned; the caller must choose a candidate.
 * - `not_found`: Qloo returned no matching artist. No graph is returned.
 */
export const discoveryStatusSchema = z.enum([
  "complete",
  "partial",
  "needs_disambiguation",
  "not_found"
]);
export type DiscoveryStatus = z.infer<typeof discoveryStatusSchema>;

export const discoveryCategoryReportSchema = z.object({
  category: discoveryCategorySchema,
  status: z.enum(["ok", "empty", "failed"]),
  count: z.number().int().min(0),
  /** Stable API error code when `failed`; never an upstream message. */
  errorCode: z.string().nullable()
});
export type DiscoveryCategoryReport = z.infer<typeof discoveryCategoryReportSchema>;

export const discoveryWarningSchema = z.object({
  code: z.enum(["category_unavailable", "no_exact_match"]),
  message: z.string().min(1),
  category: qlooEntityTypeSchema.nullable()
});
export type DiscoveryWarning = z.infer<typeof discoveryWarningSchema>;

export const culturalDiscoveryResponseSchema = z
  .object({
    status: discoveryStatusSchema,
    query: z.string(),
    resolution: z.enum(["exact", "ambiguous", "fuzzy", "none"]),
    /** The resolved artist, only when `resolution` is `exact`. */
    root: qlooEntitySchema.nullable(),
    /** Closest Qloo matches when the artist could not be resolved uniquely. */
    candidates: z.array(qlooEntitySchema),
    graph: culturalGraphSchema.nullable(),
    categories: z.array(discoveryCategoryReportSchema),
    warnings: z.array(discoveryWarningSchema),
    retrievedAt: z.iso.datetime()
  })
  .superRefine((value, ctx) => {
    const hasGraph = value.graph !== null;
    const expectsGraph = value.status === "complete" || value.status === "partial";
    if (hasGraph !== expectsGraph) {
      ctx.addIssue({ code: "custom", message: "graph must be present exactly for complete/partial status" });
    }
    if (expectsGraph && value.root === null) {
      ctx.addIssue({ code: "custom", message: "a graph requires a resolved root" });
    }
  });
export type CulturalDiscoveryResponse = z.infer<typeof culturalDiscoveryResponseSchema>;
