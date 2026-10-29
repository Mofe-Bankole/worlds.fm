import {
  DISCOVERY_MAX_PER_CATEGORY,
  QLOO_IMAGE_BATCH_MAX,
  culturalDiscoveryResponseSchema,
  artistConnectionResponseSchema,
  qlooArtistImagesResponseSchema,
  type CulturalDiscoveryResponse,
  type ArtistConnectionResponse,
} from "@worlds/shared";

/**
 * Client for the Fastify Cultural Discovery API (B1.3). The browser talks only
 * to our API, never to Qloo. Every response is validated against the shared
 * contract before the UI sees it.
 */
export const DEFAULT_API_BASE_URL = "http://localhost:4000";

export type DiscoveryFetchResult =
  | { kind: "ok"; data: CulturalDiscoveryResponse }
  | {
      kind: "error";
      /** Stable API error code, or `network` / `invalid_response`. */
      code: string;
      /** Safe, user-readable text. Never an upstream message. */
      message: string;
      status: number | null;
      retryable: boolean;
    }
  | { kind: "aborted" };

export interface FetchArtistGraphOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  limit?: number;
  fetchFn?: typeof fetch;
}

/** Pair lookup is a read of published research, not a request to run the agent. */
export async function fetchArtistConnection(
  subject: string,
  target: string,
  options: { signal?: AbortSignal; baseUrl?: string; fetchFn?: typeof fetch } = {},
): Promise<ArtistConnectionResponse | null> {
  const base = resolveApiBaseUrl(options.baseUrl);
  const url = `${base}/api/v1/graph/artist-connection?${new URLSearchParams({ subject, target })}`;
  try {
    const response = await (options.fetchFn ?? fetch)(url, {
      headers: { accept: "application/json" },
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) return null;
    const result = artistConnectionResponseSchema.safeParse(await response.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function resolveApiBaseUrl(value: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  const base = value?.trim() ? value.trim() : DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, "");
}

const FRIENDLY: Record<string, string> = {
  invalid_query: "That search is not valid. Try a shorter artist name.",
  rate_limited: "Too many searches in a short time. Wait a minute and try again.",
  qloo_rate_limited: "The cultural data provider is busy. Try again shortly.",
  qloo_not_configured: "Cultural discovery is not configured on this server yet.",
  qloo_unauthorized: "The server could not authenticate with the cultural data provider.",
  qloo_forbidden: "The cultural data provider denied this request.",
  qloo_timeout: "The cultural data provider took too long to answer. Try again.",
  qloo_unavailable: "The cultural data provider is temporarily unavailable.",
  qloo_invalid_response: "The cultural data provider sent an answer we could not read.",
  discovery_unavailable: "No cultural connections could be retrieved right now.",
};

function describeError(code: string): string {
  return FRIENDLY[code] ?? "Something went wrong while loading this world.";
}

const RETRYABLE = new Set([
  "rate_limited",
  "qloo_rate_limited",
  "qloo_timeout",
  "qloo_unavailable",
  "discovery_unavailable",
  "network",
]);

function failure(code: string, status: number | null): DiscoveryFetchResult {
  return { kind: "error", code, message: describeError(code), status, retryable: RETRYABLE.has(code) };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function fetchArtistGraph(
  query: string,
  options: FetchArtistGraphOptions = {},
): Promise<DiscoveryFetchResult> {
  const base = resolveApiBaseUrl(options.baseUrl);
  const limit = Math.min(Math.max(options.limit ?? DISCOVERY_MAX_PER_CATEGORY, 1), DISCOVERY_MAX_PER_CATEGORY);
  const url = `${base}/api/v1/graph/artist?${new URLSearchParams({ query, limit: String(limit) })}`;
  const doFetch = options.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await doFetch(url, {
      headers: { accept: "application/json" },
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    return isAbort(error) ? { kind: "aborted" } : failure("network", null);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    return isAbort(error) ? { kind: "aborted" } : failure("invalid_response", response.status);
  }

  // 200 (complete, partial, needs_disambiguation) and 404 (not_found) both carry the typed body.
  if (response.status === 200 || response.status === 404) {
    const parsed = culturalDiscoveryResponseSchema.safeParse(json);
    if (parsed.success) {
      return { kind: "ok", data: parsed.data };
    }
    if (response.status === 200) {
      return failure("invalid_response", response.status);
    }
  }

  const code =
    typeof json === "object" && json !== null && "error" in json
      ? ((json as { error?: { code?: unknown } }).error?.code ?? null)
      : null;
  return failure(typeof code === "string" ? code : "invalid_response", response.status);
}

/**
 * Qloo images for up to {@link QLOO_IMAGE_BATCH_MAX} artist names in one
 * request. Names are sorted so the same set always produces the same URL,
 * which lets the browser's HTTP cache answer repeat visits. Returns null when
 * the whole request fails; images are decoration, so failures stay silent.
 */
export async function fetchArtistImages(
  names: readonly string[],
  options: { baseUrl?: string; fetchFn?: typeof fetch } = {},
): Promise<Record<string, string | null> | null> {
  // Commas separate names on the wire, so a name containing one cannot be sent.
  const unique = [...new Set(names.map((name) => name.trim()).filter((name) => name && !name.includes(",")))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, QLOO_IMAGE_BATCH_MAX);
  if (unique.length === 0) return {};
  const base = resolveApiBaseUrl(options.baseUrl);
  const url = `${base}/api/v1/qloo/artist-images?${new URLSearchParams({ names: unique.join(",") })}`;
  try {
    const response = await (options.fetchFn ?? fetch)(url, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const parsed = qlooArtistImagesResponseSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    return Object.fromEntries(parsed.data.images.map((image) => [image.name, image.imageUrl]));
  } catch {
    return null;
  }
}
