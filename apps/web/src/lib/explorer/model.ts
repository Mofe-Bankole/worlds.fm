import type {
  CulturalCategory,
  CulturalEdge,
  CulturalGraph,
  CulturalNode,
  EvidenceKind,
} from "@worlds/shared";

/**
 * Pure view-model helpers for the constellation explorer. No React, no DOM:
 * layout and filtering are deterministic and unit-tested. Layout belongs to
 * the frontend by contract; the API sends no coordinates.
 */

export type ShapeKind = "circle" | "square" | "diamond" | "hexagon";

export interface CategoryMeta {
  label: string;
  plural: string;
  /** Shape carries the category so color is never the only signal. */
  shape: ShapeKind;
  /** Tailwind text color (drives currentColor for fill and stroke). */
  tone: string;
}

export const CATEGORY_META: Record<CulturalCategory, CategoryMeta> = {
  artist: { label: "Artist", plural: "Artists", shape: "circle", tone: "text-vibrant" },
  brand: { label: "Brand", plural: "Brands", shape: "square", tone: "text-mint" },
  destination: { label: "Destination", plural: "Destinations", shape: "diamond", tone: "text-fresh" },
  place: { label: "Place", plural: "Places", shape: "diamond", tone: "text-fresh" },
  book: { label: "Book", plural: "Books", shape: "hexagon", tone: "text-text-2" },
  movie: { label: "Movie", plural: "Movies", shape: "hexagon", tone: "text-text-2" },
  person: { label: "Person", plural: "People", shape: "hexagon", tone: "text-text-2" },
  podcast: { label: "Podcast", plural: "Podcasts", shape: "hexagon", tone: "text-text-2" },
  tv_show: { label: "TV show", plural: "TV shows", shape: "hexagon", tone: "text-text-2" },
  video_game: { label: "Video game", plural: "Video games", shape: "hexagon", tone: "text-text-2" },
  unknown: { label: "Other", plural: "Other", shape: "hexagon", tone: "text-text-2" },
};

const CATEGORY_ORDER: CulturalCategory[] = [
  "artist",
  "brand",
  "destination",
  "place",
  "book",
  "movie",
  "person",
  "podcast",
  "tv_show",
  "video_game",
  "unknown",
];

export const EVIDENCE_META: Record<EvidenceKind, { label: string; meaning: string }> = {
  qloo_affinity: {
    label: "Cultural affinity",
    meaning:
      "A Qloo recommendation signal between audiences. Not verified history, influence, collaboration, endorsement or causation.",
  },
  verified_fact: {
    label: "Verified fact",
    meaning: "Backed by a cited source.",
  },
  community_report: {
    label: "Community report",
    meaning: "A person's claim, shown with its review status.",
  },
  editorial_interpretation: {
    label: "Editorial interpretation",
    meaning: "An editor's reading, shown with its cited sources.",
  },
};

export const VIEWBOX = 1000;
export const CENTER = VIEWBOX / 2;
/** Margins so side and top labels are never clipped. */
export const VIEW_MARGIN_X = 130;
export const VIEW_MARGIN_Y = 80;
/** Node sizes in viewBox units. Images are clipped to the node's shape. */
export const ROOT_RADIUS = 64;
export const NODE_RADIUS = 30;
export const RING_RADII = [205, 305, 405] as const;

export interface NodePosition {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

function categoryRank(category: CulturalCategory): number {
  return CATEGORY_ORDER.indexOf(category);
}

/** The edge that connects a neighbour to the root, when one exists. */
export function edgeForNode(graph: CulturalGraph, nodeId: string): CulturalEdge | undefined {
  return graph.edges.find((edge) => edge.target === nodeId || edge.source === nodeId);
}

/**
 * Root at the centre; neighbours on three concentric rings. Results are
 * ranked by Qloo affinity (missing scores last) and split into three equal
 * bands: the highest band sits on the inner ring. Within a ring, nodes are
 * spread evenly and grouped by category, and each ring is rotated so labels on
 * neighbouring rings do not line up. Positions depend only on the full graph,
 * so filtering never moves a node.
 */
export function layoutConstellation(graph: CulturalGraph): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  positions.set(graph.rootId, { x: CENTER, y: CENTER, angle: 0, radius: 0 });

