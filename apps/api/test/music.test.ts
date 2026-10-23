import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  discographyResponseSchema,
  recordingStoryResponseSchema,
  releaseTracksResponseSchema
} from "@worlds/shared";

import { editionKey } from "../src/services/music-catalog.js";
import { buildTestApp } from "./helpers.js";
import { callsMatching, createStubFetch, jsonResponse, statusResponse } from "./fixtures.js";

/**
 * MOCK MUSIC FIXTURES. Hand-written, network-free payloads shaped like the
 * MusicBrainz ws/2, Spotify Web API and Wikimedia responses (field names
 * live-checked 2026-10-23). Every name, ID and fact is invented.
 */
const CLIENT_ID = "test-client-id-0000";
const CLIENT_SECRET = "test-spotify-secret-DO-NOT-LEAK-9c1e";
const ACCESS_TOKEN = "test-access-token-DO-NOT-LEAK-55aa";

const ARTIST = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER_ARTIST = "aaaaaaaa-0000-4000-8000-000000000002";
const GUEST = "aaaaaaaa-0000-4000-8000-000000000003";
const WRITER = "aaaaaaaa-0000-4000-8000-000000000004";
const RG_ALBUM = "bbbbbbbb-0000-4000-8000-000000000001";
const RG_EP = "bbbbbbbb-0000-4000-8000-000000000002";
const RG_SINGLE = "bbbbbbbb-0000-4000-8000-000000000003";
const RG_LIVE = "bbbbbbbb-0000-4000-8000-000000000004";
const RELEASE_DIGITAL = "cccccccc-0000-4000-8000-000000000001";
const RELEASE_VINYL = "cccccccc-0000-4000-8000-000000000002";
const REC_1 = "dddddddd-0000-4000-8000-000000000001";
const REC_2 = "dddddddd-0000-4000-8000-000000000002";
const REC_SAMPLED = "dddddddd-0000-4000-8000-000000000003";
const REC_SAMPLER = "dddddddd-0000-4000-8000-000000000004";
const REC_COVER = "dddddddd-0000-4000-8000-000000000005";
const WORK = "eeeeeeee-0000-4000-8000-000000000001";
const SP_ARTIST = "SpArtist0000000000000A";
const SP_ALBUM = "SpAlbum00000000000000A";
const SP_EP = "SpEp000000000000000000";
const SP_TRACK_1 = "SpTrack00000000000001A";
const SP_TRACK_2 = "SpTrack00000000000002A";

const credit = (id: string, name: string, joinphrase = "") => ({ name, joinphrase, artist: { id, name } });

