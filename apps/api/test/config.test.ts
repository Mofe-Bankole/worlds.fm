import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("parses TRUST_PROXY and rejects blanket trust", () => {
    expect(loadConfig({ NODE_ENV: "test" }).trustProxy).toBe(false);
    expect(loadConfig({ NODE_ENV: "test", TRUST_PROXY: "1" }).trustProxy).toBe(1);
    expect(loadConfig({ NODE_ENV: "test", TRUST_PROXY: "10.0.0.0/8, 127.0.0.1" }).trustProxy).toEqual([
      "10.0.0.0/8",
      "127.0.0.1"
    ]);
    expect(() => loadConfig({ NODE_ENV: "test", TRUST_PROXY: "true" })).toThrow(ConfigError);
  });

  it("provides safe development defaults", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.port).toBe(4000);
    expect(config.theAudioDbApiKey).toBe("123");
    expect(config.fanartApiKey).toBeUndefined();
    expect(config.artistProviderOrder).toEqual(["theaudiodb", "fanart"]);
    expect(config.albumProviderOrder).toEqual(["coverartarchive", "theaudiodb"]);
  });

  it("normalizes provider order strings (case, whitespace, duplicates)", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      MEDIA_ARTIST_PROVIDER_ORDER: " Fanart , THEAUDIODB,fanart"
    });
    expect(config.artistProviderOrder).toEqual(["fanart", "theaudiodb"]);
  });

  it("treats a blank FANART_API_KEY as unset instead of crashing", () => {
    const config = loadConfig({ NODE_ENV: "test", FANART_API_KEY: "" });
    expect(config.fanartApiKey).toBeUndefined();
  });

  it("defaults Qloo to the hackathon host with no key", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.qlooApiBaseUrl).toBe("https://hackathon.api.qloo.com");
    expect(config.qlooApiKey).toBeUndefined();
  });

  it("treats a blank QLOO_API_KEY as unset and normalizes a trailing slash", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      QLOO_API_KEY: "   ",
      QLOO_API_BASE_URL: "https://hackathon.api.qloo.com/"
    });
    expect(config.qlooApiKey).toBeUndefined();
    expect(config.qlooApiBaseUrl).toBe("https://hackathon.api.qloo.com");
  });

  it("accepts a Qloo key and rejects a malformed base URL", () => {
    expect(loadConfig({ NODE_ENV: "test", QLOO_API_KEY: "qloo-test-key" }).qlooApiKey).toBe(
      "qloo-test-key"
    );
    expect(() => loadConfig({ NODE_ENV: "test", QLOO_API_BASE_URL: "not-a-url" })).toThrow(
      ConfigError
    );
  });

  it("defaults Qloo tuning and validates bounds", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config).toMatchObject({
      qlooHttpTimeoutMs: 8000,
      qlooHttpRetries: 1,
      qlooCacheTtlMs: 3_600_000,
      qlooRateLimitPerMinute: 20
    });
    expect(() => loadConfig({ NODE_ENV: "test", QLOO_HTTP_RETRIES: "9" })).toThrow(ConfigError);
    expect(() => loadConfig({ NODE_ENV: "test", QLOO_RATE_LIMIT_PER_MINUTE: "0" })).toThrow(
      ConfigError
    );
  });

  it("rejects unknown provider names in the discovery order", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "test", MEDIA_ARTIST_PROVIDER_ORDER: "theaudiodb,spotify" })
    ).toThrow(ConfigError);
  });

  it("rejects out-of-range ports and tiny timeouts", () => {
    expect(() => loadConfig({ NODE_ENV: "test", PORT: "0" })).toThrow(ConfigError);
    expect(() => loadConfig({ NODE_ENV: "test", MEDIA_HTTP_TIMEOUT_MS: "10" })).toThrow(ConfigError);
  });
});
