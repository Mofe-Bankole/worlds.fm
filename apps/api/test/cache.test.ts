import { describe, expect, it } from "vitest";

import { TtlCache } from "../src/lib/cache.js";

let clock = 0;
const now = () => clock;

function makeCache(overrides: Partial<ConstructorParameters<typeof TtlCache>[0]> = {}) {
  return new TtlCache<string>({
    ttlMs: 1000,
    negativeTtlMs: 100,
    maxEntries: 3,
    now,
    ...overrides
  });
}

describe("TtlCache", () => {
  it("stores and reads positive entries within the TTL", () => {
    clock = 0;
    const cache = makeCache();
    cache.set("a", "value");
    expect(cache.get("a")).toEqual({ hit: true, value: "value", negative: false });
    clock = 999;
    expect(cache.get("a").hit).toBe(true);
  });

  it("expires positive entries after the TTL", () => {
    clock = 0;
    const cache = makeCache();
    cache.set("a", "value");
    clock = 1000;
    expect(cache.get("a").hit).toBe(false);
  });

  it("expires negative entries on the shorter negative TTL", () => {
    clock = 0;
    const cache = makeCache();
    cache.set("missing", "nope", { negative: true });
    clock = 99;
    expect(cache.get("missing")).toEqual({ hit: true, value: "nope", negative: true });
    clock = 101;
    expect(cache.get("missing").hit).toBe(false);
  });

  it("evicts the oldest entry beyond maxEntries", () => {
    clock = 0;
    const cache = makeCache({ maxEntries: 2 });
    cache.set("a", "1");
    clock = 10;
    cache.set("b", "2");
    clock = 20;
    cache.set("c", "3");
    expect(cache.get("a").hit).toBe(false);
    expect(cache.get("b").hit).toBe(true);
    expect(cache.get("c").hit).toBe(true);
    expect(cache.size).toBe(2);
  });

  it("supports explicit TTL overrides per entry", () => {
    clock = 0;
    const cache = makeCache();
    cache.set("short", "x", { ttlMs: 10 });
    clock = 11;
    expect(cache.get("short").hit).toBe(false);
  });
});
