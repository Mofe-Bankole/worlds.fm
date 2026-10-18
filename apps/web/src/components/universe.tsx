"use client";

import { useState } from "react";
import {
  AudioLines,
  Globe2,
  MapPin,
  Mic2,
  Music2,
  Tent,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface UniverseNode {
  id: string;
  label: string;
  x: number;
  y: number;
  icon: LucideIcon;
  hub?: boolean;
  hint: string;
}

const NODES: UniverseNode[] = [
  {
    id: "hub",
    label: "Worlds.fm",
    x: 50,
    y: 50,
    icon: AudioLines,
    hub: true,
    hint: "The discovery engine linking every signal",
  },
  { id: "music", label: "Music", x: 16, y: 32, icon: Music2, hint: "Songs and sound" },
  { id: "artists", label: "Artists", x: 84, y: 26, icon: Mic2, hint: "The people behind the sound" },
  { id: "cities", label: "Cities", x: 14, y: 74, icon: MapPin, hint: "Places that shaped a scene" },
  { id: "festivals", label: "Festivals", x: 86, y: 72, icon: Tent, hint: "Where culture gathers" },
  { id: "culture", label: "Culture", x: 50, y: 13, icon: Globe2, hint: "Movements and identity" },
];

const EDGES: Array<[string, string]> = [
  ["hub", "music"],
  ["hub", "artists"],
  ["hub", "cities"],
  ["hub", "festivals"],
  ["hub", "culture"],
  ["music", "culture"],
  ["culture", "artists"],
  ["cities", "music"],
  ["festivals", "culture"],
];

const STARS = [
  { x: 8, y: 12, d: 0 },
  { x: 27, y: 62, d: 1.4 },
  { x: 42, y: 8, d: 2.7 },
  { x: 61, y: 86, d: 0.8 },
  { x: 73, y: 44, d: 3.3 },
  { x: 92, y: 52, d: 2.1 },
  { x: 35, y: 88, d: 1.9 },
  { x: 55, y: 30, d: 3.9 },
];

const nodeById = new Map(NODES.map((node) => [node.id, node]));

export function Universe() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section aria-labelledby="universe-heading" className="relative px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-electric/80">
            The cultural universe
          </p>
          <h2
            id="universe-heading"
            className="mt-3 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl"
          >
            Every song is a doorway into a world
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            Music, artists, cities, festivals, and cultures are all connected.
            Hover a node to trace the links.
          </p>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-4xl border border-white/8 bg-[radial-gradient(ellipse_90%_70%_at_50%_40%,rgba(16,61,43,0.55)_0%,transparent_70%)] shadow-[inset_0_1px_0_rgba(246,248,245,0.05)]">
          <div className="absolute inset-0 grid-veil opacity-40" />
          <div className="absolute inset-0 noise opacity-[0.03] mix-blend-soft-light" />

          <div className="relative aspect-[4/3] w-full sm:aspect-[16/9]">
            {/* Twinkling field */}
            {STARS.map((star) => (
              <span
                key={`${star.x}-${star.y}`}
                aria-hidden="true"
                className="absolute size-1 rounded-full bg-cloud/60 animate-twinkle"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  animationDelay: `${star.d}s`,
                }}
              />
            ))}

            {/* Connection lines */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#BEFF55" stopOpacity="0.15" />
                  <stop offset="50%" stopColor="#1ED760" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#BEFF55" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              {EDGES.map(([from, to]) => {
                const a = nodeById.get(from);
                const b = nodeById.get(to);
                if (!a || !b) return null;
                const isActive =
                  active === from || active === to || active === null;
                return (
                  <g key={`${from}-${to}`}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="url(#edge)"
                      strokeWidth={active && (active === from || active === to) ? 0.6 : 0.35}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray="3 5"
                      className="animate-flow transition-[stroke-width,opacity] duration-500"
                      style={{ opacity: isActive ? 0.9 : 0.22 }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {NODES.map((node) => {
              const Icon = node.icon;
              const isActive = active === node.id;
              const isDimmed = active !== null && !isActive && !node.hub;
              return (
                <div
                  key={node.id}
                  className="absolute animate-float-slow"
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    transform: "translate(-50%, -50%)",
                    animationDelay: `${(node.x % 7) * 0.4}s`,
                  }}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActive(node.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(node.id)}
                    onBlur={() => setActive(null)}
                    aria-label={`${node.label}: ${node.hint}`}
                    className={cn(
                      "group flex flex-col items-center gap-2 rounded-2xl px-2 py-1 transition duration-500",
                      isDimmed ? "opacity-45" : "opacity-100",
                    )}
                  >
                    <span
                      className={cn(
                        "relative grid place-items-center rounded-full border backdrop-blur-md transition duration-500",
                        node.hub
                          ? "size-16 border-electric/60 bg-electric/12 shadow-[0_0_50px_-8px_rgba(190,255,85,0.8)] sm:size-20"
                          : "size-12 border-white/12 bg-white/[0.05] group-hover:border-electric/60 group-hover:bg-electric/10 group-hover:shadow-[0_0_36px_-8px_rgba(190,255,85,0.85)]",
                        isActive && "-translate-y-1 scale-105",
                      )}
                    >
                      {node.hub && (
                        <span className="absolute inset-0 animate-pulse-glow rounded-full bg-electric/20 blur-md" />
                      )}
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "relative text-electric transition-transform duration-500 group-hover:scale-110",
                          node.hub ? "size-7 sm:size-8" : "size-5",
                        )}
                        strokeWidth={1.75}
                      />
                    </span>
                    <span
                      className={cn(
                        "whitespace-nowrap text-[0.72rem] font-semibold tracking-tight transition-colors duration-300 sm:text-xs",
                        isActive ? "text-electric" : "text-cloud/85",
                      )}
                    >
                      {node.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
