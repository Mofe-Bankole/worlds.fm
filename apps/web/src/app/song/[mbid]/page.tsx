import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { RecordingStoryResponse } from "@worlds/shared";
import { WorldsMark } from "@/components/worlds-mark";
import { SongView } from "@/components/music/song-view";
import { PlayerProvider } from "@/components/music/player-context";
import { fetchRecordingStory } from "@/lib/api/music";
import { NON_AFFILIATION_NOTICE } from "@/lib/brand";
import { siteUrlFromRequest } from "@/lib/site";
import { isSongId, songDescription, songPath } from "@/lib/share";

/**
 * A song's own page: `/song/<MusicBrainz recording ID>`.
 *
 * Every song in a track list now has an address, so it can be shared, linked
 * and returned to without describing an album and a row number. The page reads
 * the same story the explorer shows (`GET /api/v1/music/recordings/:id/story`),
 * rendered on the server so the title, credits and sources are in the first
 * HTML response rather than appearing after a client fetch.
 *
 * MusicBrainz is the source of truth; nothing here is generated, and every
 * credit, sample and fact is labelled with where it came from.
 */

/**
 * Bound on the lookup. A cold story costs several MusicBrainz requests, which
 * are throttled to one a second: measured 2.6-4.5s, so this leaves room for a
 * slow one without letting a hung API hold the page open indefinitely.
 */
const LOOKUP_TIMEOUT_MS = 10_000;

type StoryLookup =
  | { kind: "ok"; data: RecordingStoryResponse }
  /** The catalogue says no recording has this ID, so the page is a 404. */
  | { kind: "missing" }
  /** Timeout, rate limit or provider failure: the ID may still be good. */
  | { kind: "unavailable" };

/**
 * Read the story once per request. `generateMetadata` and the page both need
 * it, and React's request cache keeps that to a single API call. Without it the
 * two would each pay for a cold MusicBrainz lookup, and a slow one would leave
 * the page titled "A song" while the body rendered the real title.
 */
const loadStory = cache(async (mbid: string): Promise<StoryLookup> => {
  const result = await fetchRecordingStory(mbid, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  if (result.kind === "ok") return { kind: "ok", data: result.data };
  if (result.kind === "error" && result.code === "recording_not_found") return { kind: "missing" };
  return { kind: "unavailable" };
});

export async function generateMetadata({ params }: { params: Promise<{ mbid: string }> }): Promise<Metadata> {
  const { mbid } = await params;
  if (!isSongId(mbid)) {
    return { title: "Song not found — Worlds.fm", robots: { index: false } };
  }

  const lookup = await loadStory(mbid);
  if (lookup.kind === "missing") {
    return { title: "Song not found — Worlds.fm", robots: { index: false } };
  }
  // A provider failure is transient, so the page is not offered for indexing
  // and the title claims nothing about a song we could not read.
  if (lookup.kind === "unavailable") {
    return {
      title: "A song on Worlds.fm",
      description: "This song’s story could not be loaded. Try again shortly.",
      robots: { index: false },
    };
  }

  const recording = lookup.data.recording;
  const description = songDescription(recording.title, recording.artistCredit);
  const origin = await siteUrlFromRequest();
  const canonical = `${origin}${songPath(mbid)}`;
  const image = `${origin}/og/song?${new URLSearchParams({
    title: recording.title,
    artist: recording.artistCredit,
  })}`;
  const fullTitle = `${recording.title} by ${recording.artistCredit} — Worlds.fm`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: "Worlds.fm",
      type: "music.song",
      images: [{ url: image, width: 1200, height: 630, alt: `${recording.title} on Worlds.fm` }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

export default async function SongPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  // An ID that cannot address a song is a 404, not a lookup against the API.
  if (!isSongId(mbid)) notFound();

  const lookup = await loadStory(mbid);
  if (lookup.kind === "missing") notFound();

  return (
    <PlayerProvider>
      <main id="main" className="relative min-h-screen bg-night">
        <header className="px-[var(--layout-gutter)] py-5">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Worlds.fm home">
            <WorldsMark className="size-7" />
            <span className="text-base font-extrabold tracking-[-0.03em]">
              Worlds<span className="text-electric">.fm</span>
            </span>
          </Link>
        </header>

        <div className="mx-auto max-w-4xl px-[var(--layout-gutter)] pb-12">
          <SongView mbid={mbid} story={lookup.kind === "ok" ? lookup.data : null} />
        </div>

        {/* Public, generic: a song page carries no personal data. */}
        <footer className="px-[var(--layout-gutter)] pb-10 pt-4">
          <p className="mx-auto max-w-2xl text-center text-[0.6875rem] leading-relaxed text-text-3">
            {NON_AFFILIATION_NOTICE}
          </p>
        </footer>
      </main>
    </PlayerProvider>
  );
}
