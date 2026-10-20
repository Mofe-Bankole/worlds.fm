"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { MediaFrame } from "@/components/primitives/media-frame";
import { ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { SectionHeader } from "@/components/primitives/section-header";
import {
  ARTISTS,
  CONNECTIONS,
  FIXTURE_LABEL,
} from "@/content/landing";
import { SOURCES } from "@/content/sources";
import { getSampleWorld } from "@/lib/sample-worlds";
import { cn } from "@/lib/cn";
import { SectionShell } from "./section-shell";
import { useLandingState } from "./landing-state";

export function ArtistDiscovery() {
  const { view, enterArtist } = useLandingState();
  const activeId = view.kind === "artist" ? view.id : null;

  return (
    <SectionShell id="discovery" labelledBy="discovery-heading">
      <SectionHeader
        index="02"
        eyebrow="Artist discovery"
        id="discovery-heading"
        title="One artist. A world of evidence."
        description="Pick an artist, or search above. Each connection says what it is, and where it comes from."
      />

      <div
        role="group"
        aria-label="Choose an artist"
        className="mt-10 flex flex-wrap gap-2"
      >
        {ARTISTS.map((artist) => (
          <button
            key={artist.id}
            type="button"
            aria-pressed={activeId === artist.id}
            onClick={() => enterArtist(artist.id)}
            className={cn(
              "rounded-full border px-5 py-2.5 text-sm font-semibold transition",
              activeId === artist.id
                ? "border-electric bg-electric text-on-accent"
                : "border-line-strong text-text-2 hover:border-electric hover:text-text",
            )}
          >
            {artist.name}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-10">
        {view.kind === "artist" ? <ArtistWorld artistId={view.id} /> : null}
        {view.kind === "sample" ? <SampleWorldPanel id={view.id} /> : null}
        {view.kind === "empty" ? <EmptyPanel query={view.query} /> : null}
      </div>
    </SectionShell>
  );
}

function ArtistWorld({ artistId }: { artistId: string }) {
  const artist = ARTISTS.find((item) => item.id === artistId) ?? ARTISTS[0];
  const connections = CONNECTIONS.filter(
    (connection) => connection.fromArtistId === artist.id,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <MediaFrame
          media={artist.media}
          aspect="landscape"
          sizes="(min-width: 1024px) 40vw, 100vw"
        />
        <h3 className="type-section mt-8 text-text">{artist.name}</h3>
        <p className="type-eyebrow mt-4 flex items-center gap-2 text-text-2">
          <MapPin aria-hidden="true" className="size-3.5" />
          {artist.location.label}
        </p>
        <p className="type-eyebrow mt-2 text-text-3">
          {artist.genres.join(" · ")}
        </p>
        <p className="type-small mt-4 text-text-3">
          Demo data. Placeholder artwork until a licensed photograph is credited.
        </p>
      </div>

      <ul className="flex flex-col gap-5 lg:col-span-7">
        {connections.map((connection) => (
          <li
            key={connection.id}
            className="rounded-panel border border-line bg-surface-1 p-6 shadow-lift sm:p-8"
          >
            <ProvenanceBadge
              kind={connection.kind}
              demo
              fixture={connection.kind === "affinity"}
            />
            <h4 className="type-sub mt-5 text-text">
              {connection.target.name}
            </h4>
            <p className="type-eyebrow mt-2 text-text-2">
              {connection.label}
              {"placeLabel" in connection.target
                ? ` · ${connection.target.placeLabel}`
                : ""}
            </p>
            <p className="type-body mt-4 max-w-prose text-text-2">
              {connection.statement}
            </p>
            {connection.kind === "verified" ? (
              <ul className="mt-5 flex flex-col gap-1.5">
                {connection.sourceIds.map((sourceId) => {
                  const source = SOURCES[sourceId];
                  return (
                    <li key={sourceId} className="text-xs text-text-3">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 underline underline-offset-2 hover:text-text"
                      >
                        {source.publisher}: {source.title}
                        <ExternalLink aria-hidden="true" className="size-3" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                      {" "}· checked {source.reviewedAt} · not yet editor-reviewed
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {connection.kind === "affinity" ? (
              <p className="mt-5 text-xs text-text-3">
                {FIXTURE_LABEL}. {connection.fixtureNote}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bundled sample worlds have no citations, so they are shown as unsourced. */
function SampleWorldPanel({ id }: { id: string }) {
  const world = getSampleWorld(id);
  return (
    <div className="rounded-panel border border-dashed border-line-strong bg-surface-1 p-6 sm:p-10">
      <p className="type-eyebrow text-text-2">
        Demo data · unsourced sample, not verified
      </p>
      <h3 className="type-section mt-5 text-text">{world.artist}</h3>
      <p className="type-eyebrow mt-4 text-text-2">
        {world.origin} · {world.genre}
      </p>
      <p className="type-lead mt-5 max-w-2xl text-text-2">{world.tagline}</p>
      <p className="type-small mt-6 text-text-3">
        This sample has no citations yet, so no connection is shown as a
        verified fact. Featured artists above carry cited sources.
      </p>
    </div>
  );
}

function EmptyPanel({ query }: { query: string }) {
  const { enterArtist } = useLandingState();
  return (
    <div className="rounded-panel border border-line bg-surface-1 p-6 sm:p-10">
      <h3 className="type-sub text-text">
        {query
          ? `“${query}” isn’t in the demo library yet.`
          : "Live search is coming soon."}
      </h3>
      <p className="type-body mt-3 max-w-prose text-text-2">
        Search is not connected to the live service yet. Try one of the
        featured artists.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {ARTISTS.map((artist) => (
          <button
            key={artist.id}
            type="button"
            onClick={() => enterArtist(artist.id)}
            className="rounded-full border border-line-strong px-5 py-2.5 text-sm font-semibold text-text-2 hover:border-electric hover:text-text"
          >
            {artist.name}
          </button>
        ))}
      </div>
    </div>
  );
}
