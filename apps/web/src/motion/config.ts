/**
 * Shared motion vocabulary. Durations are in seconds (GSAP units) and mirror
 * the --motion-duration-* CSS tokens in src/styles/tokens.css.
 * Blueprint reference: docs/design/landing-page-blueprint.md §2 "Motion" and §4.
 */
export const DURATION = {
  instant: 0.12,
  fast: 0.2,
  base: 0.32,
  slow: 0.6,
  slower: 0.9,
  cinematic: 1.4,
} as const;

export const EASE = {
  /** Reveals and entrances. Same curve as the --ease-expo-out CSS token. */
  reveal: "expo.out",
  /** Scrubbed, scroll-linked animation. */
  scrub: "power2.inOut",
  /** Gentle settle for hover and pointer-follow motion. */
  settle: "power3.out",
} as const;

export const STAGGER = {
  word: 0.06,
  card: 0.05,
} as const;

export const DISTANCE = {
  /** Vertical travel for panel reveals, in px. */
  reveal: 40,
} as const;

/**
 * Media queries for gsap.matchMedia(). Every animation should be registered
 * under `full` and, where it matters, offer a `reduced` alternative.
 */
export const MOTION_QUERIES = {
  full: "(prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)",
} as const;

export type MotionQueryKey = keyof typeof MOTION_QUERIES;
