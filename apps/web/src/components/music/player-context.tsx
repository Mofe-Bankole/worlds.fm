"use client";

import { createContext, useCallback, useContext, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { INITIAL_PLAYER_STATE, playerEntityStatus, playerReducer, type PlayerEntity, type PlayerState } from "@/lib/music/player-state";
import { spotifyUri, type SpotifyEntityKind } from "@/lib/music/spotify-embed";
import type { SpotifyPlayerSession } from "@/lib/music/spotify-player";
import { cn } from "@/lib/cn";
import { MiniPlayer } from "./mini-player";
import styles from "./mini-player.module.css";

interface PlayerContextValue {
  state: PlayerState;
  play: (entity: PlayerEntity, opener: HTMLButtonElement) => void;
  updateAlbumTracks: (id: string, trackIds: readonly string[]) => void;
  close: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, INITIAL_PLAYER_STATE);
  const [clearance, setClearance] = useState(0);
  const [sessionId, setSessionId] = useState(0);
  const sequence = useRef(0);
  const opened = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const session = useRef<SpotifyPlayerSession | null>(null);

  const play = useCallback((entity: PlayerEntity, control: HTMLButtonElement) => {
    if (!spotifyUri(entity.kind, entity.id)) return;
    if (!opened.current) {
      opener.current = control;
      setSessionId((id) => id + 1);
    }
    opened.current = true;
    dispatch({ type: "play", entity, requestId: ++sequence.current });
  }, []);

  const close = useCallback(() => {
    // Cancel immediately, before React unmounts a pending controller.
    session.current?.destroy();
    opened.current = false;
    dispatch({ type: "close" });
    if (opener.current?.isConnected) opener.current.focus();
    else page.current?.querySelector<HTMLElement>("input, button, a[href]")?.focus();
    opener.current = null;
  }, []);

  const updateAlbumTracks = useCallback((id: string, trackIds: readonly string[]) => {
    dispatch({ type: "album-tracks", id, trackIds });
  }, []);

  const padding = state.entity ? clearance : 0;
  return (
    <PlayerContext.Provider value={{ state, play, close, updateAlbumTracks }}>
      <div
        ref={page}
        className={styles.page}
        data-player-open={Boolean(state.entity)}
        style={{ "--player-clearance": `${padding}px`, paddingBottom: padding } as CSSProperties}
      >
        {children}
        {state.entity ? (
          <MiniPlayer key={sessionId} state={state} dispatch={dispatch} close={close} sessionRef={session} onClearance={setClearance} />
        ) : null}
      </div>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("Music player controls require PlayerProvider");
  return context;
}

export function PlayerPlayButton({ entity, children = "Play", className }: { entity: PlayerEntity; children?: ReactNode; className?: string }) {
  const { play } = usePlayer();
  if (!spotifyUri(entity.kind, entity.id)) return null;
  return (
    <button
      type="button"
      onClick={(event) => play(entity, event.currentTarget)}
      aria-label={`Play ${entity.title} in the player`}
      aria-controls="music-mini-player"
      className={cn(
        "inline-flex items-center justify-center gap-2 border border-line-strong px-3 py-2 text-xs font-semibold text-text transition-colors hover:border-electric hover:text-vibrant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
        className,
      )}
    >
      <span aria-hidden="true">▶</span>{children}
    </button>
  );
}

export function PlayerIndicator({ kind, id }: { kind: SpotifyEntityKind; id: string }) {
  const { state } = usePlayer();
  const status = playerEntityStatus(state, kind, id);
  return status ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-normal text-text-2">
      <span aria-hidden="true">{status === "Playing" ? "▶" : "◉"}</span>{status}
    </span>
  ) : null;
}
