"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CulturalCategory, CulturalDiscoveryResponse, CulturalGraph, EvidenceKind } from "@worlds/shared";
import { OrbitEdges, type OrbitItem } from "@/components/primitives/orbit-edges";
import {
  edgeForNode,
  filterGraph,
  layoutConstellation,
  presentCategories,
  presentEvidence,
  strongestNeighbour,
} from "@/lib/explorer/model";
import { useArtistGraph } from "@/lib/explorer/use-artist-graph";
import { useArtistImages } from "@/lib/use-artist-images";
import { FEATURED_QUERIES } from "@/content/featured-worlds";
import { cn } from "@/lib/cn";
import { Discography } from "@/components/music/discography";
import { ArtistSearchForm } from "./artist-search-form";
import { ArtistConnections } from "./artist-connections";
import { Constellation } from "./constellation";
import { Filters } from "./filters";
import { HintCard, NodeCard, RootCard } from "./node-detail";
import { NodeList } from "./node-list";
import {
  DisambiguationPanel,
  ErrorPanel,
  IdlePanel,
  LoadingPanel,
  NotFoundPanel,
  PartialNotice,
} from "./state-panels";

type View = "constellation" | "list";

/** Content width the edge dials must stay clear of. */
const CONTENT_WIDTH = "80rem";

