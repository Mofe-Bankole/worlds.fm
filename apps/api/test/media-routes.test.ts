import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  albumMediaResponseSchema,
  artistMediaResponseSchema
} from "@worlds/shared";

import { buildTestApp } from "./helpers.js";
import {
  caaResponse,
  callsMatching,
  createStubFetch,
  fanartArtistResponse,
  hangingFetch,
  jsonResponse,
  mbArtist,
  mbArtistSearchResponse,
  mbReleaseGroup,
  mbReleaseGroupSearchResponse,
  statusResponse,
  tadbAlbumRecord,
  tadbAlbumSearchResponse,
  tadbArtistRecord,
  tadbArtistSearchResponse
} from "./fixtures.js";

const FELA_MBID = "6514cffa-fbe0-4965-ad88-e998ead8a82a";

let apps: FastifyInstance[] = [];

async function makeApp(options: {
  env?: Record<string, string>;
  handlers: Parameters<typeof createStubFetch>[0];
}) {
  const { fetchFn, calls } = createStubFetch(options.handlers);
  const app = await buildTestApp({ env: options.env ?? {}, fetchFn });
  apps.push(app);
  return { app, calls };
}

beforeEach(() => {
  apps = [];
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

/* ---------------------------------------------------------------- */
/* Artist                                                            */
/* ---------------------------------------------------------------- */

describe("GET /api/v1/media/artist", () => {
  it("resolves a known artist via TheAudioDB; fanart reports disabled without a key", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com/api/v1/json/"),
          respond: () => jsonResponse(tadbArtistSearchResponse([tadbArtistRecord()]))
        },
        {
          match: (url) => url.includes("musicbrainz.org"),
          respond: () => jsonResponse(mbArtistSearchResponse([]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    expect(response.statusCode).toBe(200);
    const body = artistMediaResponseSchema.parse(response.json());

    expect(body.status).toBe("resolved");
    expect(body.cached).toBe(false);
    expect(body.artist).toEqual({
      name: "Fela Kuti",
      mbid: FELA_MBID,
      theAudioDbId: "121444"
    });
    expect(body.matches).toEqual([]);

    const artistImages = body.candidates.filter((c) => c.imageType === "artist");
    const backgrounds = body.candidates.filter((c) => c.imageType === "background");
    expect(artistImages.map((c) => c.url)).toContain(
      "https://r2.theaudiodb.com/images/media/artist/thumb/fela.jpg"
    );
    expect(backgrounds).toHaveLength(1);
    expect(body.candidates.every((c) => c.provider === "theaudiodb")).toBe(true);

    expect(body.providers).toContainEqual({ provider: "theaudiodb", status: "ok" });
    expect(body.providers).toContainEqual({
      provider: "fanart",
      status: "disabled",
      detail: "FANART_API_KEY is not configured"
    });

    // Nothing is rights-cleared in Phase 0: public display must use fallback art.
    expect(body.candidates.every((c) => c.rightsStatus === "unverified")).toBe(true);
    expect(body.approvedImages).toEqual([]);
    expect(body.fallback?.reason).toBe("rights_unverified");
  });

  it("collects fanart images when a key is configured, in configured order", async () => {
    const { app } = await makeApp({
      env: { FANART_API_KEY: "mock-fanart-key-for-tests" },
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbArtistSearchResponse([tadbArtistRecord()]))
        },
        {
          match: (url) => url.includes("webservice.fanart.tv"),
          respond: () => jsonResponse(fanartArtistResponse())
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    const body = artistMediaResponseSchema.parse(response.json());

    expect(body.status).toBe("resolved");
    expect(body.providers).toContainEqual({ provider: "fanart", status: "ok", detail: "2 image(s)" });
    const fanartUrls = body.candidates.filter((c) => c.provider === "fanart").map((c) => c.url);
    expect(fanartUrls).toContain("https://assets.fanart.tv/fanart/music/fela-thumb.jpg");
    expect(fanartUrls).toContain("https://assets.fanart.tv/fanart/music/fela-bg.jpg");
    // TheAudioDB runs first by default order.
    expect(body.candidates[0]?.provider).toBe("theaudiodb");
    // The API key must never appear anywhere in the payload.
    expect(response.body).not.toContain("mock-fanart-key-for-tests");
  });

  it("puts fanart candidates first when the discovery order is customized", async () => {
    const { app } = await makeApp({
      env: {
        FANART_API_KEY: "mock-fanart-key-for-tests",
        MEDIA_ARTIST_PROVIDER_ORDER: "fanart,theaudiodb"
      },
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbArtistSearchResponse([tadbArtistRecord()]))
        },
        {
          match: (url) => url.includes("webservice.fanart.tv"),
          respond: () => jsonResponse(fanartArtistResponse())
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.candidates[0]?.provider).toBe("fanart");
  });

  it("resolves by a verified MusicBrainz identifier without a name search", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com/api/v1/json/123/artist-mb.php"),
          respond: () => jsonResponse(tadbArtistSearchResponse([tadbArtistRecord()]))
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => {
            throw new Error("unexpected TheAudioDB call");
          }
        }
      ]
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/media/artist?name=Fela%20Kuti&mbid=${FELA_MBID}`
    });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.artist?.mbid).toBe(FELA_MBID);
    expect(callsMatching(calls, "search.php")).toHaveLength(0);
    expect(callsMatching(calls, "musicbrainz.org")).toHaveLength(0);
    expect(callsMatching(calls, "artist-mb.php")).toHaveLength(1);
  });

  it("falls back to MusicBrainz identity when TheAudioDB has no exact match", async () => {
    const mbFela = mbArtist({ id: FELA_MBID, name: "Fela Kuti" });
    const { app } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbArtistSearchResponse(null))
        },
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/artist/"),
          respond: () => jsonResponse(mbArtistSearchResponse([mbFela]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.artist?.mbid).toBe(FELA_MBID);
    expect(body.providers).toContainEqual({ provider: "theaudiodb", status: "no_results" });
    expect(body.providers).toContainEqual({ provider: "musicbrainz", status: "ok" });
    // No image available from an identity-only MusicBrainz match.
    expect(body.candidates).toEqual([]);
    expect(body.fallback?.reason).toBe("no_images");
  });

  it("rejects ambiguous names with candidate matches instead of guessing", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () =>
            jsonResponse(
              tadbArtistSearchResponse([
                tadbArtistRecord({ idArtist: "9001", strArtist: "Nirvana", strMusicBrainzID: "5b11f4ce-a62d-471e-81fc-a69a8278c7da" }),
                tadbArtistRecord({ idArtist: "9002", strArtist: "Nirvana", strMusicBrainzID: "9282c8b4-ca0b-4b2c-9beb-7c6b4a120000" })
              ])
            )
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Nirvana" });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("ambiguous");
    expect(body.artist).toBeNull();
    expect(body.matches).toHaveLength(2);
    expect(body.candidates).toEqual([]);
    expect(body.fallback?.reason).toBe("ambiguous");
  });

  it("names that only partially match do NOT count as the artist", async () => {
    const { app } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () =>
            jsonResponse(tadbArtistSearchResponse([tadbArtistRecord({ strArtist: "Fela Kuti & Egypt 80" })]))
        },
        {
          match: (url) => url.includes("musicbrainz.org"),
          respond: () => jsonResponse(mbArtistSearchResponse([]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("not_found");
    expect(body.fallback?.reason).toBe("unresolved");
  });

  it("returns a predictable not_found for unknown artists and negative-caches it", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbArtistSearchResponse(null))
        },
        {
          match: (url) => url.includes("musicbrainz.org"),
          respond: () => jsonResponse(mbArtistSearchResponse([]))
        }
      ]
    });

    const first = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Nobody%20Real" });
    const second = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Nobody%20Real" });

    expect(artistMediaResponseSchema.parse(first.json()).status).toBe("not_found");
    const secondBody = artistMediaResponseSchema.parse(second.json());
    expect(secondBody.status).toBe("not_found");
    expect(secondBody.cached).toBe(true);
    // Two upstream calls on the miss (tadb + mb), none on the second request.
    expect(calls).toHaveLength(2);
  });

  it("survives a provider timeout and reports it instead of crashing", async () => {
    const hang = hangingFetch();
    const { app } = await makeApp({
      env: { MEDIA_HTTP_TIMEOUT_MS: "150", MEDIA_HTTP_RETRIES: "0" },
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: (url, init) => hang(url, init)
        },
        {
          match: (url) => url.includes("musicbrainz.org"),
          respond: () => jsonResponse(mbArtistSearchResponse([mbArtist({ id: FELA_MBID })]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.artist?.mbid).toBe(FELA_MBID);
    const tadbErrors = body.providers.filter((p) => p.provider === "theaudiodb");
    expect(tadbErrors.some((p) => p.status === "error" && p.detail?.includes("timeout"))).toBe(true);
  });

  it("surfaces provider rate limiting as a report, not a crash", async () => {
    const { app } = await makeApp({
      env: { MEDIA_HTTP_RETRY_BASE_MS: "25" },
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => statusResponse(429, { error: "Too many requests" }, { "retry-after": "0" })
        },
        {
          match: (url) => url.includes("musicbrainz.org"),
          respond: () => jsonResponse(mbArtistSearchResponse([]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("not_found");
    expect(
      body.providers.some((p) => p.provider === "theaudiodb" && p.detail?.includes("429"))
    ).toBe(true);
    // Misses without reliable identity evidence are not allowed to look permanent:
    expect(body.fallback?.reason).toBe("providers_unavailable");
  });

  it("handles invalid Fanart credentials without failing the artist", async () => {
    const { app } = await makeApp({
      env: { FANART_API_KEY: "definitely-wrong" },
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbArtistSearchResponse([tadbArtistRecord()]))
        },
        {
          match: (url) => url.includes("webservice.fanart.tv"),
          respond: () => statusResponse(401, { error: "invalid API key" })
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });
    const body = artistMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.providers).toContainEqual({
      provider: "fanart",
      status: "error",
      detail: "unauthorized (HTTP 401)"
    });
    expect(body.candidates.some((c) => c.provider === "theaudiodb")).toBe(true);
  });
});

/* ---------------------------------------------------------------- */
/* Album                                                             */
/* ---------------------------------------------------------------- */

const RIHANNA_ARTIST_MBID = "73e5e69d-3554-40d8-8516-00cb38737a1c";
const ANTI_RG_MBID = "0c482acd-35a2-466b-b833-ef5f2f1297d4";

function tadbRihannaArtistHandler() {
  return {
    match: (url: string) => url.includes("/search.php"),
    respond: () =>
      jsonResponse(
        tadbArtistSearchResponse([
          tadbArtistRecord({
            idArtist: "111305",
            strArtist: "Rihanna",
            strMusicBrainzID: RIHANNA_ARTIST_MBID
          })
        ])
      )
  };
}

describe("GET /api/v1/media/album", () => {
  it("resolves an album via MusicBrainz with Cover Art Archive + TheAudioDB art", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        tadbRihannaArtistHandler(),
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/release-group/"),
          respond: () => jsonResponse(mbReleaseGroupSearchResponse([mbReleaseGroup()]))
        },
        {
          match: (url) => url.includes("coverartarchive.org/release-group/"),
          respond: () => jsonResponse(caaResponse())
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse([tadbAlbumRecord()]))
        }
      ]
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/media/album?artist=Rihanna&title=ANTI"
    });
    expect(response.statusCode).toBe(200);
    const body = albumMediaResponseSchema.parse(response.json());

    expect(body.status).toBe("resolved");
    expect(body.album).toMatchObject({
      title: "Anti",
      artistName: "Rihanna",
      artistMbid: RIHANNA_ARTIST_MBID,
      releaseGroupMbid: ANTI_RG_MBID,
      theAudioDbAlbumId: "2257888"
    });

    // The alias-proof release-group search runs by MusicBrainz artist ID.
    expect(callsMatching(calls, "arid%3A" + RIHANNA_ARTIST_MBID)).toHaveLength(1);
    expect(body.providers).toContainEqual({
      provider: "musicbrainz",
      status: "ok",
      detail: "release-group search by MusicBrainz artist ID"
    });

    const providers = body.candidates.map((c) => c.provider);
    expect(providers).toContain("coverartarchive");
    expect(providers).toContain("theaudiodb");
    // Cover Art Archive comes first in the default order.
    expect(body.candidates[0]?.provider).toBe("coverartarchive");
    expect(body.candidates.every((c) => c.imageType === "album")).toBe(true);
    expect(body.candidates.every((c) => c.rightsStatus === "unverified")).toBe(true);
    expect(body.approvedImages).toEqual([]);
    expect(body.fallback?.reason).toBe("rights_unverified");
  });

  it("serves caller-supplied verified MusicBrainz identifiers without an identity search", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("coverartarchive.org"),
          respond: () => jsonResponse(caaResponse())
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse([tadbAlbumRecord()]))
        }
      ]
    });

    const releaseMbid = "2c4f9421-6f2a-4f93-9b2d-92b7f6a3d000";
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/media/album?artist=Rihanna&title=ANTI&releaseMbid=${releaseMbid}&releaseGroupMbid=${ANTI_RG_MBID}`
    });
    const body = albumMediaResponseSchema.parse(response.json());

    expect(body.status).toBe("resolved");
    expect(body.album?.releaseMbid).toBe(releaseMbid);
    expect(body.album?.releaseGroupMbid).toBe(ANTI_RG_MBID);
    expect(callsMatching(calls, "musicbrainz.org")).toHaveLength(0);
    expect(callsMatching(calls, "/search.php")).toHaveLength(0);
    expect(callsMatching(calls, "coverartarchive.org/release/")).toHaveLength(1);
    expect(callsMatching(calls, "coverartarchive.org/release-group/")).toHaveLength(1);
  });

  it("keeps release IDs and release-group IDs clearly distinct", async () => {
    const { app } = await makeApp({
      handlers: [
        tadbRihannaArtistHandler(),
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/release-group/"),
          respond: () => jsonResponse(mbReleaseGroupSearchResponse([mbReleaseGroup()]))
        },
        {
          match: (url) => url.includes("coverartarchive.org"),
          respond: () => jsonResponse(caaResponse())
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse([tadbAlbumRecord()]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/album?artist=Rihanna&title=ANTI" });
    const body = albumMediaResponseSchema.parse(response.json());
    expect(body.album?.releaseMbid).toBeNull();
    expect(body.album?.releaseGroupMbid).toBe(ANTI_RG_MBID);
    for (const candidate of body.candidates) {
      expect(candidate.releaseMbid).not.toBe(candidate.releaseGroupMbid);
    }
  });

  it("falls back to TheAudioDB art when Cover Art Archive 404s", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        tadbRihannaArtistHandler(),
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/release-group/"),
          respond: () => jsonResponse(mbReleaseGroupSearchResponse([mbReleaseGroup()]))
        },
        {
          match: (url) => url.includes("coverartarchive.org"),
          respond: () => statusResponse(404)
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse([tadbAlbumRecord()]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/album?artist=Rihanna&title=ANTI" });
    const body = albumMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.providers).toContainEqual({
      provider: "coverartarchive",
      status: "no_results",
      detail: "0 front image(s)"
    });
    expect(
      body.candidates.some((c) => c.url === "https://r2.theaudiodb.com/images/media/album/thumb/hq/anti.jpg")
    ).toBe(true);
    // A second request is fully served from cache (CAA miss was negative-cached,
    // and the whole resolution is cached).
    await app.inject({ method: "GET", url: "/api/v1/media/album?artist=Rihanna&title=ANTI" });
    expect(callsMatching(calls, "coverartarchive.org")).toHaveLength(1);
  });

  it("survives Cover Art Archive being down and still serves TheAudioDB art", async () => {
    const { app } = await makeApp({
      handlers: [
        tadbRihannaArtistHandler(),
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/release-group/"),
          respond: () => jsonResponse(mbReleaseGroupSearchResponse([mbReleaseGroup()]))
        },
        {
          match: (url) => url.includes("coverartarchive.org"),
          respond: () => statusResponse(503)
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse([tadbAlbumRecord()]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/album?artist=Rihanna&title=ANTI" });
    const body = albumMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(
      body.providers.some((p) => p.provider === "coverartarchive" && p.status === "error")
    ).toBe(true);
    expect(body.candidates.some((c) => c.provider === "theaudiodb")).toBe(true);
  });

  it("reports resolved albums with genuinely missing artwork", async () => {
    const bareAlbum = tadbAlbumRecord({ strAlbumThumb: null, strAlbumThumbHQ: null, strAlbumCDart: null });
    const { app } = await makeApp({
      handlers: [
        tadbRihannaArtistHandler(),
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/release-group/"),
          respond: () => jsonResponse(mbReleaseGroupSearchResponse([mbReleaseGroup()]))
        },
        {
          match: (url) => url.includes("coverartarchive.org"),
          respond: () => statusResponse(404)
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse([bareAlbum]))
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/album?artist=Rihanna&title=ANTI" });
    const body = albumMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.candidates).toEqual([]);
    expect(body.fallback?.reason).toBe("no_images");
  });

  it("flags same-date duplicate release groups as ambiguous instead of guessing", async () => {
    const { app } = await makeApp({
      handlers: [
        tadbRihannaArtistHandler(),
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/artist/"),
          respond: () => jsonResponse(mbArtistSearchResponse([]))
        },
        {
          match: (url) => url.includes("musicbrainz.org"),
          respond: () =>
            jsonResponse(
              mbReleaseGroupSearchResponse([
                mbReleaseGroup({ id: "0c482acd-35a2-466b-b833-ef5f2f1297d4" }),
                mbReleaseGroup({ id: "3fa1f3a2-7e7e-4d1f-9f69-97aa7ff72000" })
              ])
            )
        }
      ]
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/media/album?artist=Rihanna&title=ANTI" });
    const body = albumMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("ambiguous");
    expect(body.album).toBeNull();
    expect(body.matches).toHaveLength(2);
    expect(body.candidates).toEqual([]);
  });

  it("picks the earliest release date among same-title duplicates (original over reissue)", async () => {
    const { app } = await makeApp({
      handlers: [
        tadbRihannaArtistHandler(),
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/release-group/"),
          respond: () =>
            jsonResponse(
              mbReleaseGroupSearchResponse([
                mbReleaseGroup({
                  id: "87164686-938c-30d5-accc-c50957735686",
                  title: "Exodus",
                  "first-release-date": "2000",
                  "artist-credit": [
                    {
                      name: "Bob Marley & The Wailers",
                      artist: {
                        id: "1c77a04e-5c18-4dc3-a9f8-1472d0a091c8",
                        name: "Bob Marley & The Wailers"
                      }
                    }
                  ]
                }),
                mbReleaseGroup({
                  id: "c5650313-60f3-34d3-92e4-300545133792",
                  title: "Exodus",
                  "first-release-date": "1977-06-03",
                  "artist-credit": [
                    {
                      name: "Bob Marley & The Wailers",
                      artist: {
                        id: "1c77a04e-5c18-4dc3-a9f8-1472d0a091c8",
                        name: "Bob Marley & The Wailers"
                      }
                    }
                  ]
                })
              ])
            )
        },
        {
          match: (url) => url.includes("coverartarchive.org"),
          respond: () => statusResponse(404)
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: (url) =>
            url.includes("searchalbum")
              ? jsonResponse(tadbAlbumSearchResponse(null))
              : jsonResponse(tadbArtistSearchResponse(null))
        }
      ]
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/media/album?artist=Bob%20Marley%20%26%20The%20Wailers&title=Exodus"
    });
    const body = albumMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.album?.releaseGroupMbid).toBe("c5650313-60f3-34d3-92e4-300545133792");
  });

  it("resolves albums credited to artist ALIASES by searching with the artist MBID", async () => {
    // MusicBrainz credits “Zombie” (1976) to “Fẹla” + Afrika 70; the name-only
    // query never matches, but the arid search does.
    const zombieRg = mbReleaseGroup({
      id: "517cbfb2-2279-4af9-8ca7-1c4c1a444925",
      title: "Zombie",
      "first-release-date": "1976",
      "artist-credit": [
        { name: "Fẹla", artist: { id: FELA_MBID, name: "Fẹla" } },
        { name: "Afrika 70", artist: { id: "dc45f2dc-ef36-4a7a-aa52-97495fca8ced", name: "Afrika 70" } }
      ]
    });
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("/search.php"),
          respond: () => jsonResponse(tadbArtistSearchResponse([tadbArtistRecord()]))
        },
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/release-group/"),
          respond: () => jsonResponse(mbReleaseGroupSearchResponse([zombieRg]))
        },
        {
          match: (url) => url.includes("coverartarchive.org"),
          respond: () => statusResponse(404)
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse(null))
        }
      ]
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/media/album?artist=Fela%20Kuti&title=Zombie"
    });
    const body = albumMediaResponseSchema.parse(response.json());
    expect(body.status).toBe("resolved");
    expect(body.album?.releaseGroupMbid).toBe("517cbfb2-2279-4af9-8ca7-1c4c1a444925");
    expect(body.album?.artistMbid).toBe(FELA_MBID);
    expect(callsMatching(calls, "arid%3A" + FELA_MBID)).toHaveLength(1);
  });

  it("marks unknown albums as not_found with a short negative cache", async () => {
    const { app, calls } = await makeApp({
      handlers: [
        {
          match: (url) => url.includes("/search.php"),
          respond: () => jsonResponse(tadbArtistSearchResponse(null))
        },
        {
          match: (url) => url.includes("musicbrainz.org/ws/2/artist/"),
          respond: () => jsonResponse(mbArtistSearchResponse([]))
        },
        {
          match: (url) => url.includes("musicbrainz.org"),
          respond: () => jsonResponse(mbReleaseGroupSearchResponse([]))
        },
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbAlbumSearchResponse(null))
        }
      ]
    });

    const first = await app.inject({
      method: "GET",
      url: "/api/v1/media/album?artist=Nobody%20Real&title=Imaginary%20Album"
    });
    const upstreamCalls = calls.length;
    const second = await app.inject({
      method: "GET",
      url: "/api/v1/media/album?artist=Nobody%20Real&title=Imaginary%20Album"
    });
    expect(albumMediaResponseSchema.parse(first.json()).status).toBe("not_found");
    expect(albumMediaResponseSchema.parse(second.json()).cached).toBe(true);
    expect(calls.length).toBe(upstreamCalls);
  });
});

