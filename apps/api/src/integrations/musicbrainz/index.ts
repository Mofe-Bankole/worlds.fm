import type { AlbumIdentity, ArtistIdentity } from "@worlds/shared";
import { musicBrainzIdSchema } from "@worlds/shared";
import { z } from "zod";

import { isProviderError } from "../../lib/errors.js";
import type { ProviderHttpClient } from "../../lib/http-client.js";
import { TtlCache, type TtlCacheOptions } from "../../lib/cache.js";
import { escapeLucene } from "../../lib/matching.js";
import { parseProviderPayload } from "../../lib/parse.js";

/**
 * MusicBrainz adapter (ws/2 API).
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 *
 * Requirements honored here:
 * - A descriptive User-Agent is sent on every request (set server-side).
 * - Requests are throttled to ~1/second by the injected HTTP client.
 * MusicBrainz is an identity/metadata source (IDs, names, release groups);
 * it does not serve artist photos or covers — Cover Art Archive does that.
 */

const PROVIDER = "musicbrainz";
const BASE_URL = "https://musicbrainz.org/ws/2";

const mbArtistSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  "sort-name": z.string().nullish(),
  score: z.coerce.number().nullish(),
  disambiguation: z.string().nullish()
});
export type MbArtist = z.infer<typeof mbArtistSchema>;

const mbArtistSearchResponseSchema = z.looseObject({
  artists: z.array(mbArtistSchema).nullish()
});

/**
 * `inc=genres` returns MusicBrainz's curated genre taxonomy rather than the
 * raw folksonomy tags, which also carry non-genres such as "australian" or
 * "favourite". Each genre carries how many users applied it, so the list can
 * be ordered most- to least-applied.
 */
const mbArtistGenresSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  genres: z.array(z.looseObject({ name: z.string().min(1), count: z.number().nullish() })).nullish()
});
export type MbArtistGenres = z.infer<typeof mbArtistGenresSchema>;

const mbArtistCreditSchema = z.looseObject({
  name: z.string().nullish(),
  artist: z.looseObject({ id: z.string(), name: z.string() }).nullish()
});

const mbReleaseGroupSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  score: z.coerce.number().nullish(),
  "primary-type": z.string().nullish(),
  "first-release-date": z.string().nullish(),
  "artist-credit": z.array(mbArtistCreditSchema).nullish()
});
export type MbReleaseGroup = z.infer<typeof mbReleaseGroupSchema>;

const mbReleaseGroupSearchResponseSchema = z.looseObject({
  "release-groups": z.array(mbReleaseGroupSchema).nullish()
});

export interface MusicBrainzAdapterOptions {
  http: ProviderHttpClient;
  cache: TtlCacheOptions;
}

export class MusicBrainzAdapter {
  readonly provider = PROVIDER;
  private readonly http: ProviderHttpClient;
  private readonly cache: TtlCache<unknown>;

  constructor(options: MusicBrainzAdapterOptions) {
    this.http = options.http;
    this.cache = new TtlCache(options.cache);
  }

  async searchArtists(name: string): Promise<MbArtist[]> {
    const key = `mb:search-artists:${name.toLowerCase().trim()}`;
    return this.withCache(key, async () => {
      const query = encodeURIComponent(`artist:"${escapeLucene(name)}"`);
      const url = `${BASE_URL}/artist/?query=${query}&fmt=json&limit=10`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      return (
        parseProviderPayload(PROVIDER, mbArtistSearchResponseSchema, payload).artists ?? []
      );
    });
  }

  /** Canonical artist record by MBID. Returns null when MusicBrainz 404s. */
  async lookupArtist(mbid: string): Promise<MbArtist | null> {
    const key = `mb:artist:${mbid}`;
    return this.withCache(key, async () => {
      const url = `${BASE_URL}/artist/${encodeURIComponent(mbid)}?fmt=json`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      return parseProviderPayload(PROVIDER, mbArtistSchema, payload);
    });
  }

