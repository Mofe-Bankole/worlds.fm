import type { MediaImageCandidate } from "@worlds/shared";
import { z } from "zod";

import { isProviderError } from "../../lib/errors.js";
import type { ProviderHttpClient } from "../../lib/http-client.js";
import { TtlCache, type TtlCacheOptions } from "../../lib/cache.js";
import { asUrl, parseProviderPayload } from "../../lib/parse.js";

/**
 * Fanart.tv adapter (v3.2 music API).
 * Docs: https://api.fanart.tv/
 * Endpoint: GET https://webservice.fanart.tv/v3.2/music/{musicbrainz-artist-id}?api_key=...
 *
 * Fanart.tv hosts community-contributed artwork with no machine-readable
 * license metadata, so every candidate is normalized as `unverified`.
 * The adapter disables itself (never crashes) when no API key is configured.
 */

const PROVIDER = "fanart";
const BASE_URL = "https://webservice.fanart.tv/v3.2/music";
const ATTRIBUTION = "Fanart.tv community (fanart.tv)";

const fanartImageSchema = z.looseObject({
  id: z.coerce.string().nullish(),
  url: z.string().min(1),
  likes: z.coerce.string().nullish(),
  disc: z.coerce.string().nullish()
});
export type FanartImage = z.infer<typeof fanartImageSchema>;

const fanartArtistResponseSchema = z.looseObject({
  name: z.string().min(1),
  mbid_id: z.string().min(1).nullish(),
  artistthumb: z.array(fanartImageSchema).nullish(),
  artistbackground: z.array(fanartImageSchema).nullish(),
  hdmusiclogo: z.array(fanartImageSchema).nullish(),
  musiclogo: z.array(fanartImageSchema).nullish(),
  musicbanner: z.array(fanartImageSchema).nullish()
});
export type FanartArtistResponse = z.infer<typeof fanartArtistResponseSchema>;

export interface FanartAdapterOptions {
  http: ProviderHttpClient;
  apiKey: string | undefined;
  cache: TtlCacheOptions;
}

export class FanartAdapter {
  readonly provider = PROVIDER;
  private readonly http: ProviderHttpClient;
  private readonly apiKey: string | undefined;
  private readonly cache: TtlCache<unknown>;

  constructor(options: FanartAdapterOptions) {
    this.http = options.http;
    this.apiKey = options.apiKey;
    this.cache = new TtlCache(options.cache);
  }

  get isEnabled(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  /** Throws when called while disabled; callers must check `isEnabled` first. */
  async getArtistImages(mbid: string): Promise<FanartArtistResponse | null> {
    const key = `fanart:artist:${mbid}`;
    const hit = this.cache.get(key);
    if (hit.hit) {
      return hit.value as FanartArtistResponse | null;
    }
    try {
      const url = `${BASE_URL}/${encodeURIComponent(mbid)}?api_key=${encodeURIComponent(this.apiKey ?? "")}`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      const parsed = parseProviderPayload(PROVIDER, fanartArtistResponseSchema, payload);
      this.cache.set(key, parsed);
      return parsed;
    } catch (error) {
      // Fanart answers 404 when the MBID has no artwork on file.
      if (isProviderError(error) && error.kind === "not_found") {
        this.cache.set(key, null, { negative: true });
        return null;
      }
      throw error;
    }
  }
}

const SECTION_IMAGE_TYPE: ReadonlyArray<{
  key:
    | "artistthumb"
    | "artistbackground"
    | "hdmusiclogo"
    | "musiclogo"
    | "musicbanner";
  imageType: MediaImageCandidate["imageType"];
}> = [
  { key: "artistthumb", imageType: "artist" },
  { key: "hdmusiclogo", imageType: "artist" },
  { key: "musiclogo", imageType: "artist" },
  { key: "artistbackground", imageType: "background" },
  { key: "musicbanner", imageType: "background" }
];

export function artistCandidatesFromFanart(
  response: FanartArtistResponse,
  identity: { name: string; mbid: string | null }
): MediaImageCandidate[] {
  const sourcePageUrl = identity.mbid
    ? asUrl(`https://fanart.tv/artist/${identity.mbid}`)
    : null;
  const seen = new Set<string>();
  const candidates: MediaImageCandidate[] = [];
  for (const section of SECTION_IMAGE_TYPE) {
    const images = response[section.key] ?? [];
    for (const image of images) {
      const url = asUrl(image.url);
      if (!url || seen.has(url)) {
        continue;
      }
      seen.add(url);
      candidates.push({
        url,
        provider: PROVIDER,
        sourcePageUrl,
        artistName: identity.name,
        albumTitle: null,
        artistMbid: identity.mbid,
        releaseMbid: null,
        releaseGroupMbid: null,
        imageType: section.imageType,
        width: null,
        height: null,
        attribution: ATTRIBUTION,
        copyrightHolder: null,
        licenseUrl: null,
        rightsStatus: "unverified"
      });
    }
  }
  return candidates;
}
