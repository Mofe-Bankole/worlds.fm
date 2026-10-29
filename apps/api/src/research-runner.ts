import { randomUUID } from "node:crypto";
import { open, mkdir, mkdtemp, rm, realpath, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

import { CONNECTION_FINDINGS } from "./content/connection-findings.js";
import { loadConfig } from "./config.js";
import { MusicBrainzCatalog } from "./integrations/musicbrainz/index.js";
import { QlooAdapter } from "./integrations/qloo/index.js";
import { FactoryResearchModel } from "./integrations/research/factory-model.js";
import { MusicBrainzResearchTools } from "./integrations/research/musicbrainz-tools.js";
import { ProviderHttpClient } from "./lib/http-client.js";
import { CulturalDiscoveryService } from "./services/cultural-discovery.js";
import { ConnectionFindingsIndex } from "./services/connection-findings.js";
import { draftReport, runResearch } from "./services/connection-research.js";

const API_DIR = resolve(import.meta.dirname, "..");
const OUTPUT_DIR = join(API_DIR, "research-drafts");
const ARTISTS = ["Tame Impala", "Bob Marley", "Clams Casino", "Fela Kuti", "Femi Kuti"] as const;
const modelIdSchema = z.string().trim().min(2).max(120).regex(/^[A-Za-z0-9:_./-]+$/);

export interface ResearchCommand {
  artist: (typeof ARTISTS)[number];
  maxPairs: number;
  /** Require an explicit opt-in before spending credits or contacting Qloo. */
  live: boolean;
}

export function parseResearchCommand(args: readonly string[]): ResearchCommand {
  if (args[0] === "--") args = args.slice(1);
  if (args.length !== 5 || args[0] !== "--artist" || args[2] !== "--max-pairs" ||
      args[4] !== "--live" || !ARTISTS.includes(args[1] as (typeof ARTISTS)[number]) ||
      !/^[1-3]$/.test(args[3] ?? "")) {
    throw new Error('Usage: pnpm --dir apps/api research:factory -- --artist "Tame Impala" --max-pairs 1 --live');
  }
  return { artist: args[1] as ResearchCommand["artist"], maxPairs: Number(args[3]), live: true };
}

/** Fetch one live Qloo graph, research only previously unreviewed artist pairs. */
export async function executeResearchCommand(command: ResearchCommand, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  if (!command.live) throw new Error("Use --live to authorize provider requests and Factory credit use");
  const key = env.FACTORY_API_KEY?.trim();
  const modelId = modelIdSchema.safeParse(env.FACTORY_RESEARCH_MODEL_ID).data;
  if (!key || !modelId) throw new Error("Set FACTORY_API_KEY and a valid FACTORY_RESEARCH_MODEL_ID privately before running");
  if (!Number.isInteger(command.maxPairs) || command.maxPairs < 1 || command.maxPairs > 3) {
    throw new Error("maxPairs must be between 1 and 3");
  }
  const config = loadConfig(env);
  if (!config.qlooApiKey) throw new Error("Set QLOO_API_KEY privately before running");

  const privateCwd = await mkdtemp(join(tmpdir(), "worlds-factory-research-"));
  try {
    // Isolate Factory from repo files, skills, and ancestor AGENTS.md. The
    // Factory model gets only the bounded turn JSON, never repository access.
    const qlooHttp = new ProviderHttpClient({
      timeoutMs: config.qlooHttpTimeoutMs, retries: config.qlooHttpRetries,
      retryBaseDelayMs: config.mediaHttpRetryBaseMs, userAgent: config.mediaUserAgent
    });
    const mbHttp = new ProviderHttpClient({
      // Offline MusicBrainz relation payloads are much larger than the
      // user-facing catalogue lookups; tolerate a slower response without
      // adding any model latency to the live page.
      // One retry absorbs MusicBrainz's transient 503s; offline, so no page waits on it.
      timeoutMs: Math.max(config.mediaHttpTimeoutMs, 15_000), retries: 1,
      retryBaseDelayMs: config.mediaHttpRetryBaseMs,
      minIntervalMs: Math.max(config.musicBrainzMinIntervalMs, 1100),
      userAgent: config.mediaUserAgent
    });
    const cache = { ttlMs: 60_000, negativeTtlMs: 15_000, maxEntries: 100 };
    const adapter = new QlooAdapter({
      http: qlooHttp, apiKey: config.qlooApiKey, baseUrl: config.qlooApiBaseUrl, cache
    });
    const findings = new ConnectionFindingsIndex();
    const discovery = new CulturalDiscoveryService({
      adapter,
      musicBrainz: new MusicBrainzCatalog({ http: mbHttp, cache }),
      findings,
      cache
    });
    const { body } = await discovery.discoverArtist({ query: command.artist, limit: 5 });
    if (body.status !== "complete" || !body.graph || body.graph.edges.length === 0) {
      throw new Error("Qloo did not return a complete graph; no research was attempted");
    }

    const run = await runResearch(body, {
      model: new FactoryResearchModel({
        apiKey: key, modelId, cwd: privateCwd, timeoutMs: 30_000
      }),
      tools: new MusicBrainzResearchTools(mbHttp),
      maxPairs: command.maxPairs,
      reviewed: CONNECTION_FINDINGS.findings
    });
    if (run.results.length === 0) throw new Error("No unreviewed Qloo artist pairs in this graph");
    await mkdir(OUTPUT_DIR, { recursive: true, mode: 0o700 });
    const directoryInfo = await lstat(OUTPUT_DIR);
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() ||
        await realpath(OUTPUT_DIR) !== OUTPUT_DIR) {
      throw new Error("Research draft directory must be a real local directory");
    }
    const path = join(OUTPUT_DIR, `unreviewed-${Date.now()}-${randomUUID()}.json`);
    const file = await open(path, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(draftReport(run), null, 2) + "\n", "utf8");
    } finally {
      await file.close();
    }
    return path;
  } finally {
    await rm(privateCwd, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  Promise.resolve()
    .then(() => executeResearchCommand(parseResearchCommand(process.argv.slice(2))))
    .then((path) => { console.log(`Unreviewed research draft written to ${path}`); })
    .catch(() => {
      // Provider/SDK errors might contain credentials or source text. Fail
      // without printing upstream errors; diagnostics are covered by tests.
      console.error("Research failed. Check flags, private credentials, Qloo availability and the model adapter.");
      process.exitCode = 1;
    });
}