  const affinityByNode = new Map<string, number | null>();
  for (const edge of graph.edges) {
    const other = edge.source === graph.rootId ? edge.target : edge.source;
    affinityByNode.set(other, edge.affinity);
  }

  const ranked = graph.nodes
    .map((node, index) => ({ node, index, affinity: affinityByNode.get(node.id) ?? null }))
    .filter(({ node }) => node.id !== graph.rootId)
    .sort((a, b) => {
      if (a.affinity !== b.affinity) {
        if (a.affinity === null) return 1;
        if (b.affinity === null) return -1;
        return b.affinity - a.affinity;
      }
      return a.index - b.index;
    });

  const perRing = Math.max(1, Math.ceil(ranked.length / RING_RADII.length));
  RING_RADII.forEach((radius, ring) => {
    const members = ranked
      .slice(ring * perRing, (ring + 1) * perRing)
      .sort((a, b) => categoryRank(a.node.category) - categoryRank(b.node.category) || a.index - b.index);
    const phase = ring * (360 / (perRing * RING_RADII.length));
    members.forEach(({ node }, j) => {
      const angle = -90 + phase + (360 * (j + 0.5)) / members.length;
      const radians = (angle * Math.PI) / 180;
      positions.set(node.id, {
        x: CENTER + radius * Math.cos(radians),
        y: CENTER + radius * Math.sin(radians),
        angle,
        radius,
      });
    });
  });
  return positions;
}

export interface GraphFilters {
  categories: ReadonlySet<CulturalCategory>;
  evidence: ReadonlySet<EvidenceKind>;
}

export interface VisibleGraph {
  nodes: CulturalNode[];
  edges: CulturalEdge[];
}

/** The root always stays. A neighbour shows only when its category and its link's evidence pass. */
export function filterGraph(graph: CulturalGraph, filters: GraphFilters): VisibleGraph {
  const edges = graph.edges.filter((edge) => filters.evidence.has(edge.evidence));
  const linked = new Set<string>();
  for (const edge of edges) {
    linked.add(edge.source);
    linked.add(edge.target);
  }
  const nodes = graph.nodes.filter(
    (node) =>
      node.id === graph.rootId || (filters.categories.has(node.category) && linked.has(node.id)),
  );
  const visible = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)),
  };
}

export function presentCategories(graph: CulturalGraph): Array<{ category: CulturalCategory; count: number }> {
  const counts = new Map<CulturalCategory, number>();
  for (const node of graph.nodes) {
    if (node.id === graph.rootId) continue;
    counts.set(node.category, (counts.get(node.category) ?? 0) + 1);
  }
  return CATEGORY_ORDER.filter((c) => counts.has(c)).map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }));
}

