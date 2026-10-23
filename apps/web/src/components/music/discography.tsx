"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { RELEASE_KINDS, type DiscographyResponse, type Release, type ReleaseKind, type SpotifyStatus } from "@worlds/shared";
import { fetchDiscography, type DiscographyLookup } from "@/lib/api/music";
import { KIND_LABEL, countLabel } from "@/lib/music/format";
import { useMusicResource } from "@/lib/music/use-music-resource";
import { cn } from "@/lib/cn";
import { CoverArt } from "./cover-art";
import { ExternalLink, QuietButton, SpotifyButton } from "./links";
import { ReleaseDetail } from "./release-detail";

const INITIAL_VISIBLE = 12;

const SPOTIFY_NOTE: Record<Exclude<SpotifyStatus, "linked">, string> = {
  no_spotify_link: "MusicBrainz has no Spotify link for this artist, so Spotify was not searched. Covers come from the Cover Art Archive.",
  unavailable: "Spotify could not be reached, so covers come from the Cover Art Archive. Try again later for Spotify links.",
  not_configured: "Spotify is not configured on this server, so covers come from the Cover Art Archive.",
};

/**
 * An artist's albums, EPs and singles. MusicBrainz decides what each release
 * is; Spotify adds covers and links where MusicBrainz links the artist.
 */
export function Discography({
  artistName,
  onSearchName,
}: {
  artistName: string;
  onSearchName: (name: string) => void;
}) {
  const [lookup, setLookup] = useState<DiscographyLookup>({ name: artistName });
  const key = "mbid" in lookup ? `discography:mbid:${lookup.mbid}` : `discography:name:${lookup.name.toLowerCase()}`;
  const base = useMusicResource(key, (signal) => fetchDiscography(lookup, { signal }));
  const state = base.state;

  /**
   * Spotify lists albums separately from singles and EPs, and caps a listing at
   * ten items per request, so the singles listing is the expensive half of a
   * discography. It is joined only once a reader opens a tab that holds it,
   * and the album listing already on screen stays visible while it loads.
   * Keyed by artist so picking a different artist starts over.
   */
  const [listingsKey, setListingsKey] = useState<string | null>(null);
  const wantsListings = listingsKey === key;
  const requestListings = useCallback(() => setListingsKey(key), [key]);
  const more = useMusicResource(
    wantsListings ? `${key}:all` : null,
    (signal) => fetchDiscography(lookup, { signal, include: "all" }),
  );

  const baseData = state.phase === "done" && state.result.kind === "ok" ? state.result.data : null;
  const moreData = more.state.phase === "done" && more.state.result.kind === "ok" ? more.state.result.data : null;
  const data = moreData ?? baseData;
  const enriching = wantsListings && more.state.phase === "loading";
  const enrichFailed = wantsListings && more.state.phase === "done" && more.state.result.kind === "error";

  return (
    <section aria-labelledby="discography-title" className="mt-16 border-t border-line pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="type-eyebrow text-vibrant">Discography</p>
          <h2 id="discography-title" className="text-3xl font-extrabold tracking-[-0.03em] text-text sm:text-4xl">
            {data?.artist?.name ?? artistName} on record
          </h2>
          {data?.status === "ok" ? (
            <p className="type-small text-text-2">
              {RELEASE_KINDS.filter((k) => data.counts[k] > 0)
                .map((k) => countLabel(data.counts[k], k))
                .join(" · ")}
              {data.artist?.disambiguation ? ` · ${data.artist.disambiguation}` : ""}
            </p>
          ) : null}
        </div>
        {data?.artist ? (
          <div className="flex flex-wrap items-center gap-4">
            {data.artist.spotify ? <SpotifyButton href={data.artist.spotify.url}>Artist on Spotify</SpotifyButton> : null}
            <ExternalLink href={data.artist.musicbrainzUrl} className="text-sm">
              MusicBrainz
            </ExternalLink>
          </div>
        ) : null}
      </header>

      <div className="mt-8">
        {state.phase !== "done" ? (
          <GridSkeleton />
        ) : state.result.kind === "error" ? (
          <div role="alert" className="space-y-3 py-8 text-sm text-text-2">
            <p>{state.result.message}</p>
            {state.result.retryable ? <QuietButton onClick={base.reload}>Try again</QuietButton> : null}
          </div>
        ) : state.result.data.status === "not_found" ? (
          <p role="status" className="py-8 text-sm text-text-2">
            MusicBrainz has no artist named exactly “{artistName}”, so no discography is shown. Nothing has been guessed.
          </p>
        ) : state.result.data.status === "ambiguous" ? (
          <Candidates data={state.result.data} onPick={(mbid) => setLookup({ mbid })} />
        ) : (
          <Releases
            data={data ?? state.result.data}
            artistName={data?.artist?.name ?? artistName}
            enriching={enriching}
            enrichFailed={enrichFailed}
            onRequestListings={requestListings}
            onRetryListings={more.reload}
            onSearchName={onSearchName}
          />
        )}
      </div>
    </section>
  );
}

