/**
 * Featured worlds for the landing carousel. DEMO DATA: every highlight is a
 * sourced statement (see FEATURED_SOURCES and SOURCES), none is
 * editor-reviewed, and none comes from Qloo. Highlights describe documented
 * facts only; they never imply endorsement, influence or causation beyond
 * what the source states.
 */
import { SOURCES, FEATURED_SOURCES, type FeaturedSourceId, type SourceId } from "./sources";
import type { SourceReference } from "./types";

export type HighlightType = "place" | "track" | "product" | "collab" | "screen";

export const HIGHLIGHT_LABEL: Record<HighlightType, string> = {
  place: "Place",
  track: "Track",
  product: "Product",
  collab: "Collab",
  screen: "Screen",
};

export interface WorldHighlight {
  type: HighlightType;
  /** The connected thing, for example a song or a place. */
  title: string;
  /** One sourced sentence fragment explaining the link. */
  detail: string;
  sourceId: SourceId | FeaturedSourceId;
}

export interface FeaturedWorld {
  id: string;
  name: string;
  /** Search query for the live explorer and the Qloo image lookup. */
  query: string;
  location: string;
  genres: readonly string[];
  /** The card's main statement. Restates one highlight. */
  headline: string;
  highlights: readonly [WorldHighlight, ...WorldHighlight[]];
  demo: true;
}

