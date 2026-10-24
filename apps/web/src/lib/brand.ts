/**
 * Brand values needed in JavaScript contexts where CSS variables are not
 * available (metadata, canvas, Open Graph). The source of truth for styling is
 * src/styles/tokens.css; keep these in step with it.
 */
export const BRAND = {
  night: "#08120B",
  electric: "#00CD37",
  forest: "#2A6E4C",
  vibrant: "#46D35D",
  mint: "#CBF2CD",
  surface1: "#0E1912",
  text: "#EEF6EF",
  text2: "#A3B5A8",
  text3: "#8AA090",
} as const;

export const NON_AFFILIATION_NOTICE =
  "Featured artists are not affiliated with, and do not endorse, Worlds.fm.";