export function presentEvidence(graph: CulturalGraph): Array<{ kind: EvidenceKind; count: number }> {
  const counts = new Map<EvidenceKind, number>();
  for (const edge of graph.edges) {
    counts.set(edge.evidence, (counts.get(edge.evidence) ?? 0) + 1);
  }
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

/** The neighbour with the strongest link, used as the initial selection. */
export function strongestNeighbour(graph: CulturalGraph): string | null {
  let best: CulturalEdge | null = null;
  for (const edge of graph.edges) {
    if (best === null || (edge.affinity ?? -1) > (best.affinity ?? -1)) best = edge;
  }
  if (!best) return null;
  return best.source === graph.rootId ? best.target : best.source;
}

/** First sentence of a provider description, for compact cards. */
export function firstSentence(text: string | null, max = 180): string | null {
  if (!text) return null;
  const match = /^.*?[.!?](?=\s|$)/.exec(text.trim());
  const sentence = (match?.[0] ?? text).trim();
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

/** "5 artists, 5 brands and 5 destinations". */
export function describeCounts(graph: CulturalGraph): string {
  const parts = presentCategories(graph).map(
    ({ category, count }) => `${count} ${(count === 1 ? CATEGORY_META[category].label : CATEGORY_META[category].plural).toLowerCase()}`,
  );
  if (parts.length <= 1) return parts[0] ?? "no connections";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function truncateLabel(name: string, max = 18): string {
  return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;
}

/** Affinity as shown to people: a ranking signal, formatted without false precision. */
export function formatAffinity(affinity: number | null): string {
  return affinity === null ? "No score from Qloo" : affinity.toFixed(2);
}

export interface LabelPlacement {
  anchor: "start" | "end";
  text: string;
}

export const LABEL_FONT = 30;
const NODE_HALF = NODE_RADIUS + 6;
export const LABEL_GAP = NODE_RADIUS + 18;
const CHAR_WIDTH = 0.56;

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

/**
 * Picks a side and a length for every neighbour label so labels avoid each
 * other and other nodes. Greedy and deterministic: inner nodes are placed
 * first, each trying its natural side, then the opposite, at full length, then
 * shortened. A label that cannot fit is shortened to the minimum; the full
 * name always stays available in the node's accessible name, tooltip and list.
 */
export function layoutLabels(
  graph: CulturalGraph,
  positions: Map<string, NodePosition>,
  fullLength = 22,
  minLength = 7,
): Map<string, LabelPlacement> {
  const placed: Box[] = [];
  const result = new Map<string, LabelPlacement>();

  const rootBox: Box = {
    x1: CENTER - 150,
    y1: CENTER - ROOT_RADIUS - 20,
    x2: CENTER + 150,
    y2: CENTER + ROOT_RADIUS + 70,
  };
  placed.push(rootBox);
  const nodeBoxes = new Map<string, Box>();
  for (const node of graph.nodes) {
    const p = positions.get(node.id);
    if (p && node.id !== graph.rootId) {
      nodeBoxes.set(node.id, { x1: p.x - NODE_HALF, y1: p.y - NODE_HALF, x2: p.x + NODE_HALF, y2: p.y + NODE_HALF });
    }
  }
  placed.push(...nodeBoxes.values());

  const order = graph.nodes
    .filter((n) => n.id !== graph.rootId && positions.has(n.id))
    .sort((a, b) => (positions.get(a.id)?.radius ?? 0) - (positions.get(b.id)?.radius ?? 0));

  for (const node of order) {
    const p = positions.get(node.id);
    if (!p) continue;
    const natural: "start" | "end" = p.x >= CENTER ? "start" : "end";
    const sides: Array<"start" | "end"> = [natural, natural === "start" ? "end" : "start"];
    const own = nodeBoxes.get(node.id);
    let chosen: { anchor: "start" | "end"; text: string; box: Box } | null = null;

    for (let length = fullLength; length >= minLength && !chosen; length -= 3) {
      const text = truncateLabel(node.name, length);
      const width = text.length * LABEL_FONT * CHAR_WIDTH;
      for (const anchor of sides) {
        const x1 = anchor === "start" ? p.x + LABEL_GAP : p.x - LABEL_GAP - width;
        const box: Box = { x1, y1: p.y - LABEL_FONT / 2 - 2, x2: x1 + width, y2: p.y + LABEL_FONT / 2 + 2 };
        if (!placed.some((other) => other !== own && overlaps(box, other))) {
          chosen = { anchor, text, box };
          break;
        }
      }
    }
    if (!chosen) {
      const text = truncateLabel(node.name, minLength);
      chosen = { anchor: natural, text, box: { x1: 0, y1: 0, x2: 0, y2: 0 } };
    } else {
      placed.push(chosen.box);
    }
    result.set(node.id, { anchor: chosen.anchor, text: chosen.text });
  }
  return result;
}
