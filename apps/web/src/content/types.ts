import type { ProvenanceKind } from "@/lib/provenance";

/** A citable source for a verified fact or an editorial claim. */
export interface SourceReference {
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** ISO date (YYYY-MM-DD) the source was last checked. */
  reviewedAt: string;
  /** `editor_reviewed` is reserved for a human editor's sign-off. */
  reviewStatus: "pending_editor_review" | "editor_reviewed";
  note?: string;
}

/**
 * Everything needed to credit an image. For CC BY and CC BY-SA, name the
 * author, the licence (linked) and any modification (crop, duotone, grade).
 */
export interface MediaCredit {
  author: string;
  licenseName: string;
  licenseUrl: string;
  /** The Wikimedia Commons (or other) file page, not a search result. */
  sourceUrl: string;
  modifications: readonly string[];
  attributionRequired: boolean;
}

export interface ImageAsset {
  kind: "image";
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
  credit: MediaCredit;
}

/**
 * Used wherever no suitably licensed photograph has been verified. A designed
 * state, not an empty one: it renders the subject name over a palette gradient.
 */
export interface PlaceholderAsset {
  kind: "placeholder";
  alt: string;
  label: string;
  tone: "forest" | "mint" | "night" | "electric";
  /**
   * Editorial typographic treatment, so each placeholder reads as its own
   * cover rather than a repeated tile. `kicker` must restate a sourced fact
   * (for example a place name already cited for the artist).
   */
  layout: "initial" | "stack" | "vertical" | "place";
  kicker: string;
  /** Seeds the contour pattern so every placeholder has its own terrain. */
  seed: number;
}

export type MediaAsset = ImageAsset | PlaceholderAsset;

export type EntityType =
  | "artist"
  | "brand"
  | "place"
  | "destination"
  | "museum"
  | "venue";

export interface ConnectionTarget {
  name: string;
  entityType: EntityType;
  /** Free-text place, only where a source states it. No coordinates in Phase 0. */
  placeLabel?: string;
}

interface ConnectionBase {
  id: string;
  fromArtistId: string;
  target: ConnectionTarget;
  /** Short, human-readable label. */
  label: string;
  /** Plain statement of what the link means and does not mean. */
  statement: string;
  /** Every Phase 0 relationship is demonstration content and must be shown as such. */
  demo: true;
}

export interface VerifiedConnection<S extends string = string>
  extends ConnectionBase {
  kind: "verified";
  sourceIds: readonly [S, ...S[]];
}

/** Qloo-derived. Never presented as history; scores are never invented. */
export interface AffinityConnection extends ConnectionBase {
  kind: "affinity";
  provenance: {
    provider: "qloo";
    /** `fixture` means hand-written placeholder, not a live Qloo response. */
    mode: "fixture";
    retrievedAt: null;
    entityType: "artist" | "brand" | "place" | "destination";
  };
  score: null;
  fixtureNote: string;
}

export interface EditorialConnection<S extends string = string>
  extends ConnectionBase {
  kind: "editorial";
  citedSourceIds: readonly [S, ...S[]];
}

export interface CommunityConnection extends ConnectionBase {
  kind: "community";
  author: string;
  reviewStatus: "unreviewed" | "approved" | "rejected";
}

export type Connection<S extends string = string> =
  | VerifiedConnection<S>
  | AffinityConnection
  | EditorialConnection<S>
  | CommunityConnection;

export interface ArtistCard<S extends string = string> {
  id: string;
  name: string;
  /** Where the artist's World is anchored. A source must state it. */
  location: { label: string; basisSourceId: S };
  genres: readonly string[];
  genresBasisSourceId: S;
  media: MediaAsset;
  /** The short cultural insight shown on the card. Restates a cited fact. */
  insight: { text: string; kind: ProvenanceKind; connectionId: string };
  demo: true;
}

export type FeatureStatus = "in_development" | "planned";

export interface FeaturePanel {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
}

export interface HowItWorksStep {
  id: string;
  index: string;
  title: string;
  description: string;
}