/* ---------------------------------------------------------------- */
/* Query validation                                                  */
/* ---------------------------------------------------------------- */

describe("query validation", () => {
  it("rejects invalid artist queries with a stable 400 envelope", async () => {
    const { app } = await makeApp({ handlers: [] });

    const cases = [
      "/api/v1/media/artist", // missing name
      "/api/v1/media/artist?name=x", // too short
      `/api/v1/media/artist?name=${"a".repeat(121)}`, // too long
      "/api/v1/media/artist?name=Fela%20Kuti&mbid=not-a-uuid",
      "/api/v1/media/artist?name=Fela%20Kuti&debug=true" // strict keys
    ];
    for (const url of cases) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(400);
      const body = response.json() as { error: { code: string; requestId: string } };
      expect(body.error.code).toBe("invalid_query");
      expect(typeof body.error.requestId).toBe("string");
    }
  });

  it("rejects invalid album queries", async () => {
    const { app } = await makeApp({ handlers: [] });
    const cases = [
      "/api/v1/media/album?title=ANTI", // missing artist
      "/api/v1/media/album?artist=Rihanna", // missing title
      "/api/v1/media/album?artist=R&title=ANTI" // artist too short
    ];
    for (const url of cases) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(400);
    }
  });
});

/* ---------------------------------------------------------------- */
/* Resolution cache lifecycle                                        */
/* ---------------------------------------------------------------- */

describe("resolution cache", () => {
  it("serves hits until the TTL expires, then refreshes from providers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));

    const { app, calls } = await makeApp({
      env: { MEDIA_CACHE_TTL_MS: "1000", MEDIA_NEGATIVE_CACHE_TTL_MS: "1000" },
      handlers: [
        {
          match: (url) => url.includes("theaudiodb.com"),
          respond: () => jsonResponse(tadbArtistSearchResponse([tadbArtistRecord()]))
        }
      ]
    });

    const get = () => app.inject({ method: "GET", url: "/api/v1/media/artist?name=Fela%20Kuti" });

    const first = artistMediaResponseSchema.parse((await get()).json());
    const second = artistMediaResponseSchema.parse((await get()).json());
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(callsMatching(calls, "theaudiodb.com")).toHaveLength(1);

    vi.setSystemTime(new Date("2026-10-20T00:00:01.500Z"));
    const third = artistMediaResponseSchema.parse((await get()).json());
    expect(third.cached).toBe(false);
    expect(callsMatching(calls, "theaudiodb.com")).toHaveLength(2);
  });
});
