import { ProviderError } from "./errors.js";

/**
 * Reusable outbound HTTP client for external providers.
 *
 * - Enforces per-request timeouts via AbortController.
 * - Conservative retries with bounded exponential backoff + jitter on
 *   network failures, timeouts and 5xx responses.
 * - On HTTP 429: honors Retry-After (capped), then gives up deterministically.
 * - 401/403 and 404 fail immediately (not retryable).
 * - Optional minimum interval between requests (MusicBrainz politeness).
 * - JSON responses are size-guarded and parse errors are typed.
 */

export type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export interface ProviderHttpClientOptions {
  fetchFn?: FetchLike;
  timeoutMs: number;
  retries: number;
  retryBaseDelayMs: number;
  userAgent?: string;
  minIntervalMs?: number;
  defaultHeaders?: Record<string, string>;
  /** Injectable for deterministic tests. */
  random?: () => number;
}

export interface GetJsonOptions {
  provider: string;
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_RETRY_AFTER_MS = 10_000;
const MAX_BACKOFF_MS = 5_000;

export class ProviderHttpClient {
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryBaseDelayMs: number;
  private readonly userAgent: string | undefined;
  private readonly minIntervalMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly random: () => number;
  private throttleChain: Promise<void> = Promise.resolve();

  constructor(options: ProviderHttpClientOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs;
    this.retries = options.retries;
    this.retryBaseDelayMs = options.retryBaseDelayMs;
    this.userAgent = options.userAgent;
    this.minIntervalMs = options.minIntervalMs ?? 0;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.random = options.random ?? Math.random;
  }

  async getJson(options: GetJsonOptions): Promise<unknown> {
    const { provider, url } = options;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const attempts = this.retries + 1;

    let lastError: ProviderError | undefined;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) {
        await this.wait(0);
      }
      await this.throttle();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetchFn(url, {
          method: "GET",
          headers: this.buildHeaders(options.headers),
          signal: controller.signal,
          redirect: "follow"
        });

        if (response.ok) {
          return await this.parseJson(provider, response);
        }

        if (response.status === 401 || response.status === 403) {
          throw new ProviderError(provider, "unauthorized", `${provider} rejected credentials`, response.status);
        }
        if (response.status === 404) {
          throw new ProviderError(provider, "not_found", `${provider} returned 404`, 404);
        }
        if (response.status === 429) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
          if (attempt < attempts - 1) {
            const waitMs = Math.min(
              Math.max(retryAfterMs ?? 0, this.backoffDelay(attempt)),
              retryAfterMs !== undefined ? MAX_RETRY_AFTER_MS : MAX_BACKOFF_MS
            );
            await this.wait(waitMs);
            continue;
          }
          throw new ProviderError(provider, "rate_limited", `${provider} rate-limited the request`, 429);
        }
        if (response.status >= 500) {
          throw new RetryableHttpError(response.status);
        }
        throw new ProviderError(provider, "http", `${provider} request failed`, response.status);
      } catch (error) {
        if (error instanceof ProviderError) {
          throw error;
        }
        if (error instanceof RetryableHttpError) {
          lastError = new ProviderError(provider, "http", `${provider} upstream HTTP ${error.status}`, error.status);
          continue;
        }
        if (isAbortError(error)) {
          lastError = new ProviderError(provider, "timeout", `${provider} request timed out after ${timeoutMs}ms`);
          continue;
        }
        // Node fetch surfaces network problems as TypeError ("fetch failed").
        if (error instanceof TypeError) {
          lastError = new ProviderError(provider, "network", `${provider} request failed before response`);
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new ProviderError(provider, "network", `${provider} request failed`);
  }

  private buildHeaders(extra: Record<string, string> | undefined): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...this.defaultHeaders,
      ...(extra ?? {})
    };
    if (this.userAgent) {
      headers["user-agent"] = this.userAgent;
    }
    return headers;
  }

  private async parseJson(provider: string, response: Response): Promise<unknown> {
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new ProviderError(provider, "invalid_response", `${provider} response exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new ProviderError(provider, "invalid_response", `${provider} response body could not be read`);
    }
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new ProviderError(provider, "invalid_response", `${provider} response exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ProviderError(provider, "invalid_response", `${provider} returned malformed JSON`);
    }
  }

  /** Serialize requests behind a minimum interval (per provider host). */
  private throttle(): Promise<void> {
    if (this.minIntervalMs <= 0) {
      return Promise.resolve();
    }
    const previous = this.throttleChain;
    let release!: () => void;
    this.throttleChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            release();
            resolve();
          }, this.minIntervalMs);
        })
    );
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private backoffDelay(attempt: number): number {
    const exponential = this.retryBaseDelayMs * 2 ** attempt;
    const jitter = this.random() * this.retryBaseDelayMs;
    return Math.min(exponential + jitter, MAX_BACKOFF_MS);
  }
}

class RetryableHttpError extends Error {
  constructor(readonly status: number) {
    super(`retryable HTTP ${status}`);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return undefined;
}
