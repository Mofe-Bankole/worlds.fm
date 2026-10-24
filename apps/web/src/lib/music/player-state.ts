import { spotifyUri, type SpotifyEntityKind } from "./spotify-embed";

export interface PlayerEntity {
  kind: SpotifyEntityKind;
  id: string;
  title: string;
  artist: string;
  /** Known matched tracks, used only to recognize playback inside this album. */
  trackIds?: readonly string[];
}

export type PlayerPhase = "loading" | "ready" | "fallback" | "unavailable";
export type PlaybackStatus = "unknown" | "playing" | "paused" | "buffering";
export interface PlayerState {
  entity: PlayerEntity | null;
  requestId: number;
  phase: PlayerPhase;
  playback: PlaybackStatus;
  playingUri: string | null;
}

export const INITIAL_PLAYER_STATE: PlayerState = {
  entity: null, requestId: 0, phase: "loading", playback: "unknown", playingUri: null,
};

export type PlayerAction =
  | { type: "play"; entity: PlayerEntity; requestId: number }
  | { type: "album-tracks"; id: string; trackIds: readonly string[] }
  | { type: "phase"; phase: PlayerPhase; requestId: number }
  | { type: "playback"; uri: string; paused: boolean; buffering: boolean; requestId: number }
  | { type: "close" };

export function entityContainsUri(entity: PlayerEntity, uri: string): boolean {
  return uri === spotifyUri(entity.kind, entity.id)
    || (entity.kind === "album" && Boolean(entity.trackIds?.some((id) => uri === spotifyUri("track", id))));
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  if (action.type === "close") return { ...INITIAL_PLAYER_STATE, requestId: state.requestId };
  if (action.type === "play") {
    if (!spotifyUri(action.entity.kind, action.entity.id) || action.requestId <= state.requestId) return state;
    return { ...INITIAL_PLAYER_STATE, entity: action.entity, requestId: action.requestId };
  }
  if (action.type === "album-tracks") {
    if (state.entity?.kind !== "album" || state.entity.id !== action.id) return state;
    if (state.entity.trackIds?.length === action.trackIds.length
      && state.entity.trackIds.every((id, index) => id === action.trackIds[index])) return state;
    // Catalogue enrichment is not a Play request and preserves observed state.
    return { ...state, entity: { ...state.entity, trackIds: action.trackIds } };
  }
  if (!state.entity || action.requestId !== state.requestId) return state;
  if (action.type === "phase") {
    return { ...state, phase: action.phase, playback: "unknown", playingUri: null };
  }
  if (state.phase !== "ready") return state;
  if (!entityContainsUri(state.entity, action.uri)) {
    return { ...state, playback: "unknown", playingUri: null };
  }
  return {
    ...state, playingUri: action.uri,
    playback: action.buffering ? "buffering" : action.paused ? "paused" : "playing",
  };
}

export function playerEntityStatus(state: PlayerState, kind: SpotifyEntityKind, id: string): string | null {
  const selected = state.entity?.kind === kind && state.entity.id === id;
  const observed = kind === "track" && state.playingUri === spotifyUri(kind, id);
  if (!selected && !observed) return null;
  if (state.playback !== "unknown" && (selected || observed)) {
    return state.playback === "playing" ? "Playing" : state.playback === "buffering" ? "Buffering" : "Paused";
  }
  if (state.phase === "unavailable") return "Player unavailable";
  if (state.phase === "loading") return "Loading player";
  return "In player";
}
