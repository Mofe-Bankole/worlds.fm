import {
  QLOO_AFFINITY_NOTICE,
  QLOO_IMAGE_HOST,
  type QlooEntity,
  type QlooEntityAttributes,
  type QlooEntityType,
  type QlooInsightsResponse,
  type QlooProvenance,
  type QlooResolution,
  type QlooSearchResponse
} from "@worlds/shared";
import { z } from "zod";

import { TtlCache, type TtlCacheOptions } from "../../lib/cache.js";
import { isProviderError, ProviderError } from "../../lib/errors.js";
import type { ProviderHttpClient } from "../../lib/http-client.js";
import { normalizeName } from "../../lib/matching.js";
import { parseProviderPayload } from "../../lib/parse.js";

/**
 * Qloo adapter (hackathon environment).
 *
 * Verified against the Qloo hackathon developer guide
 * (https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide):
 * - Host: https://hackathon.api.qloo.com (keys do not work on other hosts).
 * - Auth: `X-Api-Key` request header; never a query parameter or Bearer token.
 * - Entity lookup: GET /search?query=...&types=urn:entity:<type>&take=N
 *   (404 means "no results").
 * - Insights: GET /v2/insights?filter.type=urn:entity:<type>
 *   &signal.interests.entities=<entity id>&take=N (query string, not a body).
 *
 * The public reference documents the Insights response
 * (`results.entities[]` with `entity_id`, `name`, `type`, `subtype`,
 * `properties`, `popularity`, `tags`, `query`, `disambiguation`) but does not
 * show a `/search` response body. Observed live on 2026-10-21: `/search`
 * entities use `types: ["urn:entity:artist"]` and `tags[].tag_id`, and
 * Insights entities use `subtype`, `tags[].id` and `query.affinity`. Parsing
 * tolerates both shapes and drops individual entities that lack an id or a
 * name. Every field beyond `entity_id` and `name` is optional.
 */

const PROVIDER = "qloo";
const KEY_HEADER = "x-api-key";

const MAX_TAGS_PER_ENTITY = 10;
/** Cap per attribute list: the provider's own lists are long and one of these rides on every node. */
const MAX_ATTRIBUTE_VALUES = 6;

/** The `audience` tag namespace, e.g. `urn:tag:audience:qloo` (observed live 2026-10-24). */
const AUDIENCE_TAG_PREFIX = "urn:tag:audience";

/** Insights tags carry `id`; `/search` tags carry `tag_id` (observed live 2026-10-21). */
const qlooTagSchema = z.looseObject({
  id: z.string().min(1).nullish(),
  tag_id: z.string().min(1).nullish(),
  name: z.string().nullish(),
  type: z.string().nullish()
});

/**
 * `properties` is a large, loosely-typed bag. Only the fields that describe
 * *what an entity is like* are declared; everything else is ignored, and the
 * object stays loose so a provider addition cannot break parsing.
 */
const qlooPropertiesSchema = z.looseObject({
  description: z.string().nullish(),
  short_description: z.string().nullish(),
  image: z.looseObject({ url: z.string().nullish() }).nullish(),
  primary_genres: z.array(z.string()).nullish(),
  secondary_genres: z.array(z.string()).nullish(),
  lyrical_themes: z.array(z.string()).nullish(),
  influenced_by: z.array(z.string()).nullish(),
  collaborators: z.array(z.string()).nullish(),
  associated_brands: z.array(z.string()).nullish(),
  place_of_birth: z.string().nullish(),
  headquartered: z.string().nullish(),
  founded_year: z.union([z.number(), z.string()]).nullish(),
  inception: z.union([z.number(), z.string()]).nullish()
});

const qlooEntityPayloadSchema = z.looseObject({
  entity_id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().nullish(),
  subtype: z.string().nullish(),
  /** `/search` entities carry `types: [...]` instead of `type`/`subtype`. */
  types: z.array(z.string()).nullish(),
  popularity: z.number().nullish(),
  disambiguation: z.string().nullish(),
  properties: qlooPropertiesSchema.nullish(),
  tags: z.array(z.unknown()).nullish(),
  query: z.looseObject({ affinity: z.number().nullish() }).nullish()
});
type QlooEntityPayload = z.infer<typeof qlooEntityPayloadSchema>;

