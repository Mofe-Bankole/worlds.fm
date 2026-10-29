import { describe, expect, it } from "vitest";
import { culturalDiscoveryResponseSchema, type ConnectionFinding } from "@worlds/shared";

import { researchPair, type AgentAction, type AgentTurn, type ResearchDecisionModel, type ResearchSourceTools } from "../src/integrations/research/agent.js";
import { FactoryResearchModel, type FactoryRun } from "../src/integrations/research/factory-model.js";
import { MusicBrainzResearchTools } from "../src/integrations/research/musicbrainz-tools.js";
import { ProviderHttpClient } from "../src/lib/http-client.js";
import { draftReport, runResearch, selectResearchCandidates, summarizeResearchRun } from "../src/services/connection-research.js";
import { fixtureResponse } from "./research-fixtures.js";
import { executeResearchCommand, parseResearchCommand } from "../src/research-runner.js";

/** Entire suite uses invented data; no Qloo, MusicBrainz, or model requests. */
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const first = "Mock Artist has MusicBrainz artist relation \"member of band\" with Mock Artist B.";
const source = (id: string, name: string, lines: string[]) => ({
  id, name, lines,
  url: `https://musicbrainz.org/artist/${id}`,
  label: `MusicBrainz — ${name}`,
  license: "CC0 1.0"
});
const pair = {
  subject: { name: "Mock Artist", category: "artist" as const },
  target: { name: "Mock Artist B", category: "artist" as const },
  affinity: 0.91
};
const tools: ResearchSourceTools = {
  async searchArtist(name) {
    return { tool: "search_artist", artists: [{ id: name === "Mock Artist" ? A : B, name }] };
  },
  async artistRelations(id) {
    return { tool: "artist_relations", source: source(id, id === A ? pair.subject.name : pair.target.name,
      id === A ? [first] : []) };
  }
};
function model(...actions: AgentAction[]): ResearchDecisionModel {
  let step = 0;
  return {
    isEnabled: true,
    label: "fixture",
    async next(_turn: AgentTurn) {
      const action = actions[step++];
      if (!action) throw new Error("Model actions exhausted");
      return action;
    }
  };
}
const search = (name: string): AgentAction => ({ tool: "search_artist", input: { name } });
const relations = (id: string): AgentAction => ({ tool: "artist_relations", input: { artistId: id } });
const finish = (outcome: "documented" | "declined", statement: string | null, quotes: string[] = [], sourceUrls: string[] = []): AgentAction =>
  ({ tool: "finish", input: { outcome, statement, quotes, sourceUrls } });
const date = () => new Date("2026-10-24T10:00:00.000Z");