const mbSearch = (artists: unknown[]) => ({ artists });
const mbArtist = {
  id: ARTIST,
  name: "Mock Band",
  disambiguation: "",
  relations: [
    { type: "free streaming", url: { resource: `https://open.spotify.com/artist/${SP_ARTIST}` } },
    { type: "wikidata", url: { resource: "https://www.wikidata.org/wiki/Q1" } }
  ]
};
const mbGroups = {
  "release-group-count": 4,
  "release-groups": [
    { id: RG_ALBUM, title: "Mock Album", "primary-type": "Album", "secondary-types": [], "first-release-date": "2015-07-17" },
    // MusicBrainz types this as an EP; Spotify files it as a single.
    { id: RG_EP, title: "Mock EP", "primary-type": "EP", "secondary-types": [], "first-release-date": "2008-09-01" },
    { id: RG_SINGLE, title: "Mock Single", "primary-type": "Single", "secondary-types": [], "first-release-date": "2016-01-01" },
    { id: RG_LIVE, title: "Mock Live", "primary-type": "Album", "secondary-types": ["Live"], "first-release-date": "2017-01-01" }
  ]
};
const spImage = (size: number) => ({ url: `https://i.scdn.co/image/mock${size}`, width: size, height: size });
const spAlbum = (id: string, name: string, type: string, date: string, total: number) => ({
  id,
  name,
  album_type: type,
  total_tracks: total,
  release_date: date,
  images: [spImage(640), spImage(300), spImage(64)],
  external_urls: { spotify: `https://open.spotify.com/album/${id}` },
  artists: [{ id: SP_ARTIST, name: "Mock Band" }]
});
const spAlbums = {
  items: [
    spAlbum(SP_ALBUM, "Mock Album (Deluxe Edition)", "album", "2015-07-17", 2),
    spAlbum(SP_EP, "Mock EP", "single", "2008-09-22", 3)
  ],
  next: null,
  total: 2
};
const spTrack = (id: string, name: string, n: number, explicit: boolean) => ({
  id,
  name,
  disc_number: 1,
  track_number: n,
  duration_ms: 200000,
  explicit,
  external_urls: { spotify: `https://open.spotify.com/track/${id}` }
});
const spAlbumFull = {
  ...spAlbum(SP_ALBUM, "Mock Album (Deluxe Edition)", "album", "2015-07-17", 2),
  tracks: { items: [spTrack(SP_TRACK_1, "First Song", 1, false), spTrack(SP_TRACK_2, "Second Song", 2, true)], next: null }
};
const mbReleaseGroup = {
  id: RG_ALBUM,
  title: "Mock Album",
  "primary-type": "Album",
  releases: [
    { id: RELEASE_VINYL, status: "Official", country: "GB", date: "2015-07-20", media: [{ format: '12" Vinyl', "track-count": 2 }] },
    { id: RELEASE_DIGITAL, status: "Official", country: "XW", date: "2015-07-17", media: [{ format: "Digital Media", "track-count": 2 }] }
  ]
};
const mbRelease = {
  id: RELEASE_DIGITAL,
  title: "Mock Album",
  date: "2015-07-17",
  country: "XW",
  "artist-credit": [credit(ARTIST, "Mock Band")],
  media: [
    {
      position: 1,
      format: "Digital Media",
      tracks: [
        { position: 1, number: "1", title: "First Song", length: 200000, recording: { id: REC_1, title: "First Song", isrcs: ["XX0000000001"] } },
        {
          position: 2,
          number: "2",
          title: "Second Song",
          length: 180000,
          "artist-credit": [credit(ARTIST, "Mock Band", " feat. "), credit(GUEST, "Mock Guest")],
          recording: { id: REC_2, title: "Second Song" }
        }
      ]
    }
  ]
};
const mbStory = {
  id: REC_1,
  title: "First Song",
  length: 200000,
  isrcs: ["XX0000000001"],
  "artist-credit": [credit(ARTIST, "Mock Band")],
  relations: [
    { type: "producer", "target-type": "artist", direction: "backward", artist: { id: WRITER, name: "Mock Producer" } },
    { type: "instrument", "target-type": "artist", direction: "backward", attributes: ["guitar"], artist: { id: GUEST, name: "Mock Guest" } },
    {
      type: "samples material",
      "target-type": "recording",
      direction: "forward",
      recording: { id: REC_SAMPLED, title: "Old Groove", "artist-credit": [credit(OTHER_ARTIST, "Mock Elder")] }
    },
    {
      type: "samples material",
      "target-type": "recording",
      direction: "backward",
      recording: { id: REC_SAMPLER, title: "New Flip", "artist-credit": [credit(OTHER_ARTIST, "Mock Elder")] }
    },
    { type: "free streaming", "target-type": "url", url: { resource: `https://open.spotify.com/track/${SP_TRACK_1}` } },
    {
      type: "performance",
      "target-type": "work",
      work: {
        id: WORK,
        title: "First Song",
        relations: [
          { type: "composer", "target-type": "artist", artist: { id: WRITER, name: "Mock Producer" } },
          { type: "lyricist", "target-type": "artist", artist: { id: WRITER, name: "Mock Producer" } },
          { type: "wikidata", "target-type": "url", url: { resource: "https://www.wikidata.org/wiki/Q900" } }
        ]
      }
    }
  ]
};
const mbWorkRecordings = {
  recordings: [
    { id: REC_1, title: "First Song", "artist-credit": [credit(ARTIST, "Mock Band")] },
    { id: REC_COVER, title: "First Song", "artist-credit": [credit(OTHER_ARTIST, "Mock Elder")] }
  ]
};
const wdClaims = {
  entities: {
    Q900: {
      claims: {
        P166: [
          {
            mainsnak: { datavalue: { value: { id: "Q901" } } },
            qualifiers: { P585: [{ datavalue: { value: { time: "+2016-01-01T00:00:00Z" } } }] }
          }
        ]
      },
      sitelinks: { enwiki: { title: "First Song (Mock Band song)" } }
    }
  }
};
const wdLabels = { entities: { Q901: { labels: { en: { value: "Mock Music Award" } } } } };
const wpSummary = {
  type: "standard",
  extract: "\"First Song\" is a song by Mock Band. It is invented for tests.",
  content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/First_Song" } }
};

