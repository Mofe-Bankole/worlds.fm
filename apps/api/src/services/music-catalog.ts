import {
  MUSIC_CATALOG_NOTICE,
  RELEASE_KINDS,
  type Credit,
  type CreditRole,
  type CoverArt,
  type DiscographyQuery,
  type DiscographyResponse,
  type LinkedRecording,
  type RecordingStoryResponse,
  type Release,
  type ReleaseKind,
  type ReleaseTracksResponse,
  type SpotifyLink,
  type SpotifyStatus,
  type Track,
  type TrackFact
} from "@worlds/shared";

import {
  creditText,
  type MbBrowseReleaseGroup,
  type MbCredit,
  type MbRecordingStory,
  type MbReleaseSummary,
  type MusicBrainzCatalog
} from "../integrations/musicbrainz/index.js";
import {
  spotifyIdFromUrl,
  spotifyUrl,
  type SpotifyAdapter,
  type SpotifyAlbum,
  type SpotifyAlbumScope,
  type SpotifySimpleAlbum
} from "../integrations/spotify/index.js";
import type { WikimediaAdapter } from "../integrations/wikimedia/index.js";
import { ApiError, isProviderError } from "../lib/errors.js";
import { namesMatch, normalizeName } from "../lib/matching.js";

const MB = "https://musicbrainz.org";
const PRIMARY_KIND: Record<string, ReleaseKind> = { Album: "album", EP: "ep", Single: "single" };
/** Secondary types that still belong in a discography; live, compilation and remix sets are left out. */
const KEPT_SECONDARY = new Set(["Soundtrack", "Mixtape/Street"]);
const MAX_LINKED = 12;
const MAX_OTHER_VERSIONS = 8;
const SUMMARY_MAX_CHARS = 420;
const CC_BY_SA = { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" };

export interface MusicCatalogServiceOptions {
  musicBrainz: MusicBrainzCatalog;
  spotify: SpotifyAdapter;
  wikimedia: WikimediaAdapter;
  log?: { warn: (obj: object, msg: string) => void };
}

/**
 * Builds discographies, track lists and track stories. MusicBrainz decides
 * what exists and how it is typed; Spotify is joined on afterwards for covers
 * and links, and only through IDs MusicBrainz links to or titles that match
 * exactly after removing edition labels. A Spotify failure never hides
 * MusicBrainz data.
 */
export class MusicCatalogService {
  private readonly mb: MusicBrainzCatalog;
  private readonly spotify: SpotifyAdapter;
  private readonly wikimedia: WikimediaAdapter;
  private readonly log: MusicCatalogServiceOptions["log"];

  constructor(options: MusicCatalogServiceOptions) {
    this.mb = options.musicBrainz;
    this.spotify = options.spotify;
    this.wikimedia = options.wikimedia;
    this.log = options.log;
  }

  async discography(query: DiscographyQuery): Promise<DiscographyResponse> {
    const base = {
      candidates: [] as DiscographyResponse["candidates"],
      releases: [] as Release[],
      counts: { album: 0, ep: 0, single: 0 },
      spotifyPending: [] as ReleaseKind[],
      notice: MUSIC_CATALOG_NOTICE,
      retrievedAt: new Date().toISOString()
    };
    const spotifyIdle: SpotifyStatus = this.spotify.isEnabled ? "no_spotify_link" : "not_configured";

    let mbid = query.mbid ?? null;
    if (!mbid) {
      const found = await musicCall(() => this.mb.searchArtists(query.name ?? ""));
      const exact = found.filter((artist) => namesMatch(artist.name, query.name ?? ""));
      if (exact.length === 0) {
        return { ...base, status: "not_found", artist: null, spotifyStatus: spotifyIdle };
      }
      const [top, second] = exact;
      if (second && (second.score ?? 0) >= (top?.score ?? 0)) {
        return {
          ...base,
          status: "ambiguous",
          artist: null,
          spotifyStatus: spotifyIdle,
          candidates: exact.slice(0, 6).map((artist) => ({
            mbid: artist.id,
            name: artist.name,
            disambiguation: artist.disambiguation || null
          }))
        };
      }
      mbid = top?.id ?? null;
    }
    if (!mbid) return { ...base, status: "not_found", artist: null, spotifyStatus: spotifyIdle };

    const artist = await musicCall(() => this.mb.lookupArtist(mbid));
    if (!artist) return { ...base, status: "not_found", artist: null, spotifyStatus: spotifyIdle };

    const spotifyArtistId =
      (artist.relations ?? [])
        .map((relation) => (relation.url ? spotifyIdFromUrl(relation.url.resource, "artist") : null))
        .find((id): id is string => Boolean(id)) ?? null;

    const scope: SpotifyAlbumScope = query.include === "all" ? "all" : "albums";
    const [groups, spotifyResult] = await Promise.all([
      musicCall(() => this.mb.browseReleaseGroups(artist.id)),
      this.spotifyAlbums(spotifyArtistId, scope)
    ]);

    const releases = groups
      .flatMap((group) => {
        const kind = PRIMARY_KIND[group["primary-type"] ?? ""];
        const secondary = group["secondary-types"] ?? [];
        if (!kind || secondary.some((type) => !KEPT_SECONDARY.has(type))) return [];
        return [toRelease(group, kind, matchSpotifyAlbum(group, kind, spotifyResult.albums))];
      })
      .sort(byDateDesc);

    const counts = { album: 0, ep: 0, single: 0 };
    for (const release of releases) counts[release.kind] += 1;

    // Only the album listing was joined, so EPs and singles (which Spotify
    // lists together, separately from albums) can still gain covers and links
    // if the caller asks again with `include=all`.
    const spotifyPending: ReleaseKind[] =
      scope === "all" || spotifyResult.status !== "linked"
        ? []
        : RELEASE_KINDS.filter((kind) => kind !== "album" && counts[kind] > 0);

    return {
      ...base,
      status: "ok",
      artist: {
        mbid: artist.id,
        name: artist.name,
        disambiguation: artist.disambiguation || null,
        musicbrainzUrl: `${MB}/artist/${artist.id}`,
        spotify: spotifyArtistId ? { id: spotifyArtistId, url: spotifyUrl("artist", spotifyArtistId) } : null
      },
      releases,
      counts,
      spotifyPending,
      spotifyStatus: spotifyResult.status
    };
  }

  async releaseTracks(releaseGroupId: string, spotifyAlbumId?: string): Promise<ReleaseTracksResponse> {
    const group = await musicCall(() => this.mb.lookupReleaseGroup(releaseGroupId));
    if (!group) throw new ApiError(404, "release_not_found", "MusicBrainz has no release group with that ID.");

    let spotifyStatus: SpotifyStatus = this.spotify.isEnabled ? "no_spotify_link" : "not_configured";
    let album: SpotifyAlbum | null = null;
    if (spotifyAlbumId && this.spotify.isEnabled) {
      try {
        const candidate = await this.spotify.getAlbum(spotifyAlbumId);
        // Only accept the album if it is the same release under its title.
        if (candidate && editionKey(candidate.name) === editionKey(group.title)) {
          album = candidate;
          spotifyStatus = "linked";
        }
      } catch (error) {
        this.warn(error, "spotify album lookup failed");
        spotifyStatus = "unavailable";
      }
    }

    const chosen = pickRelease(group.releases ?? [], album?.total_tracks ?? album?.tracks.length ?? null);
    if (!chosen) throw new ApiError(404, "release_not_found", "MusicBrainz lists no releases for that release group.");
    const release = await musicCall(() => this.mb.lookupRelease(chosen.id));
    if (!release) throw new ApiError(404, "release_not_found", "MusicBrainz has no release with that ID.");

    const mainArtists = new Set((release["artist-credit"] ?? []).flatMap((c) => (c.artist ? [c.artist.id] : [])));
    const spotifyTracks = album?.tracks ?? [];
    const tracks: Track[] = [];
    let totalDurationMs: number | null = 0;
    const media = release.media ?? [];
    media.forEach((medium, mediumIndex) => {
      const disc = medium.position ?? mediumIndex + 1;
      for (const track of medium.tracks ?? []) {
        const credit = track["artist-credit"] ?? track.recording["artist-credit"] ?? [];
        const durationMs = track.length ?? track.recording.length ?? null;
        if (durationMs === null) totalDurationMs = null;
        else if (totalDurationMs !== null) totalDurationMs += durationMs;
        const match =
          spotifyTracks.find(
            (st) => st.disc_number === disc && st.track_number === track.position && titlesAgree(st.name, track.title)
          ) ?? spotifyTracks.find((st) => titlesAgree(st.name, track.title));
        tracks.push({
          disc,
          position: track.position,
          number: track.number ?? String(track.position),
          title: track.title,
          durationMs,
          artistCredit: creditText(credit),
          featured: featuredNames(credit, mainArtists),
          recordingMbid: track.recording.id,
          isrc: track.recording.isrcs?.[0] ?? null,
          explicit: match?.explicit ?? null,
          spotify: match?.id ? { id: match.id, url: match.external_urls?.spotify ?? spotifyUrl("track", match.id) } : null
        });
      }
    });

    return {
      release: {
        id: group.id,
        releaseMbid: release.id,
        title: group.title,
        date: release.date || null,
        country: release.country || null,
        format: media[0]?.format ?? null,
        musicbrainzUrl: `${MB}/release/${release.id}`
      },
      discCount: Math.max(media.length, 1),
      totalDurationMs: tracks.length > 0 ? totalDurationMs : null,
      tracks,
      spotifyAlbum: album ? { id: album.id, url: album.external_urls?.spotify ?? spotifyUrl("album", album.id) } : null,
      spotifyStatus,
      notice: MUSIC_CATALOG_NOTICE,
      retrievedAt: new Date().toISOString()
    };
  }

  async recordingStory(mbid: string): Promise<RecordingStoryResponse> {
    const recording = await musicCall(() => this.mb.lookupRecordingStory(mbid));
    if (!recording) throw new ApiError(404, "recording_not_found", "MusicBrainz has no recording with that ID.");

    const relations = recording.relations ?? [];
    const workRelation = relations.find((r) => r.type === "performance" && r.work);
    const work = workRelation?.work ?? null;
    const wikidataId =
      (work?.relations ?? [])
        .map((r) => (r.type === "wikidata" && r.url ? /\/(Q\d+)$/.exec(r.url.resource)?.[1] : undefined))
        .find((id): id is string => Boolean(id)) ?? null;

    const [otherVersions, facts] = await Promise.all([
      work ? this.otherVersions(work.id, recording) : Promise.resolve([]),
      wikidataId ? this.facts(wikidataId) : Promise.resolve([])
    ]);

    const spotifyTrackId =
      relations
        .map((r) => (r.url ? spotifyIdFromUrl(r.url.resource, "track") : null))
        .find((id): id is string => Boolean(id)) ?? null;

    return {
      recording: {
        mbid: recording.id,
        title: recording.title,
        artistCredit: creditText(recording["artist-credit"]),
        durationMs: recording.length ?? null,
        isrcs: recording.isrcs ?? [],
        musicbrainzUrl: `${MB}/recording/${recording.id}`,
        spotify: spotifyTrackId ? { id: spotifyTrackId, url: spotifyUrl("track", spotifyTrackId) } : null
      },
      work: work
        ? { mbid: work.id, title: work.title, musicbrainzUrl: `${MB}/work/${work.id}`, wikidataId }
        : null,
      credits: collectCredits(recording),
      samples: linkedRecordings(recording, "forward"),
      sampledBy: linkedRecordings(recording, "backward"),
      otherVersions,
      facts,
      notice: MUSIC_CATALOG_NOTICE,
      retrievedAt: new Date().toISOString()
    };
  }

  private async spotifyAlbums(
    artistId: string | null,
    scope: SpotifyAlbumScope
  ): Promise<{ status: SpotifyStatus; albums: SpotifySimpleAlbum[] }> {
    if (!this.spotify.isEnabled) return { status: "not_configured", albums: [] };
    if (!artistId) return { status: "no_spotify_link", albums: [] };
    try {
      return { status: "linked", albums: await this.spotify.getArtistAlbums(artistId, scope) };
    } catch (error) {
      this.warn(error, "spotify artist albums failed");
      return { status: "unavailable", albums: [] };
    }
  }

  private async otherVersions(workId: string, recording: MbRecordingStory): Promise<LinkedRecording[]> {
    const own = new Set((recording["artist-credit"] ?? []).flatMap((c) => (c.artist ? [c.artist.id] : [])));
    try {
      const recordings = await this.mb.browseWorkRecordings(workId);
      const seen = new Set<string>();
      const out: LinkedRecording[] = [];
      for (const other of recordings) {
        const ids = (other["artist-credit"] ?? []).flatMap((c) => (c.artist ? [c.artist.id] : []));
        if (ids.length === 0 || ids.some((id) => own.has(id))) continue;
        const artist = creditText(other["artist-credit"]);
        if (seen.has(artist)) continue;
        seen.add(artist);
        out.push({ mbid: other.id, title: other.title, artist, musicbrainzUrl: `${MB}/recording/${other.id}` });
        if (out.length >= MAX_OTHER_VERSIONS) break;
      }
      return out;
    } catch (error) {
      this.warn(error, "musicbrainz work recordings failed");
      return [];
    }
  }

  private async facts(qid: string): Promise<TrackFact[]> {
    try {
      const work = await this.wikimedia.getWorkFacts(qid);
      if (!work) return [];
      const wikidataSource = {
        provider: "wikidata" as const,
        label: "Wikidata",
        url: `https://www.wikidata.org/wiki/${qid}`,
        license: null
      };
      const facts: TrackFact[] = [];
      if (work.enwikiTitle) {
        const summary = await this.wikimedia.getWikipediaSummary(work.enwikiTitle).catch((error: unknown) => {
          this.warn(error, "wikipedia summary failed");
          return null;
        });
        if (summary) {
          facts.push({
            kind: "summary",
            text: trimToSentence(summary.extract, SUMMARY_MAX_CHARS),
            year: null,
            source: { provider: "wikipedia", label: `Wikipedia: ${summary.title}`, url: summary.url, license: CC_BY_SA }
          });
        }
      }
      for (const award of work.awards) {
        facts.push({ kind: "award", text: `Award received: ${award.label}`, year: award.year, source: wikidataSource });
      }
      for (const nomination of work.nominations) {
        facts.push({ kind: "nomination", text: `Nominated for ${nomination.label}`, year: nomination.year, source: wikidataSource });
      }
      return facts;
    } catch (error) {
      this.warn(error, "wikidata facts failed");
      return [];
    }
  }

  private warn(error: unknown, message: string) {
    this.log?.warn(
      isProviderError(error)
        ? { provider: error.provider, kind: error.kind, status: error.status }
        : { kind: "unknown" },
      message
    );
  }
}

/* ----------------------------------- helpers ----------------------------------- */

async function musicCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw mapMusicError(error);
  }
}

