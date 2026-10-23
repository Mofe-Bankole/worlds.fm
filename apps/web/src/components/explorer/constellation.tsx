"use client";

import { useId, useMemo, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { CulturalGraph, CulturalNode } from "@worlds/shared";
import {
  CATEGORY_META,
  CENTER,
  LABEL_FONT,
  LABEL_GAP,
  NODE_RADIUS,
  RING_RADII,
  ROOT_RADIUS,
  VIEWBOX,
  VIEW_MARGIN_X,
  VIEW_MARGIN_Y,
  formatAffinity,
  layoutLabels,
  truncateLabel,
  type NodePosition,
  type ShapeKind,
  type VisibleGraph,
} from "@/lib/explorer/model";
import { cn } from "@/lib/cn";
import "./constellation.css";

const STARS = Array.from({ length: 28 }, (_, i) => {
  // Deterministic scatter: the same sky on every render and on the server.
  const a = (i * 137.508 * Math.PI) / 180;
  const r = 120 + ((i * 53) % 400);
  return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a), s: 1 + (i % 3) * 0.6 };
});

/**
 * SVG <image> bypasses next/image, so request the same optimiser endpoint by
 * hand. Widths must be in Next's default `imageSizes`.
 */
function optimizedImage(url: string, width: 128 | 256): string {
  return `/_next/image?${new URLSearchParams({ url, w: String(width), q: "75" })}`;
}

export function NodeShape({ shape, r }: { shape: ShapeKind; r: number }) {
  switch (shape) {
    case "square":
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} />;
    case "diamond":
      return <polygon points={`0,${-r * 1.25} ${r * 1.25},0 0,${r * 1.25} ${-r * 1.25},0`} />;
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${(r * 1.1 * Math.cos(a)).toFixed(1)},${(r * 1.1 * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      return <polygon points={pts} />;
    }
    default:
      return <circle r={r} />;
  }
}

interface ConstellationProps {
  graph: CulturalGraph;
  visible: VisibleGraph;
  positions: Map<string, NodePosition>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}

/**
 * Radial SVG constellation. Nodes show the provider's image clipped to their
 * category shape, or the bare shape when no image exists. Nodes are
 * keyboard-focusable buttons; arrow keys move between them and Escape clears
 * the selection. The same data is available as a list.
 */
