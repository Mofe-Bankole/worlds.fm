import type {
  AlbumIdentity,
  AlbumMediaQuery,
  AlbumMediaResponse,
  ArtistIdentity,
  ArtistMediaQuery,
  ArtistMediaResponse,
  MediaFallback,
  MediaImageCandidate,
  MediaProviderReport,
  MediaProviderStatus
} from "@worlds/shared";
import { musicBrainzIdSchema } from "@worlds/shared";

import type { AppConfig } from "../config.js";
import { isProviderError } from "../lib/errors.js";
import { namesMatch, normalizeName } from "../lib/matching.js";
import { TtlCache } from "../lib/cache.js";
import {
  TheAudioDbAdapter,
  albumCandidatesFromTadb,
  albumIdentityFromTadb,
  artistCandidatesFromTadb,
  identityFromTadbArtist,
  type TadbAlbumRecord,
  type TadbArtistRecord
} from "../integrations/theaudiodb/index.js";
import {
  FanartAdapter,
  artistCandidatesFromFanart
} from "../integrations/fanart/index.js";
import {
  MusicBrainzAdapter,
  albumIdentityFromMbReleaseGroup,
  identityFromMbArtist,
  type MbReleaseGroup
} from "../integrations/musicbrainz/index.js";
import {
  CoverArtArchiveAdapter,
  albumCandidatesFromCaa
} from "../integrations/coverartarchive/index.js";

/**
 * Media Resolution Service.
 *
 * Coordinates the provider adapters into one predictable resolution flow:
 *   1. Resolve a verified identity (exact normalized name/ID matching,
 *      MusicBrainz IDs preferred; ambiguous results are surfaced, never
 *      silently picked).
 *   2. Collect image candidates from providers in the configured order.
 *   3. Assemble a normalized response with provenance, rights status and a
 *      safe fallback — and cache it (negatively when a miss is authoritative).
 *
 * Provider failures are downgraded to per-provider reports; availability of
 * one source never gates the others.
 */

const MAX_MATCHES = 5;

type CachedResolution = ArtistMediaResponse | AlbumMediaResponse;

export interface MediaResolverDeps {
  config: AppConfig;
  theAudioDb: TheAudioDbAdapter;
  fanart: FanartAdapter;
  musicBrainz: MusicBrainzAdapter;
  coverArt: CoverArtArchiveAdapter;
}

interface ArtistIdentityOutcome {
  status: "resolved" | "ambiguous" | "not_found";
  identity: ArtistIdentity | null;
  matches: ArtistIdentity[];
  tadbRecord: TadbArtistRecord | null;
  /** True when at least one identity source answered authoritatively. */
  searchReliable: boolean;
}

interface AlbumIdentityOutcome {
  status: "resolved" | "ambiguous" | "not_found";
  identity: AlbumIdentity | null;
  matches: AlbumIdentity[];
  tadbRecord: TadbAlbumRecord | null;
  searchReliable: boolean;
}

export class MediaResolver {
  private readonly config: AppConfig;
  private readonly theAudioDb: TheAudioDbAdapter;
  private readonly fanart: FanartAdapter;
  private readonly musicBrainz: MusicBrainzAdapter;
  private readonly coverArt: CoverArtArchiveAdapter;
  private readonly resolutionCache: TtlCache<CachedResolution>;

  constructor(deps: MediaResolverDeps) {
    this.config = deps.config;
    this.theAudioDb = deps.theAudioDb;
    this.fanart = deps.fanart;
    this.musicBrainz = deps.musicBrainz;
    this.coverArt = deps.coverArt;
    this.resolutionCache = new TtlCache({
      ttlMs: this.config.mediaCacheTtlMs,
      negativeTtlMs: this.config.mediaNegativeCacheTtlMs,
      maxEntries: this.config.mediaCacheMaxEntries
    });
  }

  /* ---------------------------------------------------------------- */
  /* Artist                                                            */
  /* ---------------------------------------------------------------- */