export function mapMusicError(error: unknown): unknown {
  if (!isProviderError(error)) return error;
  switch (error.kind) {
    case "rate_limited":
      return new ApiError(429, "music_rate_limited", "The music catalogue is busy. Try again shortly.");
    case "timeout":
      return new ApiError(504, "music_timeout", "The music catalogue did not respond in time.");
    case "invalid_response":
      return new ApiError(502, "music_invalid_response", "The music catalogue sent an answer Worlds.fm could not read.");
    default:
      return new ApiError(502, "music_unavailable", "The music catalogue is temporarily unavailable.");
  }
}

const EDITION_WORDS =
  /\b(deluxe|remaster(ed)?|expanded|anniversary|edition|version|bonus|explicit|clean|super|special|collector'?s|single|ep|mono|stereo|feat\.?|featuring|ft\.?|with|from|soundtrack|motion picture)\b/i;

/**
 * Title with edition, guest and tie-in labels removed: "Currents (Deluxe Edition)",
 * "Currents - Single" and "New Gold (feat. X)" become "currents" / "new gold".
 */
export function editionKey(title: string): string {
  let t = title;
  t = t.replace(/\s*[([][^)\]]*[)\]]\s*/g, (part) => (EDITION_WORDS.test(part) ? " " : part));
  t = t.replace(/\s+-\s+[^-]*$/g, (part) => (EDITION_WORDS.test(part) ? "" : part));
  return normalizeName(t);
}

