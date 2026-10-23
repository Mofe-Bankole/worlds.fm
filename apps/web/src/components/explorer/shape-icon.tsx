import { NodeShape } from "./constellation";
import { CATEGORY_META } from "@/lib/explorer/model";
import type { CulturalCategory } from "@worlds/shared";
import { cn } from "@/lib/cn";

/** Category marker: shape plus label text, so color is never the only signal. */
export function CategoryIcon({ category, className }: { category: CulturalCategory; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-16 -16 32 32"
      className={cn("size-4 shrink-0", meta.tone, className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <NodeShape shape={meta.shape} r={9} />
    </svg>
  );
}
