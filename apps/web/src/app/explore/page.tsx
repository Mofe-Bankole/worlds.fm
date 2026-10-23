import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WorldsMark } from "@/components/worlds-mark";
import { ExplorerApp } from "@/components/explorer/explorer-app";

export const metadata: Metadata = {
  title: "Explore a cultural world — Worlds.fm",
  description: "Search an artist and explore the cultural affinities connected to them.",
};

export default function ExplorePage() {
  return (
    <main id="main" className="relative min-h-screen overflow-hidden bg-night">
      <header className="relative z-[var(--z-nav)] px-[var(--layout-gutter)] py-5">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Worlds.fm home">
          <WorldsMark className="size-7" />
          <span className="text-base font-extrabold tracking-[-0.03em]">
            Worlds<span className="text-electric">.fm</span>
          </span>
        </Link>
      </header>
      <Suspense fallback={null}>
        <ExplorerApp />
      </Suspense>
    </main>
  );
}
