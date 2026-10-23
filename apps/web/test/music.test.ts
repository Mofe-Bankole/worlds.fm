import { describe, expect, it } from "vitest";
import { fetchDiscography, fetchRecordingStory, fetchReleaseTracks } from "../src/lib/api/music";
import { formatDuration, formatPartialDate, formatRuntime, isSingleArtistCredit } from "../src/lib/music/format";

/** MOCK BODIES for the music client. Names and IDs are invented. */
const MBID = "aaaaaaaa-0000-4000-8000-000000000001";
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const discography = (overrides: Record<string, unknown> = {}) => ({
  status: "ok",
  artist: { mbid: MBID, name: "Mock Band", disambiguation: null, musicbrainzUrl: `https://musicbrainz.org/artist/${MBID}`, spotify: null },
  candidates: [],
  releases: [],
  counts: { album: 0, ep: 0, single: 0 },
  spotifyStatus: "not_configured",
  notice: "Mock notice.",
  retrievedAt: "2026-10-23T00:00:00.000Z",
  ...overrides,
});

describe("music client (stubbed fetch)", () => {
  it("calls only our API with a name or an MBID", async () => {
    const seen: string[] = [];
    const fetchFn = (async (url: string) => {
      seen.push(url);
      return json(discography());
    }) as typeof fetch;
    await fetchDiscography({ name: "Mock Band" }, { baseUrl: "http://api.test/", fetchFn });
    await fetchDiscography({ mbid: MBID }, { baseUrl: "http://api.test", fetchFn });
    expect(seen).toEqual([
      "http://api.test/api/v1/music/discography?name=Mock+Band",
      `http://api.test/api/v1/music/discography?mbid=${MBID}`,
    ]);
  });

  it("treats the 404 not_found body as a result, not an error", async () => {
    const body = discography({ status: "not_found", artist: null });
    const result = await fetchDiscography({ name: "x" }, { fetchFn: (() => json(body, 404)) as typeof fetch });
    expect(result).toMatchObject({ kind: "ok", data: { status: "not_found" } });
  });

  it("maps API error codes to safe, retryable messages", async () => {
    const result = await fetchReleaseTracks(MBID, null, {
      fetchFn: (() => json({ error: { code: "music_rate_limited", message: "upstream detail" } }, 429)) as typeof fetch,
    });
    expect(result).toMatchObject({ kind: "error", code: "music_rate_limited", retryable: true });
    if (result.kind === "error") expect(result.message).not.toContain("upstream detail");
  });

  it("rejects a 200 body that breaks the contract", async () => {
    const result = await fetchRecordingStory(MBID, { fetchFn: (() => json({ nope: true })) as typeof fetch });
    expect(result).toMatchObject({ kind: "error", code: "invalid_response" });
  });

  it("reports network failures and aborts distinctly", async () => {
    const down = await fetchRecordingStory(MBID, { fetchFn: (() => Promise.reject(new TypeError("fetch failed"))) as typeof fetch });
    expect(down).toMatchObject({ kind: "error", code: "network", retryable: true });
    const aborted = await fetchRecordingStory(MBID, {
      fetchFn: (() => Promise.reject(new DOMException("aborted", "AbortError"))) as typeof fetch,
    });
    expect(aborted).toEqual({ kind: "aborted" });
  });

  it("passes the Spotify album ID only when there is one", async () => {
    const seen: string[] = [];
    const fetchFn = (async (url: string) => {
      seen.push(url);
      return json({});
    }) as typeof fetch;
    await fetchReleaseTracks(MBID, "SpAlbum00000000000000A", { baseUrl: "http://api.test", fetchFn });
    await fetchReleaseTracks(MBID, null, { baseUrl: "http://api.test", fetchFn });
    expect(seen).toEqual([
      `http://api.test/api/v1/music/releases/${MBID}/tracks?spotifyAlbumId=SpAlbum00000000000000A`,
      `http://api.test/api/v1/music/releases/${MBID}/tracks`,
    ]);
  });
});

describe("music formatting", () => {
  it("formats track durations and release runtimes", () => {
    expect(formatDuration(218000)).toBe("3:38");
    expect(formatDuration(55000)).toBe("0:55");
    expect(formatDuration(3725000)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("");
    expect(formatRuntime(3066000)).toBe("51 min");
    expect(formatRuntime(4320000)).toBe("1 hr 12 min");
    expect(formatRuntime(null)).toBe("");
  });

  it("formats MusicBrainz partial dates", () => {
    expect(formatPartialDate("2015")).toBe("2015");
    expect(formatPartialDate("2015-07")).toBe("Jul 2015");
    expect(formatPartialDate("2015-07-15")).toBe("15 Jul 2015");
    expect(formatPartialDate(null)).toBe("");
  });

  it("offers a name search only for single-artist credits", () => {
    expect(isSingleArtistCredit("Ngaiire")).toBe(true);
    expect(isSingleArtistCredit("$uicideboy$")).toBe(true);
    expect(isSingleArtistCredit("Blossoms with Miles Kane")).toBe(false);
    expect(isSingleArtistCredit("Scary Pockets ft. Elise Trouw")).toBe(false);
    expect(isSingleArtistCredit("Lofi Fruits Music & Chill Fruits Music")).toBe(false);
    expect(isSingleArtistCredit(null)).toBe(false);
  });
});
