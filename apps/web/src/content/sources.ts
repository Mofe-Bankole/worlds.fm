import type { SourceReference } from "./types";

const REVIEWED_AT = "2026-10-19";
const NOTE =
  "Checked against Wikipedia's article summary on 2026-10-19 by an engineer. Not editor-reviewed. Wikipedia is a tertiary source; replace with primary sources before launch.";

function wikipedia(
  id: string,
  title: string,
  path: string,
): SourceReference & { id: string } {
  return {
    id,
    title,
    publisher: "Wikipedia",
    url: `https://en.wikipedia.org/wiki/${path}`,
    reviewedAt: REVIEWED_AT,
    reviewStatus: "pending_editor_review",
    note: NOTE,
  };
}

/** Each URL below was fetched and its page summary read on 2026-10-19. */
export const SOURCES = {
  "wiki-avicii": wikipedia("wiki-avicii", "Avicii", "Avicii"),
  "wiki-avicii-experience": wikipedia(
    "wiki-avicii-experience",
    "Avicii Experience",
    "Avicii_Experience",
  ),
  "wiki-rihanna": wikipedia("wiki-rihanna", "Rihanna", "Rihanna"),
  "wiki-fenty-beauty": wikipedia(
    "wiki-fenty-beauty",
    "Fenty Beauty",
    "Fenty_Beauty",
  ),
  "wiki-bob-marley": wikipedia("wiki-bob-marley", "Bob Marley", "Bob_Marley"),
  "wiki-bob-marley-museum": wikipedia(
    "wiki-bob-marley-museum",
    "Bob Marley Museum",
    "Bob_Marley_Museum",
  ),
  "wiki-fela-kuti": wikipedia("wiki-fela-kuti", "Fela Kuti", "Fela_Kuti"),
  "wiki-new-afrika-shrine": wikipedia(
    "wiki-new-afrika-shrine",
    "New Afrika Shrine",
    "New_Afrika_Shrine",
  ),
} as const satisfies Record<string, SourceReference>;

export type SourceId = keyof typeof SOURCES;

export function getSource(id: SourceId): SourceReference {
  return SOURCES[id];
}
