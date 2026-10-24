import {
  connectionFindingSchema,
  type ConnectionFinding,
  type ConnectionParty
} from "@worlds/shared";

import { ProviderError } from "../../lib/errors.js";

/**
 * The connection agent's model seam (AGENTS.md §12).
 *
 * Research runs **offline**, in a generator, not on the request path. The
 * server only ever reads the reviewed artifact that a generator produced, so
 * this module is deliberately not wired into `app.ts`: a request never waits on
 * a model, and the running API needs no model credentials at all.
 *
 * ## Why the output is validated here
 *
 * A model's reply is untrusted input, exactly like a provider's HTTP body. The
 * reply is parsed with `connectionFindingSchema` before anything else sees it,
 * so the rules that matter are enforced by the type system rather than by
 * asking the model nicely:
 *
 * - a `documented` finding with no citation cannot parse, so an uncited claim
 *   can never become a graph edge;
 * - a `declined` finding cannot carry a statement or citations, so a guess
 *   cannot be smuggled in as a "decline";
 * - anything that does not parse is discarded, never repaired.
 *
 * A provider is dropped in by implementing {@link ConnectionResearchModel}.
 * Nothing else changes.
 */

export interface ResearchRequest {
  subject: ConnectionParty;
  target: ConnectionParty;
  /**
   * Qloo's affinity for the pair. Passed so the agent knows the pair was
   * surfaced by the taste graph and how strongly, but it is **not** evidence and
   * must never appear in a statement (AGENTS.md §12, rule 2).
   */
  affinity: number | null;
}

/** Why research produced nothing usable. Each is a normal, expected outcome. */
export const RESEARCH_FAILURES = [
  /** No model provider is configured. The generator should say so and stop. */
  "not_configured",
  /** The provider did not answer within the timeout. */
  "timeout",
  /** The provider errored, refused, or was rate limited. */
  "provider_error",
  /** The provider answered, but not with something that parses as a finding. */
  "invalid_output"
] as const;
export type ResearchFailure = (typeof RESEARCH_FAILURES)[number];

export type ResearchResult =
  | { kind: "finding"; finding: ConnectionFinding }
  | { kind: "unavailable"; reason: ResearchFailure; detail: string };

export interface ConnectionResearchModel {
  /** False when no provider is configured, so callers can stop early. */
  readonly isEnabled: boolean;
  /** Name for logs and the artifact's `producedBy`. Never a credential. */
  readonly label: string;
  research(request: ResearchRequest): Promise<ResearchResult>;
}

/**
 * The model used when no provider is configured.
 *
 * It reports `not_configured` rather than throwing, so the generator can print a
 * clear reason and exit instead of failing halfway through a corpus. Choosing a
 * provider is an open decision (see `docs/backend/connection-agent.md`), and this
 * is what the system does until one is chosen.
 */
export class UnconfiguredResearchModel implements ConnectionResearchModel {
  readonly isEnabled = false;
  readonly label = "none";

  async research(_request: ResearchRequest): Promise<ResearchResult> {
    return {
      kind: "unavailable",
      reason: "not_configured",
      detail:
        "No connection research model is configured. Set a provider before generating findings; the reviewed artifact is not affected."
    };
  }
}

/**
 * Validate a model's raw reply into a finding.
 *
 * Kept as a pure function so it is testable without a provider, and so the same
 * check applies to every provider. Returns `invalid_output` rather than
 * throwing: a model that answers badly is a normal event, not a crash.
 */
export function parseResearchOutput(raw: unknown): ResearchResult {
  const parsed = connectionFindingSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      kind: "unavailable",
      reason: "invalid_output",
      detail: first ? `${first.path.join(".") || "finding"}: ${first.message}` : "did not parse as a finding"
    };
  }
  return { kind: "finding", finding: parsed.data };
}

/** Map a provider failure onto a research failure, without leaking its text. */
export function researchFailureFrom(error: unknown): ResearchResult {
  const kind = error instanceof ProviderError ? error.kind : "unknown";
  return {
    kind: "unavailable",
    reason: kind === "timeout" ? "timeout" : "provider_error",
    detail:
      kind === "timeout"
        ? "The research model did not answer in time."
        : "The research model failed. See the generator log for the provider's own error code."
  };
}