  async searchReleaseGroups(options: {
    artist: string;
    title: string;
    artistMbid?: string;
  }): Promise<MbReleaseGroup[]> {
    const key = `mb:search-rg:${options.artist.toLowerCase().trim()}:${options.title
      .toLowerCase()
      .trim()}:${options.artistMbid ?? ""}`;
    return this.withCache(key, async () => {
      const parts = [`releasegroup:"${escapeLucene(options.title)}"`];
      if (options.artistMbid) {
        parts.push(`arid:${options.artistMbid}`);
      } else {
        parts.push(`artist:"${escapeLucene(options.artist)}"`);
      }
      const query = encodeURIComponent(parts.join(" AND "));
      const url = `${BASE_URL}/release-group/?query=${query}&fmt=json&limit=10`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      return (
        parseProviderPayload(PROVIDER, mbReleaseGroupSearchResponseSchema, payload)[
          "release-groups"
        ] ?? []
      );
    });
  }

  private async withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit.hit) {
      return hit.value as T;
    }
    try {
      const value = await fetcher();
      this.cache.set(key, value, { negative: isEmptyResult(value) });
      return value;
    } catch (error) {
      if (isProviderError(error) && error.kind === "not_found") {
        this.cache.set(key, null as T, { negative: true });
        return null as T;
      }
      throw error;
    }
  }
}

function isEmptyResult(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.length === 0);
}

function asMbid(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = musicBrainzIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function identityFromMbArtist(artist: MbArtist): ArtistIdentity {
  return {
    name: artist.name,
    mbid: asMbid(artist.id),
    theAudioDbId: null
  };
}

export function albumIdentityFromMbReleaseGroup(
  releaseGroup: MbReleaseGroup,
  requestedArtist: string
): AlbumIdentity {
  const credit = releaseGroup["artist-credit"]?.[0];
  return {
    title: releaseGroup.title,
    artistName: credit?.artist?.name ?? credit?.name ?? requestedArtist,
    artistMbid: asMbid(credit?.artist?.id),
    releaseMbid: null,
    releaseGroupMbid: asMbid(releaseGroup.id),
    theAudioDbAlbumId: null
  };
}

/* ------------------------- Discography, tracks and stories ------------------------- */

const mbUrlRelationSchema = z.looseObject({
  type: z.string().nullish(),
  url: z.looseObject({ resource: z.string() }).nullish()
});

const mbArtistWithUrlsSchema = mbArtistSchema.extend({
  relations: z.array(mbUrlRelationSchema).nullish()
});
export type MbArtistWithUrls = z.infer<typeof mbArtistWithUrlsSchema>;

const mbBrowseReleaseGroupSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  "primary-type": z.string().nullish(),
  "secondary-types": z.array(z.string()).nullish(),
  "first-release-date": z.string().nullish()
});
export type MbBrowseReleaseGroup = z.infer<typeof mbBrowseReleaseGroupSchema>;

const mbBrowseReleaseGroupsResponseSchema = z.looseObject({
  "release-groups": z.array(mbBrowseReleaseGroupSchema).nullish(),
  "release-group-count": z.number().int().nullish()
});

const mbMediumSummarySchema = z.looseObject({
  format: z.string().nullish(),
  "track-count": z.number().int().nullish()
});

const mbReleaseSummarySchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().nullish(),
  status: z.string().nullish(),
  country: z.string().nullish(),
  date: z.string().nullish(),
  media: z.array(mbMediumSummarySchema).nullish()
});
export type MbReleaseSummary = z.infer<typeof mbReleaseSummarySchema>;

const mbReleaseGroupWithReleasesSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  "primary-type": z.string().nullish(),
  "first-release-date": z.string().nullish(),
  releases: z.array(mbReleaseSummarySchema).nullish()
});
export type MbReleaseGroupWithReleases = z.infer<typeof mbReleaseGroupWithReleasesSchema>;

