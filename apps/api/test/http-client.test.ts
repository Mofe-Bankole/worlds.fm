import { describe, expect, it } from "vitest";

import { ProviderError } from "../src/lib/errors.js";
import { ProviderHttpClient } from "../src/lib/http-client.js";
import { hangingFetch, jsonResponse, statusResponse } from "./fixtures.js";

function makeClient(overrides: Partial<ConstructorParameters<typeof ProviderHttpClient>[0]> = {}) {
  return new ProviderHttpClient({
    timeoutMs: 100,
    retries: 2,
    retryBaseDelayMs: 5,
    random: () => 0,
    ...overrides
  });
}

describe("ProviderHttpClient", () => {
  it("parses JSON from a 200 response and sends the User-Agent", async () => {
    const seen: Array<string | undefined> = [];
    const client = makeClient({
      userAgent: "worlds-fm-tests/0.1",
      fetchFn: async (_input, init) => {
        seen.push((init?.headers as Record<string, string>)["user-agent"]);
        return jsonResponse({ ok: true });
      }
    });
    const data = await client.getJson({ provider: "test", url: "https://example.com/x" });
    expect(data).toEqual({ ok: true });
    expect(seen[0]).toBe("worlds-fm-tests/0.1");
  });

  it("does not retry 404 and throws a typed not_found error", async () => {
    let calls = 0;
    const client = makeClient({
      fetchFn: async () => {
        calls += 1;
        return statusResponse(404);
      }
    });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).rejects.toMatchObject(
      { kind: "not_found", status: 404 }
    );
    expect(calls).toBe(1);
  });

  it("does not retry 401 and throws a typed unauthorized error", async () => {
    let calls = 0;
    const client = makeClient({
      fetchFn: async () => {
        calls += 1;
        return statusResponse(401, { error: "invalid API key" });
      }
    });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).rejects.toMatchObject(
      { kind: "unauthorized", status: 401 }
    );
    expect(calls).toBe(1);
  });

  it("retries 500s with backoff and succeeds", async () => {
    let calls = 0;
    const client = makeClient({
      fetchFn: async () => {
        calls += 1;
        return calls < 3 ? statusResponse(500) : jsonResponse({ ok: true });
      }
    });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).resolves.toEqual({
      ok: true
    });
    expect(calls).toBe(3);
  });

  it("throws a typed http error after exhausting retries on 5xx", async () => {
    const client = makeClient({ fetchFn: async () => statusResponse(503) });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).rejects.toMatchObject(
      { kind: "http", status: 503 }
    );
  });

  it("honors Retry-After on 429 before retrying", async () => {
    // Real timers: the documented wait is ~1s for `Retry-After: 1`.
    let calls = 0;
    const started = Date.now();
    const client = makeClient({
      fetchFn: async () => {
        calls += 1;
        return calls === 1
          ? statusResponse(429, {}, { "retry-after": "1" })
          : jsonResponse({ ok: true });
      }
    });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).resolves.toEqual({
      ok: true
    });
    expect(calls).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(950);
  }, 10_000);

  it("throws rate_limited when 429 persists beyond retries", async () => {
    const client = makeClient({
      retries: 1,
      fetchFn: async () => statusResponse(429, {}, { "retry-after": "0" })
    });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).rejects.toMatchObject(
      { kind: "rate_limited", status: 429 }
    );
  });

  it("turns fetch aborts into typed timeout errors", async () => {
    const client = makeClient({ timeoutMs: 25, fetchFn: hangingFetch() });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).rejects.toMatchObject(
      { kind: "timeout" }
    );
  });

  it("throws network errors as typed ProviderError", async () => {
    const client = makeClient({
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      }
    });
    await expect(client.getJson({ provider: "t", url: "https://example.com" })).rejects.toMatchObject(
      { kind: "network" }
    );
  });

  it("rejects malformed JSON as invalid_response", async () => {
    const client = makeClient({
      fetchFn: async () => new Response("{not json", { status: 200 })
    });
    const attempt = client.getJson({ provider: "t", url: "https://example.com" });
    await expect(attempt).rejects.toBeInstanceOf(ProviderError);
    await expect(attempt).rejects.toMatchObject({ kind: "invalid_response" });
  });
});
