/**
 * Typed landing-page content (blueprint §5, §9).
 *
 * Status of everything in this file: DEMO DATA.
 * - Verified connections cite real pages that were fetched and read on
 *   2026-10-19, but none is editor-reviewed yet (see sources.ts).
 * - Affinity entries are hand-written fixtures. They are not Qloo responses,
 *   carry no scores, and must render with a fixture label.
 * - No photographs are included. Every artist uses a designed placeholder
 *   until a Wikimedia Commons file has been licence-checked and credited.
 * - There are no community or editorial examples: community content needs a
 *   real, reviewed submission and editorial content needs its own citations.
 */
import { NON_AFFILIATION_NOTICE } from "@/lib/brand";
import { SOURCES, type SourceId } from "./sources";
import type {
  ArtistCard,
  Connection,
  FeaturePanel,
  HowItWorksStep,
  MediaCredit,
  SourceReference,
} from "./types";

export const DEMO_DATA_LABEL = "Demo data";
export const FIXTURE_LABEL = "Qloo fixture, not a live result";
export { NON_AFFILIATION_NOTICE };

export const HERO_CONTENT = {
  headline: ["Every sound has a world.", "Discover it."],
  searchPlaceholder: "Search an artist",
} as const;

export const CONNECTIONS = [
  {
    id: "avicii-experience",
    kind: "verified",
    fromArtistId: "avicii",
    target: {
      name: "Avicii Experience",
      entityType: "museum",
      placeLabel: "Stockholm, Sweden",
    },
    label: "Museum in Stockholm built in his memory",
    statement:
      "A museum in Stockholm was built in memory of Tim Bergling, known as Avicii, to exhibit his work. This describes the museum's purpose. It does not imply any involvement by Worlds.fm.",
    sourceIds: ["wiki-avicii-experience", "wiki-avicii"],
    demo: true,
  },
  {
    id: "fenty-beauty",
    kind: "verified",
    fromArtistId: "rihanna",
    target: { name: "Fenty Beauty", entityType: "brand" },
    label: "Cosmetics brand launched with LVMH",
    statement:
      "Fenty Beauty is a cosmetics brand launched by Rihanna and LVMH on 8 September 2017. This is a business relationship, not a link to any particular song.",
    sourceIds: ["wiki-fenty-beauty", "wiki-rihanna"],
    demo: true,
  },
  {
    id: "bob-marley-museum",
    kind: "verified",
    fromArtistId: "bob-marley",
    target: {
      name: "Bob Marley Museum",
      entityType: "museum",
      placeLabel: "56 Hope Road, Kingston, Jamaica",
    },
    label: "His former home, now a museum",
    statement:
      "The Bob Marley Museum is Marley's former residence in Kingston. It was converted into a museum in 1986 and was home to the Tuff Gong label.",
    sourceIds: ["wiki-bob-marley-museum", "wiki-bob-marley"],
    demo: true,
  },
  {
    id: "new-afrika-shrine",
    kind: "verified",
    fromArtistId: "fela-kuti",
    target: {
      name: "New Afrika Shrine",
      entityType: "venue",
      placeLabel: "Ikeja, Lagos, Nigeria",
    },
    label: "Successor to the Afrika Shrine he created in 1970",
    statement:
      "The New Afrika Shrine replaced the original Afrika Shrine, which Fela Kuti created in 1970 and which burned down in 1977. It hosts the annual Felabration festival.",
    sourceIds: ["wiki-new-afrika-shrine", "wiki-fela-kuti"],
    demo: true,
  },
  {
    id: "affinity-avicii-swedish-house-mafia",
    kind: "affinity",
    fromArtistId: "avicii",
    target: { name: "Swedish House Mafia", entityType: "artist" },
    label: "Audiences may also enjoy",
    statement:
      "A placeholder showing how a Qloo affinity will appear. It is a recommendation signal. It says nothing about collaboration, influence or history.",
    provenance: {
      provider: "qloo",
      mode: "fixture",
      retrievedAt: null,
      entityType: "artist",
    },
    score: null,
    fixtureNote:
      "Hand-written placeholder. Replace with a live Qloo result from apps/api.",
    demo: true,
  },
  {
    id: "affinity-bob-marley-peter-tosh",
    kind: "affinity",
    fromArtistId: "bob-marley",
    target: { name: "Peter Tosh", entityType: "artist" },
    label: "Audiences may also enjoy",
    statement:
      "A placeholder showing how a Qloo affinity will appear. It is a recommendation signal. It says nothing about collaboration, influence or history.",
    provenance: {
      provider: "qloo",
      mode: "fixture",
      retrievedAt: null,
      entityType: "artist",
    },
    score: null,
    fixtureNote:
      "Hand-written placeholder. Replace with a live Qloo result from apps/api.",
    demo: true,
  },
] as const satisfies readonly Connection<SourceId>[];