export function Constellation({
  graph,
  visible,
  positions,
  selectedId,
  onSelect,
  onClear,
}: ConstellationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rootNode = graph.nodes.find((n) => n.id === graph.rootId);
  const labels = useMemo(() => layoutLabels(graph, positions), [graph, positions]);

  const edgeByNode = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const edge of visible.edges) {
      map.set(edge.source === graph.rootId ? edge.target : edge.source, edge.affinity);
    }
    return map;
  }, [visible.edges, graph.rootId]);

  function onKeyDown(event: KeyboardEvent<SVGGElement>, node: CulturalNode) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(node.id);
      return;
    }
    if (event.key === "Escape") {
      onClear();
      return;
    }
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const items = Array.from(svgRef.current?.querySelectorAll<SVGGElement>("[data-node]") ?? []);
    const index = items.indexOf(event.currentTarget);
    items[(index + delta + items.length) % items.length]?.focus();
  }

  const clip = (shape: string) => `url(#${uid}-clip-${shape})`;

  return (
    <svg
      ref={svgRef}
      viewBox={`${-VIEW_MARGIN_X} ${-VIEW_MARGIN_Y} ${VIEWBOX + VIEW_MARGIN_X * 2} ${VIEWBOX + VIEW_MARGIN_Y * 2}`}
      role="group"
      aria-label={`Cultural constellation for ${rootNode?.name ?? "the selected artist"}. Use Tab or the arrow keys to move between nodes and Enter to select one. A list view is also available.`}
      className="mx-auto h-auto w-full select-none"
    >
      <defs>
        <radialGradient id={`${uid}-atmosphere`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-forest)" stopOpacity="0.5" />
          <stop offset="55%" stopColor="var(--color-forest)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-night)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip-root`}>
          <circle r={ROOT_RADIUS} />
        </clipPath>
        <clipPath id={`${uid}-clip-circle`}>
          <circle r={NODE_RADIUS} />
        </clipPath>
        <clipPath id={`${uid}-clip-square`}>
          <rect x={-NODE_RADIUS} y={-NODE_RADIUS} width={NODE_RADIUS * 2} height={NODE_RADIUS * 2} />
        </clipPath>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={480} fill={`url(#${uid}-atmosphere)`} aria-hidden="true" />

      <g aria-hidden="true" className="text-mint">
        {STARS.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.s}
            fill="currentColor"
            className="constellation-star"
            style={{ "--i": i } as CSSProperties}
            opacity={0.35}
          />
        ))}
        {RING_RADII.map((radius, i) => (
          <circle
            key={radius}
            cx={CENTER}
            cy={CENTER}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.14}
            strokeDasharray={i === 1 ? "2 10" : "1 7"}
            className="constellation-ring"
            data-reverse={i === 1}
          />
        ))}
      </g>

      <g aria-hidden="true" className="text-vibrant">
        {visible.edges.map((edge, i) => {
          const other = edge.source === graph.rootId ? edge.target : edge.source;
          const to = positions.get(other);
          if (!to) return null;
          const active = selectedId === other;
          return (
            <line
              key={edge.id}
              x1={CENTER}
              y1={CENTER}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeWidth={active ? 2.5 : 1.25}
              strokeOpacity={active ? 0.85 : 0.28}
              // Dashed means cultural affinity, the same pattern as the evidence badge.
              strokeDasharray="4 6"
              className="constellation-edge"
              style={{ "--i": i } as CSSProperties}
            />
          );
        })}
      </g>

      {visible.nodes.map((node, i) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const isRoot = node.id === graph.rootId;
        const meta = CATEGORY_META[node.category];
        const r = isRoot ? ROOT_RADIUS : NODE_RADIUS;
        const shape: ShapeKind = isRoot ? "circle" : meta.shape;
        const imageClip = isRoot ? "root" : shape === "circle" || shape === "square" ? shape : null;
        const image = node.image && imageClip ? node.image.url : null;
        const selected = selectedId === node.id;
        const label = labels.get(node.id);
        const rightSide = (label?.anchor ?? (pos.x >= CENTER ? "start" : "end")) === "start";
        const affinity = isRoot ? null : (edgeByNode.get(node.id) ?? null);
        const description = isRoot
          ? `${node.name}, root artist`
          : `${node.name}, ${meta.label}, Qloo cultural affinity ${formatAffinity(affinity)}`;
        return (
          <g key={node.id} transform={`translate(${pos.x} ${pos.y})`}>
            <g className="constellation-enter" style={{ "--i": i } as CSSProperties}>
              <g className="constellation-float" style={{ "--i": i } as CSSProperties}>
                <g
                  data-node
                  data-root={isRoot}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={description}
                  className={cn("constellation-node", meta.tone)}
                  onClick={() => onSelect(node.id)}
                  onKeyDown={(event) => onKeyDown(event, node)}
                >
                  <title>{node.name}</title>
                  {isRoot ? (
                    <circle r={r * 1.55} fill="none" stroke="currentColor" strokeOpacity={0.3} className="constellation-halo" />
                  ) : null}
                  <g className="node-ring" fill="none" stroke="currentColor" strokeWidth={2}>
                    <NodeShape shape={shape} r={r + 9} />
                  </g>
                  <g fill="var(--color-surface-2)">
                    <NodeShape shape={shape} r={r} />
                  </g>
                  {image && imageClip ? (
                    <g clipPath={clip(imageClip)}>
                      <image
                        href={optimizedImage(image, isRoot ? 256 : 128)}
                        x={-r}
                        y={-r}
                        width={r * 2}
                        height={r * 2}
                        preserveAspectRatio="xMidYMid slice"
                        className="constellation-image"
                      />
                    </g>
                  ) : null}
                  <g fill="none" stroke="currentColor" strokeWidth={isRoot ? 3 : 2}>
                    <NodeShape shape={shape} r={r} />
                  </g>
                  {!image ? (
                    isRoot ? (
                      <circle r={r * 0.3} fill="currentColor" />
                    ) : (
                      <g fill="currentColor" opacity={0.85}>
                        <NodeShape shape={shape} r={r * 0.32} />
                      </g>
                    )
                  ) : null}
                  <text
                    x={isRoot ? 0 : rightSide ? LABEL_GAP : -LABEL_GAP}
                    y={isRoot ? r + 52 : LABEL_FONT / 3}
                    textAnchor={isRoot ? "middle" : rightSide ? "start" : "end"}
                    fill="var(--color-text)"
                    fontSize={isRoot ? 42 : LABEL_FONT}
                    fontWeight={isRoot ? 800 : 600}
                    className="constellation-label"
                  >
                    {isRoot ? truncateLabel(node.name, 26) : (label?.text ?? truncateLabel(node.name, 12))}
                  </text>
                </g>
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