describe("offline research agent, mock model and mock source tools", () => {
  it("follows search → read → cited draft, retaining the source and review boundary", async () => {
    const result = await researchPair(pair, model(search(pair.subject.name), relations(A),
      finish("documented", `MusicBrainz records ${first}`, [first], [source(A, "", []).url])), tools, date);
    expect(result.kind).toBe("draft");
    if (result.kind !== "draft") return;
    expect(result.finding).toMatchObject({
      outcome: "documented",
      reviewedBy: "draft:fixture",
      citations: [{ sourceUrl: source(A, "", []).url }]
    });
    expect(result.steps.map((step) => step.action.tool)).toEqual(["search_artist", "artist_relations", "finish"]);
  });

  it("declines only after inspecting both parties, without implying an exhaustive search", async () => {
    const result = await researchPair(pair, model(search(pair.subject.name), relations(A),
      search(pair.target.name), relations(B), finish("declined", null)), tools, date);
    expect(result.kind).toBe("draft");
    if (result.kind === "draft") {
      expect(result.finding).toMatchObject({ outcome: "declined", statement: null, citations: [] });
      expect(result.finding.method.consulted).toHaveLength(2);
    }
  });

  it("rejects a decline after seeing only one party", async () => {
    const result = await researchPair(pair, model(search(pair.subject.name), relations(A), finish("declined", null)), tools, date);
    expect(result).toMatchObject({ kind: "unavailable", reason: "incomplete_source_search" });
  });
  it("cannot publish an invented Qloo pair or an unconfigured model decision", async () => {
    const disabled: ResearchDecisionModel = {
      isEnabled: false, label: "none", next: async () => finish("declined", null)
    };
    expect(await researchPair(pair, disabled, tools, date))
      .toMatchObject({ kind: "unavailable", reason: "not_configured" });
    await expect(runResearch(fixtureResponse(), { model: disabled, tools, maxPairs: 1 }))
      .rejects.toThrow(/not configured/);
  });

  it("rejects invented or unrelated citations and invented claims", async () => {
    const prefix = [search(pair.subject.name), relations(A)];
    for (const decision of [
      finish("documented", `MusicBrainz records ${first}`, [first], ["https://example.test/fake"]),
      finish("documented", "MusicBrainz records Mock Artist endorses Mock Artist B.", [first], [source(A, "", []).url]),
      finish("documented", `MusicBrainz records ${first}`, ["not in source"], [source(A, "", []).url]),
    ]) {
      expect(await researchPair(pair, model(...prefix, decision), tools, date))
        .toMatchObject({ kind: "unavailable", reason: "unsupported_decision" });
    }
  });

  it("refuses unfetched IDs, off-pair searches, and duplicate calls", async () => {
    expect(await researchPair(pair, model(relations(A)), tools, date)).toMatchObject({ reason: "unresolved_artist_id" });
    expect(await researchPair(pair, model(search("Other Artist")), tools, date)).toMatchObject({ reason: "out_of_scope_search" });
    expect(await researchPair(pair, model(search(pair.subject.name), search(pair.subject.name)), tools, date))
      .toMatchObject({ reason: "duplicate_source_request" });
  });

  it("verifies a producer credit on a recording linked to the other resolved artist", async () => {
    const title = "Mock Track";
    const recordingId = "cccccccc-0000-4000-8000-000000000003";
    const credit = `Mock Artist has MusicBrainz recording credit "producer" on "${title}" by Mock Artist B.`;
    const recordingTools: ResearchSourceTools = {
      ...tools,
      artistRelations: async (id) => ({
        tool: "artist_relations",
        source: source(id, pair.subject.name, [
          `Mock Artist has MusicBrainz recording relation "producer" on "${title}".`
        ])
      }),
      recordingCredits: async () => ({
        tool: "recording_credits",
        source: {
          id: recordingId, name: title, url: `https://musicbrainz.org/recording/${recordingId}`,
          label: `MusicBrainz — ${title}`, license: "CC0 1.0", lines: [credit]
        }
      })
    };
    const actions = [search(pair.subject.name), relations(A), search(pair.target.name),
      { tool: "recording_credits", input: { producerId: A, artistId: B, title } } as const];
    const url = `https://musicbrainz.org/recording/${recordingId}`;
    const result = await researchPair(pair, model(...actions,
      finish("documented", `MusicBrainz records ${credit}`, [credit], [url])), recordingTools, date);
    expect(result).toMatchObject({ kind: "draft", finding: { citations: [{ sourceUrl: url }] } });
    expect(await researchPair(pair, model(...actions,
      finish("documented", `MusicBrainz records ${credit.replace("Mock Artist B", "Someone Else")}`,
        [credit.replace("Mock Artist B", "Someone Else")], [url])), recordingTools, date))
      .toMatchObject({ kind: "unavailable", reason: "unsupported_decision" });
    expect(await researchPair(pair, model(search(pair.subject.name), actions[3]!), recordingTools, date))
      .toMatchObject({ kind: "unavailable", reason: "unresolved_artist_id" });
  });

  it("keeps provider errors, ambiguous identity, and spent turn budgets out of the reviewed corpus", async () => {
    const failing = { ...tools, artistRelations: async () => { throw new Error("secret upstream"); } };
    const failure = await researchPair(pair, model(search(pair.subject.name), relations(A), finish("declined", null)), failing, date);
    expect(failure).toMatchObject({ kind: "unavailable", reason: "source_unavailable" });
    expect(JSON.stringify(failure)).not.toContain("secret upstream");
    expect(failure.steps.at(-1)?.observation).toEqual({ tool: "tool_error", message: "Source unexpected_error." });
    const ambiguous: ResearchSourceTools = {
      ...tools, searchArtist: async () => ({ tool: "search_artist", artists: [] })
    };
    expect(await researchPair(pair, model(search(pair.subject.name), finish("declined", null)), ambiguous, date))
      .toMatchObject({ kind: "unavailable", reason: "incomplete_source_search" });
    expect(await researchPair(pair, model(search(pair.subject.name), relations(A)), tools, date))
      .toMatchObject({ kind: "unavailable", reason: "model_error" });
  });

  it("selects only ranked, real Qloo artist edges; reviewed items cannot be researched twice", () => {
    const response = fixtureResponse();
    const candidates = selectResearchCandidates(response, 3);
    expect(candidates.map((candidate) => candidate.target.name)).toEqual(["Mock Artist B", "Mock Artist C"]);
    expect(candidates[0]?.selectionReason).toContain("Qloo Insights ranked");
    const reviewed: ConnectionFinding[] = [{
      subject: pair.subject, target: pair.target, outcome: "declined", statement: null, citations: [],
      method: { consulted: ["MusicBrainz"], query: "mock" },
      reviewedBy: "editor", reviewedAt: "2026-10-24"
    }];
    expect(selectResearchCandidates(response, 3, reviewed).map((candidate) => candidate.target.name))
      .toEqual(["Mock Artist C"]);
    expect(selectResearchCandidates(response, 0)).toEqual([]);
    const noScore = fixtureResponse();
    if (noScore.graph) noScore.graph.edges[1]!.affinity = null;
    expect(selectResearchCandidates(noScore, 3).map((candidate) => candidate.target.name))
      .toEqual(["Mock Artist B", "Mock Artist C"]);
    expect(selectResearchCandidates(culturalDiscoveryResponseSchema.parse({
      ...response, status: "not_found", root: null, graph: null
    }), 3)).toEqual([]);
  });

  it("runs Qloo selection and the model for a bounded number of pairs, never auto-publishes", async () => {
    const response = fixtureResponse();
    const run = await runResearch(response, {
      model: model(search(pair.subject.name), relations(A), finish("documented",
        `MusicBrainz records ${first}`, [first], [source(A, "", []).url])),
      tools, maxPairs: 1, now: date
    });
    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.result.kind).toBe("draft");
    expect(run.qlooRetrievedAt).toBe(response.graph?.retrieval.retrievedAt);
    expect(draftReport(run)).toMatchObject({
      kind: "UNREVIEWED_RESEARCH_DRAFT",
      items: [{ qloo: { affinity: 0.91, target: { name: "Mock Artist B" } },
        result: { kind: "draft", finding: { reviewedBy: "draft:fixture" } } }]
    });
    const trace = summarizeResearchRun(run);
    expect(trace).toMatchObject({
      kind: "UNREVIEWED_RESEARCH_TRACE",
      pairs: [{ target: "Mock Artist B", status: "documented",
        actions: [{ tool: "search_artist", sourceUrl: null }, { tool: "artist_relations", sourceUrl: source(A, "", []).url },
          { tool: "finish", sourceUrl: null }] }]
    });
    expect(JSON.stringify(trace)).not.toContain(first);
    await expect(runResearch(response, { model: model(), tools, maxPairs: 4 }))
      .rejects.toThrow(/maxPairs/);
  });
});

