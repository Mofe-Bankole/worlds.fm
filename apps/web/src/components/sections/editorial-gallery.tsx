import { MediaFrame } from "@/components/primitives/media-frame";
import { SectionHeader } from "@/components/primitives/section-header";
import { ARTISTS } from "@/content/landing";
import { cn } from "@/lib/cn";
import { SectionShell } from "./section-shell";

const LAYOUT = [
  { aspect: "portrait", className: "lg:col-span-4 lg:mt-0" },
  { aspect: "landscape", className: "lg:col-span-5 lg:mt-24" },
  { aspect: "square", className: "lg:col-span-3 lg:mt-12" },
  { aspect: "wide", className: "lg:col-span-7 lg:col-start-2 lg:-mt-6" },
] as const;

export function EditorialGallery() {
  return (
    <SectionShell id="gallery" labelledBy="gallery-heading">
      <SectionHeader
        index="05"
        eyebrow="Worlds in frame"
        id="gallery-heading"
        title="Places, not just playlists."
      />

      <ul className="mt-14 grid gap-x-6 gap-y-10 lg:grid-cols-12">
        {ARTISTS.map((artist, index) => {
          const slot = LAYOUT[index % LAYOUT.length];
          return (
            <li key={artist.id} className={cn(slot.className)}>
              <MediaFrame
                media={artist.media}
                aspect={slot.aspect}
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
              <p className="type-eyebrow mt-4 text-text-2">
                {artist.name} · {artist.location.label}
              </p>
            </li>
          );
        })}
      </ul>

      <figure className="mt-20 max-w-3xl">
        <blockquote className="type-accent text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.05] text-mint">
          A pin on the map should be able to show its sources.
        </blockquote>
        <figcaption className="type-small mt-6 text-text-3">
          Our design principle for places on Worlds.fm.
        </figcaption>
      </figure>

      <p className="type-small mt-10 max-w-prose text-text-3">
        These are placeholders. Photographs will appear here only after the
        licence on a Wikimedia Commons file is checked, and each one will carry
        its author, licence and source link. Artists shown do not endorse
        Worlds.fm.
      </p>
    </SectionShell>
  );
}
