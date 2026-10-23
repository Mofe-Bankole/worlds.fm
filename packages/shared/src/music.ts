import { z } from "zod";

import { musicBrainzIdSchema } from "./media.js";

/**
 * Music catalogue contracts: an artist's discography, an album's track list
 * and the story behind one recording.
 *
 * Source roles (AGENTS.md sections 5 and 7):
 * - MusicBrainz (CC0) is the source of truth for identity, release types
 *   (Album, EP, Single), track lists and credits/relationships.
 * - Spotify supplies cover art, links and track numbers for playback hand-off
 *   only. Covers must be shown unaltered and always link back to Spotify.
 * - Wikidata (CC0) and Wikipedia (CC BY-SA 4.0) supply "did you know" facts,
 *   each with its source link. Nothing here is AI-written or inferred.
 */

export const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{22}$/, "must be a Spotify ID");

export const RELEASE_KINDS = ["album", "ep", "single"] as const;
export const releaseKindSchema = z.enum(RELEASE_KINDS);
export type ReleaseKind = z.infer<typeof releaseKindSchema>;

export const spotifyLinkSchema = z.object({
  id: spotifyIdSchema,
  url: z.url()
});
export type SpotifyLink = z.infer<typeof spotifyLinkSchema>;

export const coverArtSchema = z.object({
  /** Small rendition (about 300px) for grids. */
  url: z.url(),
  /** Larger rendition (about 640px) for detail views. */
  largeUrl: z.url(),
  provider: z.enum(["spotify", "coverartarchive"]),
  /** Page the cover must link back to (Spotify album page or MusicBrainz release group). */
  linkUrl: z.url()
});
export type CoverArt = z.infer<typeof coverArtSchema>;

export const spotifyStatusSchema = z.enum([
  /** Spotify was consulted and the artist is linked from MusicBrainz. */
  "linked",
  /** MusicBrainz has no Spotify link for this artist, so Spotify was not guessed. */
  "no_spotify_link",
  /** Spotify failed or timed out; MusicBrainz data is still returned. */
  "unavailable",
  /** SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set on the server. */
  "not_configured"
]);
export type SpotifyStatus = z.infer<typeof spotifyStatusSchema>;

/* --------------------------------- Discography --------------------------------- */

export const discographyQuerySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    mbid: musicBrainzIdSchema.optional(),
    /**
     * Which Spotify listings to join. `albums` joins the album listing only,
     * which is one Spotify request for most artists. `all` also joins the
     * singles listing, which Spotify caps at ten items per request, so a
     * prolific artist costs several. Singles are the bulk of a discography and
     * of the Spotify quota, so they are fetched only when asked for.
     */
    include: z.enum(["albums", "all"]).default("albums")
  })
  .strict()
  .refine((q) => Boolean(q.name ?? q.mbid), { message: "name or mbid is required" });
export type DiscographyQuery = z.infer<typeof discographyQuerySchema>;

export const musicArtistSchema = z.object({
  mbid: musicBrainzIdSchema,
  name: z.string().min(1),
  disambiguation: z.string().nullable(),
  musicbrainzUrl: z.url(),
  spotify: spotifyLinkSchema.nullable()
});
export type MusicArtist = z.infer<typeof musicArtistSchema>;

export const artistCandidateSchema = z.object({
  mbid: musicBrainzIdSchema,
  name: z.string().min(1),
  disambiguation: z.string().nullable()
});

export const releaseSchema = z.object({
  /** MusicBrainz release-group ID. */
  id: musicBrainzIdSchema,
  title: z.string().min(1),
  kind: releaseKindSchema,
  /** MusicBrainz secondary types kept for context, e.g. "Soundtrack" or "Mixtape/Street". */
  secondaryTypes: z.array(z.string()),
  /** MusicBrainz first release date: YYYY, YYYY-MM or YYYY-MM-DD. */
  firstReleaseDate: z.string().nullable(),
  year: z.number().int().nullable(),
  /** From the matched Spotify album; null when Spotify has no match. */
  trackCount: z.number().int().nullable(),
  cover: coverArtSchema.nullable(),
  spotify: spotifyLinkSchema.nullable(),
  musicbrainzUrl: z.url()
});
export type Release = z.infer<typeof releaseSchema>;

export const discographyResponseSchema = z.object({
  status: z.enum(["ok", "not_found", "ambiguous"]),
  artist: musicArtistSchema.nullable(),
  /** Set when status is `ambiguous`: several artists share the exact name. */
  candidates: z.array(artistCandidateSchema),
  releases: z.array(releaseSchema),
  counts: z.object({ album: z.number().int(), ep: z.number().int(), single: z.number().int() }),
  spotifyStatus: spotifyStatusSchema,
  /**
   * Release kinds present here whose Spotify covers and links were not
   * fetched, because Spotify lists them separately from albums and the caller
   * asked for `include=albums`. Empty when `include=all`, when Spotify was not
   * consulted, or when a kind has no releases. The releases themselves are
   * complete either way: covers fall back to the Cover Art Archive, so this
   * only says the Spotify join can still be filled in.
   */
  spotifyPending: z.array(releaseKindSchema),
  notice: z.string().min(1),
  retrievedAt: z.iso.datetime()
});
export type DiscographyResponse = z.infer<typeof discographyResponseSchema>;

