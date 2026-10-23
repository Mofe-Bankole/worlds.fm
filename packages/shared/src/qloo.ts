import { z } from "zod";

/**
 * Qloo contracts for Backend Milestone B1.1.
 *
 * Qloo answers are *cultural affinity signals*. They are never historical
 * evidence, and an affinity value is a ranking signal for a group of people,
 * never the probability that an individual will like something
 * (AGENTS.md sections 5 and 6).
 */

/**
 * Entity categories accepted by the Worlds.fm Qloo routes. They map to the
 * `filter.type` values the Qloo hackathon guide lists for `/v2/insights`
 * (`urn:entity:<name>`). Legacy search-only types (album, actor, ...) are not
 * exposed.
 */
export const QLOO_ENTITY_TYPES = [
  "artist",
  "book",
  "brand",
  "destination",
  "movie",
  "person",
  "place",
  "podcast",
  "tv_show",
  "video_game"
] as const;
export const qlooEntityTypeSchema = z.enum(QLOO_ENTITY_TYPES);
export type QlooEntityType = z.infer<typeof qlooEntityTypeSchema>;

export const QLOO_MAX_QUERY_LENGTH = 100;

/** The only host Qloo image URLs are accepted from (observed live 2026-10-23). */
export const QLOO_IMAGE_HOST = "images.qloo.com";
export const QLOO_SEARCH_MAX_RESULTS = 10;
export const QLOO_INSIGHTS_MAX_RESULTS = 20;

export const qlooSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(QLOO_MAX_QUERY_LENGTH),
  /** Defaults to `artist`: artist matching is the priority for Worlds.fm. */
  type: qlooEntityTypeSchema.default("artist"),
  limit: z.coerce.number().int().min(1).max(QLOO_SEARCH_MAX_RESULTS).default(5)
});
export type QlooSearchQuery = z.infer<typeof qlooSearchQuerySchema>;

export const qlooInsightsQuerySchema = z.object({
  /** Qloo entity IDs are UUIDs. Resolve one with the search route first. */
  entityId: z.uuid(),
  targetType: qlooEntityTypeSchema,
  limit: z.coerce.number().int().min(1).max(QLOO_INSIGHTS_MAX_RESULTS).default(10)
});
export type QlooInsightsQuery = z.infer<typeof qlooInsightsQuerySchema>;

export const qlooTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  type: z.string().nullable()
});

/** A Qloo entity with the stable Qloo identifier preserved. */
export const qlooEntitySchema = z.object({
  /** Qloo `entity_id`. Never replaced with a Worlds.fm ID. */
  id: z.string().min(1),
  name: z.string().min(1),
  /** Qloo `subtype` (for example `urn:entity:artist`), else its `type`. */
  type: z.string().nullable(),
  popularity: z.number().nullable(),
  description: z.string().nullable(),
  disambiguation: z.string().nullable(),
  tags: z.array(qlooTagSchema),
  /** Qloo-hosted image (`properties.image.url`), HTTPS on {@link QLOO_IMAGE_HOST} only. */
  imageUrl: z.url().nullable().optional()
});
export type QlooEntity = z.infer<typeof qlooEntitySchema>;

export const qlooProvenanceSchema = z.object({
  provider: z.literal("qloo"),
  /** `live` means the data came from a Qloo response, never a fixture. */
  mode: z.literal("live"),
  environment: z.literal("hackathon"),
  retrievedAt: z.iso.datetime()
});
export type QlooProvenance = z.infer<typeof qlooProvenanceSchema>;

/**
 * - `exact`: exactly one entity name equals the query after normalization.
 * - `ambiguous`: several entities share that exact name; the caller must pick.
 * - `fuzzy`: no exact name; results are Qloo's closest matches, not a hit.
 * - `none`: Qloo returned no entities.
 */
export const qlooResolutionSchema = z.enum(["exact", "ambiguous", "fuzzy", "none"]);
export type QlooResolution = z.infer<typeof qlooResolutionSchema>;

export const qlooSearchResponseSchema = z.object({
  query: z.string(),
  type: qlooEntityTypeSchema,
  resolution: qlooResolutionSchema,
  /** Set only when `resolution` is `exact`. */
  bestMatchId: z.string().nullable(),
  results: z.array(qlooEntitySchema),
  provenance: qlooProvenanceSchema
});
export type QlooSearchResponse = z.infer<typeof qlooSearchResponseSchema>;

export const qlooInsightItemSchema = z.object({
  entity: qlooEntitySchema,
  /**
   * Qloo's `query.affinity` for the entity when present, else null. A ranking
   * signal across a population. Not an individual's preference probability.
   */
  affinity: z.number().nullable()
});

export const qlooInsightsResponseSchema = z.object({
  source: z.object({ entityId: z.string().min(1) }),
  targetType: qlooEntityTypeSchema,
  /** Always `affinity`: Qloo output is never verified history. */
  kind: z.literal("affinity"),
  notice: z.string().min(1),
  results: z.array(qlooInsightItemSchema),
  provenance: qlooProvenanceSchema
});
export type QlooInsightsResponse = z.infer<typeof qlooInsightsResponseSchema>;

export const QLOO_AFFINITY_NOTICE =
  "Cultural affinity signal from Qloo. It is not evidence of history, inspiration, ownership, attendance or causation, and places and destinations are cultural recommendations, not verified locations, and it is not the probability that an individual will like an item.";

/** Most artist names one image batch may ask for. */
export const QLOO_IMAGE_BATCH_MAX = 12;

/**
 * `names` is a comma-separated list. Names are trimmed and de-duplicated
 * case-insensitively; order is kept.
 */
export const qlooArtistImagesQuerySchema = z.object({
  names: z
    .string()
    .transform((raw) => {
      const seen = new Set<string>();
      return raw
        .split(",")
        .map((name) => name.trim())
        .filter((name) => {
          const key = name.toLowerCase();
          if (!name || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    })
    .pipe(z.array(z.string().max(QLOO_MAX_QUERY_LENGTH)).min(1).max(QLOO_IMAGE_BATCH_MAX))
});
export type QlooArtistImagesQuery = z.infer<typeof qlooArtistImagesQuerySchema>;

export const qlooArtistImageSchema = z.object({
  /** The name as requested. */
  name: z.string().min(1),
  /** Image of the exact-name match. Null when there is no exact match or no image. */
  imageUrl: z.url().nullable()
});

export const qlooArtistImagesResponseSchema = z.object({
  images: z.array(qlooArtistImageSchema),
  provenance: qlooProvenanceSchema
});
export type QlooArtistImagesResponse = z.infer<typeof qlooArtistImagesResponseSchema>;
