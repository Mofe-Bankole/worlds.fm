import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
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
