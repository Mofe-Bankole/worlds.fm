import { describe, expect, it } from "vitest";
import { INITIAL_PLAYER_STATE, playerEntityStatus, playerReducer } from "../src/lib/music/player-state";
import { spotifyUri } from "../src/lib/music/spotify-embed";
import { ALBUM, OTHER, TRACK } from "./spotify-fixtures";

describe("ephemeral player state", () => {
  it("replaces selection on play and clears content and playback on close", () => {
    const album = playerReducer(INITIAL_PLAYER_STATE, { type: "play", entity: ALBUM, requestId: 1 });
    const track = playerReducer(album, { type: "play", entity: TRACK, requestId: 2 });
    expect(track.entity).toBe(TRACK);
    expect(track.playback).toBe("unknown");
    expect(playerReducer(track, { type: "close" })).toEqual({ ...INITIAL_PLAYER_STATE, requestId: 2 });
  });

  it("does not infer playback from selection or controller readiness", () => {
    const selected = playerReducer(INITIAL_PLAYER_STATE, { type: "play", entity: TRACK, requestId: 1 });
    expect(playerEntityStatus(selected, "track", TRACK.id)).toBe("Loading player");
    const ready = playerReducer(selected, { type: "phase", phase: "ready", requestId: 1 });
    expect(playerEntityStatus(ready, "track", TRACK.id)).toBe("In player");
    const playing = playerReducer(ready, { type: "playback", uri: spotifyUri("track", TRACK.id)!, paused: false, buffering: false, requestId: 1 });
    expect(playerEntityStatus(playing, "track", TRACK.id)).toBe("Playing");
    const paused = playerReducer(playing, { type: "playback", uri: spotifyUri("track", TRACK.id)!, paused: true, buffering: false, requestId: 1 });
    expect(paused.playback).toBe("paused");
    expect(playerEntityStatus(paused, "track", OTHER.id)).toBeNull();
    const changedInsideEmbed = playerReducer(playing, { type: "playback", uri: spotifyUri("track", OTHER.id)!, paused: false, buffering: false, requestId: 1 });
    expect(changedInsideEmbed.playback).toBe("unknown");
    expect(changedInsideEmbed.playingUri).toBeNull();
  });

  it("recognizes only known matched tracks within an album", () => {
    let state = playerReducer(INITIAL_PLAYER_STATE, { type: "play", entity: ALBUM, requestId: 1 });
    state = playerReducer(state, { type: "phase", phase: "ready", requestId: 1 });
    state = playerReducer(state, { type: "playback", uri: spotifyUri("track", OTHER.id)!, paused: false, buffering: false, requestId: 1 });
    expect(state.playback).toBe("unknown");
    state = playerReducer(state, { type: "playback", uri: spotifyUri("track", TRACK.id)!, paused: false, buffering: true, requestId: 1 });
    expect(playerEntityStatus(state, "album", ALBUM.id)).toBe("Buffering");
    expect(playerEntityStatus(state, "track", TRACK.id)).toBe("Buffering");
  });

  it("accepts late catalogue matches without requesting playback or reviving old selections", () => {
    let state = playerReducer(INITIAL_PLAYER_STATE, { type: "play", entity: { ...ALBUM, trackIds: undefined }, requestId: 1 });
    state = playerReducer(state, { type: "phase", phase: "ready", requestId: 1 });
    const enriched = playerReducer(state, { type: "album-tracks", id: ALBUM.id, trackIds: [TRACK.id] });
    expect(enriched.requestId).toBe(state.requestId);
    expect(enriched.phase).toBe("ready");
    expect(enriched.playback).toBe("unknown");
    const observed = playerReducer(enriched, { type: "playback", uri: spotifyUri("track", TRACK.id)!, paused: false, buffering: false, requestId: 1 });
    expect(playerEntityStatus(observed, "album", ALBUM.id)).toBe("Playing");
    expect(playerEntityStatus(observed, "track", TRACK.id)).toBe("Playing");
    expect(playerReducer(observed, { type: "album-tracks", id: ALBUM.id, trackIds: [TRACK.id] })).toBe(observed);
    expect(playerReducer(observed, { type: "album-tracks", id: OTHER.id, trackIds: [] })).toBe(observed);
    const selectedTrack = playerReducer(observed, { type: "play", entity: TRACK, requestId: 2 });
    expect(playerReducer(selectedTrack, { type: "album-tracks", id: ALBUM.id, trackIds: [] })).toBe(selectedTrack);
    const closed = playerReducer(observed, { type: "close" });
    expect(playerReducer(closed, { type: "album-tracks", id: ALBUM.id, trackIds: [] })).toBe(closed);
  });

  it("ignores stale requests, callbacks after close, invalid IDs and fallback playback events", () => {
    const state = playerReducer(INITIAL_PLAYER_STATE, { type: "play", entity: TRACK, requestId: 2 });
    expect(playerReducer(state, { type: "phase", phase: "ready", requestId: 1 })).toBe(state);
    expect(playerReducer(state, { type: "play", entity: OTHER, requestId: 1 })).toBe(state);
    expect(playerReducer(state, { type: "play", entity: { ...OTHER, id: "" }, requestId: 3 })).toBe(state);
    const closed = playerReducer(state, { type: "close" });
    expect(playerReducer(closed, { type: "phase", phase: "ready", requestId: 2 })).toBe(closed);
    const fallback = playerReducer(state, { type: "phase", phase: "fallback", requestId: 2 });
    expect(playerReducer(fallback, { type: "playback", uri: spotifyUri("track", TRACK.id)!, paused: false, buffering: false, requestId: 2 })).toBe(fallback);
    expect(playerEntityStatus(fallback, "track", TRACK.id)).toBe("In player");
  });
});
