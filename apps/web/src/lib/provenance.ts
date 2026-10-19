/**
 * Relationship provenance (AGENTS.md §5, README "Cultural graph and
 * provenance"). Every cultural link carries one kind, a human label, and a
 * plain statement of what the link does and does not mean.
 *
 * Candidate to move into packages/shared once the API contract for
 * connections exists. Kept here so Phase 0 does not widen the web app's
 * workspace dependencies.
 */
export const PROVENANCE_KINDS = [
  "verified",
  "affinity",
  "community",
  "editorial",
] as const;

export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export type ProvenanceIcon = "check" | "waves" | "users" | "pen";

export interface ProvenanceMeta {
  label: string;
  /** What this kind of link means to a reader. Never implies causation or endorsement. */
  meaning: string;
  icon: ProvenanceIcon;
  /** SVG stroke-dasharray, so the line pattern (not color) identifies the kind. */
  dashArray: string | undefined;
  /** Tailwind text color class for the pattern swatch and icon. */
  toneClass: string;
}

export const PROVENANCE: Record<ProvenanceKind, ProvenanceMeta> = {
  verified: {
    label: "Verified connection",
    meaning:
      "Backed by a cited source. It states a documented fact and nothing more.",
    icon: "check",
    dashArray: undefined,
    toneClass: "text-mint",
  },
  affinity: {
    label: "Cultural affinity",
    meaning:
      "A recommendation signal from Qloo. It is not evidence of history, inspiration, ownership, attendance or causation.",
    icon: "waves",
    dashArray: "4 4",
    toneClass: "text-vibrant",
  },
  community: {
    label: "Community report",
    meaning:
      "Submitted by a person and shown with its review status. It is a claim, not a verified fact.",
    icon: "users",
    dashArray: "1.5 4",
    toneClass: "text-text-2",
  },
  editorial: {
    label: "Editorial perspective",
    meaning:
      "An editor's interpretation, shown with the supporting sources it cites.",
    icon: "pen",
    dashArray: "10 4",
    toneClass: "text-text",
  },
};