export function ExplorerApp() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const { state, search } = useArtistGraph();
  // Same names as the landing page, so a visitor coming from there reuses its lookup.
  const featuredImages = useArtistImages(FEATURED_QUERIES);
  const featured = useMemo(() => {
    const pictured = featuredImages.filter((item) => item.imageUrl);
    return pictured.length > 0 ? pictured : featuredImages;
  }, [featuredImages]);

  useEffect(() => {
    void search(q);
  }, [q, search]);

  const submit = useCallback(
    (query: string) => {
      if (query === q) void search(query);
      else router.push(`${pathname}?${new URLSearchParams({ q: query })}`);
    },
    [pathname, q, router, search],
  );

  const data = state.phase === "done" && state.result.kind === "ok" ? state.result.data : null;
  const graph = data?.graph ?? null;
  const showGraph = Boolean(data && graph && (data.status === "complete" || data.status === "partial"));

  const orbitItems = useMemo<OrbitItem[]>(() => {
    if (!graph || !showGraph) return featured;
    const withImages = graph.nodes
      .filter((n) => n.category === "artist" && n.image)
      .map((n) => ({ key: n.id, name: n.name, imageUrl: n.image?.url ?? null }));
    return withImages;
  }, [graph, showGraph, featured]);

  return (
    <div className="relative isolate">
      <OrbitEdges items={orbitItems} contentWidth={CONTENT_WIDTH} fixed className="min-[1360px]:block" />
      <div className="mx-auto w-full max-w-[var(--layout-max)] px-[var(--layout-gutter)] pb-20">
        <div
          className={cn(
            "mx-auto flex max-w-2xl flex-col items-center gap-4 text-center",
            state.phase === "idle" ? "pt-16 sm:pt-24" : "pt-2",
          )}
        >
          {state.phase === "idle" ? (
            <>
              <p className="type-eyebrow text-vibrant">Cultural world explorer</p>
              <h1 className="text-4xl font-extrabold tracking-[-0.04em] text-text sm:text-6xl">
                Explore the world around an artist
              </h1>
            </>
          ) : (
            <h1 className="sr-only">Cultural world explorer</h1>
          )}
          <ArtistSearchForm key={q} initialQuery={q} busy={state.phase === "loading"} onSubmit={submit} />
        </div>

        <div aria-live="polite" className="sr-only">
          {state.phase === "loading" ? `Loading ${state.query}` : null}
          {graph ? `Loaded ${graph.nodes.length} nodes and ${graph.edges.length} connections for ${data?.root?.name}.` : null}
        </div>

        <div className="mt-8">
          {state.phase === "idle" ? <IdlePanel onPick={submit} /> : null}
          {state.phase === "loading" ? <LoadingPanel query={state.query} /> : null}
          {state.phase === "done" && state.result.kind === "error" ? (
            <ErrorPanel
              message={state.result.message}
              retryable={state.result.retryable}
              onRetry={() => void search(state.query)}
            />
          ) : null}
          {data?.status === "not_found" ? <NotFoundPanel query={data.query} /> : null}
          {data?.status === "needs_disambiguation" ? <DisambiguationPanel data={data} onSearchName={submit} /> : null}
          {data && graph && showGraph ? (
            // Keyed by the root so selection and filters reset for each new graph.
            <GraphView key={graph.rootId} data={data} graph={graph} onSearchName={submit} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GraphView({
  data,
  graph,
  onSearchName,
}: {
  data: CulturalDiscoveryResponse;
  graph: CulturalGraph;
  onSearchName: (name: string) => void;
}) {
  const categories = useMemo(() => presentCategories(graph), [graph]);
  const evidence = useMemo(() => presentEvidence(graph), [graph]);
  const positions = useMemo(() => layoutConstellation(graph), [graph]);
  const [activeCategories, setActiveCategories] = useState<Set<CulturalCategory>>(
    () => new Set(categories.map((c) => c.category)),
  );
  const [activeEvidence, setActiveEvidence] = useState<Set<EvidenceKind>>(
    () => new Set(evidence.map((e) => e.kind)),
  );
  const [selectedId, setSelectedId] = useState<string>(() => strongestNeighbour(graph) ?? graph.rootId);
  const [view, setView] = useState<View>("constellation");
  const detailRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => filterGraph(graph, { categories: activeCategories, evidence: activeEvidence }),
    [graph, activeCategories, activeEvidence],
  );
  const root = graph.nodes.find((n) => n.id === graph.rootId);
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? root;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detailRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    }
  }, []);

  function toggle<T>(set: Set<T>, value: T, apply: (next: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  }

  if (!root || !selected) return null;
  const hiddenSelection = !visible.nodes.some((n) => n.id === selected.id);
  const toggleView = () => setView((v) => (v === "constellation" ? "list" : "constellation"));

  return (
    <div className="space-y-6">
      <PartialNotice data={data} />
      <ArtistConnections graph={graph} onSelect={select} />
      <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[16.5rem_minmax(0,1fr)_16.5rem] xl:gap-5">
        <div className="md:order-2 xl:order-1 xl:sticky xl:top-6">
          <RootCard graph={graph} node={root} view={view} onToggleView={toggleView} />
        </div>

        <div className="min-w-0 md:order-1 md:col-span-2 xl:order-2 xl:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Filters
              categories={categories}
              evidence={evidence}
              activeCategories={activeCategories}
              activeEvidence={activeEvidence}
              onToggleCategory={(c) => toggle(activeCategories, c, setActiveCategories)}
              onToggleEvidence={(k) => toggle(activeEvidence, k, setActiveEvidence)}
            />
            <div role="group" aria-label="View" className="inline-flex border border-line-strong">
              {(["constellation", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                    view === v ? "bg-text text-night" : "text-text-2 hover:text-text",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {view === "constellation" ? (
              <>
                <Constellation
                  graph={graph}
                  visible={visible}
                  positions={positions}
                  selectedId={hiddenSelection ? null : selected.id}
                  onSelect={select}
                  onClear={() => setSelectedId(graph.rootId)}
                />
                <p className="mt-2 text-center text-xs text-text-3">
                  {visible.nodes.length - 1} of {graph.nodes.length - 1} shown · Inner ring holds the strongest Qloo
                  affinities · Dashed lines mean cultural affinity, not documented history
                </p>
              </>
            ) : (
              <NodeList graph={graph} visible={visible} selectedId={selected.id} onSelect={select} />
            )}
          </div>
        </div>

        <div ref={detailRef} className="md:order-3 xl:sticky xl:top-6">
          {selected.id === root.id ? (
            <HintCard root={root} />
          ) : (
            <NodeCard root={root} node={selected} edge={edgeForNode(graph, selected.id)} onSearchName={onSearchName} />
          )}
        </div>
      </div>
      <Discography artistName={root.name} onSearchName={onSearchName} />
    </div>
  );
}