function GridSkeleton() {
  return (
    <div role="status" aria-label="Loading discography" className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-square animate-pulse bg-surface-2" />
          <div className="h-2.5 w-3/4 animate-pulse bg-line-strong" />
          <div className="h-2 w-1/3 animate-pulse bg-line" />
        </div>
      ))}
    </div>
  );
}

function Candidates({ data, onPick }: { data: DiscographyResponse; onPick: (mbid: string) => void }) {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-text-2">
        MusicBrainz lists more than one artist with this name. Pick the one you mean; we won’t guess.
      </p>
      <ul className="space-y-2">
        {data.candidates.map((candidate) => (
          <li key={candidate.mbid} className="flex items-center justify-between gap-4 border border-line-strong bg-surface-1 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{candidate.name}</p>
              <p className="text-xs text-text-2">{candidate.disambiguation ?? "No description on MusicBrainz"}</p>
            </div>
            <QuietButton onClick={() => onPick(candidate.mbid)}>Show releases</QuietButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Releases({
  data,
  artistName,
  enriching,
  enrichFailed,
  onRequestListings,
  onRetryListings,
  onSearchName,
}: {
  data: DiscographyResponse;
  artistName: string;
  enriching: boolean;
  enrichFailed: boolean;
  onRequestListings: () => void;
  onRetryListings: () => void;
  onSearchName: (name: string) => void;
}) {
  const kinds = useMemo(() => RELEASE_KINDS.filter((k) => data.counts[k] > 0), [data]);
  const [kind, setKind] = useState<ReleaseKind | undefined>(kinds[0]);
  const [expanded, setExpanded] = useState<Set<ReleaseKind>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tabRefs = useRef<Partial<Record<ReleaseKind, HTMLButtonElement | null>>>({});
  const detailRef = useRef<HTMLDivElement>(null);
  const pending = data.spotifyPending;

  useEffect(() => {
    if (!selectedId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [selectedId]);

  // EPs and singles arrive in a second, larger Spotify listing, so it is asked
  // for only once a tab that holds them is opened.
  useEffect(() => {
    if (kind && pending.includes(kind)) onRequestListings();
  }, [kind, pending, onRequestListings]);

  if (!kind) {
    return <p className="py-8 text-sm text-text-2">MusicBrainz lists no albums, EPs or singles for this artist yet.</p>;
  }

  const inKind = data.releases.filter((r) => r.kind === kind);
  const showAll = expanded.has(kind) || inKind.length <= INITIAL_VISIBLE;
  const visible = showAll ? inKind : inKind.slice(0, INITIAL_VISIBLE);
  const selected = data.releases.find((r) => r.id === selectedId) ?? null;

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = kinds[(kinds.indexOf(kind) + step + kinds.length) % kinds.length];
    if (!next) return;
    setKind(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Release types" onKeyDown={onTabKey} className="inline-flex border border-line-strong">
        {kinds.map((k) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[k] = el;
            }}
            id={`tab-${k}`}
            type="button"
            role="tab"
            aria-selected={kind === k}
            aria-controls="release-panel"
            tabIndex={kind === k ? 0 : -1}
            onClick={() => setKind(k)}
            className={cn(
              "px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric",
              kind === k ? "bg-text text-night" : "text-text-2 hover:text-text",
            )}
          >
            {KIND_LABEL[k].many} <span className={cn("font-mono", kind === k ? "text-night/70" : "text-text-3")}>{data.counts[k]}</span>
          </button>
        ))}
      </div>

      <div id="release-panel" role="tabpanel" aria-labelledby={`tab-${kind}`}>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((release) => (
            <ReleaseTile
              key={release.id}
              release={release}
              selected={release.id === selectedId}
              onSelect={() => setSelectedId(release.id === selectedId ? null : release.id)}
            />
          ))}
        </ul>
        {!showAll ? (
          <div className="mt-6">
            <QuietButton onClick={() => setExpanded((prev) => new Set(prev).add(kind))}>
              Show all {inKind.length} {KIND_LABEL[kind].many.toLowerCase()}
            </QuietButton>
          </div>
        ) : null}
      </div>

      {kind && pending.includes(kind) ? (
        enriching ? (
          <p role="status" className="text-xs text-text-2">
            Looking up Spotify covers and links for {KIND_LABEL[kind].many.toLowerCase()}…
          </p>
        ) : enrichFailed ? (
          <p className="text-xs text-text-2">
            Spotify could not be reached for {KIND_LABEL[kind].many.toLowerCase()}, so covers come from the Cover Art
            Archive. <QuietButton onClick={onRetryListings}>Try again</QuietButton>
          </p>
        ) : null
      ) : null}

      <div ref={detailRef} className="scroll-mt-6">
        {selected ? (
          <ReleaseDetail
            key={selected.id}
            release={selected}
            artistName={artistName}
            onClose={() => setSelectedId(null)}
            onSearchName={onSearchName}
          />
        ) : null}
      </div>

      {data.spotifyStatus !== "linked" ? <p className="text-xs text-text-2">{SPOTIFY_NOTE[data.spotifyStatus]}</p> : null}
      <p className="max-w-3xl text-[0.6875rem] leading-relaxed text-text-3">
        {data.notice} Live recordings, compilations and remix sets are left out.
      </p>
    </div>
  );
}

function ReleaseTile({ release, selected, onSelect }: { release: Release; selected: boolean; onSelect: () => void }) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        aria-label={`${release.title}${release.year ? `, ${release.year}` : ""}. Show tracks`}
        className={cn(
          "group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric",
        )}
      >
        <CoverArt
          cover={release.cover}
          title={release.title}
          sizes="(min-width: 1024px) 12rem, (min-width: 640px) 30vw, 45vw"
          className={cn(
            "outline outline-1 -outline-offset-1 outline-line transition-[outline-color]",
            selected ? "outline-2 outline-electric" : "group-hover:outline-line-strong",
          )}
        />
        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-text">{release.title}</p>
      </button>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-3">
        <span className="font-mono">{release.year ?? "Undated"}</span>
        {release.secondaryTypes.length > 0 ? <span>{release.secondaryTypes.join(", ").replace("Mixtape/Street", "Mixtape")}</span> : null}
        {release.trackCount ? <span>{release.trackCount} {release.trackCount === 1 ? "track" : "tracks"}</span> : null}
        {release.spotify ? (
          <ExternalLink href={release.spotify.url} label={`${release.title} on Spotify`} className="text-text-3">
            Spotify
          </ExternalLink>
        ) : null}
      </p>
    </li>
  );
}