  async resolveArtistMedia(query: ArtistMediaQuery): Promise<ArtistMediaResponse> {
    const cacheKey = `media:artist:${normalizeName(query.name)}:${query.mbid ?? ""}`;
    const hit = this.resolutionCache.get(cacheKey);
    if (hit.hit) {
      return { ...(hit.value as ArtistMediaResponse), cached: true };
    }

    const reports: MediaProviderReport[] = [];
    const outcome = await this.resolveArtistIdentity(query, reports);

    let candidates: MediaImageCandidate[] = [];
    if (outcome.status === "resolved" && outcome.identity) {
      candidates = await this.collectArtistImages(outcome.identity, outcome.tadbRecord, reports);
    }

    const approvedImages = candidates.filter(
      (candidate) => candidate.rightsStatus === "cleared"
    );
    const response: ArtistMediaResponse = {
      subjectType: "artist",
      query: { name: query.name, mbid: query.mbid ?? null },
      status: outcome.status,
      artist: outcome.identity,
      matches: outcome.matches,
      candidates,
      approvedImages,
      fallback: determineFallback(outcome.status, candidates, approvedImages, outcome.searchReliable, "artist"),
      providers: reports,
      cached: false,
      generatedAt: new Date().toISOString()
    };

    this.storeResolution(cacheKey, response, outcome);
    return response;
  }

  private async resolveArtistIdentity(
    query: ArtistMediaQuery,
    reports: MediaProviderReport[]
  ): Promise<ArtistIdentityOutcome> {
    let searchReliable = false;

    if (query.mbid) {
      // Verified identifier path: prefer the rich TheAudioDB record, fall
      // back to MusicBrainz as the identity source of truth.
      let tadbRecord: TadbArtistRecord | null = null;
      try {
        tadbRecord = await this.theAudioDb.lookupArtistByMbid(query.mbid);
        reports.push(
          makeReport(
            "theaudiodb",
            tadbRecord ? "ok" : "no_results",
            tadbRecord ? undefined : "no artist record for this MusicBrainz ID"
          )
        );
        if (tadbRecord) {
          searchReliable = true;
        }
      } catch (error) {
        reports.push(providerErrorReport("theaudiodb", error));
      }
      if (tadbRecord) {
        const identity = identityFromTadbArtist(tadbRecord);
        return resolvedArtist({ ...identity, mbid: query.mbid }, tadbRecord, searchReliable);
      }

      try {
        const mbArtist = await this.musicBrainz.lookupArtist(query.mbid);
        reports.push(
          makeReport(
            "musicbrainz",
            mbArtist ? "ok" : "no_results",
            mbArtist ? undefined : "no artist record for this MusicBrainz ID"
          )
        );
        if (mbArtist) {
          return resolvedArtist(identityFromMbArtist(mbArtist), null, true);
        }
        searchReliable = true;
      } catch (error) {
        reports.push(providerErrorReport("musicbrainz", error));
      }
      return { status: "not_found", identity: null, matches: [], tadbRecord: null, searchReliable };
    }

    // Name path: TheAudioDB search first, MusicBrainz as backstop.
    let paired: Array<{ record: TadbArtistRecord; identity: ArtistIdentity }> = [];
    let tadbReliable = false;
    try {
      const results = await this.theAudioDb.searchArtists(query.name);
      paired = dedupePairs(
        results
          .filter((record) => exactArtistName(record, query.name))
          .map((record) => ({ record, identity: identityFromTadbArtist(record) }))
      );
      reports.push(makeReport("theaudiodb", paired.length > 0 ? "ok" : "no_results"));
      tadbReliable = true;
      searchReliable = true;
    } catch (error) {
      reports.push(providerErrorReport("theaudiodb", error));
    }

    if (paired.length === 1) {
      const found = paired[0];
      if (!found) {
        return { status: "not_found", identity: null, matches: [], tadbRecord: null, searchReliable };
      }
      let identity = found.identity;

      // Backfill a missing MusicBrainz ID from MusicBrainz search.
      if (!identity.mbid) {
        try {
          const mbMatches = exactMbArtists(
            await this.musicBrainz.searchArtists(query.name),
            query.name
          );
          const distinct = dedupeIdentities(mbMatches.map(identityFromMbArtist));
          const backfill = distinct.length === 1 ? distinct[0] : undefined;
          if (backfill?.mbid) {
            reports.push(makeReport("musicbrainz", "ok", "MusicBrainz ID backfill"));
            identity = { ...identity, mbid: backfill.mbid };
          }
        } catch (error) {
          reports.push(providerErrorReport("musicbrainz", error));
        }
      }
      return resolvedArtist(identity, found.record, searchReliable);
    }
    if (paired.length > 1) {
      return {
        status: "ambiguous",
        identity: null,
        matches: paired.slice(0, MAX_MATCHES).map((pair) => pair.identity),
        tadbRecord: null,
        searchReliable
      };
    }

    // No exact TheAudioDB match: try MusicBrainz directly.
    try {
      const mbMatches = exactMbArtists(
        await this.musicBrainz.searchArtists(query.name),
        query.name
      );
      const distinct = dedupeIdentities(mbMatches.map(identityFromMbArtist));
      reports.push(makeReport("musicbrainz", distinct.length > 0 ? "ok" : "no_results"));
      searchReliable = true;
      if (distinct.length === 1) {
        return resolvedArtist(distinct[0] as ArtistIdentity, null, searchReliable);
      }
      if (distinct.length > 1) {
        return {
          status: "ambiguous",
          identity: null,
          matches: distinct.slice(0, MAX_MATCHES),
          tadbRecord: null,
          searchReliable
        };
      }
    } catch (error) {
      reports.push(providerErrorReport("musicbrainz", error));
    }
    if (!tadbReliable) {
      searchReliable = false;
    }
    return { status: "not_found", identity: null, matches: [], tadbRecord: null, searchReliable };
  }

