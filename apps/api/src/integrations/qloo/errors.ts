import { ApiError, isProviderError } from "../../lib/errors.js";

/**
 * Translate an upstream Qloo failure into the stable API error envelope.
 * Messages are fixed strings: they never echo upstream bodies, URLs or headers,
 * so the API key cannot leak through an error path.
 */
export function mapQlooError(error: unknown): unknown {
  if (!isProviderError(error)) {
    return error;
  }
  switch (error.kind) {
    case "unauthorized":
      return error.status === 403
        ? new ApiError(
            502,
            "qloo_forbidden",
            "Qloo denied access to this entity type or endpoint for the configured key."
          )
        : new ApiError(
            502,
            "qloo_unauthorized",
            "Qloo rejected the configured API key. Check QLOO_API_KEY and QLOO_API_BASE_URL."
          );
    case "rate_limited":
      return new ApiError(
        429,
        "qloo_rate_limited",
        "Qloo is rate-limiting requests. Try again shortly."
      );
    case "timeout":
      return new ApiError(504, "qloo_timeout", "Qloo did not respond in time.");
    case "invalid_response":
      return new ApiError(
        502,
        "qloo_invalid_response",
        "Qloo returned a response Worlds.fm could not read."
      );
    case "http":
      if (error.status === 400) {
        return new ApiError(
          400,
          "qloo_request_rejected",
          "Qloo rejected the request. Check entityId and targetType."
        );
      }
      return new ApiError(502, "qloo_unavailable", "Qloo is temporarily unavailable.");
    case "not_found":
      return new ApiError(404, "qloo_not_found", "Qloo has no data for that entity.");
    case "network":
      return new ApiError(502, "qloo_unavailable", "Qloo is temporarily unavailable.");
  }
}

export function qlooNotConfigured(): ApiError {
  return new ApiError(
    503,
    "qloo_not_configured",
    "Qloo is not configured on this server. Set QLOO_API_KEY to enable cultural affinity lookups."
  );
}
