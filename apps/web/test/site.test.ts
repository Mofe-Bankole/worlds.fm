import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `next/headers` is only available inside a request, so it is stubbed with a
 * Map (which has the `.get` the code uses) and filled per test.
 */
const { headerStore } = vi.hoisted(() => ({ headerStore: new Map<string, string>() }));
vi.mock("next/headers", () => ({ headers: async () => headerStore }));

const { siteUrl, siteUrlFromRequest } = await import("@/lib/site");

beforeEach(() => {
  headerStore.clear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrlFromRequest", () => {
  it("prefers an explicitly configured canonical origin over the request host", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://worlds.fm/");
    headerStore.set("host", "worlds-fm-git-branch.vercel.app");
    expect(await siteUrlFromRequest()).toBe("https://worlds.fm");
  });

  it("prefers the Vercel production domain over a preview host", async () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "worlds-fm.vercel.app");
    headerStore.set("host", "worlds-fm-abc123.vercel.app");
    expect(await siteUrlFromRequest()).toBe("https://worlds-fm.vercel.app");
  });

  it("uses the host the request arrived on when nothing is configured", async () => {
    // Otherwise a canonical tag would claim localhost on a real deployment.
    headerStore.set("host", "worlds-fm.onrender.com");
    expect(await siteUrlFromRequest()).toBe("https://worlds-fm.onrender.com");
  });

  it("honours the forwarded host and protocol behind a proxy", async () => {
    headerStore.set("host", "internal:10000");
    headerStore.set("x-forwarded-host", "worlds.fm");
    headerStore.set("x-forwarded-proto", "https");
    expect(await siteUrlFromRequest()).toBe("https://worlds.fm");
  });

  it("keeps http for local development", async () => {
    headerStore.set("host", "localhost:3100");
    expect(await siteUrlFromRequest()).toBe("http://localhost:3100");
    headerStore.set("host", "127.0.0.1:3000");
    expect(await siteUrlFromRequest()).toBe("http://127.0.0.1:3000");
  });

  it("falls back to the build-time origin when no host is present", async () => {
    expect(await siteUrlFromRequest()).toBe(siteUrl());
  });
});
