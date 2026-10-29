"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Release, ReleaseTracksResponse, Track } from "@worlds/shared";
import { fetchReleaseTracks } from "@/lib/api/music";
import { KIND_LABEL, formatDuration, formatPartialDate, formatRuntime } from "@/lib/music/format";
import { useMusicResource } from "@/lib/music/use-music-resource";
import { songPath } from "@/lib/share";
import { CoverArt, coverCredit } from "./cover-art";
import { ExternalLink, QuietButton, SpotifyButton } from "./links";
import { TrackStory } from "./track-story";
import { TrackPlayButton } from "./track-play-button";
import { PlayerIndicator, PlayerPlayButton, usePlayer } from "./player-context";

export function ReleaseDetail({
  release,
  artistName,
  onClose,
  onSearchName,
}: {
  release: Release;
  artistName: string;
  onClose: () => void;
  onSearchName: (name: string) => void;
}) {
  const spotifyAlbumId = release.spotify?.id ?? null;
  const { state, reload } = useMusicResource(`tracks:${release.id}:${spotifyAlbumId ?? ""}`, (signal) =>
    fetchReleaseTracks(release.id, spotifyAlbumId, { signal }),
  );
  const data = state.phase === "done" && state.result.kind === "ok" ? state.result.data : null;
  const { updateAlbumTracks } = usePlayer();
  useEffect(() => {
    if (data && spotifyAlbumId) {
      updateAlbumTracks(spotifyAlbumId, data.tracks.flatMap((track) => track.spotify ? [track.spotify.id] : []));
    }
  }, [data, spotifyAlbumId, updateAlbumTracks]);
  const meta = [
    formatPartialDate(data?.release.date ?? release.firstReleaseDate),
    data ? `${data.tracks.length} ${data.tracks.length === 1 ? "track" : "tracks"}` : release.trackCount ? `${release.trackCount} tracks` : "",
    formatRuntime(data?.totalDurationMs ?? null),
  ].filter(Boolean);
  const credit = coverCredit(release.cover);

  return (
    <article
      aria-labelledby="release-detail-title"
      className="grid gap-8 border border-line-strong bg-surface-1 p-5 shadow-lift sm:p-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]"
    >
      <div className="space-y-5">
        <a
          href={release.cover?.linkUrl ?? release.musicbrainzUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${release.title} on ${release.cover?.provider === "spotify" ? "Spotify" : "MusicBrainz"}`}
          className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric"
        >
          <CoverArt cover={release.cover} title={release.title} size="large" sizes="(min-width: 1024px) 19rem, 100vw" />
        </a>
        {credit ? <p className="-mt-3 text-[0.6875rem] text-text-3">{credit}</p> : null}
        <div className="space-y-2">
          <p className="type-eyebrow text-text-2">
            {KIND_LABEL[release.kind].one}
            {release.secondaryTypes.length > 0 ? ` · ${release.secondaryTypes.join(", ")}` : ""}
          </p>
          <h3 id="release-detail-title" className="text-3xl font-extrabold leading-tight tracking-[-0.03em] text-text">
            {release.title}
          </h3>
          <p className="text-sm text-text-2">{artistName}</p>
          {meta.length > 0 ? <p className="font-mono text-xs text-text-3">{meta.join(" · ")}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {release.spotify ? (
            <PlayerPlayButton entity={{
              kind: "album", id: release.spotify.id, title: release.title, artist: artistName,
              trackIds: data?.tracks.flatMap((track) => track.spotify ? [track.spotify.id] : []),
            }}>
              Play album
            </PlayerPlayButton>
          ) : null}
          {release.spotify ? <SpotifyButton href={release.spotify.url}>Open in Spotify</SpotifyButton> : null}
          <ExternalLink href={release.musicbrainzUrl} className="text-sm">
            MusicBrainz
          </ExternalLink>
          <QuietButton onClick={onClose} className="ml-auto lg:ml-0">
            Close
          </QuietButton>
        </div>
        {release.spotify ? <PlayerIndicator kind="album" id={release.spotify.id} /> : null}
      </div>

      <div className="min-w-0">
        {state.phase !== "done" ? (
          <TrackListSkeleton count={release.trackCount ?? 8} />
        ) : state.result.kind === "error" ? (
          <div role="alert" className="space-y-3 py-6 text-sm text-text-2">
            <p>{state.result.message}</p>
            {state.result.retryable ? <QuietButton onClick={reload}>Try again</QuietButton> : null}
          </div>
        ) : (
          <TrackList data={state.result.data} onSearchName={onSearchName} />
        )}
      </div>
    </article>
  );
}

function TrackListSkeleton({ count }: { count: number }) {
  return (
    <div role="status" aria-label="Loading track list" className="space-y-1">
      {Array.from({ length: Math.min(Math.max(count, 3), 14) }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line py-3">
          <span className="h-2.5 w-5 animate-pulse bg-line-strong" />
          <span className="h-2.5 animate-pulse bg-line-strong" style={{ width: `${40 + ((i * 17) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}

function TrackList({ data, onSearchName }: { data: ReleaseTracksResponse; onSearchName: (name: string) => void }) {
  const [openStory, setOpenStory] = useState<string | null>(null);
  const discs = new Map<number, Track[]>();
  for (const track of data.tracks) discs.set(track.disc, [...(discs.get(track.disc) ?? []), track]);
  const unmatched = data.spotifyAlbum !== null && data.tracks.some((t) => t.spotify === null);

  if (data.tracks.length === 0) {
    return <p className="py-6 text-sm text-text-2">MusicBrainz lists no tracks for this release yet.</p>;
  }

  return (
    <div className="space-y-6">
      {[...discs.entries()].map(([disc, tracks]) => (
        <section key={disc} aria-label={data.discCount > 1 ? `Disc ${disc}` : "Track list"}>
          {data.discCount > 1 ? (
            <h4 className="type-eyebrow mb-1 text-text-2">
              Disc {disc} <span className="font-mono text-text-3">· {tracks.length} tracks</span>
            </h4>
          ) : (
            <h4 className="sr-only">Track list</h4>
          )}
          <ol className="divide-y divide-line border-y border-line">
            {tracks.map((track) => {
              const storyId = `story-${track.recordingMbid}-${disc}-${track.position}`;
              const open = openStory === storyId;
              return (
                <li key={storyId}>
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5">
                    <span className="font-mono text-xs text-text-3 tabular-nums">{track.number}</span>
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text">
                        {/* Every song has its own page, so the title is the link
                            to it: the row no longer needs a separate control. */}
                        <Link
                          href={songPath(track.recordingMbid)}
                          className="truncate underline-offset-4 hover:text-vibrant hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
                        >
                          {track.title}
                        </Link>
                        {track.explicit ? (
                          <abbr
                            title="Explicit"
                            aria-label="Explicit"
                            className="inline-grid size-4 shrink-0 place-items-center bg-text-2 text-[0.625rem] font-bold text-night no-underline"
                          >
                            E
                          </abbr>
                        ) : null}
                      </p>
                      {track.featured.length > 0 ? (
                        <p className="truncate text-xs text-text-2">with {track.featured.join(", ")}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="hidden font-mono text-xs text-text-2 tabular-nums sm:inline">
                        {formatDuration(track.durationMs)}
                      </span>
                      <QuietButton
                        onClick={() => setOpenStory(open ? null : storyId)}
                        expanded={open}
                        controls={storyId}
                        className="px-2.5 py-1 text-[0.625rem]"
                      >
                        <span className="sr-only">{open ? "Hide" : "Show"} the story of {track.title}: </span>
                        Story
                      </QuietButton>
                      {track.spotify ? (
                        <PlayerPlayButton
                          entity={{ kind: "track", id: track.spotify.id, title: track.title, artist: track.artistCredit }}
                          className="px-2 py-1 text-[0.625rem] uppercase tracking-[0.12em]"
                        >
                          Play
                        </PlayerPlayButton>
                      ) : (
                        <TrackPlayButton recordingMbid={track.recordingMbid} title={track.title} artist={track.artistCredit} />
                      )}
                    </div>
                  </div>
                  {track.spotify ? <div className="pb-2 pl-11"><PlayerIndicator kind="track" id={track.spotify.id} /></div> : null}
                  {open ? (
                    <div className="pb-3">
                      <TrackStory
                        id={storyId}
                        recordingMbid={track.recordingMbid}
                        title={track.title}
                        onSearchName={onSearchName}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="text-[0.6875rem] leading-relaxed text-text-3">
        Track list and durations from the MusicBrainz release{" "}
        <ExternalLink href={data.release.musicbrainzUrl}>
          {[data.release.format, data.release.country === "XW" ? "worldwide" : data.release.country, formatPartialDate(data.release.date)]
            .filter(Boolean)
            .join(", ") || "page"}
        </ExternalLink>
        .{data.spotifyAlbum ? " Play links and explicit labels from Spotify." : ""}
        {unmatched ? " Some tracks have no matching Spotify track." : ""}
      </p>
    </div>
  );
}
