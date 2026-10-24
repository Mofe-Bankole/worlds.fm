import { describe, expect, it, vi } from "vitest";
import { lookupTrackForPlayback } from "../src/lib/music/track-play";

const mbid = "aaaaaaaa-0000-4000-8000-000000000001";
const trackId = "B".repeat(22);
const recording = (id: string | null, recordingMbid = mbid) => ({
  recording: {
    mbid: recordingMbid,
    spotify: id ? { id, url: `https://open.spotify.com/track/${id}` } : null,
  },
});

describe("recording fallback for a track without an album Spotify match", () => {
  it("uses a linked recording ID and the row's own title and artist", async () => {
    const lookup = vi.fn(async () => ({ kind: "ok" as const, data: recording(trackId) }));
    const entity = await lookupTrackForPlayback(mbid, "Fixture track", "Fixture artist", lookup, new AbortController().signal);
    expect(lookup).toHaveBeenCalledWith(mbid, expect.any(AbortSignal));
    expect(entity).toEqual({ kind: "track", id: trackId, title: "Fixture track", artist: "Fixture artist" });
  });

  it.each([
    recording(null),
    recording("not-a-spotify-id"),
    recording(trackId, "aaaaaaaa-0000-4000-8000-000000000002"),
  ])("never creates a player for an absent, invalid, or mismatched Spotify ID", async (data) => {
    const lookup = vi.fn(async () => ({ kind: "ok" as const, data }));
    expect(await lookupTrackForPlayback(mbid, "Fixture track", "Fixture artist", lookup, new AbortController().signal)).toBeNull();
  });

  it("does not play after a failed or cancelled recording lookup", async () => {
    const failed = vi.fn(async () => ({ kind: "error" as const }));
    expect(await lookupTrackForPlayback(mbid, "Fixture track", "Fixture artist", failed, new AbortController().signal)).toBeNull();
    const cancelled = new AbortController();
    const deferred = Promise.withResolvers<{ kind: "ok"; data: ReturnType<typeof recording> }>();
    const pending = lookupTrackForPlayback(mbid, "Fixture track", "Fixture artist", () => deferred.promise, cancelled.signal);
    cancelled.abort();
    deferred.resolve({ kind: "ok", data: recording(trackId) });
    expect(await pending).toBeNull();
  });
});
