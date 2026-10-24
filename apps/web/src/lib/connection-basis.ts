import type { ConnectionBasis } from "@worlds/shared";

/**
 * What a connection is based on (AGENTS.md §5). Evidence kind says what sort
 * of evidence a link is; basis says how specific its explanation can be.
 *
 * The ladder is ordered strongest first, and a reader must always be able to
 * tell which rung a link sits on, so a bare audience overlap is never mistaken
 * for a documented relationship.
 */
export type BasisIcon = "check" | "quote" | "link" | "waves";

export interface BasisMeta {
  label: string;
  /** What this rung means, and what it does not claim. */
  meaning: string;
  icon: BasisIcon;
  /** SVG stroke-dasharray, so the line pattern (not color) identifies the rung. */
  dashArray: string | undefined;
  /** Tailwind text color class for the pattern swatch and icon. */
  toneClass: string;
}

export const BASIS: Record<ConnectionBasis, BasisMeta> = {
  documented: {
    label: "Documented",
    meaning:
      "A cited source states this relationship. The source is shown beside it, and it claims nothing beyond what that source says.",
    icon: "check",
    dashArray: undefined,
    toneClass: "text-mint",
  },
  provider_attribute: {
    label: "Stated by Qloo",
    meaning:
      "Qloo records this relationship or trait itself. It is Qloo's description of the entities, not independent verification of history.",
    icon: "quote",
    dashArray: "6 3",
    toneClass: "text-vibrant",
  },
  shared_attribute: {
    label: "Shared trait",
    meaning:
      "The two entities share a trait recorded for both, such as a genre or an audience description. The sources that recorded it are named beside the statement. A shared trait is not a documented connection.",
    icon: "link",
    dashArray: "2 3",
    toneClass: "text-fresh",
  },
  audience_overlap: {
    label: "Audience overlap",
    meaning:
      "Nothing beyond the affinity score: Qloo found no documented link and no shared trait between the two.",
    icon: "waves",
    dashArray: "1.5 4",
    toneClass: "text-text-2",
  },
};

/** Strongest first, for legends and filters. */
export const BASIS_ORDER: ConnectionBasis[] = [
  "documented",
  "provider_attribute",
  "shared_attribute",
  "audience_overlap",
];
