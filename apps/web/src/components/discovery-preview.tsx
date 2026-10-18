"use client";

import {
  AudioLines,
  Building2,
  Compass,
  Globe2,
  MapPin,
  MoveRight,
  Sparkles,
  TrendingUp,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useExplorer } from "@/components/explorer-context";
import { SAMPLE_WORLDS, type ConnectionKind } from "@/lib/sample-worlds";
import { cn } from "@/lib/cn";

const KIND_META: Record<ConnectionKind, { icon: LucideIcon; label: string }> = {
  city: { icon: MapPin, label: "City" },
  venue: { icon: Building2, label: "Venue" },
  genre: { icon: AudioLines, label: "Genre" },
  sound: { icon: Waves, label: "Sound" },
  movement: { icon: TrendingUp, label: "Movement" },
  culture: { icon: Globe2, label: "Culture" },
};

export function DiscoveryPreview() {
  const { world, status, query, select } = useExplorer();

  return (
    <section
      id="discovery"
      aria-labelledby="discovery-heading"
      className="relative scroll-mt-24 overflow-hidden px-6 py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-0 h-72 w-[80%] -translate-x-1/2 rounded-full bg-forest/25 blur-[130px]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-electric/80">
            Discovery preview
          </p>
          <h2
            id="discovery-heading"
            className="mt-3 text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl"
          >
            One artist. Infinite connections.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
            Follow a single sound outward — into the cities, genres, venues, and
            movements that shaped it. Search above or pick an example to swap
            worlds.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-muted">
            <span className="inline-block size-1.5 rounded-full bg-amber-300" />
            Demo data — illustrative sample, not a live API result
          </p>
        </div>

        {status === "empty" && <EmptyState query={query} onSelect={select} />}

        <div
          key={world.id}
          className="mt-12 grid animate-rise gap-5 lg:grid-cols-12"
        >
          {/* Artist card */}
          <article className="card-surface relative overflow-hidden rounded-4xl p-7 sm:p-9 lg:col-span-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-30 blur-3xl"
              style={{ backgroundColor: world.accent }}
            />
            <div className="relative">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">
                Artist
              </span>
              <h3 className="mt-3 text-5xl font-extrabold leading-none tracking-[-0.04em] sm:text-6xl">
                {world.artist}
              </h3>
              <p className="mt-3 text-sm text-muted">
                {world.aka ? `Born ${world.aka} · ` : ""}
                {world.era}
              </p>

              <p className="mt-6 max-w-md text-pretty text-base leading-relaxed text-cloud/90">
                {world.tagline}
              </p>

              <dl className="mt-7 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/8 sm:grid-cols-3">
                <AxisCell icon={MapPin} label="Origin" value={world.origin} />
                <AxisCell icon={AudioLines} label="Genre" value={world.genre} />
                <AxisCell icon={Globe2} label="Culture" value={world.culture} />
              </dl>

              <div className="mt-7 flex items-center gap-2 text-xs font-medium text-muted">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: world.accent }}
                />
                {world.connections.length} cultural connections mapped
              </div>
            </div>
          </article>

          {/* Connections */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            <div className="card-surface rounded-4xl p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-cloud">
                  <Compass aria-hidden="true" className="size-4 text-electric" />
                  Connected world
                </h4>
                <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
                  Traverse
                  <MoveRight aria-hidden="true" className="size-3.5" />
                </span>
              </div>

              <ul className="mt-6 space-y-1">
                {world.connections.map((connection, index) => {
                  const meta = KIND_META[connection.kind];
                  const Icon = meta.icon;
                  const isLast = index === world.connections.length - 1;
                  return (
                    <li
                      key={`${connection.kind}-${connection.label}`}
                      className="group relative flex gap-4 rounded-2xl p-3 transition duration-300 hover:bg-white/[0.04]"
                    >
                      {/* Connector rail */}
                      <span
                        aria-hidden="true"
                        className="relative flex w-10 shrink-0 flex-col items-center"
                      >
                        <span
                          className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-electric transition duration-300 group-hover:border-electric/50 group-hover:bg-electric/10"
                          style={{ boxShadow: "0 0 0 0 transparent" }}
                        >
                          <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                        </span>
                        {!isLast && (
                          <span className="mt-1 w-px flex-1 bg-gradient-to-b from-electric/40 to-transparent" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <p className="text-base font-semibold text-cloud">
                            {connection.label}
                          </p>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted">
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          {connection.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="px-1 text-xs leading-relaxed text-muted/80">
              Connections are illustrative demo content. In the live product
              each link carries a provenance label —{" "}
              <span className="text-cloud/80">verified</span>,{" "}
              <span className="text-cloud/80">affinity</span>,{" "}
              <span className="text-cloud/80">community</span>, or{" "}
              <span className="text-cloud/80">editorial</span> — so you always
              know what a relationship means.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AxisCell({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.02] p-4">
      <dt className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
        <Icon aria-hidden="true" className="size-3.5 text-electric/80" />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium leading-snug text-cloud/95">
        {value}
      </dd>
    </div>
  );
}

function EmptyState({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="card-surface mt-10 flex animate-rise flex-col items-start gap-4 rounded-4xl p-7 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-electric/30 bg-electric/10">
        <Sparkles aria-hidden="true" className="size-5 text-electric" />
      </span>
      <div className="flex-1">
        <p className="text-lg font-semibold text-cloud">
          {query
            ? `“${query}” isn’t in the demo library yet.`
            : "Live discovery is coming soon."}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Live search is coming soon — the full Worlds.fm engine will connect to
          real cultural data. In the meantime, explore a bundled demo world.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_WORLDS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => onSelect(sample.id)}
            className={cn(
              "rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-cloud/90 transition duration-300",
              "hover:-translate-y-0.5 hover:border-electric/50 hover:bg-electric/10 hover:text-electric",
            )}
          >
            {sample.artist}
          </button>
        ))}
      </div>
    </div>
  );
}
