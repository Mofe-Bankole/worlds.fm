import { describe, expect, it } from "vitest";
import { fetchArtistGraph, resolveApiBaseUrl } from "../src/lib/api/discovery";
import { fixtureResponse } from "./fixtures";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("fetchArtistGraph (stubbed fetch, fixture bodies)", () => {
  it("calls only our API with the documented path and parameters", async () => {
    let seen = "";
    const result = await fetchArtistGraph("Mock Artist", {
      baseUrl: "http://api.test/",
      fetchFn: (async (url: string) => {
        seen = url;
        return json(fixtureResponse());
      }) as typeof fetch,
    });
    expect(seen).toBe("http://api.test/api/v1/graph/artist?query=Mock+Artist&limit=5");
    expect(seen).not.toMatch(/qloo\.com/);
    expect(result.kind).toBe("ok");
  });

  it("clamps limit to the API maximum", async () => {
    let seen = "";
    await fetchArtistGraph("x", {
      limit: 99,
      fetchFn: (async (url: string) => {
        seen = url;
        return json(fixtureResponse());
      }) as typeof fetch,
    });
    expect(seen).toContain("limit=5");
  });

  it("accepts the 404 not_found body as an honest result", async () => {
    const body = fixtureResponse({ status: "not_found", resolution: "none", root: null, graph: null, candidates: [] });
    const result = await fetchArtistGraph("zzz", { fetchFn: (() => json(body, 404)) as typeof fetch });
    expect(result).toMatchObject({ kind: "ok", data: { status: "not_found" } });
  });

  it("maps API error envelopes to safe messages", async () => {
    const result = await fetchArtistGraph("x", {
      fetchFn: (() => json({ error: { code: "qloo_rate_limited", message: "upstream internals", requestId: "r" } }, 429)) as typeof fetch,
    });
    expect(result).toMatchObject({ kind: "error", code: "qloo_rate_limited", retryable: true, status: 429 });
    expect(JSON.stringify(result)).not.toContain("internals");
  });

  it("rejects a malformed 200 instead of rendering it", async () => {
    const result = await fetchArtistGraph("x", { fetchFn: (() => json({ status: "complete" })) as typeof fetch });
    expect(result).toMatchObject({ kind: "error", code: "invalid_response" });
  });

  it("reports network failure as retryable", async () => {
    const result = await fetchArtistGraph("x", {
      fetchFn: (() => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch,
    });
    expect(result).toMatchObject({ kind: "error", code: "network", retryable: true, status: null });
  });

  it("returns aborted for a cancelled request so stale answers are dropped", async () => {
    const controller = new AbortController();
    const pending = fetchArtistGraph("x", {
      signal: controller.signal,
      fetchFn: ((_url: string, init?: RequestInit) =>
        new Promise((_res, rej) => {
          init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        })) as typeof fetch,
    });
    controller.abort();
    expect(await pending).toEqual({ kind: "aborted" });
  });

  it("defaults the API base URL to local Fastify", () => {
    expect(resolveApiBaseUrl("")).toBe("http://localhost:4000");
    expect(resolveApiBaseUrl("https://api.example.com//")).toBe("https://api.example.com");
  });
});
