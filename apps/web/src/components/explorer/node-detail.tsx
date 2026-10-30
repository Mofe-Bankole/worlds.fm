"use client";

import type { CulturalEdge, CulturalGraph, CulturalNode } from "@worlds/shared";
import { BasisBadge } from "@/components/primitives/basis-badge";
import { SignalAction, SignalCard } from "@/components/primitives/signal-card";
import { StripedImage } from "@/components/primitives/striped-image";
import { ShareControl } from "@/components/share/share-control";
import { CATEGORY_META, describeCounts, firstSentence, formatAffinity } from "@/lib/explorer/model";
import { worldShareTarget } from "@/lib/share";
import { CategoryIcon } from "./shape-icon";
import { NodeShape } from "./constellation";

function CardHeader({ node, right }: { node: CulturalNode; right?: React.ReactNode }) {
  return (
    <>
      <p className="type-eyebrow flex items-center gap-2 text-text">
        <CategoryIcon category={node.category} />
        {CATEGORY_META[node.category].label}
      </p>
      {right}
    </>
  );
}

/** Bars drawn in the category shape for entities without an image. */
function ShapeFallback({ node }: { node: CulturalNode }) {
  const meta = CATEGORY_META[node.category];
  return (
    <div className={`absolute inset-0 grid place-items-center ${meta.tone}`}>
      <svg viewBox="-60 -60 120 120" className="h-3/4 w-auto" aria-hidden="true">
        <defs>
          <pattern id={`bars-${meta.shape}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="3" height="6" fill="currentColor" opacity="0.7" />
          </pattern>
        </defs>
        <g fill={`url(#bars-${meta.shape})`} stroke="currentColor" strokeOpacity="0.5">
          <NodeShape shape={meta.shape} r={40} />
        </g>
      </svg>
    </div>
  );
}

function ImageCredit({ node }: { node: CulturalNode }) {
  return node.image ? <span className="text-[0.6875rem] text-text-2">Image via Qloo</span> : null;
}

export function RootCard({
  graph,
  node,
  view,
  onToggleView,
}: {
  graph: CulturalGraph;
  node: CulturalNode;
  view: "constellation" | "list";
  onToggleView: () => void;
}) {
  const summary = firstSentence(node.description);
  return (
    <SignalCard
      tone="forest"
      as="section"
      aria-label={`About ${node.name}`}
      header={<CardHeader node={node} right={<ImageCredit node={node} />} />}
      media={
        <StripedImage src={node.image?.url ?? null} alt={`${node.name}`} fallback={<ShapeFallback node={node} />} />
      }
      statement={
        <>
          <span className="font-extrabold">{node.name}</span>’s world reaches {describeCounts(graph)}.
        </>
      }
      action={
        <div className="space-y-3">
          {/* The World is addressed by the resolved artist name, so a shared
              link reopens this same world rather than the raw search text. */}
          <ShareControl
            subject={node.name}
            buildTarget={(origin) => worldShareTarget(node.name, origin)}
          />
          <SignalAction onClick={onToggleView}>
            {view === "constellation" ? "View as a list" : "View the constellation"}
          </SignalAction>
        </div>
      }
    >
      {summary ? <p className="type-small text-text-2">{summary}</p> : null}
      {node.tags.length > 0 ? (
        <p className="text-xs text-mint/80">{node.tags.slice(0, 3).join(" · ")}</p>
      ) : null}
    </SignalCard>
  );
}

export function NodeCard({
  root,
  node,
  edge,
  onSearchName,
}: {
  root: CulturalNode;
  node: CulturalNode;
  edge: CulturalEdge | undefined;
  /** Starts a new name search; the identity is resolved again. */
  onSearchName: (name: string) => void;
}) {
  const summary = firstSentence(node.description, 220);
  const placeLike = node.category === "destination" || node.category === "place";
  return (
    <SignalCard
      as="aside"
      aria-labelledby="node-card-title"
      header={
        <CardHeader
          node={node}
          right={
            edge ? (
              <span className="font-mono text-xs text-text-2">
                Affinity <span className="text-text">{formatAffinity(edge.affinity)}</span>
              </span>
            ) : null
          }
        />
      }
      media={
        <StripedImage src={node.image?.url ?? null} alt={`${node.name}`} fallback={<ShapeFallback node={node} />} />
      }
      statement={
        <>
          <span id="node-card-title" className="block font-extrabold">
            {node.name}
          </span>
          <span className="text-text-2">
            {edge ? edge.basis.statement : `This is the root of ${root.name}’s world.`}
          </span>
        </>
      }
      action={
        node.category === "artist" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <SignalAction onClick={() => onSearchName(node.name)}>Explore {node.name}’s world</SignalAction>
              <p className="text-[0.6875rem] text-text-3">Starts a new search by name.</p>
            </div>
            {/* Only artists have a World to open, so only artists are shareable. */}
            <ShareControl
              subject={node.name}
              buildTarget={(origin) => worldShareTarget(node.name, origin)}
              note="Anyone with this link sees this artist’s world. Nothing personal is included."
            />
          </div>
        ) : null
      }
    >
      {summary ? <p className="type-small line-clamp-4 text-text-2">{summary}</p> : null}
      {/* Which rung of the evidence ladder this link sits on, and the values
          behind it, so a shared trait is never read as a documented link. */}
      {edge ? (
        <div className="space-y-2">
          <BasisBadge basis={edge.basis} />
          {edge.researchStatus === "declined" ? (
            <p className="type-small text-text-2">
              Sources checked; no documented connection established from those sources. This remains a Qloo affinity.
            </p>
          ) : null}
          {edge.basis.shared.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {edge.basis.shared.map((value) => (
                <li
                  key={value}
                  className="border border-line-strong px-2 py-0.5 text-[0.6875rem] text-text-2"
                >
                  {value}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-xs text-text-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-mint">
          <span aria-hidden="true" className="inline-block w-5 border-t border-dashed border-current" />
          Cultural affinity
        </span>
        <span>
          A Qloo audience signal, not verified history or endorsement.
          {placeLike ? " Not a verified location." : ""}
        </span>
        <ImageCredit node={node} />
      </p>
    </SignalCard>
  );
}

export function HintCard({ root }: { root: CulturalNode }) {
  return (
    <SignalCard
      as="aside"
      header={<p className="type-eyebrow text-text-2">Selection</p>}
      statement={<span className="text-text-2">Select a node to see how it connects to {root.name}.</span>}
    >
      <p className="type-small text-text-3">Use Tab or the arrow keys, then Enter. Escape clears the selection.</p>
    </SignalCard>
  );
}
