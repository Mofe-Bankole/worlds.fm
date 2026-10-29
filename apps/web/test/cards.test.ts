import { beforeEach, describe, expect, it } from "vitest";
import { fetchArtistConnection, fetchArtistImages } from "@/lib/api/discovery";
import { describeCounts, firstSentence, strongestNeighbour } from "@/lib/explorer/model";
import { loadArtistImages, resetArtistImageStore } from "@/lib/use-artist-images";
import { FIXTURE_GRAPH } from "./fixtures";

/** TEST FIXTURE payloads: invented names and URLs, never real Qloo output. */
function imagesBody(images: { name: string; imageUrl: string | null }[]) {
  return {
    images,
    provenance: { provider: "qloo", mode: "live", environment: "hackathon", retrievedAt: "2026-10-23T10:00:00.000Z" },
  };
}

const respond = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("fetchArtistConnection", () => {
  it("reads a cited pair and never treats a bad response as research", async () => {
    const urls: string[] = [];
    const body = {
      subject: "Mock A", target: "Mock B", status: "documented",
      statement: "Mock A produced Mock B's song.", reviewedAt: "2026-10-27",
      claims: [{ text: "Mock A produced Mock B's song.", citations: [
        { sourceLabel: "Test source", sourceUrl: "https://example.test/story", license: null }
      ] }],
      research: { consulted: ["Test source"], approvedBy: "Human editor" }
    };
    const fetchFn = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(body));
    }) as unknown as typeof fetch;
    expect((await fetchArtistConnection("Mock A", "Mock B", { fetchFn, baseUrl: "https://api.test" }))?.status)
      .toBe("documented");
    expect(urls[0]).toContain("subject=Mock+A&target=Mock+B");
    expect(await fetchArtistConnection("Mock A", "Mock B", {
      fetchFn: respond({ ...body, claims: [{ text: "No citation", citations: [] }] })
    })).toBeNull();
  });
});

describe("fetchArtistImages", () => {
  it("asks for a sorted, de-duplicated batch in one request", async () => {
    const urls: string[] = [];
    const fetchFn = (async (input: string) => {
      urls.push(input);
      return new Response(
        JSON.stringify(
          imagesBody([
            { name: "Alpha Mock", imageUrl: "https://images.qloo.com/i/alpha.jpg" },
            { name: "Zulu Mock", imageUrl: null },
          ]),
        ),
      );
    }) as unknown as typeof fetch;
    const images = await fetchArtistImages(["Zulu Mock", " Alpha Mock ", "Zulu Mock", "Has, Comma"], {
      baseUrl: "http://api.test",
      fetchFn,
    });
    expect(images).toEqual({ "Alpha Mock": "https://images.qloo.com/i/alpha.jpg", "Zulu Mock": null });
    expect(urls).toEqual(["http://api.test/api/v1/qloo/artist-images?names=Alpha+Mock%2CZulu+Mock"]);
  });

  it("returns null for errors and malformed bodies, and skips empty input", async () => {
    expect(await fetchArtistImages(["x"], { fetchFn: respond({ error: { code: "rate_limited" } }, 429) })).toBeNull();
    expect(await fetchArtistImages(["x"], { fetchFn: respond({ nope: true }) })).toBeNull();
    const failing = (async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    expect(await fetchArtistImages(["x"], { fetchFn: failing })).toBeNull();
    expect(await fetchArtistImages([" "], { fetchFn: failing })).toEqual({});
  });
});

describe("artist image store", () => {
  beforeEach(() => resetArtistImageStore());

  it("shares one request between overlapping callers and skips resolved names", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string) => {
      calls.push(input);
      const names = new URL(input).searchParams.get("names")?.split(",") ?? [];
      return new Response(JSON.stringify(imagesBody(names.map((name) => ({ name, imageUrl: null })))));
    }) as unknown as typeof fetch;
    try {
      await Promise.all([loadArtistImages(["A Mock", "B Mock"]), loadArtistImages(["B Mock", "A Mock"])]);
      await loadArtistImages(["A Mock", "C Mock"]);
    } finally {
      globalThis.fetch = original;
    }
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("names=C+Mock");
  });

  it("serves fresh localStorage hits without a request and ignores expired ones", async () => {
    const store = new Map<string, string>();
    const day = 24 * 60 * 60 * 1000;
    store.set(
      "worlds:artist-images:v2",
      JSON.stringify({
        "Fresh Mock": { url: "https://images.qloo.com/i/fresh.jpg", savedAt: Date.now() - day },
        "Stale Mock": { url: "https://images.qloo.com/i/stale.jpg", savedAt: Date.now() - 8 * day },
      }),
    );
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    const originalStorage = (globalThis as { localStorage?: Storage }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    globalThis.fetch = (async (input: string) => {
      calls.push(input);
      return new Response(JSON.stringify(imagesBody([{ name: "Stale Mock", imageUrl: null }])));
    }) as unknown as typeof fetch;
    try {
      await loadArtistImages(["Fresh Mock"]);
      expect(calls).toHaveLength(0);
      await loadArtistImages(["Stale Mock"]);
      expect(calls).toHaveLength(1);
      expect(Object.keys(JSON.parse(store.get("worlds:artist-images:v2") ?? "{}"))).toEqual(["Fresh Mock"]);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as { localStorage?: unknown }).localStorage = originalStorage;
    }
  });
});

describe("card helpers", () => {  it("picks the strongest neighbour as the initial selection", () => {
    expect(strongestNeighbour(FIXTURE_GRAPH)).toBe("qloo:00000000-0000-4000-8000-0000000000b2");
  });

  it("summarises category counts in words", () => {
    expect(describeCounts(FIXTURE_GRAPH)).toBe("2 artists, 1 brand and 1 destination");
  });

  it("keeps only the first sentence of a description", () => {
    expect(firstSentence("One thing. Another thing.")).toBe("One thing.");
    expect(firstSentence(null)).toBeNull();
    expect(firstSentence("a".repeat(300), 20)).toHaveLength(20);
  });
});
