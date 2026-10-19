import { ExternalLink } from "lucide-react";
import { MediaCreditLine } from "@/components/primitives/media-frame";
import { OutlinedText } from "@/components/primitives/outlined-text";
import { WorldsMark } from "@/components/worlds-mark";
import {
  NON_AFFILIATION_NOTICE,
  collectCitedSources,
  collectMediaCredits,
} from "@/content/landing";

const LINKS = [
  { label: "Discover", href: "#discovery" },
  { label: "Features", href: "#features" },
  { label: "Orbit", href: "#orbit" },
  { label: "How it works", href: "#how" },
] as const;

export function SiteFooter() {
  const credits = collectMediaCredits();
  const sources = collectCitedSources();

  return (
    <footer
      id="about"
      className="relative overflow-hidden border-t border-line pt-20"
    >
      <div className="mx-auto grid w-full max-w-[var(--layout-max)] gap-12 px-[var(--layout-gutter)] md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-2.5">
            <WorldsMark className="size-8" />
            <span className="text-lg font-extrabold tracking-[-0.03em]">
              Worlds<span className="text-electric">.fm</span>
            </span>
          </div>
          <p className="type-small mt-5 max-w-sm text-text-2">
            Explore the places, genres and stories connected to music, with
            the evidence for every link.
          </p>
        </div>

        <nav aria-label="Footer" className="md:col-span-3">
          <h2 className="type-eyebrow text-text-3">Explore</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-text-2 hover:text-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-4">
          <h2 className="type-eyebrow text-text-3">Sources and credits</h2>
          <ul className="mt-4 flex flex-col gap-2 text-xs text-text-2">
            {sources.map((source) => (
              <li key={source.id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 underline underline-offset-2 hover:text-text"
                >
                  {source.publisher}: {source.title}
                  <ExternalLink aria-hidden="true" className="size-3" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
            {credits.length === 0 ? (
              <li className="text-text-3">
                No photographs are in use yet. Artwork shown is placeholder.
              </li>
            ) : (
              credits.map((credit) => (
                <li key={credit.sourceUrl} className="text-text-3">
                  {credit.subject}: <MediaCreditLine credit={credit} />
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-14 w-full max-w-[var(--layout-max)] px-[var(--layout-gutter)] text-xs text-text-3">
        <p>{NON_AFFILIATION_NOTICE}</p>
        <p className="mt-2">
          Demo experience. Connections are demonstration content, and nothing
          here is a live Qloo result.
        </p>
      </div>

      <div className="mt-10 select-none overflow-hidden px-[var(--layout-gutter)] pb-4 text-center">
        <OutlinedText decorative className="type-wordmark">
          Worlds.fm
        </OutlinedText>
      </div>
    </footer>
  );
}