/* --------------------------------- Track list ---------------------------------- */

export const releaseTracksParamsSchema = z.object({ id: musicBrainzIdSchema });
export const releaseTracksQuerySchema = z
  .object({ spotifyAlbumId: spotifyIdSchema.optional() })
  .strict();

export const trackSchema = z.object({
  disc: z.number().int().min(1),
  position: z.number().int().min(1),
  /** Printed track number, e.g. "A1" on vinyl or "3" digitally. */
  number: z.string(),
  title: z.string().min(1),
  durationMs: z.number().int().nullable(),
  /** Full credit as printed, e.g. "Kendrick Lamar & SZA". */
  artistCredit: z.string(),
  /** Credited artists other than the release's main artist. */
  featured: z.array(z.string()),
  recordingMbid: musicBrainzIdSchema,
  isrc: z.string().nullable(),
  /** From Spotify; null when unmatched. */
  explicit: z.boolean().nullable(),
  spotify: spotifyLinkSchema.nullable()
});
export type Track = z.infer<typeof trackSchema>;

export const releaseTracksResponseSchema = z.object({
  release: z.object({
    id: musicBrainzIdSchema,
    releaseMbid: musicBrainzIdSchema,
    title: z.string().min(1),
    date: z.string().nullable(),
    country: z.string().nullable(),
    format: z.string().nullable(),
    musicbrainzUrl: z.url()
  }),
  discCount: z.number().int().min(1),
  totalDurationMs: z.number().int().nullable(),
  tracks: z.array(trackSchema),
  spotifyAlbum: spotifyLinkSchema.nullable(),
  spotifyStatus: spotifyStatusSchema,
  notice: z.string().min(1),
  retrievedAt: z.iso.datetime()
});
export type ReleaseTracksResponse = z.infer<typeof releaseTracksResponseSchema>;

/* -------------------------------- Track story --------------------------------- */

export const recordingStoryParamsSchema = z.object({ mbid: musicBrainzIdSchema });

export const CREDIT_ROLES = ["written_by", "produced_by", "mixed_by", "engineered_by", "performed_by"] as const;
export const creditRoleSchema = z.enum(CREDIT_ROLES);
export type CreditRole = z.infer<typeof creditRoleSchema>;

export const creditedPersonSchema = z.object({
  name: z.string().min(1),
  mbid: musicBrainzIdSchema.nullable(),
  /** Extra detail from MusicBrainz, e.g. "guitar" or "lyricist". */
  detail: z.string().nullable()
});

export const creditSchema = z.object({
  role: creditRoleSchema,
  people: z.array(creditedPersonSchema).min(1)
});
export type Credit = z.infer<typeof creditSchema>;

export const linkedRecordingSchema = z.object({
  mbid: musicBrainzIdSchema,
  title: z.string().min(1),
  /** Null when MusicBrainz does not include the credit in the relationship. */
  artist: z.string().nullable(),
  musicbrainzUrl: z.url()
});
export type LinkedRecording = z.infer<typeof linkedRecordingSchema>;

export const factSourceSchema = z.object({
  provider: z.enum(["wikipedia", "wikidata", "musicbrainz"]),
  label: z.string().min(1),
  url: z.url(),
  /** Licence that applies to reused text, e.g. CC BY-SA 4.0 for Wikipedia. */
  license: z.object({ name: z.string().min(1), url: z.url() }).nullable()
});

export const trackFactSchema = z.object({
  kind: z.enum(["summary", "award", "nomination"]),
  text: z.string().min(1),
  /** Year the award or nomination applies to, when Wikidata states it. */
  year: z.number().int().nullable(),
  source: factSourceSchema
});
export type TrackFact = z.infer<typeof trackFactSchema>;

export const recordingStoryResponseSchema = z.object({
  recording: z.object({
    mbid: musicBrainzIdSchema,
    title: z.string().min(1),
    artistCredit: z.string(),
    durationMs: z.number().int().nullable(),
    isrcs: z.array(z.string()),
    musicbrainzUrl: z.url(),
    spotify: spotifyLinkSchema.nullable()
  }),
  work: z
    .object({
      mbid: musicBrainzIdSchema,
      title: z.string().min(1),
      musicbrainzUrl: z.url(),
      wikidataId: z.string().regex(/^Q\d+$/).nullable()
    })
    .nullable(),
  credits: z.array(creditSchema),
  /** Recordings this one samples (MusicBrainz "samples material"). */
  samples: z.array(linkedRecordingSchema),
  /** Recordings that sample this one. */
  sampledBy: z.array(linkedRecordingSchema),
  /** Recordings of the same song credited to other artists. */
  otherVersions: z.array(linkedRecordingSchema),
  facts: z.array(trackFactSchema),
  notice: z.string().min(1),
  retrievedAt: z.iso.datetime()
});
export type RecordingStoryResponse = z.infer<typeof recordingStoryResponseSchema>;

export const MUSIC_CATALOG_NOTICE =
  "Release types, track lists and credits come from MusicBrainz. Covers and links come from Spotify and must link back to it. Facts cite Wikidata or Wikipedia. Nothing here implies endorsement or influence beyond what the source states.";
