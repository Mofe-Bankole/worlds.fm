"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchArtistGraph, type DiscoveryFetchResult } from "@/lib/api/discovery";

export type GraphState =
  | { phase: "idle" }
  | { phase: "loading"; query: string }
  | { phase: "done"; query: string; result: Exclude<DiscoveryFetchResult, { kind: "aborted" }> };

/**
 * Loads one artist graph at a time. Starting a new search aborts the previous
 * request, and a response is applied only if it still belongs to the newest
 * search, so a slow older answer can never replace a newer one.
 */
export function useArtistGraph() {
  const [state, setState] = useState<GraphState>({ phase: "idle" });
  const latest = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    latest.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);

  const search = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      cancel();
      if (!query) {
        setState({ phase: "idle" });
        return;
      }
      const id = latest.current;
      const abort = new AbortController();
      controller.current = abort;
      setState({ phase: "loading", query });
      const result = await fetchArtistGraph(query, { signal: abort.signal });
      if (id !== latest.current || result.kind === "aborted") return;
      setState({ phase: "done", query, result });
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);

  return { state, search, cancel };
}
