"use client";

import type { CulturalDiscoveryResponse } from "@worlds/shared";
import { GlassSurface } from "@/components/primitives/glass-surface";

/** Example searches only. They are queries, not data: nothing here is shown as a result. */
export const EXAMPLE_QUERIES = ["Avicii", "Fela Kuti", "Rihanna", "Bob Marley"] as const;

export function IdlePanel({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="space-y-4 pt-1">
      <p className="type-small mx-auto max-w-md text-text-2">
        Search an artist to see the cultural world Qloo connects around them: related artists, brands and destinations.
      </p>
      <ul className="flex flex-wrap justify-center gap-2" aria-label="Example searches">
        {EXAMPLE_QUERIES.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="rounded-full border border-line-strong px-4 py-2 text-sm text-text-2 transition-colors hover:border-electric hover:text-text"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LoadingPanel({ query }: { query: string }) {
  return (
    <div role="status" aria-live="polite" className="grid place-items-center gap-6 py-24">
      <div aria-hidden="true" className="relative size-40">
        <span className="absolute inset-0 animate-spin-slow border border-dashed border-line-strong" />
        <span className="absolute inset-6 animate-spin-slow border border-dashed border-line-strong [animation-direction:reverse]" />
        {/* The centre holds still while the rings turn, so the state reads as "working", not "pulsing". */}
        <span className="absolute inset-[4.75rem] rounded-full bg-mint/25" />
      </div>
      <p className="type-small text-text-2">Mapping the cultural world of “{query}”…</p>
    </div>
  );
}

export function ErrorPanel({
  message,
  retryable,
  onRetry,
}: {
  message: string;
  retryable: boolean;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <h2 className="text-xl font-bold text-text">We couldn’t load this world</h2>
      <p className="type-small text-text-2">{message}</p>
      {retryable ? (
        <button
          type="button"
          onClick={onRetry}
          className="bg-electric px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-fresh"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function NotFoundPanel({ query }: { query: string }) {
  return (
    <div role="status" className="mx-auto max-w-xl space-y-3 py-16 text-center">
      <h2 className="text-xl font-bold text-text">No artist found for “{query}”</h2>
      <p className="type-small text-text-2">
        Qloo has no matching artist. Check the spelling or try another name. Nothing has been guessed or substituted.
      </p>
    </div>
  );
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function DisambiguationPanel({
  data,
  onSearchName,
}: {
  data: CulturalDiscoveryResponse;
  onSearchName: (name: string) => void;
}) {
  const counts = new Map<string, number>();
  for (const candidate of data.candidates) {
    const key = normalize(candidate.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (
    <GlassSurface tone="strong" className="mx-auto max-w-2xl space-y-5 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-bold text-text">
          {data.resolution === "ambiguous"
            ? `More than one artist is called “${data.query}”`
            : `No artist matched “${data.query}” exactly`}
        </h2>
        <p className="type-small text-text-2">
          {data.resolution === "ambiguous"
            ? "We won’t guess which one you meant."
            : "These are Qloo’s closest matches, not confirmed results."}{" "}
          Choosing a name starts a new search.
        </p>
      </header>
      <ul className="space-y-2">
        {data.candidates.map((candidate) => {
          const duplicate = (counts.get(normalize(candidate.name)) ?? 0) > 1;
          const detail = candidate.disambiguation ?? candidate.description;
          return (
            <li
              key={candidate.id}
              className="flex items-center justify-between gap-4 border border-line-strong bg-surface-1 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{candidate.name}</p>
                {detail ? <p className="line-clamp-2 text-xs text-text-2">{detail}</p> : null}
                {duplicate ? (
                  <p className="mt-1 text-xs text-text-3">
                    Several entities share this exact name. Choosing by ID is not supported yet, so it can’t be searched
                    unambiguously.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={duplicate}
                onClick={() => onSearchName(candidate.name)}
                className="shrink-0 border border-line-strong px-4 py-2 text-sm text-text transition-colors enabled:hover:border-electric disabled:cursor-not-allowed disabled:opacity-40"
              >
                Search this name
              </button>
            </li>
          );
        })}
      </ul>
    </GlassSurface>
  );
}

export function PartialNotice({ data }: { data: CulturalDiscoveryResponse }) {
  const failed = data.warnings.filter((w) => w.code === "category_unavailable");
  if (failed.length === 0) return null;
  return (
    <div
      role="status"
      className="border border-dashed border-line-strong bg-surface-1 px-4 py-3 text-sm text-text-2"
    >
      <p className="font-semibold text-text">Partial result</p>
      <p>
        Some connections are missing: {failed.map((w) => w.category ?? "unknown").join(", ")} could not be loaded. What
        is shown is accurate but incomplete. Try again in a few minutes.
      </p>
    </div>
  );
}
