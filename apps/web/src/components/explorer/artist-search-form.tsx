"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import { GlassSurface } from "@/components/primitives/glass-surface";

export function ArtistSearchForm({
  initialQuery,
  busy,
  onSubmit,
}: {
  initialQuery: string;
  busy: boolean;
  onSubmit: (query: string) => void;
}) {
  const [value, setValue] = useState(initialQuery);

  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={handle} role="search" className="w-full">
      <label htmlFor="explorer-search" className="sr-only">
        Search an artist
      </label>
      <GlassSurface
        radius="full"
        tone="strong"
        className="flex items-center gap-3 py-1.5 pl-5 pr-1.5 focus-within:shadow-glow-lg"
      >
        <Search aria-hidden="true" className="size-5 shrink-0 text-text-2" />
        <input
          id="explorer-search"
          name="q"
          type="search"
          autoComplete="off"
          maxLength={100}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search an artist"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-text placeholder:text-text-2 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-label="Explore this artist"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-electric text-on-accent transition hover:bg-fresh disabled:opacity-50"
        >
          <ArrowRight aria-hidden="true" className="size-5" />
        </button>
      </GlassSurface>
    </form>
  );
}
