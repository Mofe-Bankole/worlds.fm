/**
 * Error primitives shared across the API.
 *
 * `ApiError` maps to a client-facing HTTP response using the stable envelope
 * defined in @worlds/shared. `ProviderError` describes upstream failures and
 * is converted by the resolver into a provider report, not a 5xx.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export type ProviderErrorKind =
  | "timeout"
  | "rate_limited"
  | "unauthorized"
  | "not_found"
  | "http"
  | "network"
  | "invalid_response";

export class ProviderError extends Error {
  readonly provider: string;
  readonly kind: ProviderErrorKind;
  readonly status: number | undefined;
  /**
   * Set on `rate_limited` when the provider said how long to wait. Callers use
   * it to stop asking for the duration of the window instead of retrying into
   * a refusal that cannot succeed.
   */
  readonly retryAfterMs: number | undefined;

  constructor(
    provider: string,
    kind: ProviderErrorKind,
    message: string,
    status?: number,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }

  /** Short, log-safe detail string surfaced in provider reports. */
  get reportDetail(): string {
    if (this.status !== undefined) {
      return `${this.kind} (HTTP ${this.status})`;
    }
    return this.kind;
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/** Zod issue summary safe to show clients (paths + messages, no internals). */
export function summarizeValidationIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => `${issue.path.map(String).join(".") || "query"}: ${issue.message}`)
    .join("; ");
}
