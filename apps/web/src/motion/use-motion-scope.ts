"use client";

import type { RefObject } from "react";
import { MOTION_QUERIES } from "./config";
import { gsap, useGSAP } from "./gsap";

export interface MotionBuildArgs {
  /** The visitor allows motion. Build the cinematic version. */
  full: boolean;
  /** The visitor asked for reduced motion. Build a static or fade-only version. */
  reduced: boolean;
  /** Wrap event handlers that create tweens after the builder has run. */
  contextSafe: (fn: (...args: never[]) => unknown) => (...args: never[]) => unknown;
}

/**
 * The one way to run GSAP in a component.
 *
 * Conventions:
 * - Create every tween, timeline and ScrollTrigger inside `build`. They are
 *   scoped to `scope`, so selector strings only match inside that element.
 * - `build` re-runs when `dependencies` change or the motion preference flips,
 *   and everything it created is reverted first. Do not call kill() or
 *   ScrollTrigger.kill() by hand.
 * - Wrap handlers that animate later (pointer, click) in `contextSafe`.
 * - Branch on `full` / `reduced`. A reduced path should end in the same final
 *   visual state as the full one, without movement.
 * - Anything that is not a GSAP object (listeners, observers) must be removed
 *   by the function `build` returns.
 */
export function useMotionScope(
  scope: RefObject<HTMLElement | null>,
  build: (args: MotionBuildArgs) => void | (() => void),
  dependencies: unknown[] = [],
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { full: MOTION_QUERIES.full, reduced: MOTION_QUERIES.reduced },
        (context, contextSafe) => {
          const conditions = context.conditions ?? {};
          return build({
            full: Boolean(conditions.full),
            reduced: Boolean(conditions.reduced),
            contextSafe: (contextSafe ?? ((fn) => fn)) as MotionBuildArgs["contextSafe"],
          });
        },
      );
      return () => mm.revert();
    },
    { scope, dependencies },
  );
}
