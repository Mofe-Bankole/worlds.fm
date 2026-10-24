"use client";

import Image from "next/image";
import type { CulturalGraph } from "@worlds/shared";
import { CATEGORY_META, formatAffinity, presentCategories, type VisibleGraph } from "@/lib/explorer/model";
import { BASIS } from "@/lib/connection-basis";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "./shape-icon";

interface NodeListProps {
  graph: CulturalGraph;
  visible: VisibleGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Full list alternative to the constellation: same data, no spatial reading needed. */
export function NodeList({ graph, visible, selectedId, onSelect }: NodeListProps) {
  const edges = new Map(
    visible.edges.map((e) => [e.source === graph.rootId ? e.target : e.source, e] as const),
  );
  const root = graph.nodes.find((n) => n.id === graph.rootId);
  return (
    <div className="space-y-6">
      {root ? (
        <button
          type="button"
          aria-pressed={selectedId === root.id}
          onClick={() => onSelect(root.id)}
          className={cn(
            "flex w-full items-center gap-3 border px-4 py-3 text-left",
            selectedId === root.id ? "border-electric bg-surface-2" : "border-line-strong bg-surface-1",
          )}
        >
          <CategoryIcon category={root.category} className="size-5" />
          <span className="flex-1">
            <span className="block text-base font-bold text-text">{root.name}</span>
            <span className="type-eyebrow text-text-2">Root artist</span>
          </span>
        </button>
      ) : null}
      {presentCategories(graph).map(({ category }) => {
        const nodes = visible.nodes.filter((n) => n.category === category && n.id !== graph.rootId);
        if (nodes.length === 0) return null;
        return (
          <section key={category} aria-label={CATEGORY_META[category].plural}>
            <h3 className="type-eyebrow mb-2 flex items-center gap-2 text-text-2">
              <CategoryIcon category={category} />
              {CATEGORY_META[category].plural}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {nodes.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    aria-pressed={selectedId === node.id}
                    onClick={() => onSelect(node.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border px-4 py-3 text-left transition-colors",
                      selectedId === node.id
                        ? "border-electric bg-surface-2"
                        : "border-line-strong bg-surface-1 hover:bg-surface-2",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {node.image ? (
                        <Image src={node.image.url} alt="" width={36} height={36} className="size-9 shrink-0 object-cover" />
                      ) : (
                        <span className="grid size-9 shrink-0 place-items-center bg-surface-2">
                          <CategoryIcon category={node.category} />
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold text-text">{node.name}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-text-2">
                      <span className="block text-text">
                        {BASIS[edges.get(node.id)?.basis.kind ?? "audience_overlap"].label}
                      </span>
                      <span className="block">Affinity {formatAffinity(edges.get(node.id)?.affinity ?? null)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
