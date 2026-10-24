"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRecordingStory } from "@/lib/api/music";
import { lookupTrackForPlayback } from "@/lib/music/track-play";
import { cn } from "@/lib/cn";
import { PlayerIndicator, usePlayer } from "./player-context";

/** Looks up an unmatched track only after a reader asks to play it. */
export function TrackPlayButton({ recordingMbid, title, artist }: {
  recordingMbid: string;
  title: string;
  artist: string;
}) {
  const { play } = usePlayer();
  const [phase, setPhase] = useState<"idle" | "loading" | "unavailable">("idle");
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const onPlay = async (control: HTMLButtonElement) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setPhase("loading");
    try {
      const entity = await lookupTrackForPlayback(
        recordingMbid, title, artist,
        (mbid, signal) => fetchRecordingStory(mbid, { signal }),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (entity) {
        setSpotifyId(entity.id);
        play(entity, control);
        setPhase("idle");
      } else {
        setPhase("unavailable");
      }
    } catch {
      if (!controller.signal.aborted) setPhase("unavailable");
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={(event) => void onPlay(event.currentTarget)}
        disabled={phase === "loading"}
        aria-label={`Play ${title} in the player`}
        aria-controls="music-mini-player"
        className={cn(
          "inline-flex items-center justify-center gap-2 border border-line-strong px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:border-electric hover:text-vibrant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
          "disabled:cursor-wait disabled:opacity-60",
        )}
      >
        <span aria-hidden="true">▶</span>{phase === "loading" ? "Finding…" : "Play"}
      </button>
      {phase === "unavailable" ? <span role="status" className="text-xs text-text-2">No Spotify link found for this recording.</span> : null}
      {spotifyId ? <PlayerIndicator kind="track" id={spotifyId} /> : null}
    </div>
  );
}
