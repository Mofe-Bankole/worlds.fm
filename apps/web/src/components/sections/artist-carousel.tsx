"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Disc3,
  MapPin,
  Pause,
  Play,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { GlassSurface } from "@/components/primitives/glass-surface";
import type { OrbitItem } from "@/components/primitives/orbit-edges";
import { ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { SignalAction, SignalCard } from "@/components/primitives/signal-card";
import { StripedImage } from "@/components/primitives/striped-image";
import {
  FEATURED_WORLDS,
  HIGHLIGHT_LABEL,
  featuredSource,
  type FeaturedWorld,
  type HighlightType,
} from "@/content/featured-worlds";
import { usePrefersReducedMotion } from "@/motion/use-motion-preferences";
import { cn } from "@/lib/cn";
import { worldPath } from "@/lib/share";
import { ORBIT_RETRACT_TARGET } from "./landing-orbit";

const HIGHLIGHT_ICON: Record<HighlightType, LucideIcon> = {
  place: MapPin,
  track: Disc3,
  product: ShoppingBag,
  collab: Users,
  screen: Clapperboard,
};

const AUTOPLAY_MS = 7000;
const TOTAL = FEATURED_WORLDS.length;
const pad = (n: number) => String(n).padStart(2, "0");
/** Built by the share helper so carousel links and share links can never drift apart. */
const exploreHref = (world: FeaturedWorld) => worldPath(world.query);

/**
 * Featured worlds: a centred, snap-scrolling carousel. Swipe, trackpad, arrow
 * keys, buttons and the progress segments all move it. It advances on its own
 * every few seconds while visible, unless the visitor paused it, is hovering
 * or focused inside it, or prefers reduced motion.
 */
export function FeaturedCarousel({ images = [] }: { images?: readonly OrbitItem[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const reduced = usePrefersReducedMotion();
  const autoplay = playing && !reduced;
  const running = autoplay && !hovered && !focused && onScreen;
  const imageFor = (name: string) => images.find((item) => item.name === name)?.imageUrl ?? null;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const next = (index + TOTAL) % TOTAL;
      const card = track?.children[next] as HTMLElement | undefined;
      if (!track || !card) return;
      setActive(next);
      track.scrollTo({
        left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
        behavior: reduced ? "auto" : "smooth",
      });
    },
    [reduced],
  );

  // The card nearest the track's centre is the active one, whatever moved it.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const centre = track.scrollLeft + track.clientWidth / 2;
        let best = 0;
        let bestDistance = Infinity;
        Array.from(track.children).forEach((child, i) => {
          const el = child as HTMLElement;
          const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centre);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
          }
        });
        setActive(best);
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Off-screen, the carousel neither advances nor pulls in images.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), {
      threshold: 0.35,
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  function onTrackKey(event: KeyboardEvent<HTMLUListElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowRight") goTo(active + 1);
    else if (event.key === "ArrowLeft") goTo(active - 1);
    else if (event.key === "Home") goTo(0);
    else if (event.key === "End") goTo(TOTAL - 1);
    else return;
    event.preventDefault();
  }

  const current = FEATURED_WORLDS[active] ?? FEATURED_WORLDS[0];

  return (
    <div
      ref={rootRef}
      id={ORBIT_RETRACT_TARGET}
      role="region"
      aria-roledescription="carousel"
      aria-labelledby="featured-heading"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      style={{ "--featured-ms": `${AUTOPLAY_MS}ms` } as CSSProperties}
    >
      <div className="mx-auto mb-7 flex w-full max-w-[var(--layout-max)] flex-wrap items-end justify-between gap-5 px-[var(--layout-gutter)]">
        <div className="max-w-xl">
          <p className="type-eyebrow text-text-3">
            Featured worlds · <span className="text-text-2">Demo data</span>
          </p>
          <h2 id="featured-heading" className="mt-3 text-balance text-2xl font-semibold tracking-[-0.03em] text-text sm:text-3xl">
            Ten artists, and the connections around them
          </h2>
          <ul aria-label="Connection types" className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(HIGHLIGHT_LABEL) as HighlightType[]).map((type) => {
              const Icon = HIGHLIGHT_ICON[type];
              return (
                <li key={type} className="featured-chip">
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  {HIGHLIGHT_LABEL[type]}
                </li>
              );
            })}
          </ul>
        </div>
        <GlassSurface radius="full" className="flex items-center gap-1 p-1">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Previous world"
            className="grid size-10 place-items-center rounded-full text-text hover:bg-line"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          {reduced ? null : (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause automatic rotation" : "Start automatic rotation"}
              aria-pressed={!playing}
              className="grid size-10 place-items-center rounded-full text-text hover:bg-line"
            >
              {playing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next world"
            className="grid size-10 place-items-center rounded-full text-text hover:bg-line"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </GlassSurface>
      </div>

      <p aria-live={running ? "off" : "polite"} className="sr-only">
        {`World ${active + 1} of ${TOTAL}: ${current.name}`}
      </p>

      <ul
        ref={trackRef}
        tabIndex={0}
        aria-label="Featured worlds. Use the left and right arrow keys to move."
        onKeyDown={onTrackKey}
        className="featured-track relative flex snap-x snap-mandatory gap-5 overflow-x-auto pb-6 pt-2 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-electric [&::-webkit-scrollbar]:hidden"
      >
        {FEATURED_WORLDS.map((world, index) => (
          <li
            key={world.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${TOTAL}: ${world.name}`}
            data-active={index === active}
            className="shrink-0 snap-center"
            onFocus={() => index !== active && goTo(index)}
          >
            <WorldCard world={world} index={index} active={index === active} src={imageFor(world.query)} />
          </li>
        ))}
      </ul>

      <div className="mx-auto mt-2 flex w-full max-w-3xl items-center gap-4 px-[var(--layout-gutter)]">
        <span className="font-mono text-xs tabular-nums text-text-2">
          {pad(active + 1)} <span className="text-text-3">/ {pad(TOTAL)}</span>
        </span>
        <div role="group" aria-label="Choose a world" className="flex flex-1 gap-1.5">
          {FEATURED_WORLDS.map((world, index) => (
            <button
              key={world.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show ${world.name}`}
              aria-current={index === active ? "true" : undefined}
              className="group relative h-6 flex-1"
            >
              <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden bg-line transition-colors group-hover:bg-line-strong">
                <span
                  // Re-keyed per slide so the timer restarts from zero on every change.
                  key={index === active ? `run-${active}` : "idle"}
                  className="featured-progress__fill"
                  data-state={index < active ? "done" : index === active ? (autoplay ? "timing" : "current") : "todo"}
                  style={{ animationPlayState: running ? "running" : "paused" }}
                  onAnimationEnd={() => {
                    if (running && index === active) goTo(active + 1);
                  }}
                />
              </span>
            </button>
          ))}
        </div>
        <span className="hidden min-w-[8rem] text-right text-xs text-text-2 sm:block">{current.name}</span>
      </div>
    </div>
  );
}

function WorldCard({
  world,
  index,
  active,
  src,
}: {
  world: FeaturedWorld;
  index: number;
  active: boolean;
  src: string | null;
}) {
  return (
    <SignalCard
      tone={active ? "forest" : "night"}
      className="featured-card h-full"
      header={
        <>
          <h3 className="type-eyebrow text-text">{world.name}</h3>
          <span className="font-mono text-xs tabular-nums text-text-2">
            {pad(index + 1)} / {pad(TOTAL)}
          </span>
        </>
      }
      media={
        <div className="relative">
          <StripedImage
            src={src}
            alt={world.name}
            sizes="(min-width: 640px) 25rem, 84vw"
            fallback={
              <span
                role="img"
                aria-label={`${world.name}: no image available`}
                className="type-accent absolute inset-0 grid place-items-center text-[9rem] leading-none text-mint/70"
              >
                {world.name.charAt(0)}
              </span>
            }
          />
          <span className="absolute bottom-3 left-6 flex items-center gap-1.5 bg-night/85 px-2.5 py-1 text-xs text-text sm:left-7">
            <MapPin aria-hidden="true" className="size-3.5 text-vibrant" />
            {world.location}
          </span>
        </div>
      }
      statement={world.headline}
      action={<SignalAction href={exploreHref(world)}>Explore {world.name}’s world</SignalAction>}
    >
      <ul aria-label={`Connections for ${world.name}`} className="divide-y divide-line border-y border-line">
        {world.highlights.map((highlight) => {
          const Icon = HIGHLIGHT_ICON[highlight.type];
          const source = featuredSource(highlight.sourceId);
          return (
            <li key={highlight.title} className="flex items-start gap-3 py-3">
              <span className="featured-chip mt-0.5 w-[5.75rem]">
                <Icon aria-hidden="true" className="size-3" />
                {HIGHLIGHT_LABEL[highlight.type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-text">{highlight.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-2">
                  {highlight.detail}.{" "}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 whitespace-nowrap underline decoration-line-strong underline-offset-2 hover:text-text"
                  >
                    {source.publisher}
                    <ArrowUpRight aria-hidden="true" className="size-3" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ProvenanceBadge kind="verified" size="sm" demo />
        <span className={cn("text-[0.6875rem] text-text-2")}>
          Sources pending editor review{src ? " · Image via Qloo" : ""}
        </span>
      </div>
    </SignalCard>
  );
}
