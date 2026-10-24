import { BadgeCheck, Link2, Quote, Waves, type LucideIcon } from "lucide-react";
import type { EdgeBasis } from "@worlds/shared";
import { cn } from "@/lib/cn";
import { BASIS, type BasisIcon } from "@/lib/connection-basis";

const ICONS: Record<BasisIcon, LucideIcon> = {
  check: BadgeCheck,
  quote: Quote,
  link: Link2,
  waves: Waves,
};

/**
 * The rung of the evidence ladder a connection sits on. Carried by three
 * signals so it never relies on color alone: a text label, an icon and a line
 * pattern.
 */
export function BasisBadge({ basis, className }: { basis: EdgeBasis; className?: string }) {
  const meta = BASIS[basis.kind];
  const Icon = ICONS[meta.icon];

  return (
    <span
      data-basis={basis.kind}
      title={meta.meaning}
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-1 px-2.5 py-1">
        <Icon aria-hidden="true" className={cn("size-3.5", meta.toneClass)} />
        <span className="type-eyebrow text-[0.6875rem] text-text">{meta.label}</span>
        <svg aria-hidden="true" focusable="false" width="24" height="6" viewBox="0 0 24 6" className={meta.toneClass}>
          <line
            x1="1.5"
            y1="3"
            x2="22.5"
            y2="3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={meta.dashArray}
          />
        </svg>
      </span>
      {basis.sourceUrl ? (
        <a
          href={basis.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[0.6875rem] text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text"
        >
          {basis.sourceLabel}
        </a>
      ) : (
        <span className="text-[0.6875rem] text-text-2">{basis.sourceLabel}</span>
      )}
    </span>
  );
}