const qlooListPayloadSchema = z.looseObject({
  success: z.boolean().nullish(),
  results: z.union([
    z.array(z.unknown()),
    z.looseObject({ entities: z.array(z.unknown()) })
  ])
});

export interface QlooAdapterOptions {
  http: ProviderHttpClient;
  baseUrl: string;
  apiKey: string | undefined;
  cache: TtlCacheOptions;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

export class QlooAdapter {
  readonly provider = PROVIDER;
  private readonly http: ProviderHttpClient;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly cache: TtlCache<unknown>;
  private readonly now: () => Date;

  constructor(options: QlooAdapterOptions) {
    this.http = options.http;
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.cache = new TtlCache(options.cache);
    this.now = options.now ?? (() => new Date());
  }

  get isEnabled(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  /**
   * Resolve entities by name. Exact (normalized) name matches rank first and
   * are the only results that can produce a `bestMatchId`: a fuzzy neighbour is
   * never presented as the artist the caller asked for.
   */
  async searchEntities(input: {
    query: string;
    type: QlooEntityType;
    limit: number;
  }): Promise<QlooSearchResponse> {
    const normalizedQuery = normalizeName(input.query);
    const key = `search:${input.type}:${input.limit}:${normalizedQuery}`;
    const cached = this.cache.get(key);
    if (cached.hit) {
      return cached.value as QlooSearchResponse;
    }

    const params = new URLSearchParams({
      query: input.query,
      types: entityUrn(input.type),
      take: String(input.limit)
    });

    let entities: QlooEntity[];
    try {
      const payload = await this.get("/search", params);
      entities = this.parseEntities(payload).map((item) => item.entity);
    } catch (error) {
      if (isProviderError(error) && error.kind === "not_found") {
        entities = [];
      } else {
        throw error;
      }
    }

    const ranked = rankByExactName(entities, normalizedQuery).slice(0, input.limit);
    const { resolution, bestMatchId } = resolve(ranked, normalizedQuery);
    const response: QlooSearchResponse = {
      query: input.query,
      type: input.type,
      resolution,
      bestMatchId,
      results: ranked,
      provenance: this.provenance()
    };
    this.cache.set(key, response, { negative: ranked.length === 0 });
    return response;
  }

  /** Cultural affinities for one source entity within a target category. */
  async getInsights(input: {
    entityId: string;
    targetType: QlooEntityType;
    limit: number;
  }): Promise<QlooInsightsResponse> {
    const key = `insights:${input.entityId.toLowerCase()}:${input.targetType}:${input.limit}`;
    const cached = this.cache.get(key);
    if (cached.hit) {
      return cached.value as QlooInsightsResponse;
    }

    const params = new URLSearchParams({
      "filter.type": entityUrn(input.targetType),
      "signal.interests.entities": input.entityId,
      take: String(input.limit)
    });
    const payload = await this.get("/v2/insights", params);
    const items = this.parseEntities(payload).slice(0, input.limit);

    const response: QlooInsightsResponse = {
      source: { entityId: input.entityId },
      targetType: input.targetType,
      kind: "affinity",
      notice: QLOO_AFFINITY_NOTICE,
      results: items,
      provenance: this.provenance()
    };
    this.cache.set(key, response, { negative: items.length === 0 });
    return response;
  }

  private async get(path: string, params: URLSearchParams): Promise<unknown> {
    if (!this.apiKey) {
      // Callers must check `isEnabled`; fail closed instead of sending a keyless request.
      throw new ProviderError(PROVIDER, "unauthorized", "qloo api key is not configured");
    }
    return this.http.getJson({
      provider: PROVIDER,
      url: `${this.baseUrl}${path}?${params.toString()}`,
      headers: { [KEY_HEADER]: this.apiKey }
    });
  }

  private parseEntities(
    payload: unknown
  ): Array<{ entity: QlooEntity; affinity: number | null }> {
    const parsed = parseProviderPayload(PROVIDER, qlooListPayloadSchema, payload);
    const rawItems = Array.isArray(parsed.results) ? parsed.results : parsed.results.entities;

    const items: Array<{ entity: QlooEntity; affinity: number | null }> = [];
    for (const raw of rawItems) {
      const result = qlooEntityPayloadSchema.safeParse(raw);
      if (result.success) {
        items.push({
          entity: toEntity(result.data),
          affinity: result.data.query?.affinity ?? null
        });
      }
    }
    if (rawItems.length > 0 && items.length === 0) {
      throw new ProviderError(PROVIDER, "invalid_response", "unexpected qloo entity shape");
    }
    return items;
  }

  private provenance(): QlooProvenance {
    return {
      provider: "qloo",
      mode: "live",
      environment: "hackathon",
      retrievedAt: this.now().toISOString()
    };
  }
}

function entityUrn(type: QlooEntityType): string {
  return `urn:entity:${type}`;
}

function toEntity(payload: QlooEntityPayload): QlooEntity {
  const tags = (payload.tags ?? []).flatMap((raw) => {
    const result = qlooTagSchema.safeParse(raw);
    const id = result.success ? (result.data.id ?? result.data.tag_id) : undefined;
    return result.success && id
      ? [
          {
            id,
            name: result.data.name ?? null,
            type: result.data.type ?? null
          }
        ]
      : [];
  });
  const kept = tags.slice(0, MAX_TAGS_PER_ENTITY);
  return {
    id: payload.entity_id,
    name: payload.name,
    type: payload.subtype ?? payload.types?.[0] ?? payload.type ?? null,
    popularity: payload.popularity ?? null,
    description:
      payload.properties?.description ?? payload.properties?.short_description ?? null,
    disambiguation: payload.disambiguation ?? null,
    tags: kept,
    imageUrl: qlooImageUrl(payload.properties?.image?.url),
    attributes: toAttributes(payload.properties, tags)
  };
}

/**
 * Pull out the traits that can explain a connection. Provider order is kept,
 * because the provider lists them most- to least-characteristic, and each list
 * is capped and de-duplicated so one node cannot bloat a graph response.
 */
function toAttributes(
  properties: z.infer<typeof qlooPropertiesSchema> | null | undefined,
  tags: Array<{ name: string | null; type: string | null }>
): QlooEntityAttributes {
  const props = properties ?? {};
  return {
    genres: stringList([...(props.primary_genres ?? []), ...(props.secondary_genres ?? [])]),
    themes: stringList(props.lyrical_themes),
    audienceTraits: stringList(
      tags
        .filter((tag) => (tag.type ?? "").startsWith(AUDIENCE_TAG_PREFIX))
        .map((tag) => tag.name ?? "")
    ),
    influences: stringList(props.influenced_by),
    collaborators: stringList(props.collaborators),
    brands: stringList(props.associated_brands),
    origin: firstText(props.place_of_birth) ?? firstText(props.headquartered),
    foundedYear: yearOf(props.founded_year) ?? yearOf(props.inception)
  };
}

/** Trimmed, de-duplicated (case-insensitively), capped, order preserved. */
function stringList(values: Array<string | null | undefined> | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_ATTRIBUTE_VALUES) break;
  }
  return out;
}