describe("MusicBrainz source adapter", () => {
  it("constructs bounded, attributable fact lines from artist relations", async () => {
    const urls: string[] = [];
    const http = new ProviderHttpClient({
      timeoutMs: 1000, retries: 0, retryBaseDelayMs: 25,
      fetchFn: async (input) => {
        urls.push(String(input));
        return new Response(JSON.stringify(String(input).includes("?query=")
          ? { artists: [{ id: A, name: pair.subject.name }] }
          : { id: A, name: pair.subject.name, relations: [
            { type: "member of band", "target-type": "artist", artist: { id: B, name: pair.target.name } },
            { type: "image", "target-type": "url", url: { resource: "https://example.test" } }
          ] }), { status: 200 });
      }
    });
    const adapter = new MusicBrainzResearchTools(http);
    expect((await adapter.searchArtist(pair.subject.name)).artists).toHaveLength(1);
    expect((await adapter.artistRelations(A)).source).toMatchObject({ lines: [first], license: "CC0 1.0" });
    expect(urls[0]).toContain("musicbrainz.org/ws/2/artist/?query=");
    expect(urls[1]).toContain("inc=artist-rels");
  });

  it("keeps MusicBrainz relation direction so a quoted line never inverts a fact", async () => {
    const http = new ProviderHttpClient({
      timeoutMs: 1000, retries: 0, retryBaseDelayMs: 25,
      fetchFn: async () => new Response(JSON.stringify({ id: A, name: "Femi Kuti", relations: [
        { type: "parent", direction: "backward", "target-type": "artist", artist: { id: B, name: "Fela Kuti" } },
        { type: "sibling", direction: "forward", "target-type": "artist", artist: { id: B, name: "Seun Kuti" } }
      ] }), { status: 200 })
    });
    const { source } = await new MusicBrainzResearchTools(http).artistRelations(A);
    expect(source.lines).toEqual([
      'Fela Kuti has MusicBrainz artist relation "parent" with Femi Kuti.',
      'Femi Kuti has MusicBrainz artist relation "sibling" with Seun Kuti.'
    ]);
  });

  it("searches a recording by resolved artist ID and rejects ambiguous credits", async () => {
    const recordingId = "cccccccc-0000-4000-8000-000000000003";
    const http = new ProviderHttpClient({
      timeoutMs: 1000, retries: 0, retryBaseDelayMs: 25,
      fetchFn: async (input) => new Response(JSON.stringify(String(input).includes("/recording/?")
        ? { recordings: [{ id: recordingId, title: "Mock Track" }] }
        : {
            id: recordingId, title: "Mock Track",
            "artist-credit": [{ artist: { id: B, name: pair.target.name } }],
            relations: [{ type: "producer", "target-type": "artist", artist: { id: A, name: pair.subject.name } }]
          }), { status: 200 })
    });
    const adapter = new MusicBrainzResearchTools(http);
    const result = await adapter.recordingCredits(A, B, "Mock Track");
    expect(result.source.lines).toEqual([
      'Mock Artist has MusicBrainz recording credit "producer" on "Mock Track" by Mock Artist B.'
    ]);
    expect(result.source.url).toBe(`https://musicbrainz.org/recording/${recordingId}`);
    await expect(adapter.recordingCredits(A, A, "Mock Track")).rejects.toThrow(/identity mismatch/);
  });
});

