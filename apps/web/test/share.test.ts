import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isShareableName,
  isSongId,
  normalizeShareName,
  ogCardFontSize,
  ogCardName,
  resolveShareOrigin,
  SHARE_NAME_MAX,
  songDescription,
  songPath,
  songShareTarget,
  songUrl,
  worldDescription,
  worldPath,
  worldShareTarget,
  worldUrl,
} from "@/lib/share";
import { siteUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeShareName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeShareName("  Tame   Impala  ")).toBe("Tame Impala");
    expect(normalizeShareName("Tame\tImpala\n")).toBe("Tame Impala");
  });

  it("strips control characters rather than letting them into a URL", () => {
    expect(normalizeShareName("Avicii\u0000\u001F")).toBe("Avicii");
    expect(normalizeShareName("A\u0007B")).toBe("A B");
  });

  it("caps the length at the search limit", () => {
    const long = "a".repeat(SHARE_NAME_MAX + 50);
    expect(normalizeShareName(long)).toHaveLength(SHARE_NAME_MAX);
  });

  it("returns an empty string for unusable input", () => {
    for (const value of ["", "   ", "\u0000", null, undefined]) {
      expect(normalizeShareName(value)).toBe("");
      expect(isShareableName(value)).toBe(false);
    }
  });

  it("accepts ordinary names", () => {
    for (const name of ["Avicii", "Tame Impala", "Fela Kuti", "$uicideboy$", "AC/DC", "宇多田ヒカル"]) {
      expect(isShareableName(name)).toBe(true);
    }
  });
});

describe("worldPath", () => {
  it("addresses a world by name in the query string", () => {
    expect(worldPath("Tame Impala")).toBe("/explore?q=Tame+Impala");
  });

  it("percent-encodes names that would break a path segment", () => {
    // A raw "/" would be read as a path separator, so it must be encoded.
    expect(worldPath("AC/DC")).toBe("/explore?q=AC%2FDC");
    expect(worldPath("AC/DC")).not.toContain("/DC");
  });

  it("round-trips every name through the URL unchanged", () => {
    const names = ["Tame Impala", "AC/DC", "$uicideboy$", "Sunn O)))", "宇多田ヒカル", "a&b=c", "100% Pure", "#hash", "?query"];
    for (const name of names) {
      const path = worldPath(name);
      const query = path.slice(path.indexOf("?") + 1);
      expect(new URLSearchParams(query).get("q")).toBe(name);
    }
  });

  it("normalizes before encoding, so the link is stable", () => {
    expect(worldPath("  Tame   Impala ")).toBe(worldPath("Tame Impala"));
  });

  it("carries the artist name and nothing else", () => {
    // No accounts exist yet, so a share link must not be able to encode
    // anything personal: it is built from the name alone.
    const params = new URLSearchParams(worldPath("Avicii").split("?")[1]);
    expect([...params.keys()]).toEqual(["q"]);
  });
});

describe("worldUrl", () => {
  it("builds an absolute URL and ignores trailing slashes on the origin", () => {
    expect(worldUrl("Avicii", "https://worlds.fm")).toBe("https://worlds.fm/explore?q=Avicii");
    expect(worldUrl("Avicii", "https://worlds.fm/")).toBe("https://worlds.fm/explore?q=Avicii");
  });
});

describe("resolveShareOrigin", () => {
  it("prefers the configured canonical site URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://worlds.fm/");
    expect(resolveShareOrigin()).toBe("https://worlds.fm");
  });

  it("falls back when the configured value is blank", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "   ");
    expect(resolveShareOrigin("http://fallback.test")).toBe("http://fallback.test");
  });
});

describe("worldShareTarget", () => {
  it("names the artist and links to their world", () => {
    const data = worldShareTarget("Tame Impala", "https://worlds.fm");
    expect(data.title).toBe("Tame Impala — Worlds.fm");
    expect(data.text).toContain("Tame Impala");
    expect(data.url).toBe("https://worlds.fm/explore?q=Tame+Impala");
  });

  it("normalizes the name it is given", () => {
    expect(worldShareTarget("  Avicii  ", "https://worlds.fm").url).toBe("https://worlds.fm/explore?q=Avicii");
  });
});