function titlesAgree(a: string, b: string): boolean {
  return namesMatch(a, b) || editionKey(a) === editionKey(b);
}

function yearOf(date: string | null | undefined): number | null {
  const year = Number(/^(\d{4})/.exec(date ?? "")?.[1] ?? NaN);
  return Number.isFinite(year) ? year : null;
}

function matchSpotifyAlbum(
  group: MbBrowseReleaseGroup,
  kind: ReleaseKind,
  albums: SpotifySimpleAlbum[]
): SpotifySimpleAlbum | null {
  const year = yearOf(group["first-release-date"]);
  const exact = normalizeName(group.title);
  const loose = editionKey(group.title);
  let best: { album: SpotifySimpleAlbum; score: number } | null = null;
  for (const album of albums) {
    const isExact = normalizeName(album.name) === exact;
    if (!isExact && editionKey(album.name) !== loose) continue;
    const albumYear = yearOf(album.release_date);
    const gap = year !== null && albumYear !== null ? Math.abs(albumYear - year) : 0;
    if (gap > 1) continue;
    const typeAgrees = (kind === "album") === (album.album_type === "album");
    const score = (isExact ? 100 : 50) - gap * 10 + (typeAgrees ? 5 : 0) - album.name.length / 100;
    if (!best || score > best.score) best = { album, score };
  }
  return best?.album ?? null;
}

