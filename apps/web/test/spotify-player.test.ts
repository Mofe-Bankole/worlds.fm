import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpotifyPlayer } from "../src/lib/music/spotify-player";
import { createSpotifyApiLoader, SPOTIFY_EMBED_TIMEOUT_MS, spotifyUri, type SpotifyIframeApi } from "../src/lib/music/spotify-embed";
import { ALBUM, OTHER, TRACK, ElementDouble, apiDouble, browserDouble, deferred } from "./spotify-fixtures";

beforeEach(() => { vi.useFakeTimers(); browserDouble(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("single Spotify player lifecycle (API and DOM doubles, no network)", () => {
  it("does not request anything until play, creates once, reuses loadEntity, and does not invent playback", async () => {
    const host = new ElementDouble("div");
    const mock = apiDouble();
    const load = vi.fn(async () => mock.api);
    const report = vi.fn();
    const player = createSpotifyPlayer(host.asElement(), report, load);
    expect(load).not.toHaveBeenCalled();
    player.play(ALBUM, 1);
    await tick();
    expect(mock.api.createController).toHaveBeenCalledTimes(1);
    expect(mock.controller.play).not.toHaveBeenCalled();
    mock.ready();
    expect(mock.controller.play).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: "playback" }));
    player.play(TRACK, 2);
    player.play(TRACK, 2);
    expect(mock.controller.loadEntity).toHaveBeenCalledExactlyOnceWith(spotifyUri("track", TRACK.id));
    expect(mock.controller.play).toHaveBeenCalledTimes(2);
    expect(host.children).toHaveLength(1);
    expect(host.querySelector("iframe")?.title).toBe("Spotify track: Fixture track");
    mock.playback(spotifyUri("track", TRACK.id)!);
    expect(report).toHaveBeenLastCalledWith({ type: "playback", uri: spotifyUri("track", TRACK.id), paused: false, buffering: false, requestId: 2 });
    player.destroy();
    expect(host.children).toHaveLength(0);
    expect(mock.listenerCount()).toBe(0);
    expect(mock.controller.destroy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("coalesces rapid selections before the API and before ready; only the latest request plays", async () => {
    const host = new ElementDouble("div");
    const pending = deferred<SpotifyIframeApi>();
    const mock = apiDouble();
    const player = createSpotifyPlayer(host.asElement(), vi.fn(), () => pending.promise);
    player.play(ALBUM, 1);
    player.play(TRACK, 2);
    pending.resolve(mock.api);
    await tick();
    expect(mock.api.createController).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ uri: spotifyUri("track", TRACK.id) }), expect.any(Function));
    player.play(OTHER, 3);
    mock.ready();
    mock.ready();
    expect(mock.controller.loadEntity).toHaveBeenCalledExactlyOnceWith(spotifyUri("track", OTHER.id));
    expect(mock.controller.play).toHaveBeenCalledTimes(1);
    player.destroy();
  });

  it("locks a timed-out session to a single fallback even if the API arrives late", async () => {
    const host = new ElementDouble("div");
    const pending = deferred<SpotifyIframeApi>();
    const mock = apiDouble();
    const report = vi.fn();
    const player = createSpotifyPlayer(host.asElement(), report, () => pending.promise);
    player.play(ALBUM, 1);
    vi.advanceTimersByTime(SPOTIFY_EMBED_TIMEOUT_MS);
    const iframe = host.querySelector("iframe");
    expect(iframe?.src).toBe(`https://open.spotify.com/embed/album/${ALBUM.id}`);
    expect(iframe?.loading).toBe("lazy");
    expect(iframe?.allow).toContain("encrypted-media");
    pending.resolve(mock.api);
    await tick();
    expect(mock.api.createController).not.toHaveBeenCalled();
    player.play(TRACK, 2);
    expect(host.querySelector("iframe")).toBe(iframe);
    expect(host.children).toHaveLength(1);
    iframe?.onload?.();
    expect(report).toHaveBeenLastCalledWith({ type: "phase", phase: "fallback", requestId: 2 });
    expect(mock.controller.play).not.toHaveBeenCalled();
    player.destroy();
  });

  it("disposes a late controller without removing the fallback iframe", async () => {
    const host = new ElementDouble("div");
    const mock = apiDouble(true);
    const player = createSpotifyPlayer(host.asElement(), vi.fn(), async () => mock.api);
    player.play(ALBUM, 1);
    await tick();
    vi.advanceTimersByTime(SPOTIFY_EMBED_TIMEOUT_MS);
    const fallback = host.querySelector("iframe");
    mock.attach();
    expect(host.querySelector("iframe")).toBe(fallback);
    expect(host.children).toHaveLength(1);
    expect(mock.controller.destroy).toHaveBeenCalledTimes(1);
    expect(mock.controller.play).not.toHaveBeenCalled();
    player.destroy();
  });

  it("handles script errors, failed fallback, and a fallback that never loads", async () => {
    for (const failure of ["error", "timeout"]) {
      const host = new ElementDouble("div");
      const report = vi.fn();
      const player = createSpotifyPlayer(host.asElement(), report, () => Promise.reject(new Error("fixture failure")));
      player.play(TRACK, 1);
      await tick();
      if (failure === "error") host.querySelector("iframe")?.onerror?.();
      else vi.advanceTimersByTime(SPOTIFY_EMBED_TIMEOUT_MS);
      expect(host.children).toHaveLength(0);
      expect(report).toHaveBeenLastCalledWith({ type: "phase", phase: "unavailable", requestId: 1 });
      player.destroy();
    }
  });

  it.each(["load", "error"])("ignores a stale fallback %s callback after replacing the selection", async (event) => {
    const host = new ElementDouble("div");
    const report = vi.fn();
    const player = createSpotifyPlayer(host.asElement(), report, () => Promise.reject(new Error("fixture failure")));
    player.play(ALBUM, 1);
    await tick();
    const frame = host.querySelector("iframe")!;
    const staleCallback = event === "load" ? frame.onload! : frame.onerror!;
    player.play(TRACK, 2);
    const count = report.mock.calls.length;
    staleCallback();
    expect(host.querySelector("iframe")).toBe(frame);
    expect(report).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(SPOTIFY_EMBED_TIMEOUT_MS);
    expect(report).toHaveBeenLastCalledWith({ type: "phase", phase: "unavailable", requestId: 2 });
    player.destroy();
  });

  it("cancels close-before-API and shares a script across Strict Mode cleanup and reopening", async () => {
    const load = createSpotifyApiLoader();
    const oldHost = new ElementDouble("div");
    const old = createSpotifyPlayer(oldHost.asElement(), vi.fn(), load);
    old.play(ALBUM, 1);
    old.destroy();
    const host = new ElementDouble("div");
    const reopened = createSpotifyPlayer(host.asElement(), vi.fn(), load);
    reopened.play(TRACK, 2);
    expect((document.body as unknown as ElementDouble).children).toHaveLength(1);
    const mock = apiDouble();
    window.onSpotifyIframeApiReady?.(mock.api);
    await tick();
    expect(oldHost.children).toHaveLength(0);
    expect(mock.api.createController).toHaveBeenCalledTimes(1);
    mock.ready();
    expect(mock.controller.play).toHaveBeenCalledTimes(1);
    reopened.destroy();
  });

  it("destroys close-before-controller callbacks and ignores subsequent stale events", async () => {
    const host = new ElementDouble("div");
    const mock = apiDouble(true);
    const report = vi.fn();
    const player = createSpotifyPlayer(host.asElement(), report, async () => mock.api);
    player.play(ALBUM, 1);
    await tick();
    player.destroy();
    player.destroy();
    const count = report.mock.calls.length;
    mock.attach();
    mock.ready();
    mock.playback(spotifyUri("track", TRACK.id)!);
    expect(report).toHaveBeenCalledTimes(count);
    expect(mock.controller.play).not.toHaveBeenCalled();
    expect(mock.controller.destroy).toHaveBeenCalledTimes(1);
    expect(host.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