describe("Factory SDK decision adapter (SDK mocked, no credentials or paid calls)", () => {
  const factoryTurn: AgentTurn = { ...pair, history: [] };
  const action = search(pair.subject.name);
  const makeSdk = (out: unknown, messages: unknown[] = []): FactoryRun =>
    (async (_prompt, _options) => ({
      success: true, messages, structuredOutput: out, text: "", subtype: "success"
    })) as FactoryRun;

  it("fails closed without credentials and checks the authorized command before network access", async () => {
    const disabled = new FactoryResearchModel({
      cwd: "/tmp/research-fixture", apiKey: undefined, modelId: "mock", runSdk: makeSdk(action)
    });
    expect(disabled.isEnabled).toBe(false);
    await expect(disabled.next(factoryTurn)).rejects.toThrow(/not configured/);
    expect(parseResearchCommand(["--", "--artist", "Tame Impala", "--max-pairs", "1", "--live"]))
      .toEqual({ artist: "Tame Impala", maxPairs: 1, live: true });
    expect(() => parseResearchCommand(["--artist", "Other Artist", "--max-pairs", "1", "--live"])).toThrow(/Usage/);
    expect(() => parseResearchCommand(["--artist", "Tame Impala", "--max-pairs", "4", "--live"])).toThrow(/Usage/);
    await expect(executeResearchCommand({ artist: "Tame Impala", maxPairs: 1, live: false }))
      .rejects.toThrow(/--live/);
    await expect(executeResearchCommand({ artist: "Tame Impala", maxPairs: 1, live: true }, {}))
      .rejects.toThrow(/FACTORY_API_KEY/);
  });

  it("passes only bounded turn data as prompt; denies all SDK tool permissions", async () => {
    let capturedPrompt = "";
    let capturedOptions: Parameters<FactoryRun>[1] | undefined;
    const model = new FactoryResearchModel({
      cwd: "/tmp/research-fixture", apiKey: "fixture-secret-never-print", modelId: "mock",
      runSdk: (async (prompt, options) => {
        capturedPrompt = prompt; capturedOptions = options;
        return { success: true, messages: [], structuredOutput: action, subtype: "success" } as never;
      }) as FactoryRun
    });
    expect(await model.next(factoryTurn)).toEqual(action);
    expect(capturedPrompt).toContain("Mock Artist");
    expect(capturedPrompt).not.toContain("fixture-secret-never-print");
    expect(capturedOptions?.cwd).toBe("/tmp/research-fixture");
    expect(capturedOptions?.modelId).toBe("mock");
    expect(capturedOptions?.disableBuiltinSkills).toBe(true);
    expect(capturedOptions?.autoRejectPermissionRequests).toBe(true);
    expect(capturedOptions?.permissionHandler?.({} as never)).toBe("cancel");
    expect(capturedOptions?.outputFormat?.type).toBe("json_schema");
  });

  it("rejects model tool-use, malformed structured output, and SDK errors", async () => {
    for (const sdk of [
      makeSdk(action, [{ type: "tool_call", name: "Execute" }]),
      makeSdk({ tool: "finish", input: { outcome: "documented", citations: [] } }),
      (async () => { throw new Error("model key error"); }) as FactoryRun
    ]) {
      const model = new FactoryResearchModel({
        cwd: "/tmp/research-fixture", apiKey: "fixture", modelId: "mock", runSdk: sdk
      });
      await expect(model.next(factoryTurn)).rejects.toThrow();
    }
  });
});
