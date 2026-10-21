/**
 * Name matching helpers. Providers return near-duplicate names; we only trust
 * exact normalized equality so that e.g. "Fela Kuti" never matches "Femi Kuti".
 */

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

/** Escape user input for embedding inside a MusicBrainz Lucene field query. */
export function escapeLucene(value: string): string {
  return value.replace(/["\\]/g, (character) => `\\${character}`);
}
