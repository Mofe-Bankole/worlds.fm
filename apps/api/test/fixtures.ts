/**
 * MOCK PROVIDER FIXTURES — synthetic payloads for automated tests only.
 *
 * These hand-written objects mirror the real provider response shapes
 * (field names verified against the live APIs on 2026-10-20) so the suite
 * never performs network calls. They are demo data for tests, NOT real
 * provider responses and NOT production content.
 */

/* ---------------------------------- TheAudioDB ---------------------------------- */

export function tadbArtistRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    idArtist: "121444",
    strArtist: "Fela Kuti",
    strArtistAlternate: null,
    strMusicBrainzID: "6514cffa-fbe0-4965-ad88-e998ead8a82a",
    strArtistThumb: "https://r2.theaudiodb.com/images/media/artist/thumb/fela.jpg",
    strArtistWideThumb: null,
    strArtistLogo: null,
    strArtistClearart: null,
    strArtistCutout: null,
    strArtistBanner: null,
    strArtistFanart: "https://r2.theaudiodb.com/images/media/artist/fanart/fela.jpg",
    strArtistFanart2: null,
    strArtistFanart3: null,
    strArtistFanart4: null,
    ...overrides
  };
}

export function tadbArtistSearchResponse(
  records: Array<Record<string, unknown>> | null
): Record<string, unknown> {
  return { artists: records };
}

export function tadbAlbumRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    idAlbum: "2257888",
    idArtist: "111305",
    strAlbum: "Anti",
    strArtist: "Rihanna",
    strMusicBrainzID: "0c482acd-35a2-466b-b833-ef5f2f1297d4",
    strMusicBrainzArtistID: "73e5e69d-3554-40d8-8516-00cb38737a1c",
    strAlbumThumb: "https://r2.theaudiodb.com/images/media/album/thumb/anti.jpg",
    strAlbumThumbHQ: "https://r2.theaudiodb.com/images/media/album/thumb/hq/anti.jpg",
    strAlbumCDart: null,
    intYearReleased: "2016",
    ...overrides
  };
}

export function tadbAlbumSearchResponse(
  records: Array<Record<string, unknown>> | null
): Record<string, unknown> {
  return { album: records };
}

/* ---------------------------------- MusicBrainz ---------------------------------- */

export function mbArtistSearchResponse(
  artists: Array<Record<string, unknown>>
): Record<string, unknown> {
  return { created: "2026-10-20T00:00:00.000Z", count: artists.length, offset: 0, artists };
}

export function mbArtist(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "dbf9858e-7ca1-4447-9b6a-2d67f74f0000",
    name: "Fela Kuti",
    "sort-name": "Kuti, Fela",
    score: 100,
    disambiguation: "Nigerian multi-instrumentalist",
    ...overrides
  };
}

export function mbReleaseGroup(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "0c482acd-35a2-466b-b833-ef5f2f1297d4",
    title: "Anti",
    score: 100,
    "primary-type": "Album",
    "first-release-date": "2016-01-28",
    "artist-credit": [
      {
        name: "Rihanna",
        artist: { id: "73e5e69d-3554-40d8-8516-00cb38737a1c", name: "Rihanna" }
      }
    ],
    ...overrides
  };
}

export function mbReleaseGroupSearchResponse(
  groups: Array<Record<string, unknown>>
): Record<string, unknown> {
  return {
    created: "2026-10-20T00:00:00.000Z",
    count: groups.length,
    offset: 0,
    "release-groups": groups
  };
}

/* ----------------------------------- Fanart.tv ----------------------------------- */

export function fanartArtistResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Fela Kuti",
    mbid_id: "6514cffa-fbe0-4965-ad88-e998ead8a82a",
    artistthumb: [{ id: "1", url: "https://assets.fanart.tv/fanart/music/fela-thumb.jpg", likes: "3" }],
    artistbackground: [
      { id: "2", url: "https://assets.fanart.tv/fanart/music/fela-bg.jpg", likes: "5" }
    ],
    hdmusiclogo: [],
    musiclogo: [],
    musicbanner: [],
    ...overrides
  };
}

/* ------------------------------- Cover Art Archive ------------------------------- */

export function caaResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    release: "https://musicbrainz.org/release/0c482acd-35a2-466b-b833-ef5f2f1297d4",
    images: [
      {
        id: "1",
        image: "https://coverartarchive.org/release-group/0c482acd/front.jpg",
        front: true,
        types: ["Front"],
        comment: "",
        thumbnails: {
          small: "https://coverartarchive.org/release-group/0c482acd/front-250.jpg",
          large: "https://coverartarchive.org/release-group/0c482acd/front-500.jpg"
        }
      }
    ],
    ...overrides
  };
}

/* ------------------------------- HTTP response stubs ------------------------------ */

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init
  });
}

export function statusResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

/** A fetch stub that never answers but aborts like undici does on timeout. */
export function hangingFetch(): (input: string | URL, init?: RequestInit) => Promise<Response> {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("This operation was aborted", "AbortError"));
      });
    });
}

export interface FetchCall {
  url: string;
  init?: RequestInit | undefined;
}

/**
 * URL-matched stub fetch. Handlers run in order; the first match wins.
 * Unmatched URLs fail loudly so a test can never hit the real network.
 */
export function createStubFetch(
  handlers: Array<{
    match: (url: string) => boolean;
    respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
  }>
): { fetchFn: (input: string | URL, init?: RequestInit) => Promise<Response>; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchFn = (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push(init === undefined ? { url } : { url, init });
    for (const handler of handlers) {
      if (handler.match(url)) {
        return Promise.resolve(handler.respond(url, init));
      }
    }
    throw new Error(`[test stub] no handler matched URL: ${url}`);
  };
  return { fetchFn, calls };
}

export function callsMatching(calls: FetchCall[], needle: string): FetchCall[] {
  return calls.filter((call) => call.url.includes(needle));
}