  private async collectArtistImages(
    identity: ArtistIdentity,
    tadbRecord: TadbArtistRecord | null,
    reports: MediaProviderReport[]
  ): Promise<MediaImageCandidate[]> {
    const candidates: MediaImageCandidate[] = [];
    for (const provider of this.config.artistProviderOrder) {
      if (provider === "theaudiodb") {
        try {
          // `reused` means the identity step already fetched (and reported on)
          // this record, so no extra upstream call or report is needed.
          const reused = tadbRecord !== null;
          let record = tadbRecord;
          if (!record && identity.mbid) {
            record = await this.theAudioDb.lookupArtistByMbid(identity.mbid);
          }
          if (!record) {
            if (!reused) {
              reports.push(makeReport("theaudiodb", "no_results", "no artist images"));
            }
            continue;
          }
          const images = artistCandidatesFromTadb(record, identity);
          candidates.push(...images);
          if (!reused) {
            reports.push(
              makeReport("theaudiodb", images.length > 0 ? "ok" : "no_results", `${images.length} image(s)`)
            );
          }
        } catch (error) {
          reports.push(providerErrorReport("theaudiodb", error));
        }
      } else if (provider === "fanart") {
        if (!this.fanart.isEnabled) {
          reports.push(makeReport("fanart", "disabled", "FANART_API_KEY is not configured"));
          continue;
        }
        if (!identity.mbid) {
          reports.push(makeReport("fanart", "skipped", "requires a MusicBrainz artist ID"));
          continue;
        }
        try {
          const raw = await this.fanart.getArtistImages(identity.mbid);
          if (!raw) {
            reports.push(makeReport("fanart", "no_results"));
            continue;
          }
          const images = artistCandidatesFromFanart(raw, identity);
          candidates.push(...images);
          reports.push(makeReport("fanart", images.length > 0 ? "ok" : "no_results", `${images.length} image(s)`));
        } catch (error) {
          reports.push(providerErrorReport("fanart", error));
        }
      }
    }
    return dedupeCandidates(candidates);
  }

  /* ---------------------------------------------------------------- */
  /* Album                                                             */
  /* ---------------------------------------------------------------- */