const mbCreditSchema = z.looseObject({
  name: z.string(),
  joinphrase: z.string().nullish(),
  artist: z.looseObject({ id: z.string(), name: z.string() }).nullish()
});
export type MbCredit = z.infer<typeof mbCreditSchema>;

const mbRecordingSummarySchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  length: z.number().int().nullish(),
  isrcs: z.array(z.string()).nullish(),
  "artist-credit": z.array(mbCreditSchema).nullish()
});
export type MbRecordingSummary = z.infer<typeof mbRecordingSummarySchema>;

const mbTrackSchema = z.looseObject({
  id: z.string().nullish(),
  position: z.number().int(),
  number: z.string().nullish(),
  title: z.string().min(1),
  length: z.number().int().nullish(),
  "artist-credit": z.array(mbCreditSchema).nullish(),
  recording: mbRecordingSummarySchema
});

const mbReleaseWithTracksSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().nullish(),
  country: z.string().nullish(),
  "artist-credit": z.array(mbCreditSchema).nullish(),
  media: z
    .array(
      z.looseObject({
        position: z.number().int().nullish(),
        format: z.string().nullish(),
        tracks: z.array(mbTrackSchema).nullish()
      })
    )
    .nullish()
});
export type MbReleaseWithTracks = z.infer<typeof mbReleaseWithTracksSchema>;

const mbRelationSchema = z.looseObject({
  type: z.string(),
  direction: z.string().nullish(),
  "target-type": z.string().nullish(),
  attributes: z.array(z.string()).nullish(),
  artist: z.looseObject({ id: z.string(), name: z.string() }).nullish(),
  recording: mbRecordingSummarySchema.nullish(),
  url: z.looseObject({ resource: z.string() }).nullish(),
  work: z
    .looseObject({
      id: z.string(),
      title: z.string(),
      relations: z
        .array(
          z.looseObject({
            type: z.string(),
            direction: z.string().nullish(),
            "target-type": z.string().nullish(),
            attributes: z.array(z.string()).nullish(),
            artist: z.looseObject({ id: z.string(), name: z.string() }).nullish(),
            url: z.looseObject({ resource: z.string() }).nullish()
          })
        )
        .nullish()
    })
    .nullish()
});
export type MbRelation = z.infer<typeof mbRelationSchema>;

const mbRecordingStorySchema = mbRecordingSummarySchema.extend({
  relations: z.array(mbRelationSchema).nullish()
});
export type MbRecordingStory = z.infer<typeof mbRecordingStorySchema>;

const mbWorkRecordingsResponseSchema = z.looseObject({
  recordings: z.array(mbRecordingSummarySchema).nullish()
});

const RELEASE_GROUP_PAGE = 100;
const MAX_RELEASE_GROUP_PAGES = 3;

export class MusicBrainzCatalog {
  readonly provider = PROVIDER;
  private readonly http: ProviderHttpClient;
  private readonly cache: TtlCache<unknown>;

  constructor(options: MusicBrainzAdapterOptions) {
    this.http = options.http;
    this.cache = new TtlCache(options.cache);
  }

  searchArtists(name: string): Promise<MbArtist[]> {
    return this.cached(`mbc:search:${name.toLowerCase().trim()}`, async () => {
      const query = encodeURIComponent(`artist:"${escapeLucene(name)}"`);
      const payload = await this.get(`/artist/?query=${query}&fmt=json&limit=10`);
      return parseProviderPayload(PROVIDER, mbArtistSearchResponseSchema, payload).artists ?? [];
    });
  }

  /** Artist with URL relationships (Spotify, Wikidata). Null on 404. */
  lookupArtist(mbid: string): Promise<MbArtistWithUrls | null> {
    return this.cached(`mbc:artist:${mbid}`, async () =>
      parseProviderPayload(PROVIDER, mbArtistWithUrlsSchema, await this.get(`/artist/${mbid}?inc=url-rels&fmt=json`))
    );
  }

