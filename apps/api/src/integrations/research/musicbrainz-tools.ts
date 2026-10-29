import { z } from "zod";

import type { ProviderHttpClient } from "../../lib/http-client.js";
import { escapeLucene, namesMatch } from "../../lib/matching.js";
import type { ResearchSourceTools, SourceRecord } from "./agent.js";

const BASE = "https://musicbrainz.org/ws/2/artist";
const artistSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1)
});
const searchSchema = z.object({ artists: z.array(artistSchema).default([]) });
const relationSchema = z.object({
  type: z.string().min(1),
  "target-type": z.string().optional(),
  direction: z.enum(["forward", "backward"]).optional(),
  artist: artistSchema.optional(),
  recording: z.object({ id: z.uuid(), title: z.string().min(1) }).optional(),
  attributes: z.array(z.string()).optional()
});
const sourceSchema = artistSchema.extend({
  relations: z.array(relationSchema).default([])
});
const recordingSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  "artist-credit": z.array(z.union([
    z.string(),
    z.object({ artist: artistSchema, name: z.string().optional() })
  ])).default([]),
  relations: z.array(relationSchema).default([])
});
const recordingSearchSchema = z.object({
  recordings: z.array(z.object({ id: z.uuid(), title: z.string().min(1) })).default([])
});

/** Bounded MusicBrainz relation and recording-credit sources for cited drafts. */
export class MusicBrainzResearchTools implements ResearchSourceTools {
  constructor(private readonly http: ProviderHttpClient) {}

  async searchArtist(name: string): Promise<{ tool: "search_artist"; artists: Array<{ id: string; name: string }> }> {
    const query = encodeURIComponent(`artist:"${escapeLucene(name)}"`);
    const raw = await this.http.getJson({
      provider: "musicbrainz",
      url: `${BASE}/?query=${query}&fmt=json&limit=5`
    });
    const parsed = searchSchema.parse(raw);
    const matches = parsed.artists.filter((artist) => namesMatch(artist.name, name));
    return {
      tool: "search_artist",
      artists: matches.length === 1 ? matches.map((artist) => ({ ...artist, id: artist.id.toLowerCase() })) : []
    };
  }

  async artistRelations(id: string): Promise<{ tool: "artist_relations"; source: SourceRecord }> {
    const raw = await this.http.getJson({
      provider: "musicbrainz",
      url: `${BASE}/${encodeURIComponent(id)}?inc=artist-rels+recording-rels&fmt=json`
    });
    const parsed = sourceSchema.parse(raw);
    if (parsed.id.toLowerCase() !== id) throw new Error("MusicBrainz artist ID did not match request");
    const lines = parsed.relations
      .filter((relation) => relation.artist && (!relation["target-type"] || relation["target-type"] === "artist"))
      .slice(0, 80)
      // A backward relation names the other artist first ("parent" backward
      // means the other artist is the parent); keep MusicBrainz's order so the
      // quoted line never inverts a fact.
      .map((relation) =>
        (relation.direction === "backward"
          ? `${relation.artist?.name} has MusicBrainz artist relation "${relation.type}" with ${parsed.name}`
          : `${parsed.name} has MusicBrainz artist relation "${relation.type}" with ${relation.artist?.name}`) +
        (relation.attributes?.length ? ` (${relation.attributes.join(", ")})` : "") + "."
      ).map((line) => line.slice(0, 300));
    // A recording relationship can identify a track worth verifying, but
    // cannot alone prove the other artist performed on it.
    for (const relation of parsed.relations) {
      if (lines.length >= 80) break;
      if (relation.recording && relation["target-type"] === "recording" &&
          ["producer", "mix", "instrument", "vocal", "performer"].some((role) =>
            relation.type.toLowerCase().includes(role))) {
        lines.push(`${parsed.name} has MusicBrainz recording relation "${relation.type}" on "${relation.recording.title}".`.slice(0, 300));
      }
    }
    return {
      tool: "artist_relations",
      source: {
        id: parsed.id.toLowerCase(),
        name: parsed.name,
        url: `https://musicbrainz.org/artist/${id}`,
        label: `MusicBrainz — ${parsed.name}`,
        license: "CC0 1.0",
        lines
      }
    };
  }

  /** Look up a named recording for a resolved performer, then inspect its actual credited roles. */
  async recordingCredits(producerId: string, id: string, title: string): Promise<{ tool: "recording_credits"; source: SourceRecord }> {
    const query = encodeURIComponent(`arid:${id} AND recording:"${escapeLucene(title)}"`);
    const search = recordingSearchSchema.parse(await this.http.getJson({
      provider: "musicbrainz", url: `https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=5`
    }));
    const matches = search.recordings.filter((item) => namesMatch(item.title, title));
    if (matches.length !== 1) throw new Error("Recording not uniquely resolved");
    const match = matches[0]!;
    const record = recordingSchema.parse(await this.http.getJson({
      provider: "musicbrainz",
      url: `https://musicbrainz.org/ws/2/recording/${match.id}?inc=artist-rels+artist-credits&fmt=json`
    }));
    if (record.id !== match.id || !namesMatch(record.title, title) ||
        !record["artist-credit"].some((credit) => typeof credit !== "string" && credit.artist.id === id)) {
      throw new Error("Recording artist identity mismatch");
    }
    const performer = record["artist-credit"].find((credit) =>
      typeof credit !== "string" && credit.artist.id === id);
    const performerName = typeof performer === "string" ? null : performer?.artist.name;
    const lines = record.relations
      .filter((relation) => relation.artist && (!relation["target-type"] || relation["target-type"] === "artist") &&
        relation.artist.id.toLowerCase() === producerId &&
        ["producer", "mix", "instrument", "vocal", "performer"].some((role) => relation.type.toLowerCase().includes(role)))
      .slice(0, 30)
      .map((relation) => `${relation.artist!.name} has MusicBrainz recording credit "${relation.type}" on "${record.title}" by ${performerName}.`
        .slice(0, 300));
    return {
      tool: "recording_credits",
      source: {
        id: record.id, name: record.title, url: `https://musicbrainz.org/recording/${record.id}`,
        label: `MusicBrainz — ${record.title}`, license: "CC0 1.0", lines
      }
    };
  }
}
