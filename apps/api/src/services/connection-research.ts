import type { CulturalDiscoveryResponse, CulturalEdge, CulturalNode, ConnectionFinding } from "@worlds/shared";

import { normalizeName } from "../lib/matching.js";
import {
  researchPair,
  type AgentResult,
  type ResearchDecisionModel,
  type ResearchSourceTools
} from "../integrations/research/agent.js";

export interface ResearchCandidate {
  subject: CulturalNode;
  target: CulturalNode;
  edge: CulturalEdge;
  /** Which ranked Qloo result caused this pair to be investigated. */
  selectionReason: string;
}

export interface ResearchRun {
  root: string;
  qlooRetrievedAt: string;
  model: string;
  results: Array<{ candidate: ResearchCandidate; result: AgentResult }>;
}

/**
 * Public-demo-safe summary of an offline run. No raw model prompt, source
 * payload, private key, or unreviewed statement is included. Publication still
 * requires a human to check the draft and choose to share this summary.
 */
export function summarizeResearchRun(run: ResearchRun) {
  return {
    kind: "UNREVIEWED_RESEARCH_TRACE" as const,
    root: run.root,
    qlooRetrievedAt: run.qlooRetrievedAt,
    pairs: run.results.map(({ candidate, result }) => ({
      subject: candidate.subject.name,
      target: candidate.target.name,
      qlooAffinity: candidate.edge.affinity,
      selectionReason: candidate.selectionReason,
      status: result.kind === "draft" ? result.finding.outcome : "unavailable",
      reason: result.kind === "unavailable" ? result.reason : null,
      actions: result.steps.map(({ action, observation }) => ({
        tool: action.tool,
        sourceUrl: observation && "source" in observation ? observation.source.url : null
      }))
    }))
  };
}

/** Safe, reviewable draft artifact; no published finding is modified here. */
export function draftReport(run: ResearchRun) {
  return {
    kind: "UNREVIEWED_RESEARCH_DRAFT" as const,
    root: run.root,
    qlooRetrievedAt: run.qlooRetrievedAt,
    model: run.model,
    items: run.results.map(({ candidate, result }) => ({
      qloo: {
        subject: { id: candidate.subject.externalId, name: candidate.subject.name, category: candidate.subject.category },
        target: { id: candidate.target.externalId, name: candidate.target.name, category: candidate.target.category },
        affinity: candidate.edge.affinity,
        selectionReason: candidate.selectionReason
      },
      result
    }))
  };
}

/**
 * Only candidates in Qloo's actual returned graph are eligible. Prevent
 * looking up arbitrary user/model-invented pairs and retrying already-reviewed
 * names. A score sorts candidates but never proves their relationship.
 */
export function selectResearchCandidates(
  response: CulturalDiscoveryResponse,
  maxPairs: number,
  reviewed: readonly ConnectionFinding[] = []
): ResearchCandidate[] {
  const graph = response.graph;
  if (!graph || !response.root || response.status === "not_found" || response.status === "needs_disambiguation") {
    return [];
  }
  const root = graph.nodes.find((node) => node.id === graph.rootId);
  if (!root || normalizeName(root.name) !== normalizeName(response.root.name)) return [];
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  return graph.edges
    .filter((edge) => edge.evidence === "qloo_affinity" && edge.source === graph.rootId &&
      edge.provenance.mode === "live" && edge.provenance.provider === "qloo")
    .map((edge) => ({
      edge,
      subject: root,
      target: nodes.get(edge.target)
    }))
    .filter((candidate): candidate is { edge: CulturalEdge; subject: CulturalNode; target: CulturalNode } => {
      const target = candidate.target;
      return target !== undefined && target.id !== root.id &&
        target.category === "artist" &&
        !reviewed.some((item) =>
          [item.subject, item.target].some((party) => party.category === root.category && normalizeName(party.name) === normalizeName(root.name)) &&
          [item.subject, item.target].some((party) => party.category === target.category && normalizeName(party.name) === normalizeName(target.name))
        );
    })
    .sort((a, b) => {
      const scoreA = a.edge.affinity;
      const scoreB = b.edge.affinity;
      if (scoreA === null && scoreB !== null) return 1;
      if (scoreB === null && scoreA !== null) return -1;
      if (scoreA !== null && scoreB !== null && scoreA !== scoreB) return scoreB - scoreA;
      return a.target.name.localeCompare(b.target.name);
    })
    .slice(0, Math.min(Math.max(0, maxPairs), 3))
    .map((candidate) => ({
      ...candidate,
      selectionReason: `Qloo Insights ranked ${candidate.target.name} for ${root.name}` +
        (candidate.edge.affinity === null ? " without a score." : ` (affinity ${candidate.edge.affinity}).`)
    }));
}

/** No production API route invokes this. Call it offline with approved budgets. */
export async function runResearch(
  response: CulturalDiscoveryResponse,
  options: {
    model: ResearchDecisionModel;
    tools: ResearchSourceTools;
    maxPairs: number;
    reviewed?: readonly ConnectionFinding[];
    now?: () => Date;
  }
): Promise<ResearchRun> {
  if (!options.model.isEnabled) throw new Error("Research model is not configured");
  if (!Number.isInteger(options.maxPairs) || options.maxPairs < 1 || options.maxPairs > 3) {
    throw new Error("Research maxPairs must be an integer from 1 to 3");
  }
  const candidates = selectResearchCandidates(response, options.maxPairs, options.reviewed);
  const results: ResearchRun["results"] = [];
  for (const candidate of candidates) {
    const result = await researchPair({
      subject: { name: candidate.subject.name, category: candidate.subject.category },
      target: { name: candidate.target.name, category: candidate.target.category },
      affinity: candidate.edge.affinity
    }, options.model, options.tools, options.now);
    results.push({ candidate, result });
  }
  return {
    root: response.root?.name ?? response.query,
    qlooRetrievedAt: response.graph?.retrieval.retrievedAt ?? response.retrievedAt,
    model: options.model.label,
    results
  };
}
