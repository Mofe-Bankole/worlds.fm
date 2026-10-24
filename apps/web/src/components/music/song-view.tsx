"use client";

import Link from "next/link";
import type { RecordingStoryResponse } from "@worlds/shared";
import { ShareControl } from "@/components/share/share-control";
import { formatDuration, isSingleArtistCredit } from "@/lib/music/format";
import { songShareTarget, worldPath } from "@/lib/share";
import { ExternalLink, SpotifyButton } from "./links";
import { StoryBody } from "./track-story";

/**
 * One song as a page.
 *
 * The story is passed in already fetched and rendered on the server, so this
 * component only adds the interactive parts: sharing, and a link into the
 * artist's World. When the story could not be read it says so plainly and
 * offers a retry, rather than showing an empty shell that looks like "this song
 * has no story".
 */
export function SongView({ mbid, story }: { mbid: string; story: RecordingStoryResponse | null }) {
  if (!story) return <Unavailable mbid={mbid} />;

  const recording = story.recording;
  const duration = formatDuration(recording.durationMs);
  const artist = isSingleArtistCredit(recording.artistCredit) ? recording.artistCredit : null;

  return (
    <article className="space-y-8" aria-labelledby="song-title">
      <div className="space-y-4 border border-line-strong bg-surface-1 p-5 shadow-lift sm:p-8">
        <p className="type-eyebrow text-text-2">Song</p>
        <h1 id="song-title" className="text-4xl font-extrabold leading-tight tracking-[-0.03em] text-text sm:text-5xl">
          {recording.title}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-2">
          <span>{recording.artistCredit}</span>
          {duration ? <span className="font-mono text-xs text-text-3">{duration}</span> : null}
          {recording.isrcs[0] ? <span className="font-mono text-xs text-text-3">ISRC {recording.isrcs[0]}</span> : null}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {recording.spotify ? <SpotifyButton href={recording.spotify.url}>Open in Spotify</SpotifyButton> : null}
          {artist ? (
            <Link
              href={worldPath(artist)}
              className="inline-flex items-center gap-1 border border-line-strong px-4 py-2 text-sm font-semibold text-text-2 transition-colors hover:border-electric hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
            >
              Explore {artist}’s world
            </Link>
          ) : null}
          <ExternalLink href={recording.musicbrainzUrl} className="text-sm">
            MusicBrainz
          </ExternalLink>
        </div>

        <ShareControl
          subject={recording.title}
          buildTarget={(origin) =>
            songShareTarget(
              { recordingMbid: recording.mbid, title: recording.title, artist: recording.artistCredit },
              origin,
            )
          }
          fieldLabel="Link to this song"
          note="Anyone with this link sees this song. Nothing personal is included."
        />
      </div>

      <StoryBody data={story} />

      <p className="text-[0.6875rem] leading-relaxed text-text-3">{story.notice}</p>
    </article>
  );
}

/**
 * The catalogue could not answer for this ID. The ID itself is well-formed and
 * the recording was not reported missing (both of those are a 404 before we get
 * here), so this is a provider problem and is described as one.
 */
function Unavailable({ mbid }: { mbid: string }) {
  return (
    <div className="space-y-4 border border-line-strong bg-surface-1 p-5 sm:p-8" role="alert">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-text">This song is not available right now</h1>
      <p className="text-sm leading-relaxed text-text-2">
        The music catalogue did not answer in time, or was temporarily unreachable. The recording itself is unchanged,
        and MusicBrainz still has it.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {/* A reload is the retry: this page is rendered on the server. */}
        <Link
          href={`/song/${mbid}`}
          className="border border-line-strong px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-2 transition-colors hover:border-electric hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
        >
          Try again
        </Link>
        <ExternalLink href={`https://musicbrainz.org/recording/${mbid}`} className="text-sm">
          Open on MusicBrainz
        </ExternalLink>
      </div>
    </div>
  );
}
