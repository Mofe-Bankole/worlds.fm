"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SAMPLE_WORLDS,
  findSampleWorld,
  getSampleWorld,
  type SampleWorld,
} from "@/lib/sample-worlds";

export type DiscoveryStatus = "idle" | "match" | "empty";

interface ExplorerValue {
  /** The world currently shown in the discovery preview. */
  world: SampleWorld;
  status: DiscoveryStatus;
  /** Last submitted query (used for the empty state copy). */
  query: string;
  worlds: SampleWorld[];
  /** Resolve a query against the demo library and jump to the preview. */
  explore: (query: string) => boolean;
  /** Directly open a world by id. */
  select: (id: string) => void;
}

const ExplorerContext = createContext<ExplorerValue | null>(null);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollToPreview() {
  if (typeof document === "undefined") return;
  const target = document.getElementById("discovery");
  if (!target) return;
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

export function ExplorerProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<SampleWorld>(() => getSampleWorld("avicii"));
  const [status, setStatus] = useState<DiscoveryStatus>("idle");
  const [query, setQuery] = useState("");

  const explore = useCallback((value: string) => {
    const trimmed = value.trim();
    setQuery(trimmed);

    if (!trimmed) {
      setStatus("idle");
      scrollToPreview();
      return false;
    }

    const match = findSampleWorld(trimmed);
    if (match) {
      setWorld(match);
      setStatus("match");
      scrollToPreview();
      return true;
    }

    setStatus("empty");
    scrollToPreview();
    return false;
  }, []);

  const select = useCallback((id: string) => {
    setWorld(getSampleWorld(id));
    setQuery("");
    setStatus("match");
    scrollToPreview();
  }, []);

  const value = useMemo<ExplorerValue>(
    () => ({ world, status, query, worlds: SAMPLE_WORLDS, explore, select }),
    [world, status, query, explore, select],
  );

  return (
    <ExplorerContext.Provider value={value}>
      {children}
    </ExplorerContext.Provider>
  );
}

export function useExplorer(): ExplorerValue {
  const value = useContext(ExplorerContext);
  if (!value) {
    throw new Error("useExplorer must be used within an ExplorerProvider");
  }
  return value;
}