  async resolveAlbumMedia(query: AlbumMediaQuery): Promise<AlbumMediaResponse> {
    const cacheKey = [
      "media:album",
      normalizeName(query.artist),
      normalizeName(query.title),
      query.artistMbid ?? "",
      query.releaseMbid ?? "",
      query.releaseGroupMbid ?? ""
    ].join(":");
    const hit = this.resolutionCache.get(cacheKey);
    if (hit.hit) {
      return { ...(hit.value as AlbumMediaResponse), cached: true };
    }

    const reports: MediaProviderReport[] = [];
    const outcome = await this.resolveAlbumIdentity(query, reports);

    let candidates: MediaImageCandidate[] = [];
    let identity = outcome.identity;
    let tadbRecord = outcome.tadbRecord;
    if (outcome.status === "resolved" && identity) {
      const collected = await this.collectAlbumImages(identity, tadbRecord, reports);
      candidates = collected.candidates;
      tadbRecord = collected.tadbRecord ?? tadbRecord;
      identity = enrichAlbumIdentity(identity, tadbRecord);
    }

    const approvedImages = candidates.filter(
      (candidate) => candidate.rightsStatus === "cleared"
    );
    const response: AlbumMediaResponse = {
      subjectType: "album",
      query: {
        artist: query.artist,
        title: query.title,
        artistMbid: query.artistMbid ?? null,
        releaseMbid: query.releaseMbid ?? null,
        releaseGroupMbid: query.releaseGroupMbid ?? null
      },
      status: outcome.status,
      album: identity,
      matches: outcome.matches,
      candidates,
      approvedImages,
      fallback: determineFallback(outcome.status, candidates, approvedImages, outcome.searchReliable, "album"),
      providers: reports,
      cached: false,
      generatedAt: new Date().toISOString()
    };

    this.storeResolution(cacheKey, response, outcome);
    return response;
  }

  private async resolveAlbumIdentity(
    query: AlbumMediaQuery,
    reports: MediaProviderReport[]
  ): Promise<AlbumIdentityOutcome> {
    let searchReliable = false;

    // Verified identifier path.
    if (query.releaseMbid || query.releaseGroupMbid) {
      const identity: AlbumIdentity = {
        title: query.title,
        artistName: query.artist,
        artistMbid: query.artistMbid ?? null,
        releaseMbid: query.releaseMbid ?? null,
        releaseGroupMbid: query.releaseGroupMbid ?? null,
        theAudioDbAlbumId: null
      };
      return {
        status: "resolved",
        identity,
        matches: [],
        tadbRecord: null,
        searchReliable: true
      };
    }

    // MusicBrainz release-group search (primary identity source).
    // Resolve the artist MBID first: searching by `arid:` is alias-proof
    // (e.g. albums credited to “Fẹla” / “Fela Ransome-Kuti” still match).
    let artistMbid = query.artistMbid;
    if (!artistMbid) {
      artistMbid = await this.resolveAlbumArtistMbid(query.artist, reports) ?? undefined;
    }

    let mbSearchReliable = false;
    const runReleaseGroupSearch = async (byName: boolean): Promise<MbReleaseGroup[]> => {
      try {
        const groups = await this.musicBrainz.searchReleaseGroups({
          artist: query.artist,
          title: query.title,
          ...(byName ? {} : artistMbid !== undefined ? { artistMbid } : {})
        });
        const exact = groups.filter(
          (group) =>
            namesMatch(group.title, query.title) &&
            releaseGroupMatchesArtist(group, query.artist, byName ? undefined : artistMbid)
        );
        reports.push(
          makeReport(
            "musicbrainz",
            exact.length > 0 ? "ok" : "no_results",
            byName ? "release-group search by name" : "release-group search by MusicBrainz artist ID"
          )
        );
        mbSearchReliable = true;
        return exact;
      } catch (error) {
        reports.push(providerErrorReport("musicbrainz", error));
        return [];
      }
    };

    let exactGroups = await runReleaseGroupSearch(artistMbid === undefined);
    if (exactGroups.length === 0 && artistMbid) {
      // The arid search can miss RGs credited to a band entity when the caller
      // (or TheAudioDB) resolved the person entity instead — retry by name.
      exactGroups = await runReleaseGroupSearch(true);
    }
    if (mbSearchReliable) {
      searchReliable = true;
    }

    if (exactGroups.length > 0) {
      // Prefer canonical studio-album groupings when several types match.
      const albums = exactGroups.filter((group) => group["primary-type"] === "Album");
      const considered = albums.length > 0 ? albums : exactGroups;
      const canonical = pickCanonicalReleaseGroup(considered);
      if (canonical === "ambiguous") {
        return {
          status: "ambiguous",
          identity: null,
          matches: dedupeIdentities(
            considered.map((group) => albumIdentityFromMbReleaseGroup(group, query.artist))
          ).slice(0, MAX_MATCHES),
          tadbRecord: null,
          searchReliable
        };
      }
      if (canonical) {
        return {
          status: "resolved",
          identity: {
            ...albumIdentityFromMbReleaseGroup(canonical, query.artist),
            artistMbid: artistMbid ?? asMbid(canonical["artist-credit"]?.[0]?.artist?.id)
          },
          matches: [],
          tadbRecord: null,
          searchReliable
        };
      }
    }

    // TheAudioDB fallback when MusicBrainz cannot pin the release group.
    try {
      const albums = await this.theAudioDb.searchAlbum(query.artist, query.title);
      const exact = albums.filter((record) => exactAlbumRecord(record, query.artist, query.title));
      reports.push(makeReport("theaudiodb", exact.length > 0 ? "ok" : "no_results", exact.length > 0 ? "fallback identity" : undefined));
      searchReliable = true;
      const distinct = dedupeIdentities(
        exact.map((record) => albumIdentityFromTadb(record, query.artist))
      );
      if (distinct.length === 1) {
        const record =
          exact.find((item) => item.idAlbum === (distinct[0] as AlbumIdentity).theAudioDbAlbumId) ??
          exact[0] ??
          null;
        return {
          status: "resolved",
          identity: distinct[0] as AlbumIdentity,
          matches: [],
          tadbRecord: record,
          searchReliable
        };
      }
      if (distinct.length > 1) {
        return {
          status: "ambiguous",
          identity: null,
          matches: distinct.slice(0, MAX_MATCHES),
          tadbRecord: null,
          searchReliable
        };
      }
    } catch (error) {
      reports.push(providerErrorReport("theaudiodb", error));
    }
    return { status: "not_found", identity: null, matches: [], tadbRecord: null, searchReliable };
  }

