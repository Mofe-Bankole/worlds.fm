"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useExplorer } from "@/components/explorer-context";
import { ARTISTS } from "@/content/landing";

/** What the artist discovery section is currently showing. */
export type DiscoveryView =
  | { kind: "artist"; id: string }
  | { kind: "sample"; id: string }
  | { kind: "empty"; query: string };

interface LandingStateValue {
  view: DiscoveryView;
  /** Open an artist from the carousel or the artist picker. */
  enterArtist: (id: string) => void;
}

const LandingStateContext = createContext<LandingStateValue | null>(null);

function scrollToDiscovery() {
  const target = document.getElementById("discovery");
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/**
 * Bridges the existing search (ExplorerProvider, unchanged) and the carousel
 * to one discovery view. Whichever the visitor used last wins: searching
 * replaces a carousel pick, and a carousel pick replaces a search result.
 */
export function LandingStateProvider({ children }: { children: ReactNode }) {
  const { world, status, query } = useExplorer();
  const [view, setView] = useState<DiscoveryView>({
    kind: "artist",
    id: ARTISTS[0].id,
  });

  // Follow the explorer when its result changes. Adjusting state during
  // render avoids an effect and the extra paint it would cause.
  const explorerKey = `${status}|${world.id}|${query}`;
  const [seenKey, setSeenKey] = useState(explorerKey);
  if (seenKey !== explorerKey) {
    setSeenKey(explorerKey);
    if (status === "match") {
      const known = ARTISTS.some((artist) => artist.id === world.id);
      setView({ kind: known ? "artist" : "sample", id: world.id });
    } else if (status === "empty") {
      const needle = query.toLowerCase();
      const featured = ARTISTS.find((artist) =>
        artist.name.toLowerCase().includes(needle),
      );
      setView(
        featured
          ? { kind: "artist", id: featured.id }
          : { kind: "empty", query },
      );
    }
  }

  const enterArtist = useCallback((id: string) => {
    setView({ kind: "artist", id });
    scrollToDiscovery();
  }, []);

  const value = useMemo(() => ({ view, enterArtist }), [view, enterArtist]);

  return (
    <LandingStateContext.Provider value={value}>
      {children}
    </LandingStateContext.Provider>
  );
}

export function useLandingState(): LandingStateValue {
  const value = useContext(LandingStateContext);
  if (!value) {
    throw new Error("useLandingState must be used within LandingStateProvider");
  }
  return value;
}
