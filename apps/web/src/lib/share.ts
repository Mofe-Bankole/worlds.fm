/**
 * Shareable links: artist Worlds and individual songs.
 *
 * A World is addressed by artist name in the query string:
 * `/explore?q=Tame%20Impala`. A query parameter is used rather than a path
 * segment because artist names are arbitrary, and a few contain characters that
 * do not survive a path segment: an encoded "/" in "AC/DC" is rejected or
 * rewritten by many servers and proxies. The query form is lossless for every
 * name the API can return.
 *
 * A song is addressed by MusicBrainz recording ID in a path segment:
 * `/song/<uuid>`. An ID needs neither encoding nor normalization, so the two
 * destinations use the form each one actually needs.
 *
 * A share link carries the name or the ID and nothing else. There are no
 * accounts yet, so there is nothing personal to leak, and these helpers
 * deliberately have no way to add anything.
 */

import { musicBrainzIdSchema } from "@worlds/shared";

/** Where a World lives. */
export const WORLD_PATH = "/explore";

/** Longest name the explorer search accepts; share links stay within it. */
export const SHARE_NAME_MAX = 100;

/**
 * Trim, collapse internal whitespace and drop control characters, so a name is
 * safe both in a URL and in a card. Returns "" when nothing usable remains,
 * which callers treat as "there is no World to share".
 */
export function normalizeShareName(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SHARE_NAME_MAX)
    .trim();
}

/** True when a name can be turned into a link. */
export function isShareableName(value: string | null | undefined): boolean {
  return normalizeShareName(value).length > 0;
}

/**
 * Relative path for a World: what goes in a canonical tag and in `href`.
 * The name is percent-encoded, so every character round-trips.
 */
export function worldPath(name: string): string {
  return `${WORLD_PATH}?${new URLSearchParams({ q: normalizeShareName(name) }).toString()}`;
}

/**
 * Absolute URL for a World. `origin` is passed in so this stays a pure
 * function; in the browser use {@link resolveShareOrigin} to obtain it.
 */
export function worldUrl(name: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${worldPath(name)}`;
}

/**
 * Origin to build share links from.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when set, so a link shared from a preview
 * deployment still points at the canonical site (a preview URL is often behind
 * deployment protection, and its origin may not be in the API's CORS list).
 * Otherwise the browser's current origin is used, which is always correct.
 */
export function resolveShareOrigin(fallback = "http://localhost:3000"): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return fallback;
}

/* ---------------------------------- Songs ---------------------------------- */

/**
 * Where a song lives. A MusicBrainz recording ID is a UUID, so unlike an artist
 * name it survives a path segment untouched.
 */
export const SONG_PATH = "/song";

/** True when a value can address a song page. */
export function isSongId(value: string | null | undefined): boolean {
  return typeof value === "string" && musicBrainzIdSchema.safeParse(value).success;
}

/** Relative path for a song: what goes in a canonical tag and in `href`. */
export function songPath(recordingMbid: string): string {
  return `${SONG_PATH}/${recordingMbid}`;
}

/** Absolute URL for a song. `origin` is passed in so this stays a pure function. */
export function songUrl(recordingMbid: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}${songPath(recordingMbid)}`;
}

/* ------------------------------ Share targets ------------------------------ */

/**
 * What a share control sends. Built from an origin at the moment of sharing, so
 * nothing about the visitor and nothing about the deployment is baked in at
 * build time.
 */
export interface ShareTarget {
  title: string;
  text: string;
  url: string;
}

/** Share payload for an artist's World. */
export function worldShareTarget(name: string, origin: string): ShareTarget {
  const clean = normalizeShareName(name);
  return {
    title: `${clean} — Worlds.fm`,
    text: `Explore ${clean}’s world on Worlds.fm: the artists, places and brands connected to them.`,
    url: worldUrl(clean, origin),
  };
}

/**
 * Share payload for one song. The artist is named only when it is known, so the
 * message never implies an attribution the page cannot show.
 */
export function songShareTarget(
  song: { recordingMbid: string; title: string; artist: string | null },
  origin: string,
): ShareTarget {
  const title = song.title.trim();
  const by = song.artist?.trim();
  return {
    title: by ? `${title} by ${by} — Worlds.fm` : `${title} — Worlds.fm`,
    text: by
      ? `The story of ${title} by ${by} on Worlds.fm: credits, samples, other versions and cited facts.`
      : `The story of ${title} on Worlds.fm: credits, samples, other versions and cited facts.`,
    url: songUrl(song.recordingMbid, origin),
  };
}

/** One-line description reused by the page metadata and the share card. */
export function worldDescription(name: string): string {
  const clean = normalizeShareName(name);
  return `Explore ${clean}’s cultural world: the artists, places, brands and destinations connected to them, each labelled with what the link is based on.`;
}

/**
 * One-line description for a song page. It names the sources, so a preview does
 * not read as though Worlds.fm wrote the story itself.
 */
export function songDescription(title: string, artist: string | null): string {
  const cleanTitle = title.trim();
  const by = artist?.trim();
  const subject = by ? `${cleanTitle} by ${by}` : cleanTitle;
  return `The story of ${subject}: credits, samples, other versions and cited facts, from MusicBrainz, Wikidata and Wikipedia.`;
}

/* ------------------------------- Share card -------------------------------- */

/** Longest name drawn on the share card before it is shortened. */
const OG_NAME_MAX = 60;

/** Name as drawn on the share card, shortened so it cannot overflow the frame. */
export function ogCardName(name: string, max = OG_NAME_MAX): string {
  const clean = normalizeShareName(name);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(max - 1, 1)).trimEnd()}…`;
}

/** Type size for the share card: short names fill it, long ones still fit. */
export function ogCardFontSize(length: number): number {
  if (length <= 10) return 132;
  if (length <= 18) return 108;
  if (length <= 28) return 88;
  if (length <= 44) return 70;
  return 56;
}
