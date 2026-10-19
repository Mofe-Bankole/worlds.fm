"use client";

import { useSyncExternalStore } from "react";

function createMediaStore(query: string, serverValue: boolean) {
  const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => serverValue;
  return () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * True when the visitor asked for reduced motion. The server snapshot is
 * `false`, so use this for behaviour inside effects and handlers. For layout
 * or markup differences prefer CSS media queries, which cannot mismatch on
 * hydration.
 */
export const usePrefersReducedMotion = createMediaStore(
  "(prefers-reduced-motion: reduce)",
  false,
);

/** True when the visitor asked for less transparency (glass becomes solid). */
export const usePrefersReducedTransparency = createMediaStore(
  "(prefers-reduced-transparency: reduce)",
  false,
);

/** True for devices whose primary pointer cannot hover (most phones/tablets). */
export const useCoarsePointer = createMediaStore("(hover: none)", false);
