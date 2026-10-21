import type { AlbumIdentity, MediaImageCandidate } from "@worlds/shared";
import { z } from "zod";

import { isProviderError } from "../../lib/errors.js";
import type { ProviderHttpClient } from "../../lib/http-client.js";
import { TtlCache, type TtlCacheOptions } from "../../lib/cache.js";
import { asUrl, parseProviderPayload } from "../../lib/parse.js";

/**
 * Cover Art Archive adapter.
 * Docs: https://musicbrainz.org/doc/Cover_Art_Archive/API
 *
 * Artwork is indexed by MusicBrainz IDs:
 * - /release/{release-mbid}        → artwork for a specific release
 * - /release-group/{rg-mbid}       → the "front" artwork chosen for the group
 *
 * A 404 means "no artwork on file" — a definitive negative we cache briefly.
 * Cover images are usually label-copyrighted uploads; nothing here is ever
 * rights-`cleared` automatically.
 */

const PROVIDER = "coverartarchive";
const BASE_URL = "https://coverartarchive.org";
const ATTRIBUTION = "Cover Art Archive / MusicBrainz community";

const caaImageSchema = z.looseObject({
  id: z.coerce.string().nullish(),
  image: z.string().min(1),
  front: z.boolean().nullish(),
  types: z.array(z.string()).nullish(),
  comment: z.string().nullish(),
  thumbnails: z
    .looseObject({ small: z.string().nullish(), large: z.string().nullish() })
    .nullish()
});
export type CaaImage = z.infer<typeof caaImageSchema>;

const caaResponseSchema = z.looseObject({
  images: z.array(caaImageSchema).nullish()
});
export type CaaResponse = z.infer<typeof caaResponseSchema>;

export interface CoverArtArchiveAdapterOptions {
  http: ProviderHttpClient;
  cache: TtlCacheOptions;
}

export class CoverArtArchiveAdapter {
  readonly provider = PROVIDER;
  private readonly http: ProviderHttpClient;
  private readonly cache: TtlCache<unknown>;

  constructor(options: CoverArtArchiveAdapterOptions) {
    this.http = options.http;
    this.cache = new TtlCache(options.cache);
  }

  async getReleaseGroupImages(releaseGroupMbid: string): Promise<CaaResponse | null> {
    return this.fetchArt("release-group", releaseGroupMbid);
  }

  async getReleaseImages(releaseMbid: string): Promise<CaaResponse | null> {
    return this.fetchArt("release", releaseMbid);
  }

  private async fetchArt(
    kind: "release" | "release-group",
    mbid: string
  ): Promise<CaaResponse | null> {
    const key = `caa:${kind}:${mbid}`;
    const hit = this.cache.get(key);
    if (hit.hit) {
      return hit.value as CaaResponse | null;
    }
    try {
      const url = `${BASE_URL}/${kind}/${encodeURIComponent(mbid)}`;
      const payload = await this.http.getJson({ provider: PROVIDER, url });
      const parsed = parseProviderPayload(PROVIDER, caaResponseSchema, payload);
      this.cache.set(key, parsed, { negative: (parsed.images ?? []).length === 0 });
      return parsed;
    } catch (error) {
      if (isProviderError(error) && error.kind === "not_found") {
        this.cache.set(key, null, { negative: true });
        return null;
      }
      throw error;
    }
  }
}

/**
 * Keep front-cover images only. Phase 0 deliberately excludes booklet/back
 * scans; they rarely help a UI and mostly increase rights surface area.
 */
export function albumCandidatesFromCaa(
  response: CaaResponse,
  identity: AlbumIdentity,
  subject: { kind: "release" | "release-group"; mbid: string }
): MediaImageCandidate[] {
  const sourcePageUrl = asUrl(
    subject.kind === "release"
      ? `https://musicbrainz.org/release/${subject.mbid}`
      : `https://musicbrainz.org/release-group/${subject.mbid}`
  );
  const seen = new Set<string>();
  const candidates: MediaImageCandidate[] = [];
  for (const image of response.images ?? []) {
    if (image.front !== true) {
      continue;
    }
    const url = asUrl(image.image);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    candidates.push({
      url,
      provider: PROVIDER,
      sourcePageUrl,
      artistName: identity.artistName,
      albumTitle: identity.title,
      artistMbid: identity.artistMbid,
      releaseMbid: subject.kind === "release" ? subject.mbid : identity.releaseMbid,
      releaseGroupMbid:
        subject.kind === "release-group" ? subject.mbid : identity.releaseGroupMbid,
      imageType: "album",
      width: null,
      height: null,
      attribution: ATTRIBUTION,
      copyrightHolder: null,
      licenseUrl: null,
      rightsStatus: "unverified"
    });
  }
  return candidates;
}
