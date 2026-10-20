"use client";

import { useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { GlassSurface } from "@/components/primitives/glass-surface";
import { MediaFrame } from "@/components/primitives/media-frame";
import { ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { ARTISTS } from "@/content/landing";
import { useLandingState } from "./landing-state";

/** Native scroll-snap carousel: swipe, trackpad, keyboard and buttons all work. */
export function ArtistCarousel() {
  const trackRef = useRef<HTMLUListElement>(null);
  const { enterArtist } = useLandingState();

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("li");
    const step = (card?.clientWidth ?? 320) + 20;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: step * direction, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div aria-roledescription="carousel" aria-label="Featured artist worlds">
      <div className="mb-5 flex items-end justify-between gap-4 px-[var(--layout-gutter)]">
        <p className="type-eyebrow text-text-3">
          Featured worlds · <span className="text-text-2">Demo data</span>
        </p>
        <GlassSurface radius="full" className="flex gap-1 p-1">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Previous artists"
            className="grid size-10 place-items-center rounded-full text-text hover:bg-line"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Next artists"
            className="grid size-10 place-items-center rounded-full text-text hover:bg-line"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </GlassSurface>
      </div>

      <ul
        ref={trackRef}
        tabIndex={0}
        aria-label="Artists"
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-[var(--layout-gutter)] px-[var(--layout-gutter)] pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ARTISTS.map((artist) => (
          <li
            key={artist.id}
            className="w-[78vw] max-w-80 shrink-0 snap-start sm:w-72"
          >
            <article className="flex h-full flex-col gap-4 rounded-panel border border-line bg-surface-1 p-3 shadow-lift">
              <MediaFrame
                media={artist.media}
                aspect="portrait"
                sizes="(min-width: 640px) 288px, 78vw"
                className="gap-0"
              />
              <div className="flex flex-1 flex-col gap-3 px-2 pb-2">
                <div>
                  <h3 className="type-sub text-text">{artist.name}</h3>
                  <p className="type-eyebrow mt-2 flex items-center gap-1.5 text-text-2">
                    <MapPin aria-hidden="true" className="size-3.5" />
                    {artist.location.label}
                  </p>
                  <p className="type-eyebrow mt-1 text-text-3">
                    {artist.genres.join(" · ")}
                  </p>
                </div>
                <p className="type-small flex-1 text-text-2">
                  {artist.insight.text}
                </p>
                <ProvenanceBadge kind={artist.insight.kind} size="sm" demo />
                <button
                  type="button"
                  onClick={() => enterArtist(artist.id)}
                  className="group inline-flex items-center justify-between rounded-full border border-line-strong px-5 py-3 text-sm font-semibold text-text transition hover:border-electric hover:text-electric"
                >
                  <span>
                    Enter world
                    <span className="sr-only"> of {artist.name}</span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-1"
                  />
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
