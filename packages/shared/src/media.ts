import { z } from "zod";

/**
 * Media resolution contracts for Worlds.fm Backend Phase 0.
 *
 * Provider-agnostic shapes shared between the Fastify API and web clients.
 * Contracts here describe *discovery and provenance*, not permission:
 * an image being reachable through an API never makes it rights-cleared.
 */

/** MusicBrainz identifiers are UUIDs (artists, releases, release groups). */
export const musicBrainzIdSchema = z.uuid();

export const mediaImageTypeSchema = z.enum([
  "artist",
  "album",
  "track",
  "background"
]);
export type MediaImageType = z.infer<typeof mediaImageTypeSchema>;

/**
 * Rights review state for an image candidate.
 * - `cleared`: permission or licensing explicitly verified; safe to display.
 * - `unverified`: reachable via an API, but no confirmed license evidence.
 * - `restricted`: known to be unusable for public display.
 */
export const mediaRightsStatusSchema = z.enum([
  "cleared",
  "unverified",
  "restricted"
]);
export type MediaRightsStatus = z.infer<typeof mediaRightsStatusSchema>;

export const mediaResolutionStatusSchema = z.enum([
  "resolved",
  "ambiguous",
  "not_found"
]);
export type MediaResolutionStatus = z.infer<typeof mediaResolutionStatusSchema>;

/**
 * One discovered image. Always an exploratory candidate at the provider layer;
 * promotion to public display requires a verified rights decision.
 */
export const mediaImageCandidateSchema = z.object({
  /** Direct image URL on the provider's or archive's host. */
  url: z.url(),
  /** Discovering provider, e.g. "theaudiodb" | "fanart" | "coverartarchive". */
  provider: z.string().min(1),
  /** Human-viewable page describing the asset, when one exists. */
  sourcePageUrl: z.url().nullable(),

  artistName: z.string().min(1).nullable(),
  albumTitle: z.string().min(1).nullable(),

  artistMbid: musicBrainzIdSchema.nullable(),
  releaseMbid: musicBrainzIdSchema.nullable(),
  releaseGroupMbid: musicBrainzIdSchema.nullable(),

  imageType: mediaImageTypeSchema,

  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),

  attribution: z.string().min(1).nullable(),
  copyrightHolder: z.string().min(1).nullable(),
  licenseUrl: z.url().nullable(),

  rightsStatus: mediaRightsStatusSchema
});
export type MediaImageCandidate = z.infer<typeof mediaImageCandidateSchema>;

/** Normalized artist identity after verified matching. */
export const artistIdentitySchema = z.object({
  name: z.string().min(1),
  mbid: musicBrainzIdSchema.nullable(),
  theAudioDbId: z.string().min(1).nullable()
});
export type ArtistIdentity = z.infer<typeof artistIdentitySchema>;

/** Normalized album identity. Distinguishes release vs. release-group IDs. */
export const albumIdentitySchema = z.object({
  title: z.string().min(1),
  artistName: z.string().min(1),
  artistMbid: musicBrainzIdSchema.nullable(),
  releaseMbid: musicBrainzIdSchema.nullable(),
  releaseGroupMbid: musicBrainzIdSchema.nullable(),
  theAudioDbAlbumId: z.string().min(1).nullable()
});
export type AlbumIdentity = z.infer<typeof albumIdentitySchema>;

export const mediaProviderStatusSchema = z.enum([
  "ok",
  "no_results",
  "error",
  "skipped",
  "disabled"
]);
export type MediaProviderStatus = z.infer<typeof mediaProviderStatusSchema>;

/** Per-provider outcome so callers can see provenance and failures. */
export const mediaProviderReportSchema = z.object({
  provider: z.string().min(1),
  status: mediaProviderStatusSchema,
  detail: z.string().min(1).optional()
});
export type MediaProviderReport = z.infer<typeof mediaProviderReportSchema>;

export const mediaFallbackReasonSchema = z.enum([
  "unresolved",
  "ambiguous",
  "no_images",
  "rights_unverified",
  "providers_unavailable"
]);
export type MediaFallbackReason = z.infer<typeof mediaFallbackReasonSchema>;

/** Why there is nothing safe to display, and what a client should do. */
export const mediaFallbackSchema = z.object({
  reason: mediaFallbackReasonSchema,
  message: z.string().min(1)
});
export type MediaFallback = z.infer<typeof mediaFallbackSchema>;

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export const artistMediaQuerySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    mbid: musicBrainzIdSchema.optional()
  })
  .strict();
export type ArtistMediaQuery = z.infer<typeof artistMediaQuerySchema>;

export const albumMediaQuerySchema = z
  .object({
    artist: z.string().trim().min(2).max(120),
    title: z.string().trim().min(1).max(200),
    artistMbid: musicBrainzIdSchema.optional(),
    releaseMbid: musicBrainzIdSchema.optional(),
    releaseGroupMbid: musicBrainzIdSchema.optional()
  })
  .strict();
export type AlbumMediaQuery = z.infer<typeof albumMediaQuerySchema>;

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

export const artistMediaResponseSchema = z.object({
  subjectType: z.literal("artist"),
  query: z.object({
    name: z.string().min(1),
    mbid: musicBrainzIdSchema.nullable()
  }),
  status: mediaResolutionStatusSchema,
  artist: artistIdentitySchema.nullable(),
  /** Identity candidates surfaced only when `status` is "ambiguous". */
  matches: z.array(artistIdentitySchema),
  /** Exploratory candidates. Never assume these are display-safe. */
  candidates: z.array(mediaImageCandidateSchema),
  /** Rights-cleared images approved for public display. */
  approvedImages: z.array(mediaImageCandidateSchema),
  fallback: mediaFallbackSchema.nullable(),
  providers: z.array(mediaProviderReportSchema),
  /** True when served from the API's cache rather than freshly resolved. */
  cached: z.boolean(),
  generatedAt: z.iso.datetime()
});
export type ArtistMediaResponse = z.infer<typeof artistMediaResponseSchema>;

export const albumMediaResponseSchema = z.object({
  subjectType: z.literal("album"),
  query: z.object({
    artist: z.string().min(1),
    title: z.string().min(1),
    artistMbid: musicBrainzIdSchema.nullable(),
    releaseMbid: musicBrainzIdSchema.nullable(),
    releaseGroupMbid: musicBrainzIdSchema.nullable()
  }),
  status: mediaResolutionStatusSchema,
  album: albumIdentitySchema.nullable(),
  /** Identity candidates surfaced only when `status` is "ambiguous". */
  matches: z.array(albumIdentitySchema),
  candidates: z.array(mediaImageCandidateSchema),
  approvedImages: z.array(mediaImageCandidateSchema),
  fallback: mediaFallbackSchema.nullable(),
  providers: z.array(mediaProviderReportSchema),
  cached: z.boolean(),
  generatedAt: z.iso.datetime()
});
export type AlbumMediaResponse = z.infer<typeof albumMediaResponseSchema>;

/** Stable API error envelope; never leaks secrets, SQL, or stack traces. */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1)
  })
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
