"use client";

import type { CreditRole, LinkedRecording, RecordingStoryResponse } from "@worlds/shared";
import { fetchRecordingStory } from "@/lib/api/music";
import { isSingleArtistCredit } from "@/lib/music/format";
import { useMusicResource } from "@/lib/music/use-music-resource";
import { ExternalLink, QuietButton } from "./links";

const ROLE_LABEL: Record<CreditRole, string> = {
  written_by: "Written by",
  produced_by: "Produced by",
  performed_by: "Performed by",
  mixed_by: "Mixed by",
  engineered_by: "Engineered by",
};

/**
 * The sourced story behind one recording: who made it, what it samples, who
 * sampled or re-recorded it, and facts quoted from Wikipedia or Wikidata.
 * Nothing here is generated; an empty source shows as empty.
 */
export function TrackStory({
  id,
  recordingMbid,
  title,
  onSearchName,
}: {
  id: string;
  recordingMbid: string;
  title: string;
  onSearchName: (name: string) => void;
}) {
  const { state, reload } = useMusicResource(`story:${recordingMbid}`, (signal) =>
    fetchRecordingStory(recordingMbid, { signal }),
  );

  return (
    <div id={id} role="region" aria-label={`Story of ${title}`} className="border-l-2 border-forest bg-surface-2/60 px-4 py-4 sm:px-5">
      {state.phase !== "done" ? (
        <div role="status" className="space-y-2">
          <p className="text-xs text-text-2">Looking up the story of “{title}”…</p>
          <div aria-hidden="true" className="space-y-1.5">
            <div className="h-2.5 w-3/4 animate-pulse bg-line-strong" />
            <div className="h-2.5 w-1/2 animate-pulse bg-line-strong" />
          </div>
        </div>
      ) : state.result.kind === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-text-2">
          <span>{state.result.message}</span>
          {state.result.retryable ? <QuietButton onClick={reload}>Try again</QuietButton> : null}
        </div>
      ) : (
        <StoryBody data={state.result.data} onSearchName={onSearchName} />
      )}
    </div>
  );
}

function StoryBody({ data, onSearchName }: { data: RecordingStoryResponse; onSearchName: (name: string) => void }) {
  const summary = data.facts.find((f) => f.kind === "summary");
  const honours = data.facts.filter((f) => f.kind !== "summary");
  const connections: Array<{ title: string; items: LinkedRecording[] }> = [
    { title: "Samples", items: data.samples },
    { title: "Sampled by", items: data.sampledBy },
    { title: "Also recorded by", items: data.otherVersions },
  ].filter((group) => group.items.length > 0);
  const empty = !summary && honours.length === 0 && data.credits.length === 0 && connections.length === 0;

  return (
    <div className="space-y-5">
      {summary || honours.length > 0 ? (
        <section aria-label="Did you know" className="space-y-3">
          <h4 className="type-eyebrow text-mint">Did you know</h4>
          {summary ? (
            <figure className="space-y-1.5">
              <blockquote className="text-sm leading-relaxed text-text">{summary.text}</blockquote>
              <figcaption className="text-[0.6875rem] text-text-3">
                <ExternalLink href={summary.source.url}>{summary.source.label}</ExternalLink>
                {summary.source.license ? (
                  <>
                    {" · "}
                    <ExternalLink href={summary.source.license.url}>{summary.source.license.name}</ExternalLink>
                  </>
                ) : null}
              </figcaption>
            </figure>
          ) : null}
          {honours.length > 0 ? (
            <ul className="space-y-1">
              {honours.map((fact) => (
                <li key={`${fact.kind}-${fact.text}-${fact.year}`} className="flex gap-3 text-sm text-text-2">
                  <span className="w-10 shrink-0 font-mono text-xs leading-5 text-text-3 tabular-nums">{fact.year ?? "—"}</span>
                  <span>
                    {fact.text}{" "}
                    <ExternalLink href={fact.source.url} className="text-[0.6875rem] text-text-3" label={`Source: ${fact.source.label}`}>
                      {fact.source.label}
                    </ExternalLink>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {data.credits.length > 0 ? (
        <section aria-label="Credits">
          <h4 className="type-eyebrow mb-2 text-text-2">Credits</h4>
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)]">
            {data.credits.map((credit) => (
              <div key={credit.role} className="contents">
                <dt className="text-xs uppercase leading-5 tracking-[0.1em] text-text-3">{ROLE_LABEL[credit.role]}</dt>
                <dd className="text-text">
                  {credit.people.map((person, i) => (
                    <span key={`${person.mbid ?? person.name}`}>
                      {i > 0 ? ", " : null}
                      {person.name}
                      {person.detail ? <span className="text-text-2"> ({person.detail})</span> : null}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {connections.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {connections.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h4 className="type-eyebrow mb-2 text-text-2">
                {group.title} <span className="font-mono text-text-3">{group.items.length}</span>
              </h4>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.mbid} className="text-sm">
                    <p className="text-text">{item.title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
                      {item.artist ? <span>{item.artist}</span> : null}
                      {isSingleArtistCredit(item.artist) ? (
                        <button
                          type="button"
                          onClick={() => onSearchName(item.artist as string)}
                          className="font-semibold text-vibrant underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
                        >
                          Explore world
                        </button>
                      ) : null}
                      <ExternalLink href={item.musicbrainzUrl} label={`${item.title} on MusicBrainz`}>
                        MusicBrainz
                      </ExternalLink>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {empty ? (
        <p className="text-sm text-text-2">MusicBrainz has no credits or connections for this recording yet.</p>
      ) : null}

      <p className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-3 text-[0.6875rem] text-text-3">
        <span>Credits and connections from MusicBrainz (CC0).</span>
        {data.recording.isrcs[0] ? <span className="font-mono">ISRC {data.recording.isrcs[0]}</span> : null}
        <ExternalLink href={data.recording.musicbrainzUrl}>Missing something? Add it on MusicBrainz</ExternalLink>
      </p>
    </div>
  );
}
