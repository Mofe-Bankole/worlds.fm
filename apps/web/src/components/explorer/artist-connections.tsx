"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ArtistConnectionResponse, CulturalGraph } from "@worlds/shared";
import { fetchArtistConnection } from "@/lib/api/discovery";
import { formatAffinity } from "@/lib/explorer/model";
import { useArtistImages } from "@/lib/use-artist-images";

/** The graph provides ranked candidates; images and read-only stories never block it. */
export function ArtistConnections({ graph, onSelect }: { graph: CulturalGraph; onSelect: (id: string) => void }) {
  const root = graph.nodes.find((node) => node.id === graph.rootId);
  const candidates = useMemo(() => graph.edges
    .filter((edge) => edge.source === graph.rootId && edge.provenance.provider === "qloo" &&
      edge.provenance.mode === "live" && graph.nodes.some((node) => node.id === edge.target && node.category === "artist"))
    .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1))
    .slice(0, 5)
    .map((edge) => ({ edge, node: graph.nodes.find((node) => node.id === edge.target)! })), [graph]);
  const names = useMemo(() => candidates.map(({ node }) => node.name), [candidates]);
  const images = useArtistImages(names);
  const [selected, setSelected] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ id: string; detail: ArtistConnectionResponse | null } | null>(null);

  useEffect(() => {
    if (!root || !selected) return;
    const node = candidates.find((candidate) => candidate.node.id === selected)?.node;
    if (!node) return;
    const abort = new AbortController();
    void fetchArtistConnection(root.name, node.name, { signal: abort.signal }).then((result) => {
      if (!abort.signal.aborted) {
        setLookup({ id: node.id, detail: result });
      }
    });
    return () => abort.abort();
  }, [selected, root, candidates]);

  if (!root || candidates.length === 0) return null;
  const active = candidates.find(({ node }) => node.id === selected)?.node;
  const loading = Boolean(active && lookup?.id !== active.id);
  const detail = lookup && lookup.id === active?.id ? lookup.detail : null;

  return (
    <section aria-label="Explore artist connections" className="space-y-4 border border-line-strong bg-surface-1 p-4 sm:p-6">
      <div>
        <p className="type-eyebrow text-mint">Artist paths</p>
        <h2 className="mt-1 text-xl font-bold text-text">Where could {root.name} lead?</h2>
        <p className="type-small text-text-2">
          Qloo ranks artists worth exploring. A shared audience is not evidence that they worked together.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {candidates.map(({ edge, node }) => {
          const image = node.image?.url ?? images.find((item) => item.name === node.name)?.imageUrl ?? null;
          return (
            <li key={node.id}>
              <button
                type="button"
                aria-pressed={selected === node.id}
                onClick={() => {
                  setSelected(node.id);
                  onSelect(node.id);
                }}
                className={`w-full border p-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-electric ${selected === node.id ? "border-electric" : "border-line-strong"}`}
              >
                <span className="relative block aspect-square overflow-hidden bg-surface-2">
                  {image ? <Image src={image} alt="" fill sizes="(max-width: 640px) 50vw, 13rem" className="object-cover" /> :
                    <span className="grid h-full place-items-center text-3xl text-mint" aria-hidden="true">♪</span>}
                </span>
                <span className="mt-2 block font-semibold text-text">{node.name}</span>
                <span className="block text-xs text-text-2">Qloo affinity {formatAffinity(edge.affinity)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <div aria-live="polite" className="space-y-3 border-t border-line pt-4">
          <h3 className="font-semibold text-text">{root.name} × {active.name}</h3>
          {loading ? <p className="type-small text-text-2">Checking published research…</p> : null}
          {!loading && !detail ? <p className="type-small text-text-2">Published research is temporarily unavailable. Qloo affinity is not proof of a connection.</p> : null}
          {detail?.status === "unresearched" ? <p className="type-small text-text-2">Not researched yet. No specific connection claimed.</p> : null}
          {detail?.status === "pending_review" ? <p className="type-small text-text-2">Research exists, but its claims have not passed editorial review. No story is published here yet.</p> : null}
          {detail?.research ? (
            <ol aria-label="How this result was reached" className="grid gap-2 sm:grid-cols-3">
              <li className="border border-line p-3 type-small text-text-2">
                <span className="type-eyebrow block text-mint">1 · Qloo selected</span>
                Qloo ranked {active.name} for {root.name} (affinity {formatAffinity(candidates.find(({ node }) => node.id === active.id)?.edge.affinity ?? null)}).
              </li>
              <li className="border border-line p-3 type-small text-text-2">
                <span className="type-eyebrow block text-mint">2 · Agent checked</span>
                {detail.research.consulted.join(", ")}
              </li>
              <li className="border border-line p-3 type-small text-text-2">
                <span className="type-eyebrow block text-mint">3 · Editor approved</span>
                {detail.research.approvedBy}{detail.reviewedAt ? ` · ${detail.reviewedAt}` : ""}
              </li>
            </ol>
          ) : null}
          {detail?.status === "declined" ? <p className="type-small text-text">No documented connection found in the sources checked. Worlds.fm says nothing more about this pair.</p> : null}
          {detail?.status === "documented" ? (
            <>
              <p className="type-eyebrow text-mint">Source-backed finding · checked {detail.reviewedAt}</p>
              <ul className="space-y-3">
                {detail.claims.map((claim) => (
                  <li key={claim.text} className="type-small text-text">
                    <p>{claim.text}</p>
                    <span className="flex flex-wrap gap-3">
                      {claim.citations.map((citation) => (
                        <a key={citation.sourceUrl} href={citation.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-mint underline underline-offset-2">{citation.sourceLabel}</a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
