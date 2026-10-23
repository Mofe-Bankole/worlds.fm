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

/**
 * Added 2026-10-23 for the featured worlds carousel. Each fact was checked
 * against the linked page's text as returned by a web search on that date
 * by an engineer, not read in full. Not editor-reviewed.
 */
const REVIEWED_AT_FEATURED = "2026-10-23";
const FEATURED_NOTE =
  "Checked against the page text returned by a web search on 2026-10-23 by an engineer. Not editor-reviewed; confirm against the full page before launch.";

function web(id: string, title: string, publisher: string, url: string): SourceReference & { id: string } {
  return { id, title, publisher, url, reviewedAt: REVIEWED_AT_FEATURED, reviewStatus: "pending_editor_review", note: FEATURED_NOTE };
}

export const FEATURED_SOURCES = {
  "wiki-wake-me-up": web("wiki-wake-me-up", "Wake Me Up (Avicii song)", "Wikipedia", "https://en.wikipedia.org/wiki/Wake_Me_Up_(Avicii_song)"),
  "songfacts-wake-me-up": web("songfacts-wake-me-up", "Wake Me Up by Avicii", "Songfacts", "https://www.songfacts.com/facts/avicii/wake-me-up"),
  "rollingstone-same-ol-mistakes": web(
    "rollingstone-same-ol-mistakes",
    "Tame Impala respond to Rihanna's hypnotic cover",
    "Rolling Stone",
    "https://www.rollingstone.com/music/music-news/tame-impala-respond-to-rihannas-hypnotic-cover-53720/",
  ),
  "wiki-exodus": web("wiki-exodus", "Exodus (Bob Marley and the Wailers album)", "Wikipedia", "https://en.wikipedia.org/wiki/Exodus_(Bob_Marley_and_the_Wailers_album)"),
  "albumism-exodus": web(
    "albumism-exodus",
    "Celebrating 45 years of Bob Marley and the Wailers' Exodus",
    "Albumism",
    "https://albumism.com/features/tribute-celebrating-45-years-of-bob-marley-and-the-wailers-exodus",
  ),
  "allmusic-zombie": web("allmusic-zombie", "Zombie: Fela Kuti & Africa 70", "AllMusic", "https://www.allmusic.com/album/zombie-mw0000651216"),
  "wiki-tame-impala": web("wiki-tame-impala", "Tame Impala", "Wikipedia", "https://en.wikipedia.org/wiki/Tame_Impala"),
  "perthnow-less-i-know": web(
    "perthnow-less-i-know",
    "Kevin Parker thanks fans as The Less I Know the Better passes one billion streams",
    "PerthNow",
    "https://www.perthnow.com.au/entertainment/music/kevin-parker-thanks-fans-after-tame-impalas-single-the-less-i-know-the-better-passes-one-billion-streams-ng-b881861995z",
  ),
  "wiki-michael-jackson": web("wiki-michael-jackson", "Michael Jackson", "Wikipedia", "https://en.wikipedia.org/wiki/Michael_Jackson"),
  "britannica-thriller": web("britannica-thriller", "Thriller (recording by Jackson)", "Britannica", "https://www.britannica.com/topic/Thriller-recording-by-Jackson"),
  "wiki-say-say-say": web("wiki-say-say-say", "Say Say Say", "Wikipedia", "https://en.wikipedia.org/wiki/Say_Say_Say"),
  "svwiki-frida-sundemo": web("svwiki-frida-sundemo", "Frida Sundemo", "Wikipedia (Swedish)", "https://sv.wikipedia.org/wiki/Frida_Sundemo"),
  "edm-nervo-hurt": web("edm-nervo-hurt", "NERVO drop “Hurt” with Frida Sundemo", "EDM.com", "https://edm.com/music-releases/nervo-drop-hurt-with-frida-sundemo/"),
  "kasbo-this-is-it": web(
    "kasbo-this-is-it",
    "Kasbo releases new single “This Is It” with longtime collaborator Frida Sundemo",
    "Music Is 4 Lovers",
    "https://www.musicis4lovers.com/kasbo-releases-new-single-this-is-it-with-longtime-collaborator-frida-sundemo/",
  ),
  "wiki-kendrick-lamar": web("wiki-kendrick-lamar", "Kendrick Lamar", "Wikipedia", "https://en.wikipedia.org/wiki/Kendrick_Lamar"),
  "pulitzer-kendrick-lamar": web("pulitzer-kendrick-lamar", "DAMN., by Kendrick Lamar", "The Pulitzer Prizes", "https://www.pulitzer.org/winners/kendrick-lamar"),
  "wiki-all-the-stars": web("wiki-all-the-stars", "All the Stars", "Wikipedia", "https://en.wikipedia.org/wiki/All_the_Stars"),
  "allmusic-rio-romeo": web("allmusic-rio-romeo", "Rio Romeo biography", "AllMusic", "https://www.allmusic.com/artist/rio-romeo-mn0004546624"),
  "first-avenue-rio-romeo": web("first-avenue-rio-romeo", "Rio Romeo", "First Avenue", "https://first-avenue.com/performer/rio-romeo/"),
  "officialcharts-wuthering-heights": web(
    "officialcharts-wuthering-heights",
    "Celebrating Kate Bush's Wuthering Heights Number 1",
    "Official Charts",
    "https://www.officialcharts.com/chart-news/official-charts-flashback-1978-celebrating-kate-bushs-wuthering-heights-number-1-in-the-uk-40-years-ago-this-week__18605/",
  ),
  "wiki-kate-bush": web("wiki-kate-bush", "Kate Bush", "Wikipedia", "https://en.wikipedia.org/wiki/Kate_Bush"),
  "bbc-running-up-that-hill": web(
    "bbc-running-up-that-hill",
    "Kate Bush's Running Up That Hill hits number one",
    "BBC News",
    "https://www.bbc.com/news/entertainment-arts-61843442",
  ),
  "newsshopper-kate-bush": web(
    "newsshopper-kate-bush",
    "Kate Bush: Stranger Things singer from south east London",
    "News Shopper",
    "https://www.newsshopper.co.uk/news/24966331.kate-bush-stranger-things-singer-south-east-london/",
  ),
} as const satisfies Record<string, SourceReference>;

export type FeaturedSourceId = keyof typeof FEATURED_SOURCES;