  /**
   * Best-effort artist → MusicBrainz ID resolution used to make the album
   * identity search alias-proof. Returns null when no single exact match
   * exists; failures here must never block album resolution.
   */
  private async resolveAlbumArtistMbid(
    artist: string,
    reports: MediaProviderReport[]
  ): Promise<string | null> {
    try {
      const results = await this.theAudioDb.searchArtists(artist);
      const exact = results.filter((record) => exactArtistName(record, artist));
      const distinct = dedupeIdentities(exact.map(identityFromTadbArtist));
      const match = distinct.length === 1 ? distinct[0] : undefined;
      if (match?.mbid) {
        return match.mbid;
      }
    } catch (error) {
      reports.push(providerErrorReport("theaudiodb", error));
    }
    try {
      const mbMatches = exactMbArtists(await this.musicBrainz.searchArtists(artist), artist);
      const distinct = dedupeIdentities(mbMatches.map(identityFromMbArtist));
      const match = distinct.length === 1 ? distinct[0] : undefined;
      return match?.mbid ?? null;
    } catch (error) {
      reports.push(providerErrorReport("musicbrainz", error));
      return null;
    }
  }

  private async collectAlbumImages(
    identity: AlbumIdentity,
    tadbRecord: TadbAlbumRecord | null,
    reports: MediaProviderReport[]
  ): Promise<{ candidates: MediaImageCandidate[]; tadbRecord: TadbAlbumRecord | null }> {
    const candidates: MediaImageCandidate[] = [];
    let record = tadbRecord;

    for (const provider of this.config.albumProviderOrder) {
      if (provider === "coverartarchive") {
        const subjects: Array<{ kind: "release" | "release-group"; mbid: string }> = [];
        if (identity.releaseMbid) {
          subjects.push({ kind: "release", mbid: identity.releaseMbid });
        }
        if (identity.releaseGroupMbid) {
          subjects.push({ kind: "release-group", mbid: identity.releaseGroupMbid });
        }
        if (subjects.length === 0) {
          reports.push(
            makeReport("coverartarchive", "skipped", "requires a MusicBrainz release or release-group ID")
          );
          continue;
        }
        try {
          let collected = 0;
          for (const subject of subjects) {
            const raw =
              subject.kind === "release"
                ? await this.coverArt.getReleaseImages(subject.mbid)
                : await this.coverArt.getReleaseGroupImages(subject.mbid);
            if (!raw) {
              continue;
            }
            const images = albumCandidatesFromCaa(raw, identity, subject);
            collected += images.length;
            candidates.push(...images);
          }
          reports.push(
            makeReport("coverartarchive", collected > 0 ? "ok" : "no_results", `${collected} front image(s)`)
          );
        } catch (error) {
          reports.push(providerErrorReport("coverartarchive", error));
        }
      } else if (provider === "theaudiodb") {
        try {
          if (!record) {
            const albums = await this.theAudioDb.searchAlbum(
              identity.artistName,
              identity.title
            );
            const exact = albums.filter((candidate) =>
              exactAlbumRecord(candidate, identity.artistName, identity.title)
            );
            record = exact[0] ?? null;
            reports.push(makeReport("theaudiodb", record ? "ok" : "no_results"));
          }
          if (record) {
            candidates.push(...albumCandidatesFromTadb(record, identity));
          }
        } catch (error) {
          reports.push(providerErrorReport("theaudiodb", error));
        }
      }
    }

    return { candidates: dedupeCandidates(candidates), tadbRecord: record };
  }

