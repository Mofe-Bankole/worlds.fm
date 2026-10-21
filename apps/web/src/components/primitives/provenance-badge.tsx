import { BadgeCheck, PenLine, Users, Waves, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PROVENANCE,
  type ProvenanceIcon,
  type ProvenanceKind,
} from "@/lib/provenance";

const ICONS: Record<ProvenanceIcon, LucideIcon> = {
  check: BadgeCheck,
  waves: Waves,
  users: Users,
  pen: PenLine,
};

interface ProvenanceBadgeProps {
  kind: ProvenanceKind;
  size?: "sm" | "md";
  /** Mark the item as demonstration content. */
  demo?: boolean;
  /** Mark a Qloo-shaped item as a hand-written fixture, not a live result. */
  fixture?: boolean;
  className?: string;
}

/**
 * Demonstration-content marker. Sits next to the claim it qualifies, not in a
 * page footer: a reader who scans one card must still see that the content is
 * not sourced yet.
 */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "type-eyebrow inline-flex rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[0.6875rem] text-text-2",
        className,
      )}
    >
      Demo data
    </span>
  );
}

/**
 * Evidence label for a cultural relationship. The kind is always carried by
 * three signals: a text label, an icon and a line pattern. Color only adds to
 * them, so it never has to be perceived on its own.
 */
export function ProvenanceBadge({
  kind,
  size = "md",
  demo = false,
  fixture = false,
  className,
}: ProvenanceBadgeProps) {
  const meta = PROVENANCE[kind];
  const Icon = ICONS[meta.icon];

  return (
    <span
      data-provenance={kind}
      title={meta.meaning}
      className={cn("inline-flex flex-wrap items-center gap-1.5", className)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-1",
          size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn(size === "sm" ? "size-3.5" : "size-4", meta.toneClass)}
        />
        <span className={cn("type-eyebrow text-text", size === "sm" && "text-[0.6875rem]")}>
          {meta.label}
        </span>
        <svg
          aria-hidden="true"
          focusable="false"
          width="28"
          height="6"
          viewBox="0 0 28 6"
          className={meta.toneClass}
        >
          <line
            x1="1.5"
            y1="3"
            x2="26.5"
            y2="3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={meta.dashArray}
          />
        </svg>
      </span>
      {demo ? <DemoBadge /> : null}
      {fixture ? (
        <span className="type-eyebrow rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[0.6875rem] text-text-2">
          Qloo fixture
        </span>
      ) : null}
    </span>
  );
}
