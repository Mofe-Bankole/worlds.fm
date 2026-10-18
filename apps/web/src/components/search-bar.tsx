"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useExplorer } from "@/components/explorer-context";
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
        Search an artist, song, or cultural movement
      </label>
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] pl-5 pr-2 backdrop-blur-xl transition duration-300",
          "focus-within:border-electric/50 focus-within:bg-white/[0.06]",
          "focus-within:shadow-[0_0_70px_-16px_rgba(190,255,85,0.55)]",
          size === "lg" ? "py-2.5" : "py-1.5",
        )}
      >
        <Search
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted transition-colors duration-300 group-focus-within:text-electric",
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
          placeholder="Search an artist, song, or cultural movement..."
          className={cn(
            "min-w-0 flex-1 bg-transparent text-cloud placeholder:text-muted/80 focus:outline-none",
            size === "lg" ? "py-2.5 text-base sm:text-lg" : "py-1.5 text-sm",
          )}
        />
        <button
          type="submit"
          aria-label="Explore this world"
          className={cn(
            "grid shrink-0 place-items-center rounded-xl bg-brand text-ink transition duration-300",
            "hover:bg-electric hover:shadow-[0_0_28px_-4px_rgba(190,255,85,0.9)]",
            "active:scale-95",
            size === "lg" ? "size-12" : "size-9",
          )}
        >
          <ArrowRight
            aria-hidden="true"
            className={size === "lg" ? "size-5" : "size-4"}
          />
        </button>
      </div>
    </form>
  );
}