  /* ---------------------------------------------------------------- */

  private storeResolution(
    key: string,
    response: CachedResolution,
    outcome: { status: string; searchReliable: boolean }
  ): void {
    if (outcome.status === "not_found" && !outcome.searchReliable) {
      // An unverifiable miss (all identity providers failed) is never cached.
      return;
    }
    const hadProviderError = response.providers.some((report) => report.status === "error");
    // Authoritative misses and partially-failed responses get the short
    // negative TTL; healthy resolutions get the standard TTL.
    const negative = outcome.status === "not_found" || hadProviderError;
    this.resolutionCache.set(key, response, { negative });
  }
}

/* -------------------------------------------------------------------- */

function exactArtistName(record: TadbArtistRecord, requested: string): boolean {
  if (namesMatch(record.strArtist, requested)) {
    return true;
  }
  return typeof record.strArtistAlternate === "string" && record.strArtistAlternate.length > 0
    ? namesMatch(record.strArtistAlternate, requested)
    : false;
}

function exactMbArtists<T extends { name: string }>(artists: T[], requested: string): T[] {
  return artists.filter((artist) => namesMatch(artist.name, requested));
}

function dedupePairs<T extends { identity: ArtistIdentity }>(pairs: T[]): T[] {
  const seen = new Set<string>();
  return pairs.filter((pair) => {
    const key = identityKey(pair.identity);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function exactAlbumRecord(record: TadbAlbumRecord, artist: string, title: string): boolean {
  if (!namesMatch(record.strAlbum, title)) {
    return false;
  }
  if (record.strArtist) {
    return namesMatch(record.strArtist, artist);
  }
  return true;
}

/**
 * Deterministically pick the canonical release group among exact matches:
 * the earliest first-release-date wins (original album over later reissues).
 * A tie (or missing dates) is reported as ambiguous rather than guessed.
 */
function pickCanonicalReleaseGroup(groups: MbReleaseGroup[]): MbReleaseGroup | "ambiguous" | null {
  const unique: MbReleaseGroup[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    if (!seen.has(group.id)) {
      seen.add(group.id);
      unique.push(group);
    }
  }
  if (unique.length === 0) {
    return null;
  }
  if (unique.length === 1) {
    return unique[0] ?? null;
  }
  const dated = unique
    .map((group) => ({ group, key: releaseDateKey(group["first-release-date"]) }))
    .sort((a, b) => a.key - b.key);
  const first = dated[0];
  const second = dated[1];
  if (first && second && first.key === second.key) {
    return "ambiguous";
  }
  return first?.group ?? "ambiguous";
}

/** Parse MB partial dates ("1977", "1977-06-03") into a sortable key; missing sorts last. */
function releaseDateKey(value: string | null | undefined): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parts = value.split("-").map((part) => Number.parseInt(part, 10));
  const year = parts[0] ?? 9999;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return year * 10_000 + month * 100 + day;
}

function releaseGroupMatchesArtist(
  group: MbReleaseGroup,
  artist: string,
  artistMbid: string | undefined
): boolean {
  const credits = group["artist-credit"] ?? [];
  return credits.some((credit) => {
    if (artistMbid && credit.artist?.id === artistMbid) {
      return true;
    }
    if (credit.artist?.name && namesMatch(credit.artist.name, artist)) {
      return true;
    }
    return credit.name !== null && credit.name !== undefined && namesMatch(credit.name, artist);
  });
}

function identityKey(identity: ArtistIdentity | AlbumIdentity): string {
  if ("mbid" in identity) {
    return identity.mbid ?? `tadb:${identity.theAudioDbId ?? identity.name.toLowerCase()}`;
  }
  return `album:${identity.releaseGroupMbid ?? identity.theAudioDbAlbumId ?? identity.title.toLowerCase()}`;
}

function dedupeIdentities<T extends ArtistIdentity | AlbumIdentity>(identities: T[]): T[] {
  const seen = new Set<string>();
  return identities.filter((identity) => {
    const key = identityKey(identity);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolvedArtist(
  identity: ArtistIdentity,
  tadbRecord: TadbArtistRecord | null,
  searchReliable: boolean
): ArtistIdentityOutcome {
  return { status: "resolved", identity, matches: [], tadbRecord, searchReliable };
}

function dedupeCandidates(candidates: MediaImageCandidate[]): MediaImageCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) {
      return false;
    }
    seen.add(candidate.url);
    return true;
  });
}

function enrichAlbumIdentity(
  identity: AlbumIdentity,
  record: TadbAlbumRecord | null
): AlbumIdentity {
  if (!record) {
    return identity;
  }
  return {
    ...identity,
    theAudioDbAlbumId: identity.theAudioDbAlbumId ?? record.idAlbum,
    releaseGroupMbid: identity.releaseGroupMbid ?? asMbid(record.strMusicBrainzID),
    artistMbid: identity.artistMbid ?? asMbid(record.strMusicBrainzArtistID)
  };
}

function asMbid(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = musicBrainzIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function makeReport(
  provider: string,
  status: MediaProviderStatus,
  detail?: string
): MediaProviderReport {
  return detail === undefined ? { provider, status } : { provider, status, detail };
}

function providerErrorReport(provider: string, error: unknown): MediaProviderReport {
  if (isProviderError(error)) {
    return makeReport(provider, "error", error.reportDetail);
  }
  return makeReport(provider, "error", "unexpected_error");
}

function determineFallback(
  status: "resolved" | "ambiguous" | "not_found",
  candidates: MediaImageCandidate[],
  approvedImages: MediaImageCandidate[],
  searchReliable: boolean,
  subject: "artist" | "album"
): MediaFallback | null {
  if (status === "not_found") {
    return searchReliable
      ? {
          reason: "unresolved",
          message: `No verified ${subject} match was found; render a neutral placeholder.`
        }
      : {
          reason: "providers_unavailable",
          message: "Metadata providers are temporarily unavailable; render a neutral placeholder and retry later."
        };
  }
  if (status === "ambiguous") {
    return {
      reason: "ambiguous",
      message: `Several ${subject}s matched this query; ask the caller to refine the search or supply a MusicBrainz ID.`
    };
  }
  if (candidates.length === 0) {
    return {
      reason: "no_images",
      message: `No ${subject} images were found at any provider; render a neutral placeholder.`
    };
  }
  if (approvedImages.length === 0) {
    return {
      reason: "rights_unverified",
      message:
        "Discovered images have unverified usage rights; render a neutral placeholder until rights are reviewed."
    };
  }
  return null;
}
