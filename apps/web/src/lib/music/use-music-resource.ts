"use client";

import { useCallback, useEffect, useState } from "react";
import type { MusicResult } from "@/lib/api/music";

type Settled<T> = Exclude<MusicResult<T>, { kind: "aborted" }>;

/** Successful answers only, so a failed lookup is retried next time it is opened. */
const answers = new Map<string, Settled<unknown>>();
const MAX_ANSWERS = 120;

export type ResourceState<T> = { phase: "idle" } | { phase: "loading" } | { phase: "done"; result: Settled<T> };

/**
 * Loads one music resource per key. Changing the key aborts the previous
 * request, and answers are kept for the session so reopening an album or a
 * track story is instant.
 */
export function useMusicResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<MusicResult<T>>,
): { state: ResourceState<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ token: string; result: Settled<T> } | null>(null);
  const token = key === null ? null : `${key}#${attempt}`;
  const cached = key === null ? undefined : (answers.get(key) as Settled<T> | undefined);

  useEffect(() => {
    if (key === null || token === null || cached) return;
    const controller = new AbortController();
    void load(controller.signal).then((result) => {
      if (result.kind === "aborted" || controller.signal.aborted) return;
      if (result.kind === "ok") {
        if (answers.size >= MAX_ANSWERS) answers.delete(answers.keys().next().value as string);
        answers.set(key, result);
      }
      setSettled({ token, result });
    });
    return () => controller.abort();
    // `load` is recreated by callers each render; the key identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, cached]);

  const reload = useCallback(() => {
    if (key !== null) answers.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  let state: ResourceState<T>;
  if (key === null) state = { phase: "idle" };
  else if (cached) state = { phase: "done", result: cached };
  else if (settled && settled.token === token) state = { phase: "done", result: settled.result };
  else state = { phase: "loading" };
  return { state, reload };
}