type Handler = Parameters<typeof createStubFetch>[0][number];
const on = (needle: string, body: unknown, status = 200): Handler => ({
  match: (url) => url.includes(needle),
  respond: () => (status === 200 ? jsonResponse(body) : statusResponse(status, body))
});
const token: Handler = {
  match: (url) => url.startsWith("https://accounts.spotify.com/api/token"),
  respond: () => jsonResponse({ access_token: ACCESS_TOKEN, token_type: "Bearer", expires_in: 3600 })
};
const discographyHandlers = (extra: Handler[] = []): Handler[] => [
  ...extra,
  token,
  on("musicbrainz.org/ws/2/artist/?query=", mbSearch([{ id: ARTIST, name: "Mock Band", score: 100 }])),
  on(`musicbrainz.org/ws/2/artist/${ARTIST}?inc=url-rels`, mbArtist),
  on(`musicbrainz.org/ws/2/release-group?artist=${ARTIST}`, mbGroups),
  on(`api.spotify.com/v1/artists/${SP_ARTIST}/albums`, spAlbums)
];
const storyHandlers = (extra: Handler[] = []): Handler[] => [
  ...extra,
  on(`musicbrainz.org/ws/2/recording/${REC_1}?inc=`, mbStory),
  on(`musicbrainz.org/ws/2/recording?work=${WORK}`, mbWorkRecordings),
  on("wikidata.org/w/api.php?action=wbgetentities&ids=Q900", wdClaims),
  on("wikidata.org/w/api.php?action=wbgetentities&ids=Q901", wdLabels),
  on("en.wikipedia.org/api/rest_v1/page/summary/", wpSummary)
];

let apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

async function makeApp(handlers: Handler[], withSpotify = true) {
  const { fetchFn, calls } = createStubFetch(handlers);
  const app = await buildTestApp({
    env: {
      MEDIA_HTTP_RETRIES: "0",
      ...(withSpotify ? { SPOTIFY_CLIENT_ID: CLIENT_ID, SPOTIFY_CLIENT_SECRET: CLIENT_SECRET } : {})
    },
    fetchFn
  });
  apps.push(app);
  return { app, calls };
}

const expectNoSecrets = (payload: string) => {
  expect(payload).not.toContain(CLIENT_SECRET);
  expect(payload).not.toContain(ACCESS_TOKEN);
};

