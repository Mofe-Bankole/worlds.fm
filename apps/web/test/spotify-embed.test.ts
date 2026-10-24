import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpotifyApiLoader, SPOTIFY_EMBED_SCRIPT, spotifyEmbedUrl, spotifyUri } from "../src/lib/music/spotify-embed";
import { apiDouble, browserDouble } from "./spotify-fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("Spotify URIs and embed URLs", () => {
  it("builds album and track addresses from actual IDs, without accepting arbitrary URLs", () => {
    const id = "A".repeat(22);
    expect(spotifyUri("album", id)).toBe(`spotify:album:${id}`);
    expect(spotifyUri("track", id)).toBe(`spotify:track:${id}`);
    expect(spotifyEmbedUrl("album", id)).toBe(`https://open.spotify.com/embed/album/${id}`);
    expect(spotifyEmbedUrl("track", id)).toBe(`https://open.spotify.com/embed/track/${id}`);
    for (const invalid of ["", "short", "https://open.spotify.com/track/x", "A".repeat(21) + "/"]) {
      expect(spotifyUri("album", invalid)).toBeNull();
      expect(spotifyEmbedUrl("track", invalid)).toBeNull();
    }
  });
});

describe("on-demand singleton loader", () => {
  it("does no work during import/creation, and requests the script only on first use", async () => {
    const body = browserDouble();
    const load = createSpotifyApiLoader();
    expect(body.children).toHaveLength(0);
    expect(window.onSpotifyIframeApiReady).toBeUndefined();
    const first = load();
    expect(load()).toBe(first);
    expect(body.children).toHaveLength(1);
    expect(body.children[0].src).toBe(SPOTIFY_EMBED_SCRIPT);
    const { api } = apiDouble();
    window.onSpotifyIframeApiReady?.(api);
    await expect(first).resolves.toBe(api);
    await expect(load()).resolves.toBe(api);
    expect(body.children).toHaveLength(1);
  });

  it("rejects on script failure, restores the previous callback, and retries only when called again", async () => {
    const body = browserDouble();
    const previous = vi.fn();
    window.onSpotifyIframeApiReady = previous;
    const load = createSpotifyApiLoader();
    const pending = load();
    const rejection = expect(pending).rejects.toThrow("could not load");
    body.children[0].onerror?.();
    await rejection;
    expect(body.children).toHaveLength(0);
    expect(window.onSpotifyIframeApiReady).toBe(previous);
    const retry = load();
    expect(body.children).toHaveLength(1);
    const { api } = apiDouble();
    window.onSpotifyIframeApiReady?.(api);
    await expect(retry).resolves.toBe(api);
    expect(previous).toHaveBeenCalledWith(api);
  });

  it("is SSR-safe and touches no document on the server", async () => {
    const load = createSpotifyApiLoader();
    await expect(load()).rejects.toThrow("requires a browser");
    const body = browserDouble();
    const pending = load();
    window.onSpotifyIframeApiReady?.(apiDouble().api);
    await pending;
    expect(body.children).toHaveLength(1);
  });
});
