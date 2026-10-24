import {
  DISCOVERY_CATEGORIES,
  culturalDiscoveryResponseSchema,
  culturalGraphSchema,
  type CulturalDiscoveryResponse,
  type DiscoveryCategory,
  type DiscoveryCategoryReport,
  type DiscoveryWarning,
  type QlooInsightsResponse
} from "@worlds/shared";

import { buildCulturalGraph } from "../graph/cultural-graph-builder.js";
import type { RootTraits } from "../graph/connection-explanation.js";
import { mapQlooError } from "../integrations/qloo/errors.js";
import type { QlooAdapter } from "../integrations/qloo/index.js";
import type { MusicBrainzCatalog } from "../integrations/musicbrainz/index.js";
import { TtlCache, type TtlCacheOptions } from "../lib/cache.js";
import { ApiError } from "../lib/errors.js";
import { namesMatch, normalizeName } from "../lib/matching.js";
import type { ConnectionFindingsIndex } from "./connection-findings.js";

/** Graph size for a first constellation: root plus up to 15 neighbours. */
export const DISCOVERY_MAX_NODES = 16;

/**
 * Genres to keep for the root artist. Enough to find a shared genre with most
 * neighbours without letting one node carry the whole taxonomy.
 */
const MAX_ROOT_GENRES = 6;

export interface CulturalDiscoveryServiceOptions {
  adapter: QlooAdapter;
  /**
   * Used only to describe the root artist, because Qloo's search endpoint
   * returns no genres. Optional: without it the graph is unchanged, just less
   * specific about the root.
   */
  musicBrainz?: MusicBrainzCatalog;
  /**
   * Precomputed connection research (AGENTS.md §12). Optional, and read-only:
   * it can raise an edge to the `documented` rung, and its absence only means
   * every edge stays on the weaker rungs.
   */
  findings?: ConnectionFindingsIndex;
  /** `ttlMs` caches complete results; `negativeTtlMs` the shorter partial/no-match ones. */
  cache: TtlCacheOptions;
}

export interface DiscoveryResult {
  body: CulturalDiscoveryResponse;
  cacheHit: boolean;
}

/**
 * Orchestrates the existing deterministic tools: Qloo search, bounded Qloo
 * Insights, then `buildCulturalGraph`. It adds no data of its own. Only
 * successful outcomes are cached, so an outage is never remembered as an
 * empty graph. Insights and search results are also cached by the adapter,
 * which means a retry after a partial failure only re-asks the failed category.
 */
export class CulturalDiscoveryService {
  private readonly adapter: QlooAdapter;
  private readonly musicBrainz: MusicBrainzCatalog | undefined;
  private readonly findings: ConnectionFindingsIndex | undefined;
  private readonly cache: TtlCache<CulturalDiscoveryResponse>;
  private readonly inFlight = new Map<string, Promise<CulturalDiscoveryResponse>>();

  constructor(options: CulturalDiscoveryServiceOptions) {
    this.adapter = options.adapter;
    this.musicBrainz = options.musicBrainz;
    this.findings = options.findings;
    this.cache = new TtlCache(options.cache);
  }

  get isEnabled(): boolean {
    return this.adapter.isEnabled;
  }

  async discoverArtist(input: { query: string; limit: number }): Promise<DiscoveryResult> {
    const key = `graph:${input.limit}:${normalizeName(input.query)}`;
    const cached = this.cache.get(key);
    if (cached.hit) {
      return { body: cached.value, cacheHit: true };
    }
    // Concurrent identical requests share one exploration (and one Qloo spend).
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.explore(input, key).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    return { body: await pending, cacheHit: false };
  }

