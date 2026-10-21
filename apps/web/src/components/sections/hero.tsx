"use client";

import { SearchBar } from "@/components/search-bar";
import { useExplorer } from "@/components/explorer-context";
import { ContourField } from "@/components/primitives/contour-field";
import { HERO_CONTENT, EXAMPLE_SEARCHES } from "@/content/landing";
import { ArtistCarousel } from "./artist-carousel";

export function Hero() {
  const { explore } = useExplorer();

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden pb-16 pt-36 sm:pt-44"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,color-mix(in_oklab,var(--color-forest)_70%,transparent),transparent_70%)]" />
        <ContourField
          rings={12}
          seed={3}
          wobble={0.05}
          className="absolute left-1/2 top-[-10%] size-[170vmin] max-w-none -translate-x-1/2 text-mint/15"
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night" />
      </div>

      <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-col items-center px-[var(--layout-gutter)] text-center">
        <p className="type-eyebrow text-text-2">Music × culture × place</p>
        <h1
          id="hero-heading"
          className="type-hero mt-6 max-w-5xl text-text"
        >
          {HERO_CONTENT.headline[0]}
          <br />
          <span className="type-accent text-mint">{HERO_CONTENT.headline[1]}</span>
        </h1>
        <p className="type-lead mt-8 max-w-xl text-text-2">
          Search an artist and step into the places, genres and stories around
          them. Every link shows what it is based on.
        </p>

        <div className="mt-10 w-full max-w-2xl">
          <SearchBar />
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="type-eyebrow mr-1 text-text-3">Try</span>
            {EXAMPLE_SEARCHES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => explore(name)}
                className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-text-2 transition hover:border-electric hover:text-text"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-16 sm:mt-20">
        <ArtistCarousel />
      </div>
    </section>
  );
}
