import { z } from "zod";

import { TtlCache, type TtlCacheOptions } from "../../lib/cache.js";
import { ProviderError, isProviderError } from "../../lib/errors.js";
import type { FetchLike, ProviderHttpClient } from "../../lib/http-client.js";
import { parseProviderPayload } from "../../lib/parse.js";

/**
 * Spotify Web API adapter (catalogue metadata only).
 * Docs: https://developer.spotify.com/documentation/web-api
 *
 * - Client Credentials flow: no user login and no user data (AGENTS.md §7).
 * - Only endpoints confirmed for Development Mode after the February 2026
 *   changes are used: GET /artists/{id}/albums, GET /albums/{id},
 *   GET /albums/{id}/tracks. Live-checked 2026-10-23;
 *   /artists/{id}/albums accepts at most limit=10 in Development Mode.
 * - Credentials never appear in URLs, logs or errors.
 */

const PROVIDER = "spotify";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";
/** Development Mode rejects limit > 10 on this endpoint ("Invalid limit"). */
const ALBUM_PAGE_SIZE = 10;
const MAX_ALBUM_PAGES = 10;
/** Refresh this long before Spotify's stated expiry to avoid edge failures. */
const TOKEN_SAFETY_MS = 60_000;

const imageSchema = z.looseObject({
  url: z.string().min(1),
  width: z.number().nullish(),
  height: z.number().nullish()
});

const simpleArtistSchema = z.looseObject({ id: z.string().nullish(), name: z.string() });

const simpleAlbumSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  album_type: z.string(),
  total_tracks: z.number().int().nullish(),
  release_date: z.string().nullish(),
  images: z.array(imageSchema).nullish(),
  external_urls: z.looseObject({ spotify: z.string().nullish() }).nullish(),
  artists: z.array(simpleArtistSchema).nullish()
});
export type SpotifySimpleAlbum = z.infer<typeof simpleAlbumSchema>;

const simpleTrackSchema = z.looseObject({
  id: z.string().nullish(),
  name: z.string().min(1),
  disc_number: z.number().int(),
  track_number: z.number().int(),
  duration_ms: z.number().int().nullish(),
  explicit: z.boolean().nullish(),
  external_urls: z.looseObject({ spotify: z.string().nullish() }).nullish()
});
export type SpotifySimpleTrack = z.infer<typeof simpleTrackSchema>;

const pagingSchema = <T extends z.ZodType>(item: T) =>
  z.looseObject({ items: z.array(item), next: z.string().nullish(), total: z.number().int().nullish() });

const albumSchema = simpleAlbumSchema.extend({ tracks: pagingSchema(simpleTrackSchema) });
export type SpotifyAlbum = SpotifySimpleAlbum & { tracks: SpotifySimpleTrack[] };

const tokenSchema = z.looseObject({ access_token: z.string().min(1), expires_in: z.number() });

export interface SpotifyAdapterOptions {
  http: ProviderHttpClient;
  /** Used only for the token POST; ProviderHttpClient is GET-only. */
  fetchFn?: FetchLike;
  clientId: string | undefined;
  clientSecret: string | undefined;
  timeoutMs: number;
  cache: TtlCacheOptions;
  now?: () => number;
}

export class SpotifyAdapter {
  readonly provider = PROVIDER;
  private readonly http: ProviderHttpClient;
  private readonly fetchFn: FetchLike;
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly timeoutMs: number;
  private readonly cache: TtlCache<unknown>;
  private readonly now: () => number;
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(options: SpotifyAdapterOptions) {
    this.http = options.http;
    this.fetchFn = options.fetchFn ?? fetch;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.timeoutMs = options.timeoutMs;
    this.cache = new TtlCache(options.cache);
    this.now = options.now ?? Date.now;
  }

