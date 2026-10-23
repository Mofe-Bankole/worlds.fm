import { z } from "zod";

import { TtlCache, type TtlCacheOptions } from "../../lib/cache.js";
import { isProviderError } from "../../lib/errors.js";
import type { ProviderHttpClient } from "../../lib/http-client.js";
import { parseProviderPayload } from "../../lib/parse.js";

/**
 * Wikidata (CC0) and English Wikipedia (CC BY-SA 4.0) for sourced track facts.
 * Docs: https://www.wikidata.org/w/api.php and
 * https://en.wikipedia.org/api/rest_v1/ (page summary).
 *
 * Only statements Wikidata holds are returned, and the Wikipedia summary is
 * quoted as published with attribution; nothing is paraphrased or inferred.
 */

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const MAX_AWARDS = 8;

const AWARD_RECEIVED = "P166";
const NOMINATED_FOR = "P1411";
const POINT_IN_TIME = "P585";

const itemValueSchema = z.looseObject({ id: z.string().regex(/^Q\d+$/) });
const timeValueSchema = z.looseObject({ time: z.string() });

const claimSchema = z.looseObject({
  mainsnak: z.looseObject({ datavalue: z.looseObject({ value: z.unknown() }).nullish() }),
  qualifiers: z.record(z.string(), z.array(z.looseObject({ datavalue: z.looseObject({ value: z.unknown() }).nullish() }))).nullish()
});

const entitySchema = z.looseObject({
  claims: z.record(z.string(), z.array(claimSchema)).nullish(),
  sitelinks: z.record(z.string(), z.looseObject({ title: z.string() })).nullish(),
  labels: z.record(z.string(), z.looseObject({ value: z.string() })).nullish()
});

const entitiesResponseSchema = z.looseObject({ entities: z.record(z.string(), entitySchema) });

const summarySchema = z.looseObject({
  type: z.string().nullish(),
  extract: z.string().nullish(),
  content_urls: z.looseObject({ desktop: z.looseObject({ page: z.string() }).nullish() }).nullish()
});

export interface WikidataAward {
  qid: string;
  label: string;
  year: number | null;
}

export interface WikidataWorkFacts {
  qid: string;
  awards: WikidataAward[];
  nominations: WikidataAward[];
  enwikiTitle: string | null;
}

export interface WikipediaSummary {
  title: string;
  extract: string;
  url: string;
}

export interface WikimediaAdapterOptions {
  http: ProviderHttpClient;
  cache: TtlCacheOptions;
}

export class WikimediaAdapter {
  private readonly http: ProviderHttpClient;
  private readonly cache: TtlCache<unknown>;

  constructor(options: WikimediaAdapterOptions) {
    this.http = options.http;
    this.cache = new TtlCache(options.cache);
  }

  async getWorkFacts(qid: string): Promise<WikidataWorkFacts | null> {
    return this.cached(`wd:work:${qid}`, async () => {
      const params = new URLSearchParams({
        action: "wbgetentities",
        ids: qid,
        props: "claims|sitelinks",
        sitefilter: "enwiki",
        format: "json"
      });
      const payload = await this.http.getJson({ provider: "wikidata", url: `${WIKIDATA_API}?${params}` });
      const entity = parseProviderPayload("wikidata", entitiesResponseSchema, payload).entities[qid];
      if (!entity) return null;
      const awards = statements(entity.claims?.[AWARD_RECEIVED]);
      const nominations = statements(entity.claims?.[NOMINATED_FOR]);
      const labels = await this.labels([...awards, ...nominations].map((s) => s.qid));
      const named = (list: { qid: string; year: number | null }[]) =>
        list.flatMap((s) => {
          const label = labels.get(s.qid);
          return label ? [{ ...s, label }] : [];
        });
      return {
        qid,
        awards: named(awards),
        nominations: named(nominations),
        enwikiTitle: entity.sitelinks?.enwiki?.title ?? null
      };
    });
  }

  async getWikipediaSummary(title: string): Promise<WikipediaSummary | null> {
    return this.cached(`wp:summary:${title}`, async () => {
      const payload = await this.http.getJson({
        provider: "wikipedia",
        url: `${WIKIPEDIA_SUMMARY}${encodeURIComponent(title.replace(/ /g, "_"))}`
      });
      const summary = parseProviderPayload("wikipedia", summarySchema, payload);
      const url = summary.content_urls?.desktop?.page;
      // Disambiguation pages and empty extracts say nothing about the song.
      if (summary.type !== "standard" || !summary.extract || !url) return null;
      return { title, extract: summary.extract, url };
    });
  }

  private async labels(qids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(qids)].slice(0, 50);
    if (unique.length === 0) return new Map();
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: unique.join("|"),
      props: "labels",
      languages: "en",
      format: "json"
    });
    const payload = await this.http.getJson({ provider: "wikidata", url: `${WIKIDATA_API}?${params}` });
    const entities = parseProviderPayload("wikidata", entitiesResponseSchema, payload).entities;
    const map = new Map<string, string>();
    for (const [id, entity] of Object.entries(entities)) {
      const label = entity.labels?.en?.value;
      if (label) map.set(id, label);
    }
    return map;
  }

  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit.hit) return hit.value as T;
    try {
      const value = await fetcher();
      this.cache.set(key, value, { negative: value === null });
      return value;
    } catch (error) {
      if (isProviderError(error) && error.kind === "not_found") {
        this.cache.set(key, null as T, { negative: true });
        return null as T;
      }
      throw error;
    }
  }
}

function statements(claims: z.infer<typeof claimSchema>[] | null | undefined): { qid: string; year: number | null }[] {
  const out: { qid: string; year: number | null }[] = [];
  for (const claim of claims ?? []) {
    const item = itemValueSchema.safeParse(claim.mainsnak.datavalue?.value);
    if (!item.success) continue;
    const time = timeValueSchema.safeParse(claim.qualifiers?.[POINT_IN_TIME]?.[0]?.datavalue?.value);
    const year = time.success ? Number(/^[+-]?(\d{4})/.exec(time.data.time)?.[1] ?? NaN) : NaN;
    out.push({ qid: item.data.id, year: Number.isFinite(year) ? year : null });
    if (out.length >= MAX_AWARDS) break;
  }
  return out;
}
