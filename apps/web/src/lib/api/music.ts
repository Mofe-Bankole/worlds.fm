import {
  discographyResponseSchema,
  recordingStoryResponseSchema,
  releaseTracksResponseSchema,
  type DiscographyResponse,
  type RecordingStoryResponse,
  type ReleaseTracksResponse,
} from "@worlds/shared";
import { resolveApiBaseUrl } from "./discovery";

/**
 * Client for the Fastify music catalogue (discography, track lists, track
 * stories). Like the discovery client it calls only our API and validates
 * every body against the shared contract.
 */
export type MusicResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; code: string; message: string; retryable: boolean }
  | { kind: "aborted" };

export interface MusicFetchOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

const FRIENDLY: Record<string, string> = {
  rate_limited: "Too many music requests in a short time. Wait a minute and try again.",
  music_rate_limited: "MusicBrainz is busy right now. Try again in a few seconds.",
  music_timeout: "The music catalogue took too long to answer. Try again.",
  music_unavailable: "The music catalogue is temporarily unavailable.",
  music_invalid_response: "The music catalogue sent an answer we could not read.",
  release_not_found: "MusicBrainz no longer lists this release.",
  recording_not_found: "MusicBrainz no longer lists this recording.",
};
const RETRYABLE = new Set(["rate_limited", "music_rate_limited", "music_timeout", "music_unavailable", "network"]);

function failure<T>(code: string): MusicResult<T> {
  return {
    kind: "error",
    code,
    message: FRIENDLY[code] ?? "Something went wrong while loading this music.",
    retryable: RETRYABLE.has(code),
  };
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

interface Contract<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

async function getMusic<T>(
  path: string,
  schema: Contract<T>,
  options: MusicFetchOptions,
  bodyStatuses: readonly number[] = [200],
): Promise<MusicResult<T>> {
  const url = `${resolveApiBaseUrl(options.baseUrl)}${path}`;
  let response: Response;
  try {
    response = await (options.fetchFn ?? fetch)(url, {
      headers: { accept: "application/json" },
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    return isAbort(error) ? { kind: "aborted" } : failure("network");
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    return isAbort(error) ? { kind: "aborted" } : failure("invalid_response");
  }
  if (bodyStatuses.includes(response.status)) {
    const parsed = schema.safeParse(json);
    if (parsed.success) return { kind: "ok", data: parsed.data };
    if (response.status === 200) return failure("invalid_response");
  }
  const code = (json as { error?: { code?: unknown } } | null)?.error?.code;
  return failure(typeof code === "string" ? code : "invalid_response");
}

export type DiscographyLookup = { name: string } | { mbid: string };

export interface DiscographyFetchOptions extends MusicFetchOptions {
  /**
   * `albums` (the default) joins Spotify covers and links for albums only.
   * `all` also joins singles and EPs, which Spotify lists separately and caps
   * at ten items per request, so it costs several calls for a prolific artist.
   */
  include?: "albums" | "all";
}

export function fetchDiscography(
  lookup: DiscographyLookup,
  options: DiscographyFetchOptions = {},
): Promise<MusicResult<DiscographyResponse>> {
  const params = new URLSearchParams("mbid" in lookup ? { mbid: lookup.mbid } : { name: lookup.name });
  if (options.include === "all") params.set("include", "all");
  // 404 carries the typed not_found body.
  return getMusic(`/api/v1/music/discography?${params}`, discographyResponseSchema, options, [200, 404]);
}

export function fetchReleaseTracks(
  releaseGroupId: string,
  spotifyAlbumId: string | null,
  options: MusicFetchOptions = {},
): Promise<MusicResult<ReleaseTracksResponse>> {
  const query = spotifyAlbumId ? `?${new URLSearchParams({ spotifyAlbumId })}` : "";
  return getMusic(
    `/api/v1/music/releases/${encodeURIComponent(releaseGroupId)}/tracks${query}`,
    releaseTracksResponseSchema,
    options,
  );
}

export function fetchRecordingStory(
  recordingMbid: string,
  options: MusicFetchOptions = {},
): Promise<MusicResult<RecordingStoryResponse>> {
  return getMusic(`/api/v1/music/recordings/${encodeURIComponent(recordingMbid)}/story`, recordingStoryResponseSchema, options);
}
