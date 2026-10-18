"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { useExplorer } from "@/components/explorer-context";

const EXAMPLES = ["Avicii", "Burna Boy", "Rosalía"] as const;

export function Hero() {
  const { explore } = useExplorer();

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden px-6 pb-24 pt-32 sm:pt-40 lg:pb-32 lg:pt-48"
    >
      {/* Animated gradient lighting */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(16,61,43,0.9)_0%,transparent_60%)]" />
        <div className="absolute -left-[15%] top-[6%] size-[38rem] rounded-full bg-brand/12 blur-[130px] animate-drift" />
        <div className="absolute -right-[10%] top-[18%] size-[34rem] rounded-full bg-electric/12 blur-[140px] animate-drift-slow" />
        <div className="absolute bottom-[-18%] left-1/3 size-[32rem] rounded-full bg-forest/50 blur-[150px] animate-float-slow" />
        <div className="absolute inset-0 grid-veil opacity-60" />
        <div className="absolute inset-0 noise opacity-[0.035] mix-blend-soft-light" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <div className="mx-auto max-w-5xl text-center">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-electric/25 bg-electric/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-electric/90">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-electric opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-electric" />
            </span>
            AI-powered cultural discovery
          </span>
        </div>

        <h1 className="mt-7 animate-rise stagger-1 text-balance text-[clamp(2.6rem,8vw,6.5rem)] font-extrabold leading-[0.94] tracking-[-0.045em]">
          Every sound has a world.
          <br />
          <span className="text-gradient">Discover it.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl animate-rise stagger-2 text-pretty text-base leading-relaxed text-muted sm:text-lg">
          From the music you love to the places, people, and cultures that
          shaped it. Explore the connections you never knew existed.
        </p>

        <div className="mx-auto mt-10 max-w-2xl animate-rise stagger-3">
          <SearchBar />
        </div>

        <div className="mt-6 flex animate-rise stagger-4 flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles aria-hidden="true" className="size-3.5 text-electric/80" />
            Try exploring:
          </span>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {EXAMPLES.map((example, index) => (
              <li key={example} className="flex items-center gap-2">
                {index > 0 && (
                  <span aria-hidden="true" className="text-muted/40">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => explore(example)}
                  className="rounded-full border border-white/10 px-3 py-1 font-medium text-cloud/90 transition duration-300 hover:-translate-y-0.5 hover:border-electric/50 hover:bg-electric/10 hover:text-electric"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-16 flex animate-rise stagger-5 justify-center lg:mt-20">
        <span className="inline-flex flex-col items-center gap-1 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted/70">
          Explore the universe
          <ChevronDown aria-hidden="true" className="size-4 animate-float" />
        </span>
      </div>
    </section>
  );
}