export const ARTISTS: readonly ArtistCard<SourceId>[] = [
  {
    id: "avicii",
    name: "Avicii",
    location: {
      label: "Stockholm, Sweden",
      basisSourceId: "wiki-avicii-experience",
    },
    genres: ["House"],
    genresBasisSourceId: "wiki-avicii",
    media: {
      kind: "placeholder",
      label: "Avicii",
      tone: "forest",
      alt: "Placeholder artwork for Avicii. No photograph has been licensed yet.",
    },
    insight: {
      text: "A museum in Stockholm was built in his memory to exhibit his work.",
      kind: "verified",
      connectionId: "avicii-experience",
    },
    demo: true,
  },
  {
    id: "rihanna",
    name: "Rihanna",
    location: { label: "Barbados", basisSourceId: "wiki-rihanna" },
    genres: ["Dance-pop", "R&B"],
    genresBasisSourceId: "wiki-rihanna",
    media: {
      kind: "placeholder",
      label: "Rihanna",
      tone: "mint",
      alt: "Placeholder artwork for Rihanna. No photograph has been licensed yet.",
    },
    insight: {
      text: "She launched the cosmetics brand Fenty Beauty with LVMH in 2017.",
      kind: "verified",
      connectionId: "fenty-beauty",
    },
    demo: true,
  },
  {
    id: "bob-marley",
    name: "Bob Marley",
    location: {
      label: "Kingston, Jamaica",
      basisSourceId: "wiki-bob-marley-museum",
    },
    genres: ["Reggae"],
    genresBasisSourceId: "wiki-bob-marley",
    media: {
      kind: "placeholder",
      label: "Bob Marley",
      tone: "night",
      alt: "Placeholder artwork for Bob Marley. No photograph has been licensed yet.",
    },
    insight: {
      text: "His former home at 56 Hope Road became a museum in 1986.",
      kind: "verified",
      connectionId: "bob-marley-museum",
    },
    demo: true,
  },
  {
    id: "fela-kuti",
    name: "Fela Kuti",
    location: {
      label: "Lagos, Nigeria",
      basisSourceId: "wiki-new-afrika-shrine",
    },
    genres: ["Afrobeat"],
    genresBasisSourceId: "wiki-fela-kuti",
    media: {
      kind: "placeholder",
      label: "Fela Kuti",
      tone: "forest",
      alt: "Placeholder artwork for Fela Kuti. No photograph has been licensed yet.",
    },
    insight: {
      text: "The New Afrika Shrine in Lagos succeeds the club he created in 1970.",
      kind: "verified",
      connectionId: "new-afrika-shrine",
    },
    demo: true,
  },
];

export const EXAMPLE_SEARCHES: readonly string[] = ARTISTS.map(
  (artist) => artist.name,
);

export const FEATURE_PANELS = [
  {
    id: "search",
    title: "Start with a sound",
    description:
      "Search an artist and enter the World of places, genres and stories around them.",
    status: "in_development",
  },
  {
    id: "map",
    title: "A map you can trust",
    description:
      "A place appears on the map only when a source supports it. No guessed pins.",
    status: "in_development",
  },
  {
    id: "provenance",
    title: "Every link shows its evidence",
    description:
      "Verified, affinity, community or editorial, each with a label, an icon and its own line style.",
    status: "in_development",
  },
  {
    id: "affinity",
    title: "Cultural affinity, clearly labelled",
    description:
      "Qloo recommendation signals show up as affinities. They are never presented as history.",
    status: "in_development",
  },
  {
    id: "graph",
    title: "A World, as a graph",
    description:
      "See how an artist connects to genres, places, other artists and movements, and follow any link.",
    status: "in_development",
  },
  {
    id: "share",
    title: "Share a journey",
    description:
      "Send a link to a World. Nothing personal is shared by default.",
    status: "planned",
  },
] as const satisfies readonly FeaturePanel[];

export const HOW_IT_WORKS = [
  {
    id: "search",
    index: "01",
    title: "Search",
    description: "Type an artist you love.",
  },
  {
    id: "enter",
    index: "02",
    title: "Enter the World",
    description:
      "See the places, genres and artists connected to them, each with its evidence.",
  },
  {
    id: "explore",
    index: "03",
    title: "Explore and share",
    description:
      "Follow a link to a new World, then share the journey if you want to.",
  },
] as const satisfies readonly HowItWorksStep[];

/** Credits for every photograph in use, for the footer. Empty until photos are licensed. */
export function collectMediaCredits(): readonly (MediaCredit & {
  subject: string;
})[] {
  return ARTISTS.flatMap((artist) =>
    artist.media.kind === "image"
      ? [{ ...artist.media.credit, subject: artist.name }]
      : [],
  );
}

/** Sources cited by any connection, de-duplicated, for a sources list. */
export function collectCitedSources(): readonly SourceReference[] {
  const ids = new Set<SourceId>();
  for (const connection of CONNECTIONS) {
    if (connection.kind === "verified") {
      connection.sourceIds.forEach((id) => ids.add(id));
    }
  }
  return [...ids].map((id) => SOURCES[id]);
}