export const FEATURED_WORLDS: readonly FeaturedWorld[] = [
  {
    id: "avicii",
    name: "Avicii",
    query: "Avicii",
    location: "Stockholm, Sweden",
    genres: ["House", "EDM"],
    headline: "A museum in Stockholm was built in his memory to exhibit his work.",
    highlights: [
      { type: "place", title: "Avicii Experience", detail: "Museum in Stockholm dedicated to his life and work", sourceId: "wiki-avicii-experience" },
      { type: "collab", title: "“Wake Me Up” with Aloe Blacc", detail: "2013 single with vocals and lyrics by Aloe Blacc", sourceId: "songfacts-wake-me-up" },
    ],
    demo: true,
  },
  {
    id: "rihanna",
    name: "Rihanna",
    query: "Rihanna",
    location: "Barbados",
    genres: ["Pop", "R&B"],
    headline: "She launched the cosmetics brand Fenty Beauty with LVMH in 2017.",
    highlights: [
      { type: "product", title: "Fenty Beauty", detail: "Cosmetics brand launched with LVMH in September 2017", sourceId: "wiki-fenty-beauty" },
      { type: "collab", title: "“Umbrella” with Jay-Z", detail: "Won the Grammy for Best Rap/Sung Collaboration", sourceId: "wiki-rihanna" },
      { type: "track", title: "“Same Ol’ Mistakes”", detail: "Her cover of Tame Impala on Anti, produced by Kevin Parker", sourceId: "rollingstone-same-ol-mistakes" },
    ],
    demo: true,
  },
  {
    id: "tame-impala",
    name: "Tame Impala",
    query: "Tame Impala",
    location: "Perth, Australia",
    genres: ["Psychedelic rock", "Pop"],
    headline: "Rihanna covered “New Person, Same Old Mistakes” on Anti, with Kevin Parker producing.",
    highlights: [
      { type: "place", title: "Perth", detail: "Where Kevin Parker conceived the project in 2007", sourceId: "wiki-tame-impala" },
      { type: "track", title: "“The Less I Know the Better”", detail: "Fourth single from Currents (2015)", sourceId: "perthnow-less-i-know" },
      { type: "collab", title: "Rihanna, “Same Ol’ Mistakes”", detail: "A cover of his Currents closer, credited to him as producer", sourceId: "rollingstone-same-ol-mistakes" },
    ],
    demo: true,
  },
  {
    id: "michael-jackson",
    name: "Michael Jackson",
    query: "Michael Jackson",
    location: "Gary, Indiana",
    genres: ["Pop", "Soul"],
    headline: "Thriller (1982) earned him seven of the eight Grammys he won in 1984.",
    highlights: [
      { type: "place", title: "Gary, Indiana", detail: "Born there on 29 August 1958", sourceId: "wiki-michael-jackson" },
      { type: "track", title: "Thriller", detail: "1982 album behind seven of his eight 1984 Grammys", sourceId: "britannica-thriller" },
      { type: "collab", title: "“Say Say Say” with Paul McCartney", detail: "Duet released in October 1983", sourceId: "wiki-say-say-say" },
    ],
    demo: true,
  },
  {
    id: "kendrick-lamar",
    name: "Kendrick Lamar",
    query: "Kendrick Lamar",
    location: "Compton, California",
    genres: ["Hip hop"],
    headline: "DAMN. made him the first musician outside classical and jazz to win the Pulitzer Prize for Music.",
    highlights: [
      { type: "place", title: "Compton, California", detail: "Where he was born and raised", sourceId: "wiki-kendrick-lamar" },
      { type: "track", title: "DAMN.", detail: "2017 album awarded the 2018 Pulitzer Prize for Music", sourceId: "pulitzer-kendrick-lamar" },
      { type: "collab", title: "“All the Stars” with SZA", detail: "Single from Black Panther: The Album, January 2018", sourceId: "wiki-all-the-stars" },
    ],
    demo: true,
  },
  {
    id: "kate-bush",
    name: "Kate Bush",
    query: "Kate Bush",
    location: "Bexleyheath, London",
    genres: ["Art pop"],
    headline: "“Wuthering Heights” was the first UK number one written and performed by a woman.",
    highlights: [
      { type: "track", title: "“Wuthering Heights”", detail: "Her 1978 debut single, a UK number one", sourceId: "officialcharts-wuthering-heights" },
      { type: "collab", title: "“Don’t Give Up” with Peter Gabriel", detail: "A UK top 10 duet", sourceId: "wiki-kate-bush" },
      { type: "screen", title: "Stranger Things", detail: "Featured “Running Up That Hill”, which reached UK number one in 2022", sourceId: "bbc-running-up-that-hill" },
    ],
    demo: true,
  },
  {
    id: "bob-marley",
    name: "Bob Marley",
    query: "Bob Marley",
    location: "Kingston, Jamaica",
    genres: ["Reggae"],
    headline: "His former home at 56 Hope Road became a museum in 1986.",
    highlights: [
      { type: "place", title: "Bob Marley Museum", detail: "His former Kingston home, a museum since 1986", sourceId: "wiki-bob-marley-museum" },
      { type: "track", title: "Exodus", detail: "Bob Marley and the Wailers album, June 1977", sourceId: "wiki-exodus" },
      { type: "collab", title: "The Wailers", detail: "Founded with Peter Tosh and Bunny Wailer", sourceId: "albumism-exodus" },
    ],
    demo: true,
  },
  {
    id: "frida-sundemo",
    name: "Frida Sundemo",
    query: "Frida Sundemo",
    location: "Sweden",
    genres: ["Pop", "Electronic"],
    headline: "The Swedish singer, songwriter and producer is a longtime collaborator of Kasbo.",
    highlights: [
      { type: "collab", title: "Kasbo, “This Is It”", detail: "Single with her longtime collaborator", sourceId: "kasbo-this-is-it" },
      { type: "collab", title: "NERVO, “Hurt”", detail: "Single featuring her vocals", sourceId: "edm-nervo-hurt" },
      { type: "screen", title: "Kill Your Friends", detail: "Her acting debut, a British film from 2015", sourceId: "svwiki-frida-sundemo" },
    ],
    demo: true,
  },
  {
    id: "fela-kuti",
    name: "Fela Kuti",
    query: "Fela Kuti",
    location: "Lagos, Nigeria",
    genres: ["Afrobeat"],
    headline: "The New Afrika Shrine in Lagos succeeds the club he created in 1970.",
    highlights: [
      { type: "place", title: "New Afrika Shrine", detail: "Successor to the Afrika Shrine he created in 1970", sourceId: "wiki-new-afrika-shrine" },
      { type: "track", title: "Zombie", detail: "1976 album with Africa 70", sourceId: "allmusic-zombie" },
    ],
    demo: true,
  },
  {
    id: "rio-romeo",
    name: "Rio Romeo",
    query: "Rio Romeo",
    location: "Pomona, California",
    genres: ["Alt-pop", "Cabaret"],
    headline: "Piano-led alt-pop with cabaret flair, from Pomona, California.",
    highlights: [
      { type: "place", title: "Pomona, California", detail: "Where the singer-songwriter is based", sourceId: "allmusic-rio-romeo" },
      { type: "track", title: "“Nothing’s New”", detail: "From the 2022 EP Good God!", sourceId: "first-avenue-rio-romeo" },
    ],
    demo: true,
  },
];

/** Search queries of the featured worlds, in carousel order. */
export const FEATURED_QUERIES: readonly string[] = FEATURED_WORLDS.map((world) => world.query);

export function featuredSource(id: SourceId | FeaturedSourceId): SourceReference {
  return id in FEATURED_SOURCES ? FEATURED_SOURCES[id as FeaturedSourceId] : SOURCES[id as SourceId];
}
