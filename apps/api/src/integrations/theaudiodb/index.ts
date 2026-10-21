import type {
  AlbumIdentity,
  ArtistIdentity,
  MediaImageCandidate
} from "@worlds/shared";
import { musicBrainzIdSchema } from "@worlds/shared";
import { z } from "zod";

import { isProviderError } from "../../lib/errors.js";
import type { ProviderHttpClient } from "../../lib/http-client.js";
import { TtlCache, type TtlCacheOptions } from "../../lib/cache.js";
import { normalizeName } from "../../lib/matching.js";
import { asUrl, parseProviderPayload } from "../../lib/parse.js";

/**
 * TheAudioDB adapter (v1 API).
 * Docs: https://www.theaudiodb.com/free_music_api
 * Free documented development key: "123" (30 requests/minute).
 *
 * Records carry rich image fields hosted on theaudiodb/r2 CDNs; they are
 * community/label contributions with no machine-readable license data, so
 * every candidate leaves normalization as `unverified`.
 */

const PROVIDER = "theaudiodb";
const BASE_URL = "https://www.theaudiodb.com/api/v1/json";
const ATTRIBUTION = "TheAudioDB community (theaudiodb.com)";

const tadbArtistSchema = z.looseObject({
  idArtist: z.string().min(1),
  strArtist: z.string().min(1),
  strArtistAlternate: z.string().nullish(),
  strMusicBrainzID: z.string().nullish(),
  strArtistThumb: z.string().nullish(),
  strArtistWideThumb: z.string().nullish(),
  strArtistLogo: z.string().nullish(),
  strArtistCutout: z.string().nullish(),
  strArtistClearart: z.string().nullish(),
  strArtistBanner: z.string().nullish(),
  strArtistFanart: z.string().nullish(),
  strArtistFanart2: z.string().nullish(),
  strArtistFanart3: z.string().nullish(),
  strArtistFanart4: z.string().nullish()
});
export type TadbArtistRecord = z.infer<typeof tadbArtistSchema>;

const tadbAlbumSchema = z.looseObject({
  idAlbum: z.string().min(1),
  idArtist: z.string().nullish(),
  strAlbum: z.string().min(1),
  strArtist: z.string().nullish(),
  strMusicBrainzID: z.string().nullish(),
  strMusicBrainzArtistID: z.string().nullish(),
  strAlbumThumb: z.string().nullish(),
  strAlbumThumbHQ: z.string().nullish(),
  strAlbumCDart: z.string().nullish(),
  intYearReleased: z.string().nullish()
});
export type TadbAlbumRecord = z.infer<typeof tadbAlbumSchema>;

const artistsResponseSchema = z.looseObject({
  artists: z.array(tadbArtistSchema).nullish()
});
const albumResponseSchema = z.looseObject({
  album: z.array(tadbAlbumSchema).nullish()
});

export interface TheAudioDbAdapterOptions {
  http: ProviderHttpClient;
  apiKey: string;
  cache: TtlCacheOptions;
}

export class TheAudioDbAdapter {
  readonly provider = PROVIDER;
  private readonly http: ProviderHttpClient;
  private readonly apiKey: string;
  private readonly cache: TtlCache<unknown>;

  constructor(options: TheAudioDbAdapterOptions) {
    this.http = options.http;
    this.apiKey = options.apiKey;
    this.cache = new TtlCache(options.cache);
  }

  async searchArtists(name: string): Promise<TadbArtistRecord[]> {
    const key = `tadb:search-artists:${normalizeName(name)}`;
    return this.withCache(key, async () => {
      const url = `${BASE_URL}/${this.apiKey}/search.php?s=${encodeURIComponent(name)}`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      return parseProviderPayload(PROVIDER, artistsResponseSchema, payload).artists ?? [];
    });
  }

  async lookupArtistByMbid(mbid: string): Promise<TadbArtistRecord | null> {
    const key = `tadb:artist-mb:${mbid}`;
    return this.withCache(key, async () => {
      const url = `${BASE_URL}/${this.apiKey}/artist-mb.php?i=${encodeURIComponent(mbid)}`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      return (
        parseProviderPayload(PROVIDER, artistsResponseSchema, payload).artists?.[0] ?? null
      );
    });
  }

  async searchAlbum(artist: string, title: string): Promise<TadbAlbumRecord[]> {
    const key = `tadb:search-album:${normalizeName(artist)}:${normalizeName(title)}`;
    return this.withCache(key, async () => {
      const url =
        `${BASE_URL}/${this.apiKey}/searchalbum.php` +
        `?s=${encodeURIComponent(artist)}&a=${encodeURIComponent(title)}`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      return parseProviderPayload(PROVIDER, albumResponseSchema, payload).album ?? [];
    });
  }

