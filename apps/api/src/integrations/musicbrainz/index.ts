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
