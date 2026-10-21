import { describe, expect, it } from "vitest";

import { escapeLucene, namesMatch, normalizeName } from "../src/lib/matching.js";

describe("name matching", () => {
  it("matches case-insensitively with normalized whitespace", () => {
    expect(namesMatch("Fela Kuti", "  fela   KUTI ")).toBe(true);
  });

  it("matches artist names written with '&' or 'and'", () => {
    expect(namesMatch("Bob Marley & The Wailers", "bob marley and the wailers")).toBe(true);
  });

  it("does not confuse distinct artists with similar names", () => {
    expect(namesMatch("Bob Marley", "Bob Marley & The Wailers")).toBe(false);
    expect(namesMatch("Fela Kuti", "Femi Kuti")).toBe(false);
    expect(namesMatch("Nirvana", "Nirvana 2002")).toBe(false);
  });

  it("matches album titles with different punctuation", () => {
    expect(namesMatch("Anti", "ANTI")).toBe(true);
    expect(namesMatch("True", "True (Avicii by Avicii)")).toBe(false);
  });

  it("escapes quotes for Lucene embedding", () => {
    expect(escapeLucene('The "Best" \\ Of')).toBe('The \\"Best\\" \\\\ Of');
  });

  it("normalizes diacritics for cross-locale names", () => {
    expect(normalizeName("Björk")).toBe("bjork");
  });
});
