import { spotifyUri } from "./spotify-embed";
import type { PlayerEntity } from "./player-state";

type RecordingLookup = (
  mbid: string,
  signal: AbortSignal,
) => Promise<{
  kind: "ok";
  data: { recording: { mbid: string; spotify: { id: string } | null } };
} | { kind: "error" | "aborted" }>;

/** A recording's linked Spotify ID can be used even if the album listing failed. */
export async function lookupTrackForPlayback(
  mbid: string,
  title: string,
  artist: string,
  lookup: RecordingLookup,
  signal: AbortSignal,
): Promise<PlayerEntity | null> {
  const result = await lookup(mbid, signal);
  if (signal.aborted || result.kind !== "ok") return null;
  const { recording } = result.data;
  const id = recording.spotify?.id;
  if (recording.mbid !== mbid || !id || !spotifyUri("track", id)) return null;
  return { kind: "track", id, title, artist };
}