function pickCover(album: SpotifySimpleAlbum): CoverArt | null {
  const images = [...(album.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  if (images.length === 0) return null;
  const small = images.find((image) => (image.width ?? 0) >= 280) ?? images[images.length - 1];
  const large = [...images].reverse().find((image) => (image.width ?? 0) <= 700) ?? images[images.length - 1];
  if (!small || !large) return null;
  return {
    url: small.url,
    largeUrl: large.url,
    provider: "spotify",
    linkUrl: album.external_urls?.spotify ?? spotifyUrl("album", album.id)
  };
}

function toRelease(group: MbBrowseReleaseGroup, kind: ReleaseKind, album: SpotifySimpleAlbum | null): Release {
  const musicbrainzUrl = `${MB}/release-group/${group.id}`;
  const spotify: SpotifyLink | null = album
    ? { id: album.id, url: album.external_urls?.spotify ?? spotifyUrl("album", album.id) }
    : null;
  return {
    id: group.id,
    title: group.title,
    kind,
    secondaryTypes: group["secondary-types"] ?? [],
    firstReleaseDate: group["first-release-date"] || null,
    year: yearOf(group["first-release-date"]),
    trackCount: album?.total_tracks ?? null,
    cover: (album ? pickCover(album) : null) ?? {
      url: `https://coverartarchive.org/release-group/${group.id}/front-250`,
      largeUrl: `https://coverartarchive.org/release-group/${group.id}/front-500`,
      provider: "coverartarchive",
      linkUrl: musicbrainzUrl
    },
    spotify,
    musicbrainzUrl
  };
}

function byDateDesc(a: Release, b: Release): number {
  return (b.firstReleaseDate ?? "").localeCompare(a.firstReleaseDate ?? "") || a.title.localeCompare(b.title);
}

function pickRelease(releases: MbReleaseSummary[], spotifyTrackCount: number | null): MbReleaseSummary | null {
  let best: { release: MbReleaseSummary; score: number } | null = null;
  for (const release of releases) {
    const trackCount = (release.media ?? []).reduce((sum, m) => sum + (m["track-count"] ?? 0), 0);
    const formats = (release.media ?? []).map((m) => m.format ?? "");
    let score = 0;
    if (release.status === "Official") score += 4;
    if (formats.every((f) => f === "Digital Media")) score += 2;
    if (spotifyTrackCount !== null && trackCount === spotifyTrackCount) score += 3;
    if (release.country === "XW") score += 1;
    if (trackCount === 0) score -= 10;
    const earlier = best && (release.date ?? "9999") < (best.release.date ?? "9999");
    if (!best || score > best.score || (score === best.score && earlier)) best = { release, score };
  }
  return best?.release ?? null;
}

function featuredNames(credit: readonly MbCredit[], mainArtists: Set<string>): string[] {
  return credit.flatMap((part) => (part.artist && !mainArtists.has(part.artist.id) ? [part.name] : []));
}

const ROLE_BY_TYPE: Record<string, CreditRole> = {
  producer: "produced_by",
  mix: "mixed_by",
  engineer: "engineered_by",
  recording: "engineered_by",
  vocal: "performed_by",
  instrument: "performed_by",
  performer: "performed_by",
  composer: "written_by",
  lyricist: "written_by",
  writer: "written_by"
};

const ROLE_ORDER: CreditRole[] = ["written_by", "produced_by", "performed_by", "mixed_by", "engineered_by"];

function collectCredits(recording: MbRecordingStory): Credit[] {
  const byRole = new Map<CreditRole, Map<string, { name: string; mbid: string | null; details: Set<string> }>>();
  const add = (type: string, artist: { id: string; name: string } | null | undefined, attributes: readonly string[] | null | undefined) => {
    const role = ROLE_BY_TYPE[type];
    if (!role || !artist) return;
    const people = byRole.get(role) ?? new Map();
    byRole.set(role, people);
    const person = people.get(artist.id) ?? { name: artist.name, mbid: artist.id, details: new Set<string>() };
    people.set(artist.id, person);
    const detail =
      role === "written_by" ? type : role === "performed_by" ? (attributes?.length ? attributes.join(", ") : type === "vocal" ? "vocals" : null) : null;
    if (detail) person.details.add(detail);
  };
  for (const relation of recording.relations ?? []) {
    if (relation["target-type"] === "artist") add(relation.type, relation.artist, relation.attributes);
    if (relation.type === "performance") {
      for (const workRelation of relation.work?.relations ?? []) {
        if (workRelation["target-type"] === "artist") add(workRelation.type, workRelation.artist, workRelation.attributes);
      }
    }
  }
  return ROLE_ORDER.flatMap((role) => {
    const people = byRole.get(role);
    if (!people || people.size === 0) return [];
    return [
      {
        role,
        people: [...people.values()].map((p) => ({
          name: p.name,
          mbid: p.mbid,
          detail: p.details.size > 0 ? [...p.details].join(", ") : null
        }))
      }
    ];
  });
}

function linkedRecordings(recording: MbRecordingStory, direction: "forward" | "backward"): LinkedRecording[] {
  const seen = new Set<string>();
  const out: LinkedRecording[] = [];
  for (const relation of recording.relations ?? []) {
    if (relation.type !== "samples material" || relation.direction !== direction || !relation.recording) continue;
    if (seen.has(relation.recording.id)) continue;
    seen.add(relation.recording.id);
    const artist = creditText(relation.recording["artist-credit"]);
    out.push({
      mbid: relation.recording.id,
      title: relation.recording.title,
      artist: artist || null,
      musicbrainzUrl: `${MB}/recording/${relation.recording.id}`
    });
    if (out.length >= MAX_LINKED) break;
  }
  return out;
}

function trimToSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}