  get isEnabled(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Albums and singles (Spotify files EPs as singles), newest first as Spotify orders them. */
  async getArtistAlbums(artistId: string): Promise<SpotifySimpleAlbum[]> {
    return this.cached(`sp:artist-albums:${artistId}`, async () => {
      const page = async (index: number) => {
        const params = new URLSearchParams({
          include_groups: "album,single",
          limit: String(ALBUM_PAGE_SIZE),
          offset: String(index * ALBUM_PAGE_SIZE)
        });
        const payload = await this.get(`/artists/${encodeURIComponent(artistId)}/albums?${params}`);
        return parseProviderPayload(PROVIDER, pagingSchema(simpleAlbumSchema), payload);
      };
      const first = await page(0);
      const total = first.total ?? (first.next ? ALBUM_PAGE_SIZE * MAX_ALBUM_PAGES : first.items.length);
      const pages = Math.min(Math.ceil(total / ALBUM_PAGE_SIZE), MAX_ALBUM_PAGES);
      const rest = await Promise.all(Array.from({ length: Math.max(pages - 1, 0) }, (_, i) => page(i + 1)));
      return [first, ...rest].flatMap((p) => p.items);
    });
  }

  /** One album with its full track list. Null when Spotify answers 404. */
  async getAlbum(albumId: string): Promise<SpotifyAlbum | null> {
    return this.cached(`sp:album:${albumId}`, async () => {
      let payload: unknown;
      try {
        payload = await this.get(`/albums/${encodeURIComponent(albumId)}`);
      } catch (error) {
        if (isProviderError(error) && error.kind === "not_found") return null;
        throw error;
      }
      const album = parseProviderPayload(PROVIDER, albumSchema, payload);
      const tracks = [...album.tracks.items];
      let next = album.tracks.next;
      // Albums over 50 tracks are rare; follow at most a few pages.
      for (let page = 0; next && page < 3; page += 1) {
        const params = new URLSearchParams({ limit: "50", offset: String(tracks.length) });
        const more = parseProviderPayload(
          PROVIDER,
          pagingSchema(simpleTrackSchema),
          await this.get(`/albums/${encodeURIComponent(albumId)}/tracks?${params}`)
        );
        tracks.push(...more.items);
        next = more.next;
      }
      return { ...album, tracks };
    });
  }

  private async get(path: string): Promise<unknown> {
    const request = async () =>
      this.http.getJson({
        provider: PROVIDER,
        url: `${API_URL}${path}`,
        headers: { authorization: `Bearer ${await this.accessToken()}` }
      });
    try {
      return await request();
    } catch (error) {
      // A revoked or expired token answers 401: fetch a new one and retry once.
      if (isProviderError(error) && error.kind === "unauthorized" && error.status === 401) {
        this.token = null;
        return request();
      }
      throw error;
    }
  }

  private async accessToken(): Promise<string> {
    if (!this.isEnabled) {
      throw new ProviderError(PROVIDER, "unauthorized", "spotify is not configured");
    }
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    // Concurrent callers share one token request.
    this.tokenRequest ??= this.requestToken().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  private async requestToken(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchFn(TOKEN_URL, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`
        },
        body: "grant_type=client_credentials",
        signal: controller.signal
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      throw new ProviderError(PROVIDER, timedOut ? "timeout" : "network", "spotify token request failed");
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new ProviderError(PROVIDER, "unauthorized", "spotify rejected the client credentials", response.status);
    }
    if (!response.ok) {
      throw new ProviderError(PROVIDER, "http", "spotify token request failed", response.status);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderError(PROVIDER, "invalid_response", "spotify token response was not JSON");
    }
    const parsed = parseProviderPayload(PROVIDER, tokenSchema, body);
    this.token = {
      value: parsed.access_token,
      expiresAt: this.now() + Math.max(parsed.expires_in * 1000 - TOKEN_SAFETY_MS, 0)
    };
    return parsed.access_token;
  }

  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit.hit) return hit.value as T;
    const value = await fetcher();
    this.cache.set(key, value, { negative: value === null || (Array.isArray(value) && value.length === 0) });
    return value;
  }
}

/** Spotify ID from an open.spotify.com URL of the given kind, else null. */
export function spotifyIdFromUrl(url: string, kind: "artist" | "album" | "track"): string | null {
  const match = new RegExp(`^https://open\\.spotify\\.com/(?:intl-[a-z-]+/)?${kind}/([A-Za-z0-9]{22})(?:[/?#]|$)`).exec(url);
  return match?.[1] ?? null;
}

export function spotifyUrl(kind: "artist" | "album" | "track", id: string): string {
  return `https://open.spotify.com/${kind}/${id}`;
}