  async lookupAlbumByReleaseGroupMbid(
    releaseGroupMbid: string
  ): Promise<TadbAlbumRecord | null> {
    const key = `tadb:album-mb:${releaseGroupMbid}`;
    return this.withCache(key, async () => {
      const url = `${BASE_URL}/${this.apiKey}/album-mb.php?i=${encodeURIComponent(releaseGroupMbid)}`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      return (
        parseProviderPayload(PROVIDER, albumResponseSchema, payload).album?.[0] ?? null
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
      // A provider 404 is a definitive negative: remember it briefly.
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

export function identityFromTadbArtist(record: TadbArtistRecord): ArtistIdentity {
  return {
    name: record.strArtist,
    mbid: asMbid(record.strMusicBrainzID),
    theAudioDbId: record.idArtist
  };
}

interface ImageField {
  value: string | null | undefined;
  imageType: MediaImageCandidate["imageType"];
}

export function artistCandidatesFromTadb(
  record: TadbArtistRecord,
  identity: ArtistIdentity
): MediaImageCandidate[] {
  const fields: ImageField[] = [
    { value: record.strArtistThumb, imageType: "artist" },
    { value: record.strArtistWideThumb, imageType: "artist" },
    { value: record.strArtistLogo, imageType: "artist" },
    { value: record.strArtistClearart, imageType: "artist" },
    { value: record.strArtistCutout, imageType: "artist" },
    { value: record.strArtistBanner, imageType: "background" },
    { value: record.strArtistFanart, imageType: "background" },
    { value: record.strArtistFanart2, imageType: "background" },
    { value: record.strArtistFanart3, imageType: "background" },
    { value: record.strArtistFanart4, imageType: "background" }
  ];
  const sourcePageUrl = asUrl(`https://www.theaudiodb.com/artist/${record.idArtist}`);
  return dedupeByUrl(
    fields.flatMap((field) =>
      candidateFromField(field, sourcePageUrl, {
        artistName: identity.name,
        artistMbid: identity.mbid,
        albumTitle: null,
        releaseMbid: null,
        releaseGroupMbid: null
      })
    )
  );
}

export function albumCandidatesFromTadb(
  record: TadbAlbumRecord,
  identity: AlbumIdentity
): MediaImageCandidate[] {
  const fields: ImageField[] = [
    { value: record.strAlbumThumbHQ, imageType: "album" },
    { value: record.strAlbumThumb, imageType: "album" },
    { value: record.strAlbumCDart, imageType: "album" }
  ];
  const sourcePageUrl = asUrl(`https://www.theaudiodb.com/album/${record.idAlbum}`);
  return dedupeByUrl(
    fields.flatMap((field) =>
      candidateFromField(field, sourcePageUrl, {
        artistName: identity.artistName,
        artistMbid: identity.artistMbid,
        albumTitle: identity.title,
        releaseMbid: identity.releaseMbid,
        releaseGroupMbid: identity.releaseGroupMbid
      })
    )
  );
}

export function albumIdentityFromTadb(
  record: TadbAlbumRecord,
  requestedArtist: string
): AlbumIdentity {
  return {
    title: record.strAlbum,
    artistName: record.strArtist ?? requestedArtist,
    artistMbid: asMbid(record.strMusicBrainzArtistID),
    releaseMbid: null,
    releaseGroupMbid: asMbid(record.strMusicBrainzID),
    theAudioDbAlbumId: record.idAlbum
  };
}

interface CandidateContext {
  artistName: string;
  artistMbid: string | null;
  albumTitle: string | null;
  releaseMbid: string | null;
  releaseGroupMbid: string | null;
}

function candidateFromField(
  field: ImageField,
  sourcePageUrl: string | null,
  context: CandidateContext
): MediaImageCandidate[] {
  const url = asUrl(field.value);
  if (!url) {
    return [];
  }
  return [
    {
      url,
      provider: PROVIDER,
      sourcePageUrl,
      artistName: context.artistName,
      albumTitle: context.albumTitle,
      artistMbid: context.artistMbid,
      releaseMbid: context.releaseMbid,
      releaseGroupMbid: context.releaseGroupMbid,
      imageType: field.imageType,
      width: null,
      height: null,
      attribution: ATTRIBUTION,
      copyrightHolder: null,
      licenseUrl: null,
      rightsStatus: "unverified"
    }
  ];
}

function dedupeByUrl(candidates: MediaImageCandidate[]): MediaImageCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) {
      return false;
    }
    seen.add(candidate.url);
    return true;
  });
}