describe("GET /api/v1/music/discography", () => {
  it("types releases from MusicBrainz and joins Spotify covers through the linked artist", async () => {
    const { app, calls } = await makeApp(discographyHandlers());
    const res = await app.inject({ method: "GET", url: "/api/v1/music/discography?name=mock%20band" });
    expect(res.statusCode).toBe(200);
    expectNoSecrets(res.payload);
    const body = discographyResponseSchema.parse(res.json());

    expect(body.status).toBe("ok");
    expect(body.spotifyStatus).toBe("linked");
    expect(body.artist?.spotify?.id).toBe(SP_ARTIST);
    expect(body.counts).toEqual({ album: 1, ep: 1, single: 1 });
    expect(body.releases.map((r) => r.title)).toEqual(["Mock Single", "Mock Album", "Mock EP"]);

    const album = body.releases.find((r) => r.id === RG_ALBUM);
    expect(album?.spotify?.id).toBe(SP_ALBUM);
    expect(album?.cover).toMatchObject({ provider: "spotify", linkUrl: `https://open.spotify.com/album/${SP_ALBUM}` });
    const ep = body.releases.find((r) => r.id === RG_EP);
    expect(ep?.kind).toBe("ep");
    expect(ep?.spotify?.id).toBe(SP_EP);
    const single = body.releases.find((r) => r.id === RG_SINGLE);
    expect(single?.spotify).toBeNull();
    expect(single?.cover).toMatchObject({
      provider: "coverartarchive",
      linkUrl: `https://musicbrainz.org/release-group/${RG_SINGLE}`
    });

    const tokenCall = callsMatching(calls, "accounts.spotify.com")[0];
    expect(tokenCall?.init?.method).toBe("POST");
    expect(tokenCall?.url).not.toContain(CLIENT_SECRET);
    const albumsCall = callsMatching(calls, "api.spotify.com")[0];
    expect(albumsCall?.url).toContain("limit=10");
    expect((albumsCall?.init?.headers as Record<string, string>).authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it("reuses the Spotify token across requests", async () => {
    const { app, calls } = await makeApp(discographyHandlers());
    await app.inject({ method: "GET", url: "/api/v1/music/discography?name=Mock%20Band" });
    await app.inject({ method: "GET", url: `/api/v1/music/discography?mbid=${ARTIST}` });
    expect(callsMatching(calls, "accounts.spotify.com")).toHaveLength(1);
  });

  it("returns MusicBrainz data with archive covers when Spotify is not configured", async () => {
    const { app, calls } = await makeApp(discographyHandlers(), false);
    const res = await app.inject({ method: "GET", url: "/api/v1/music/discography?name=Mock%20Band" });
    const body = discographyResponseSchema.parse(res.json());
    expect(body.spotifyStatus).toBe("not_configured");
    expect(body.releases.every((r) => r.cover?.provider === "coverartarchive" && r.spotify === null)).toBe(true);
    expect(callsMatching(calls, "spotify.com")).toHaveLength(0);
  });

  it("keeps the discography when Spotify fails", async () => {
    const { app } = await makeApp(discographyHandlers([on("api.spotify.com", { error: "boom" }, 500)]));
    const res = await app.inject({ method: "GET", url: "/api/v1/music/discography?name=Mock%20Band" });
    expect(res.statusCode).toBe(200);
    expectNoSecrets(res.payload);
    const body = discographyResponseSchema.parse(res.json());
    expect(body.spotifyStatus).toBe("unavailable");
    expect(body.releases).toHaveLength(3);
  });

  it("asks the user to choose when two artists share the exact name", async () => {
    const { app } = await makeApp(
      discographyHandlers([
        on(
          "musicbrainz.org/ws/2/artist/?query=",
          mbSearch([
            { id: ARTIST, name: "Mock Band", score: 100, disambiguation: "UK rock" },
            { id: OTHER_ARTIST, name: "Mock Band", score: 100, disambiguation: "US jazz" }
          ])
        )
      ])
    );
    const res = await app.inject({ method: "GET", url: "/api/v1/music/discography?name=Mock%20Band" });
    const body = discographyResponseSchema.parse(res.json());
    expect(body.status).toBe("ambiguous");
    expect(body.candidates.map((c) => c.disambiguation)).toEqual(["UK rock", "US jazz"]);
    expect(body.releases).toEqual([]);
  });

  it("answers 404 when no artist has the exact name", async () => {
    const { app } = await makeApp(
      discographyHandlers([on("musicbrainz.org/ws/2/artist/?query=", mbSearch([{ id: ARTIST, name: "Mock Bandits", score: 90 }]))])
    );
    const res = await app.inject({ method: "GET", url: "/api/v1/music/discography?name=Mock%20Band" });
    expect(res.statusCode).toBe(404);
    expect(discographyResponseSchema.parse(res.json()).status).toBe("not_found");
  });

  it("rejects missing or unknown query parameters", async () => {
    const { app } = await makeApp([]);
    for (const url of ["/api/v1/music/discography", "/api/v1/music/discography?name=x&extra=1", "/api/v1/music/discography?mbid=nope"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("invalid_query");
    }
  });

  it("maps MusicBrainz outages and rate limits to stable errors", async () => {
    const busy = await makeApp([on("musicbrainz.org", {}, 503)]);
    const res = await busy.app.inject({ method: "GET", url: "/api/v1/music/discography?name=Mock%20Band" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("music_unavailable");

    const limited = await makeApp([on("musicbrainz.org", {}, 429)]);
    const res2 = await limited.app.inject({ method: "GET", url: "/api/v1/music/discography?name=Mock%20Band" });
    expect(res2.statusCode).toBe(429);
    expect(res2.json().error.code).toBe("music_rate_limited");
  });
});

describe("GET /api/v1/music/releases/:id/tracks", () => {
  const handlers = (extra: Handler[] = []): Handler[] => [
    ...extra,
    token,
    on(`musicbrainz.org/ws/2/release-group/${RG_ALBUM}?inc=releases`, mbReleaseGroup),
    on(`musicbrainz.org/ws/2/release/${RELEASE_DIGITAL}?inc=`, mbRelease),
    on(`api.spotify.com/v1/albums/${SP_ALBUM}`, spAlbumFull)
  ];

  it("lists MusicBrainz tracks with featured artists and Spotify track links", async () => {
    const { app } = await makeApp(handlers());
    const res = await app.inject({ method: "GET", url: `/api/v1/music/releases/${RG_ALBUM}/tracks?spotifyAlbumId=${SP_ALBUM}` });
    expect(res.statusCode).toBe(200);
    expectNoSecrets(res.payload);
    const body = releaseTracksResponseSchema.parse(res.json());
    expect(body.release.releaseMbid).toBe(RELEASE_DIGITAL);
    expect(body.spotifyStatus).toBe("linked");
    expect(body.totalDurationMs).toBe(380000);
    expect(body.tracks.map((t) => [t.title, t.spotify?.id, t.explicit])).toEqual([
      ["First Song", SP_TRACK_1, false],
      ["Second Song", SP_TRACK_2, true]
    ]);
    expect(body.tracks[1]?.featured).toEqual(["Mock Guest"]);
    expect(body.tracks[1]?.artistCredit).toBe("Mock Band feat. Mock Guest");
  });

  it("ignores a Spotify album whose title does not match the release", async () => {
    const { app } = await makeApp(
      handlers([on(`api.spotify.com/v1/albums/${SP_ALBUM}`, { ...spAlbumFull, name: "Something Else" })])
    );
    const res = await app.inject({ method: "GET", url: `/api/v1/music/releases/${RG_ALBUM}/tracks?spotifyAlbumId=${SP_ALBUM}` });
    const body = releaseTracksResponseSchema.parse(res.json());
    expect(body.spotifyAlbum).toBeNull();
    expect(body.tracks.every((t) => t.spotify === null)).toBe(true);
  });

  it("answers 404 for an unknown release group and 400 for bad IDs", async () => {
    const { app } = await makeApp([on("musicbrainz.org/ws/2/release-group/", {}, 404)]);
    const missing = await app.inject({ method: "GET", url: `/api/v1/music/releases/${RG_ALBUM}/tracks` });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("release_not_found");
    const bad = await app.inject({ method: "GET", url: `/api/v1/music/releases/${RG_ALBUM}/tracks?spotifyAlbumId=../x` });
    expect(bad.statusCode).toBe(400);
  });
});

describe("GET /api/v1/music/recordings/:mbid/story", () => {
  it("collects credits, samples, other versions and cited facts", async () => {
    const { app } = await makeApp(storyHandlers());
    const res = await app.inject({ method: "GET", url: `/api/v1/music/recordings/${REC_1}/story` });
    expect(res.statusCode).toBe(200);
    const body = recordingStoryResponseSchema.parse(res.json());

    expect(body.recording.spotify?.id).toBe(SP_TRACK_1);
    expect(body.work?.wikidataId).toBe("Q900");
    expect(body.credits.map((c) => c.role)).toEqual(["written_by", "produced_by", "performed_by"]);
    expect(body.credits[0]?.people[0]).toMatchObject({ name: "Mock Producer", detail: "composer, lyricist" });
    expect(body.credits[2]?.people[0]).toMatchObject({ name: "Mock Guest", detail: "guitar" });
    expect(body.samples.map((s) => s.title)).toEqual(["Old Groove"]);
    expect(body.sampledBy.map((s) => s.title)).toEqual(["New Flip"]);
    expect(body.otherVersions.map((s) => s.mbid)).toEqual([REC_COVER]);

    const summary = body.facts.find((f) => f.kind === "summary");
    expect(summary?.source).toMatchObject({ provider: "wikipedia", license: { name: "CC BY-SA 4.0" } });
    expect(body.facts.find((f) => f.kind === "award")).toMatchObject({
      text: "Award received: Mock Music Award",
      year: 2016,
      source: { provider: "wikidata", url: "https://www.wikidata.org/wiki/Q900" }
    });
  });

  it("still answers when Wikimedia is down", async () => {
    const { app } = await makeApp(storyHandlers([on("wikidata.org", {}, 503)]));
    const res = await app.inject({ method: "GET", url: `/api/v1/music/recordings/${REC_1}/story` });
    expect(res.statusCode).toBe(200);
    const body = recordingStoryResponseSchema.parse(res.json());
    expect(body.facts).toEqual([]);
    expect(body.credits.length).toBeGreaterThan(0);
  });

  it("answers 404 for an unknown recording", async () => {
    const { app } = await makeApp([on("musicbrainz.org/ws/2/recording/", {}, 404)]);
    const res = await app.inject({ method: "GET", url: `/api/v1/music/recordings/${REC_1}/story` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("recording_not_found");
  });
});

describe("editionKey", () => {
  it("drops edition, guest and tie-in labels but keeps real subtitles", () => {
    expect(editionKey("Currents (Deluxe Edition)")).toBe(editionKey("Currents"));
    expect(editionKey("Currents - Single")).toBe(editionKey("Currents"));
    expect(editionKey("New Gold (feat. Mock Band and Mock Guest)")).toBe(editionKey("New Gold"));
    expect(editionKey("Wings (From the Motion Picture Mock)")).toBe(editionKey("Wings"));
    expect(editionKey("Songs (For Lovers)")).not.toBe(editionKey("Songs"));
  });
});
