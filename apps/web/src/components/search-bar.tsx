"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useExplorer } from "@/components/explorer-context";
import { GlassSurface } from "@/components/primitives/glass-surface";
import { cn } from "@/lib/cn";

interface SearchBarProps {
  className?: string;
  id?: string;
  size?: "lg" | "md";
}

export function SearchBar({ className, id = "worlds-search", size = "lg" }: SearchBarProps) {
  const { explore } = useExplorer();
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    explore(value);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn("group w-full", className)}
    >
      <label htmlFor={id} className="sr-only">
        Search an artist
      </label>
      <GlassSurface
        radius="full"
        tone="strong"
        className={cn(
          "flex items-center gap-3 pl-6 pr-2 transition duration-300",
          "focus-within:shadow-glow-lg",
          size === "lg" ? "py-2" : "py-1.5",
        )}
      >
        <Search
          aria-hidden="true"
          className={cn(
            "shrink-0 text-text-2 transition-colors duration-300 group-focus-within:text-electric",
            size === "lg" ? "size-5" : "size-4",
          )}
        />
        <input
          id={id}
          name="q"
          type="search"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search an artist"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-text placeholder:text-text-2 focus:outline-none",
            size === "lg" ? "py-3 text-base sm:text-lg" : "py-1.5 text-sm",
          )}
        />
        <button
          type="submit"
          aria-label="Explore this world"
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-electric text-on-accent transition duration-300",
            "hover:bg-fresh hover:shadow-glow-sm active:scale-95",
            size === "lg" ? "size-12" : "size-9",
          )}
        >
          <ArrowRight
            aria-hidden="true"
            className={size === "lg" ? "size-5" : "size-4"}
          />
        </button>
      </GlassSurface>
    </form>
  );
}
