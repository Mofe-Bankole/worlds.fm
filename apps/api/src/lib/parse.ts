import type { z } from "zod";

import { ProviderError } from "./errors.js";

/**
 * Validate an upstream payload before normalizing it. Providers are external
 * and their shapes drift; anything unexpected becomes a typed
 * `invalid_response` error instead of a runtime crash.
 */
export function parseProviderPayload<Schema extends z.ZodType>(
  provider: string,
  schema: Schema,
  payload: unknown
): z.infer<Schema> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ProviderError(
      provider,
      "invalid_response",
      `unexpected ${provider} response shape`
    );
  }
  return result.data as z.infer<Schema>;
}

/** Coerce an untrusted string into a URL or null. */
export function asUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
}
