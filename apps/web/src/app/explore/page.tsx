import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WorldsMark } from "@/components/worlds-mark";
import { ExplorerApp } from "@/components/explorer/explorer-app";
import { PlayerProvider } from "@/components/music/player-context";
import { NON_AFFILIATION_NOTICE } from "@/lib/brand";
import { siteUrlFromRequest } from "@/lib/site";
import { normalizeShareName, worldDescription, worldPath } from "@/lib/share";

/**
 * A shared World link carries the artist in `?q=`, so the page title, the
 * description and the preview image all name that artist. The image is drawn by
 * `/og/world` and deliberately does not claim anything about the artist: the
 * explorer itself labels every connection with what it is based on.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const name = normalizeShareName(raw);

  if (!name) {
    return {
      title: "Explore a cultural world — Worlds.fm",
      description: "Search an artist and explore the cultural affinities connected to them.",
    };
  }

  const description = worldDescription(name);
  // From the request, so the canonical URL matches the host actually serving it.
  const origin = await siteUrlFromRequest();
  const canonical = `${origin}${worldPath(name)}`;
  const image = `${origin}/og/world?${new URLSearchParams({ name })}`;

  return {
    title: `${name} — a cultural world on Worlds.fm`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${name} — a cultural world on Worlds.fm`,
      description,
      url: canonical,
      siteName: "Worlds.fm",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: `${name} on Worlds.fm` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — a cultural world on Worlds.fm`,
      description,
      images: [image],
    },
  };
}

export default function ExplorePage() {
  return (
    <PlayerProvider>
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
        {/* Public, generic: a World page carries no personal data. */}
        <footer className="px-[var(--layout-gutter)] pb-10 pt-4">
          <p className="mx-auto max-w-2xl text-center text-[0.6875rem] leading-relaxed text-text-3">
            {NON_AFFILIATION_NOTICE}
          </p>
        </footer>
      </main>
    </PlayerProvider>
  );
}
