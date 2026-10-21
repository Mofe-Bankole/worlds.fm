import { MediaFrame } from "@/components/primitives/media-frame";
import { ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { SectionHeader } from "@/components/primitives/section-header";
import { ARTISTS } from "@/content/landing";
import { cn } from "@/lib/cn";
import { SectionShell } from "./section-shell";

/* A magazine spread: one tall lead, two offset companions, and a pull quote
   that sits in the gap the lead leaves. Each frame is a chapter, captioned
   with a fact the artist's cited connection already states. */
const SPREAD = [
  {
    aspect: "portrait",
    className: "lg:col-span-6 lg:row-span-2 lg:row-start-1",
    sizes: "(min-width: 1024px) 50vw, 100vw",
  },
  {
    aspect: "landscape",
    className: "lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:mt-20",
    sizes: "(min-width: 1024px) 40vw, 100vw",
  },
  {
    aspect: "square",
    className: "lg:col-span-4 lg:col-start-2 lg:row-start-3 lg:mt-4",
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
  {
    aspect: "wide",
    className: "lg:col-span-6 lg:col-start-7 lg:row-start-3 lg:self-end",
    sizes: "(min-width: 1024px) 50vw, 100vw",
  },
] as const;

export function EditorialGallery() {
  return (
    <SectionShell id="gallery" labelledBy="gallery-heading">
      <SectionHeader
        index="05"
        eyebrow="Worlds in frame"
        id="gallery-heading"
        title={
          <>
            Places, <span className="type-accent text-mint">not just</span>{" "}
            playlists.
          </>
        }
        description="Four artists, four places. Each chapter starts from one fact with a source."
      />

      <ol className="mt-16 grid gap-x-8 gap-y-14 lg:grid-cols-12">
        {ARTISTS.slice(0, SPREAD.length).map((artist, index) => {
          const slot = SPREAD[index]!;
          return (
            <li key={artist.id} className={cn("flex flex-col gap-5", slot.className)}>
              <MediaFrame media={artist.media} aspect={slot.aspect} sizes={slot.sizes} />
              <div className="flex flex-col gap-3">
                <p className="type-eyebrow text-text-2">
                  <span className="text-electric">
                    {String(index + 1).padStart(2, "0")}
                  </span>{" "}
                  · {artist.name} · {artist.location.label}
                </p>
                <p className="type-lead max-w-md text-text">
                  {artist.insight.text}
                </p>
                <ProvenanceBadge kind={artist.insight.kind} size="sm" demo />
              </div>
            </li>
          );
        })}

        <li
          aria-hidden="false"
          className="flex items-center lg:col-span-5 lg:col-start-8 lg:row-start-2"
        >
          <figure>
            <blockquote className="type-accent text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] text-mint">
              A pin on the map should be able to show its sources.
            </blockquote>
            <figcaption className="type-small mt-5 text-text-3">
              Our design principle for places on Worlds.fm.
            </figcaption>
          </figure>
        </li>
      </ol>

      <p className="type-small mt-14 max-w-prose text-text-3">
        Typographic placeholders, not photographs. A photograph will appear
        here only after its Wikimedia Commons licence is checked, and it will
        carry its author, licence and source link. Artists shown do not endorse
        Worlds.fm. Demo data.
      </p>
    </SectionShell>
  );
}
