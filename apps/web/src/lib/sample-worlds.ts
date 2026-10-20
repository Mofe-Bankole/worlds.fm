/**
 * DEMO DATA — locally bundled sample worlds.
 *
 * These entries exist to demonstrate the Worlds.fm discovery experience ahead
 * of the live API (apps/api + Qloo). They are illustrative only and are
 * surfaced in the UI with an explicit "demo data" label. Nothing here is a
 * live or verified API result, and no real-world claim should be treated as
 * sourced.
 */

export type ConnectionKind =
  | "city"
  | "venue"
  | "genre"
  | "sound"
  | "movement"
  | "culture";

export interface WorldConnection {
  kind: ConnectionKind;
  label: string;
  detail: string;
  meta: string;
}

export interface SampleWorld {
  id: string;
  artist: string;
  aka?: string;
  origin: string;
  country: string;
  genre: string;
  culture: string;
  era: string;
  tagline: string;
  accent: string;
  /** Extra aliases used for fuzzy matching during search. */
  searchTerms: string[];
  connections: WorldConnection[];
}

export const SAMPLE_WORLDS: SampleWorld[] = [
  {
    id: "avicii",
    artist: "Avicii",
    aka: "Tim Bergling",
    origin: "Stockholm, Sweden",
    country: "Sweden",
    genre: "Electronic Dance Music",
    culture: "Global Dance Music",
    era: "1989–2018",
    tagline:
      "The Swedish producer who turned Nordic folk melodies into stadium-sized euphoria.",
    accent: "#BEFF55",
    searchTerms: ["tim bergling", "stockholm", "edm", "house", "sweden"],
    connections: [
      {
        kind: "venue",
        label: "Avicii Experience",
        detail: "Interactive music museum in central Stockholm.",
        meta: "Venue",
      },
      {
        kind: "movement",
        label: "Scandinavian house",
        detail: "The Nordic progressive-house wave of the early 2010s.",
        meta: "Movement",
      },
      {
        kind: "sound",
        label: "Folk sampling",
        detail: "Nordic folk motifs woven into electronic production.",
        meta: "Sound",
      },
      {
        kind: "city",
        label: "Stockholm",
        detail: "Home studio and the early club scene that shaped the sound.",
        meta: "City",
      },
      {
        kind: "culture",
        label: "Genre-blurring crossover",
        detail: "Country, soul, and dance colliding on global charts.",
        meta: "Culture",
      },
    ],
  },
  {
    id: "burna-boy",
    artist: "Burna Boy",
    aka: "Damini Ebunoluwa Ogulu",
    origin: "Port Harcourt → Lagos, Nigeria",
    country: "Nigeria",
    genre: "Afro-fusion",
    culture: "Global Afrobeats",
    era: "1991–",
    tagline:
      "The self-styled African Giant who carried Afro-fusion to the world's biggest stages.",
    accent: "#1ED760",
    searchTerms: ["damini ogulu", "afrobeats", "afrofusion", "lagos", "nigeria"],
    connections: [
      {
        kind: "city",
        label: "Lagos",
        detail: "The creative capital driving contemporary Afrobeats.",
        meta: "City",
      },
      {
        kind: "movement",
        label: "Afrobeats",
        detail: "A West African pop renaissance with global reach.",
        meta: "Movement",
      },
      {
        kind: "sound",
        label: "Afro-fusion",
        detail: "Dancehall, reggae, R&B, and Fuji woven together.",
        meta: "Sound",
      },
      {
        kind: "city",
        label: "Port Harcourt",
        detail: "The Delta roots and early influences behind the artist.",
        meta: "Origin",
      },
      {
        kind: "culture",
        label: "Pan-African pride",
        detail: "A sound that carries African identity worldwide.",
        meta: "Culture",
      },
    ],
  },
  {
    id: "rosalia",
    artist: "Rosalía",
    aka: "Rosalía Vila Tobella",
    origin: "Barcelona, Spain",
    country: "Spain",
    genre: "Flamenco / Art Pop",
    culture: "Nuevo Flamenco",
    era: "1992–",
    tagline:
      "The Catalan artist who rebuilt flamenco for a global pop audience.",
    accent: "#6FE9A8",
    searchTerms: [
      "rosalia",
      "rosalia vila tobella",
      "flamenco",
      "barcelona",
      "spain",
      "catalonia",
    ],
    connections: [
      {
        kind: "city",
        label: "Barcelona",
        detail: "Catalonia's flamenco reinvention and art-pop hub.",
        meta: "City",
      },
      {
        kind: "genre",
        label: "Flamenco",
        detail: "Andalusian tradition, radically reimagined.",
        meta: "Genre",
      },
      {
        kind: "sound",
        label: "Palmas & handclaps",
        detail: "Percussive rhythm sitting at the core of the records.",
        meta: "Sound",
      },
      {
        kind: "movement",
        label: "Nuevo flamenco",
        detail: "Tradition meeting reggaeton and electronic pop.",
        meta: "Movement",
      },
      {
        kind: "culture",
        label: "Latin pop bridge",
        detail: "Connecting Spain with Latin American pop audiences.",
        meta: "Culture",
      },
    ],
  },
];

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Resolve a free-text query against the bundled demo library. */
export function findSampleWorld(query: string): SampleWorld | null {
  const q = normalise(query);
  if (!q) return null;

  const exact = SAMPLE_WORLDS.find((world) => {
    const candidates = [
      world.id,
      world.artist,
      world.aka ?? "",
      ...world.searchTerms,
    ].map(normalise);
    return candidates.some((candidate) => candidate === q);
  });
  if (exact) return exact;

  return (
    SAMPLE_WORLDS.find((world) => {
      const haystack = [
        world.artist,
        world.aka ?? "",
        world.origin,
        world.genre,
        world.culture,
        ...world.searchTerms,
      ]
        .map(normalise)
        .join(" ");
      return q.length > 2 && haystack.includes(q);
    }) ?? null
  );
}

export function getSampleWorld(id: string): SampleWorld {
  return SAMPLE_WORLDS.find((world) => world.id === id) ?? SAMPLE_WORLDS[0]!;
}
