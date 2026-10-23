"use client";

import type { CulturalCategory, EvidenceKind } from "@worlds/shared";
import { CATEGORY_META, EVIDENCE_META } from "@/lib/explorer/model";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "./shape-icon";

interface FiltersProps {
  categories: Array<{ category: CulturalCategory; count: number }>;
  evidence: Array<{ kind: EvidenceKind; count: number }>;
  activeCategories: ReadonlySet<CulturalCategory>;
  activeEvidence: ReadonlySet<EvidenceKind>;
  onToggleCategory: (category: CulturalCategory) => void;
  onToggleEvidence: (kind: EvidenceKind) => void;
}

function chip(active: boolean) {
  return cn(
    "inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-medium transition-colors",
    active ? "border-line-strong bg-surface-2 text-text" : "border-line text-text-3 line-through hover:text-text-2",
  );
}

export function Filters(props: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the constellation">
      {props.categories.map(({ category, count }) => (
        <button
          key={category}
          type="button"
          aria-pressed={props.activeCategories.has(category)}
          onClick={() => props.onToggleCategory(category)}
          className={chip(props.activeCategories.has(category))}
        >
          <CategoryIcon category={category} className="size-3.5" />
          {CATEGORY_META[category].plural}
          <span className="font-mono text-text-3">{count}</span>
        </button>
      ))}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line-strong" />
      {props.evidence.map(({ kind, count }) => (
        <button
          key={kind}
          type="button"
          aria-pressed={props.activeEvidence.has(kind)}
          onClick={() => props.onToggleEvidence(kind)}
          title={EVIDENCE_META[kind].meaning}
          className={chip(props.activeEvidence.has(kind))}
        >
          <span aria-hidden="true" className="inline-block w-4 border-t border-dashed border-current" />
          {EVIDENCE_META[kind].label}
          <span className="font-mono text-text-3">{count}</span>
        </button>
      ))}
    </div>
  );
}