  private async explore(
    input: { query: string; limit: number },
    key: string
  ): Promise<CulturalDiscoveryResponse> {
    let search;
    try {
      search = await this.adapter.searchEntities({ query: input.query, type: "artist", limit: 5 });
    } catch (error) {
      throw mapQlooError(error);
    }

    const base = {
      query: input.query,
      resolution: search.resolution,
      retrievedAt: search.provenance.retrievedAt
    };

    if (search.resolution === "none") {
      return this.remember(key, true, {
        ...base,
        status: "not_found",
        root: null,
        candidates: [],
        graph: null,
        categories: [],
        warnings: []
      });
    }

    const root = search.resolution === "exact"
      ? (search.results.find((entity) => entity.id === search.bestMatchId) ?? null)
      : null;
    if (!root) {
      const warnings: DiscoveryWarning[] = [
        {
          code: "no_exact_match",
          message:
            search.resolution === "ambiguous"
              ? "Several artists share this name. Choose one candidate."
              : "No artist matched this name exactly. These are Qloo's closest matches, not confirmed results.",
          category: "artist"
        }
      ];
      return this.remember(key, false, {
        ...base,
        status: "needs_disambiguation",
        root: null,
        candidates: search.results,
        graph: null,
        categories: [],
        warnings
      });
    }

    // Started here rather than before the search so that a name we end up
    // asking the reader to disambiguate costs no MusicBrainz requests. It runs
    // alongside the insights, which are the bulk of the wait, and is awaited
    // only after them: MusicBrainz is throttled to one request a second, so
    // awaiting it earlier would serialise that delay into every uncached graph.
    const traitsPromise = this.resolveRootTraits(input.query);
    const settled = await Promise.allSettled(
      DISCOVERY_CATEGORIES.map((category) =>
        this.adapter.getInsights({ entityId: root.id, targetType: category, limit: input.limit })
      )
    );

    const successes: QlooInsightsResponse[] = [];
    const categories: DiscoveryCategoryReport[] = [];
    const warnings: DiscoveryWarning[] = [];
    const failures: ApiError[] = [];
    settled.forEach((outcome, index) => {
      const category = DISCOVERY_CATEGORIES[index] as DiscoveryCategory;
      if (outcome.status === "fulfilled") {
        successes.push(outcome.value);
        const count = outcome.value.results.length;
        categories.push({ category, status: count > 0 ? "ok" : "empty", count, errorCode: null });
        return;
      }
      const mapped = mapQlooError(outcome.reason);
      const code = mapped instanceof ApiError ? mapped.code : "internal_error";
      if (mapped instanceof ApiError) failures.push(mapped);
      categories.push({ category, status: "failed", count: 0, errorCode: code });
      warnings.push({
        code: "category_unavailable",
        message: `Qloo ${category} affinities were unavailable (${code}); this category is missing from the graph.`,
        category
      });
    });

    if (successes.length === 0) {
      throw allFailedError(failures);
    }

    const rootTraits = await traitsPromise;
    const graph = culturalGraphSchema.parse(
      buildCulturalGraph(
        { root, insights: successes, rootTraits, findings: this.findings ?? null },
        { maxNodes: DISCOVERY_MAX_NODES, maxPerCategory: input.limit }
      )
    );
    const partial = failures.length > 0;
    return this.remember(key, partial, {
      ...base,
      status: partial ? "partial" : "complete",
      root,
      candidates: [],
      graph,
      categories,
      warnings
    });
  }

  /**
   * The root artist's genres from MusicBrainz, which Qloo's search endpoint
   * does not supply. Best-effort throughout: this only sharpens how a link is
   * described, so any failure or doubt returns null rather than a guess.
   *
   * Only a single exact-name match is accepted. When several artists share the
   * name, attaching one of their genres to the wrong artist would be worse than
   * saying nothing.
   */
  private async resolveRootTraits(name: string): Promise<RootTraits | null> {
    if (!this.musicBrainz) return null;
    try {
      const found = await this.musicBrainz.searchArtists(name);
      const exact = found.filter((artist) => namesMatch(artist.name, name));
      const only = exact.length === 1 ? exact[0] : undefined;
      if (!only) return null;

      const artist = await this.musicBrainz.lookupArtistGenres(only.id);
      const genres = [...(artist?.genres ?? [])]
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .map((genre) => genre.name)
        .slice(0, MAX_ROOT_GENRES);
      if (genres.length === 0) return null;
      return { genres, sourceLabel: "MusicBrainz" };
    } catch {
      // A missing enrichment must never fail a graph that is otherwise fine.
      return null;
    }
  }

  /** Validates, then stores. `short` selects the shorter TTL (partial or no-match). */
  private remember(
    key: string,
    short: boolean,
    body: CulturalDiscoveryResponse
  ): CulturalDiscoveryResponse {
    const validated = culturalDiscoveryResponseSchema.parse(body);
    this.cache.set(key, validated, { negative: short });
    return validated;
  }
}

/** One shared failure keeps its meaning (for example a rate limit); mixed failures become 502. */
function allFailedError(failures: ApiError[]): ApiError {
  const first = failures[0];
  if (first && failures.every((failure) => failure.code === first.code)) {
    return first;
  }
  return new ApiError(
    502,
    "discovery_unavailable",
    "Qloo could not provide any affinity results for this artist right now."
  );
}