function firstText(value: string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/** Accepts a number or a numeric string; anything implausible becomes null. */
function yearOf(value: number | string | null | undefined): number | null {
  const year = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(year) && year >= 1000 && year <= 2100 ? year : null;
}

/** Accepts only HTTPS URLs on the Qloo image host; anything else becomes null. */
export function qlooImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === QLOO_IMAGE_HOST ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Stable sort: exact normalized-name matches first, upstream order otherwise. */
function rankByExactName(entities: QlooEntity[], normalizedQuery: string): QlooEntity[] {
  const exact = entities.filter((entity) => normalizeName(entity.name) === normalizedQuery);
  const rest = entities.filter((entity) => normalizeName(entity.name) !== normalizedQuery);
  return [...exact, ...rest];
}

function resolve(
  ranked: QlooEntity[],
  normalizedQuery: string
): { resolution: QlooResolution; bestMatchId: string | null } {
  if (ranked.length === 0) {
    return { resolution: "none", bestMatchId: null };
  }
  const exact = ranked.filter((entity) => normalizeName(entity.name) === normalizedQuery);
  if (exact.length === 1 && exact[0]) {
    return { resolution: "exact", bestMatchId: exact[0].id };
  }
  if (exact.length > 1) {
    return { resolution: "ambiguous", bestMatchId: null };
  }
  return { resolution: "fuzzy", bestMatchId: null };
}