describe("songPath and songUrl", () => {
  const MBID = "3f0f4a1e-1111-4222-8333-444455556666";

  it("addresses a song by recording ID in a path segment", () => {
    expect(songPath(MBID)).toBe(`/song/${MBID}`);
    expect(songUrl(MBID, "https://worlds.fm")).toBe(`https://worlds.fm/song/${MBID}`);
    expect(songUrl(MBID, "https://worlds.fm/")).toBe(`https://worlds.fm/song/${MBID}`);
  });

  it("needs no encoding, so the ID round-trips exactly", () => {
    expect(songPath(MBID).slice("/song/".length)).toBe(MBID);
  });

  it("accepts only well-formed MusicBrainz IDs", () => {
    expect(isSongId(MBID)).toBe(true);
    expect(isSongId(MBID.toUpperCase())).toBe(true);
    for (const value of ["", "not-a-uuid", MBID.slice(0, -1), `${MBID}x`, "AC/DC", null, undefined]) {
      expect(isSongId(value)).toBe(false);
    }
  });
});

describe("songShareTarget", () => {
  const MBID = "3f0f4a1e-1111-4222-8333-444455556666";

  it("names the song, the artist and where the facts come from", () => {
    const data = songShareTarget({ recordingMbid: MBID, title: "Let It Happen", artist: "Tame Impala" }, "https://worlds.fm");
    expect(data.title).toBe("Let It Happen by Tame Impala — Worlds.fm");
    expect(data.text).toContain("Let It Happen");
    expect(data.text).toContain("Tame Impala");
    expect(data.url).toBe(`https://worlds.fm/song/${MBID}`);
  });

  it("does not invent an artist when the credit is missing", () => {
    const data = songShareTarget({ recordingMbid: MBID, title: "Untitled", artist: null }, "https://worlds.fm");
    expect(data.title).toBe("Untitled — Worlds.fm");
    expect(data.text).not.toContain(" by ");
    expect(data.text).not.toContain("null");
  });

  it("trims the values it is given, so a link is stable", () => {
    const data = songShareTarget({ recordingMbid: MBID, title: "  Let It Happen ", artist: " Tame Impala " }, "https://worlds.fm");
    expect(data.title).toBe("Let It Happen by Tame Impala — Worlds.fm");
  });
});

describe("songDescription", () => {
  it("names the song, the artist and the sources", () => {
    const text = songDescription("Let It Happen", "Tame Impala");
    expect(text).toContain("Let It Happen by Tame Impala");
    expect(text).toContain("MusicBrainz");
  });

  it("makes no claim beyond what the page shows", () => {
    const text = songDescription("Let It Happen", "Tame Impala");
    expect(text).not.toMatch(/endorse|inspired|influence|caused/i);
    // The story cites sources; it is not written by us.
    expect(text).toContain("cited facts");
  });

  it("reads correctly without an artist", () => {
    expect(songDescription("Untitled", null)).toContain("The story of Untitled:");
  });
});

describe("worldDescription", () => {
  it("names the artist and makes no claim beyond what the page shows", () => {
    const text = worldDescription("Avicii");
    expect(text).toContain("Avicii");
    expect(text).not.toMatch(/endorse|inspired|influence|caused/i);
  });
});

describe("share card helpers", () => {
  it("shortens only names that would overflow the frame", () => {
    expect(ogCardName("Avicii")).toBe("Avicii");
    const long = ogCardName("a".repeat(80), 20);
    expect(long).toHaveLength(20);
    expect(long.endsWith("…")).toBe(true);
  });

  it("shrinks the type as the name grows, so it always fits", () => {
    const sizes = [6, 12, 20, 30, 50].map(ogCardFontSize);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1] as number);
    }
  });
});

describe("siteUrl", () => {
  it("prefers the configured public origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://worlds.fm/");
    expect(siteUrl()).toBe("https://worlds.fm");
  });

  it("falls back to the Vercel production domain, not the deployment URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "worlds.fm");
    vi.stubEnv("VERCEL_URL", "worlds-fm-abc123.vercel.app");
    expect(siteUrl()).toBe("https://worlds.fm");
  });

  it("uses localhost when nothing is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
