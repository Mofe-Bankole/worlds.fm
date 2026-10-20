import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContourField } from "@/components/primitives/contour-field";
import { GlassSurface } from "@/components/primitives/glass-surface";
import { MediaFrame } from "@/components/primitives/media-frame";
import { OutlinedText } from "@/components/primitives/outlined-text";
import { ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { SectionHeader } from "@/components/primitives/section-header";
import { ARTISTS } from "@/content/landing";
import { PROVENANCE_KINDS } from "@/lib/provenance";

export const metadata: Metadata = {
  title: "Design foundations",
  robots: { index: false, follow: false },
};

// Class names are written out in full so Tailwind can see them.
const BRAND_SWATCHES = [
  { name: "night", hex: "#08120B", className: "bg-night" },
  { name: "electric", hex: "#00CD37", className: "bg-electric" },
  { name: "vibrant", hex: "#46D35D", className: "bg-vibrant" },
  { name: "fresh", hex: "#5DDE6C", className: "bg-fresh" },
  { name: "mint", hex: "#CBF2CD", className: "bg-mint" },
  { name: "forest", hex: "#2A6E4C", className: "bg-forest" },
] as const;

const DERIVED_SWATCHES = [
  { name: "surface-1", className: "bg-surface-1" },
  { name: "surface-2", className: "bg-surface-2" },
  { name: "text", className: "bg-text" },
  { name: "text-2", className: "bg-text-2" },
  { name: "text-3", className: "bg-text-3" },
] as const;

const TYPE_SAMPLES = [
  { token: "type-hero", className: "type-hero", sample: "Every sound has a world." },
  { token: "type-cta", className: "type-cta", sample: "Where does your sound live?" },
  { token: "type-section", className: "type-section", sample: "Cultural connections" },
  { token: "type-sub", className: "type-sub", sample: "Artist discovery" },
  { token: "type-lead", className: "type-lead", sample: "Explore the artists, places and movements behind music." },
  { token: "type-body", className: "type-body", sample: "Body copy sits on Night with 17:1 contrast." },
  { token: "type-eyebrow", className: "type-eyebrow", sample: "02 · Artist discovery" },
  { token: "type-accent", className: "type-accent text-3xl", sample: "a world of its own" },
] as const;

/** Internal reference for tokens and primitives. Not shipped to production. */
export default function DesignFoundationsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-[var(--layout-max)] flex-col gap-24 px-[var(--layout-gutter)] py-20">
      <SectionHeader
        headingLevel={1}
        index="00"
        eyebrow="Design foundations"
        title="Tokens and primitives"
        description="Internal reference for Phase 0. This page is hidden in production builds."
      />

      <section aria-labelledby="color" className="flex flex-col gap-6">
        <h2 id="color" className="type-sub">Color</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {BRAND_SWATCHES.map((swatch) => (
            <li key={swatch.name} className="flex flex-col gap-2">
              <span className={`${swatch.className} h-20 rounded-md border border-line-strong`} />
              <span className="type-eyebrow text-text-2">{swatch.name}</span>
              <span className="type-eyebrow text-text-3">{swatch.hex}</span>
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {DERIVED_SWATCHES.map((swatch) => (
            <li key={swatch.name} className="flex flex-col gap-2">
              <span className={`${swatch.className} h-12 rounded-md border border-line-strong`} />
              <span className="type-eyebrow text-text-2">{swatch.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-8">
        <h2 id="type" className="type-sub">Typography</h2>
        {TYPE_SAMPLES.map((item) => (
          <div key={item.token} className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="type-eyebrow text-text-3">{item.token}</span>
            <p className={`${item.className} text-text`}>{item.sample}</p>
          </div>
        ))}
        <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden">
          <OutlinedText as="p" tone="subtle" className="type-wordmark">
            Worlds.fm
          </OutlinedText>
        </div>
        <div className="flex flex-wrap gap-6">
          <OutlinedText as="p" tone="mint" className="type-section">Mint outline</OutlinedText>
          <OutlinedText as="p" tone="electric" className="type-section">Electric outline</OutlinedText>
        </div>
      </section>

      <section aria-labelledby="glass" className="flex flex-col gap-6">
        <h2 id="glass" className="type-sub">Glass and contour field</h2>
        <div className="relative isolate grid min-h-80 place-items-center overflow-hidden rounded-panel bg-surface-1">
          <ContourField className="absolute inset-0 -z-10 size-full text-mint/20" rings={12} />
          <GlassSurface className="max-w-md p-8" tone="default">
            <p className="type-eyebrow text-text-2">Glass surface</p>
            <p className="type-sub mt-2 text-text">Legible over rings.</p>
            <p className="type-body mt-3 text-text-2">
              Falls back to a solid surface without backdrop-filter or with reduced transparency.
            </p>
          </GlassSurface>
        </div>
      </section>

      <section aria-labelledby="provenance" className="flex flex-col gap-6">
        <h2 id="provenance" className="type-sub">Provenance</h2>
        <ul className="flex flex-col gap-4">
          {PROVENANCE_KINDS.map((kind) => (
            <li key={kind}>
              <ProvenanceBadge
                kind={kind}
                demo
                fixture={kind === "affinity"}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="media" className="flex flex-col gap-6">
        <h2 id="media" className="type-sub">Media frame (placeholders)</h2>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ARTISTS.map((artist) => (
            <li key={artist.id}>
              <MediaFrame media={artist.media} sizes="(min-width: 1024px) 25vw, 50vw" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