  /**
   * An artist's genres, most-applied first. Genres are community-applied and
   * curated into a taxonomy, so they describe how the artist is filed rather
   * than anything the artist stated. Null on 404.
   */
  lookupArtistGenres(mbid: string): Promise<MbArtistGenres | null> {
    return this.cached(`mbc:artist-genres:${mbid}`, async () =>
      parseProviderPayload(PROVIDER, mbArtistGenresSchema, await this.get(`/artist/${mbid}?inc=genres&fmt=json`))
    );
  }

  /**
   * Every album, EP and single release group credited to the artist.
   * `website-default` drops groups whose only releases are bootlegs, as musicbrainz.org does.
   */
  browseReleaseGroups(artistMbid: string): Promise<MbBrowseReleaseGroup[]> {
    return this.cached(`mbc:rgs:${artistMbid}`, async () => {
      const groups: MbBrowseReleaseGroup[] = [];
      for (let page = 0; page < MAX_RELEASE_GROUP_PAGES; page += 1) {
        const payload = await this.get(
          `/release-group?artist=${artistMbid}&type=album|ep|single&release-group-status=website-default&fmt=json&limit=${RELEASE_GROUP_PAGE}&offset=${page * RELEASE_GROUP_PAGE}`
        );
        const parsed = parseProviderPayload(PROVIDER, mbBrowseReleaseGroupsResponseSchema, payload);
        const batch = parsed["release-groups"] ?? [];
        groups.push(...batch);
        if (batch.length < RELEASE_GROUP_PAGE || groups.length >= (parsed["release-group-count"] ?? 0)) break;
      }
      return groups;
    });
  }

  lookupReleaseGroup(id: string): Promise<MbReleaseGroupWithReleases | null> {
    return this.cached(`mbc:rg:${id}`, async () =>
      parseProviderPayload(
        PROVIDER,
        mbReleaseGroupWithReleasesSchema,
        await this.get(`/release-group/${id}?inc=releases+media&fmt=json`)
      )
    );
  }

  lookupRelease(id: string): Promise<MbReleaseWithTracks | null> {
    return this.cached(`mbc:release:${id}`, async () =>
      parseProviderPayload(
        PROVIDER,
        mbReleaseWithTracksSchema,
        await this.get(`/release/${id}?inc=recordings+artist-credits+isrcs&fmt=json`)
      )
    );
  }

  /** A recording with credits, samples, its work (and the work's writers) and URL links. */
  lookupRecordingStory(id: string): Promise<MbRecordingStory | null> {
    return this.cached(`mbc:story:${id}`, async () =>
      parseProviderPayload(
        PROVIDER,
        mbRecordingStorySchema,
        await this.get(
          `/recording/${id}?inc=artist-credits+isrcs+artist-rels+recording-rels+work-rels+work-level-rels+url-rels&fmt=json`
        )
      )
    );
  }

  /** Up to 25 recordings of a work, for "other versions". */
  browseWorkRecordings(workId: string): Promise<MbRecordingSummary[]> {
    return this.cached(`mbc:work-recs:${workId}`, async () =>
      parseProviderPayload(
        PROVIDER,
        mbWorkRecordingsResponseSchema,
        await this.get(`/recording?work=${workId}&inc=artist-credits&fmt=json&limit=25`)
      ).recordings ?? []
    );
  }

  private get(path: string): Promise<unknown> {
    return this.http.getJson({ provider: PROVIDER, url: `${BASE_URL}${path}` });
  }

  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit.hit) return hit.value as T;
    try {
      const value = await fetcher();
      this.cache.set(key, value, { negative: isEmptyResult(value) });
      return value;
    } catch (error) {
      if (isProviderError(error) && error.kind === "not_found") {
        this.cache.set(key, null as T, { negative: true });
        return null as T;
      }
      throw error;
    }
  }
}

/** "Kendrick Lamar & SZA" from a MusicBrainz artist credit. */
export function creditText(credit: readonly MbCredit[] | null | undefined): string {
  return (credit ?? []).map((part) => `${part.name}${part.joinphrase ?? ""}`).join("").trim();
}
