import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Outbound text link to a provider page; always opens in a new tab. */
export function ExternalLink({
  href,
  children,
  className,
  label,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 text-text-2 underline-offset-4 transition-colors hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
        className,
      )}
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

/** Primary hand-off to Spotify. Text only: Worlds.fm does not reproduce Spotify marks. */
export function SpotifyButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-electric px-4 py-2 text-sm font-semibold text-on-accent transition hover:bg-fresh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function QuietButton({
  children,
  onClick,
  pressed,
  expanded,
  controls,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      className={cn(
        "border border-line-strong px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-2 transition-colors hover:border-electric hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
        (pressed || expanded) && "border-electric text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}
