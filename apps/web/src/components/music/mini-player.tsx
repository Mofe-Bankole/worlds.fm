"use client";

import { useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject } from "react";
import { createSpotifyPlayer, type SpotifyPlayerSession } from "@/lib/music/spotify-player";
import { playerEntityStatus, type PlayerAction, type PlayerState } from "@/lib/music/player-state";
import { ExternalLink, QuietButton } from "./links";
import styles from "./mini-player.module.css";

export function MiniPlayer({
  state, dispatch, close, sessionRef, onClearance,
}: {
  state: PlayerState;
  dispatch: Dispatch<PlayerAction>;
  close: () => void;
  sessionRef: RefObject<SpotifyPlayerSession | null>;
  onClearance: (height: number) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const session = createSpotifyPlayer(host.current, dispatch);
    sessionRef.current = session;
    return () => {
      session.destroy();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [dispatch, sessionRef]);

  useEffect(() => {
    if (state.entity) sessionRef.current?.play(state.entity, state.requestId);
  }, [state.entity, state.requestId, sessionRef]);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    const measure = () => {
      // Includes the desktop dock's 24px bottom offset and a readable gap.
      const height = Math.ceil(element.getBoundingClientRect().height) + 48;
      onClearance(height);
      root.style.scrollPaddingBottom = `${height}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingBottom = previous;
    };
  }, [onClearance]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    // Events within Spotify's cross-origin document do not reach this listener.
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [close]);

  const entity = state.entity;
  if (!entity) return null;
  const status = playerEntityStatus(state, entity.kind, entity.id);
  return (
    <section
      id="music-mini-player"
      ref={panel}
      tabIndex={-1}
      aria-labelledby="music-player-title"
      className={styles.dock}
    >
      <div className={styles.header}>
        <div className="min-w-0">
          <p className="type-eyebrow text-text-2">Spotify player</p>
          <h2 id="music-player-title" className={styles.title}>{entity.title}</h2>
          <p className="text-xs text-text-2">{entity.artist}</p>
        </div>
        <QuietButton onClick={close}>Close<span className="sr-only"> Spotify player</span></QuietButton>
      </div>
      <p role="status" className="mb-2 text-xs text-text-2">
        <span aria-hidden="true">{status === "Playing" ? "▶" : "◉"} </span>{status}
        {state.phase === "fallback" ? " · playback status unavailable" : ""}
      </p>
      <div ref={host} className={styles.embed} />
      {state.phase === "unavailable" ? (
        <p role="alert" className="text-sm text-text-2">Spotify’s player could not load. Open this {entity.kind} in Spotify instead.</p>
      ) : null}
      <div className="mt-3 space-y-2">
        <ExternalLink href={`https://open.spotify.com/${entity.kind}/${entity.id}`} className="text-xs">
          Open in Spotify
        </ExternalLink>
        <p className="text-[0.6875rem] leading-relaxed text-text-2">
          Spotify controls playback; you may need to press Play inside its player. Not logged in? You may hear previews only.
          {" "}This third-party player may set cookies. Worlds.fm does not save your playback activity.
        </p>
      </div>
    </section>
  );
}
