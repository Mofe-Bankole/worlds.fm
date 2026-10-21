import type { ReactNode } from "react";
import { MapPin, Search, Share2 } from "lucide-react";
import { ContourField } from "@/components/primitives/contour-field";
import { ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { SectionHeader } from "@/components/primitives/section-header";
import { FEATURE_PANELS } from "@/content/landing";
import { PROVENANCE_KINDS } from "@/lib/provenance";
import { cn } from "@/lib/cn";
import { SectionShell } from "./section-shell";

type PanelId = (typeof FEATURE_PANELS)[number]["id"];

const SPAN: Record<PanelId, string> = {
  search: "lg:col-span-4",
  map: "lg:col-span-2 lg:row-span-2",
  provenance: "lg:col-span-2",
  affinity: "lg:col-span-2",
  graph: "lg:col-span-3",
  share: "lg:col-span-3",
};

const TONE: Partial<Record<PanelId, string>> = {
  map: "bg-[linear-gradient(170deg,var(--color-forest),var(--color-surface-1)_70%)]",
  provenance: "border-electric/40!",
  affinity: "border-dashed border-line-strong!",
  graph: "border-mint/25!",
};

const STATUS_LABEL = {
  in_development: "In development",
  planned: "Planned",
} as const;

const VISUALS: Record<PanelId, ReactNode> = {
  search: (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-full border border-line-strong bg-night px-5 py-3 text-text-2"
    >
      <Search className="size-4" />
      <span className="text-sm">Avicii</span>
    </div>
  ),
  map: (
    <div aria-hidden="true" className="relative min-h-40 flex-1 overflow-hidden rounded-3xl bg-night">
      <ContourField
        rings={8}
        seed={7}
        wobble={0.08}
        className="absolute inset-0 size-full text-mint/25"
      />
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-text">
        <MapPin className="size-3.5 text-electric" />
        Source required
      </span>
    </div>
  ),
  provenance: (
    <div aria-hidden="true" className="flex flex-wrap gap-2">
      {PROVENANCE_KINDS.slice(0, 2).map((kind) => (
        <ProvenanceBadge key={kind} kind={kind} size="sm" />
      ))}
    </div>
  ),
  affinity: (
    <div aria-hidden="true">
      <ProvenanceBadge kind="affinity" size="sm" fixture />
    </div>
  ),
  graph: (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 90"
      className="h-24 w-full text-mint/60"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <line x1="40" y1="45" x2="120" y2="20" />
      <line x1="120" y1="20" x2="200" y2="50" />
      <line x1="40" y1="45" x2="120" y2="72" strokeDasharray="4 4" />
      <line x1="120" y1="72" x2="200" y2="50" strokeDasharray="4 4" />
      {[
        [40, 45],
        [120, 20],
        [200, 50],
        [120, 72],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" className="fill-surface-2" />
      ))}
    </svg>
  ),
  share: (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-full border border-dashed border-line-strong px-5 py-3 text-text-2"
    >
      <Share2 className="size-4" />
      <span className="text-sm">A link to a World</span>
    </div>
  ),
};

export function FeatureBento() {
  return (
    <SectionShell id="features" labelledBy="features-heading">
      <SectionHeader
        index="03"
        eyebrow="What you can do"
        id="features-heading"
        title="Built to show its work."
        description="Six parts of one experience. None of them is live yet, and each is marked with where it stands."
      />

      <ul className="mt-14 grid gap-5 lg:grid-cols-6">
        {FEATURE_PANELS.map((panel) => (
          <li
            key={panel.id}
            className={cn(
              "flex flex-col gap-6 rounded-panel border border-line bg-surface-1 p-7 shadow-lift sm:p-8",
              SPAN[panel.id],
              TONE[panel.id],
            )}
          >
            <p className="type-eyebrow text-text-3">
              {STATUS_LABEL[panel.status]}
            </p>
            {VISUALS[panel.id]}
            <div className="mt-auto">
              <h3 className="type-sub text-text">{panel.title}</h3>
              <p className="type-body mt-3 text-text-2">{panel.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
