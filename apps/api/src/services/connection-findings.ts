import { artistConnectionResponseSchema, type ArtistConnectionResponse, type ConnectionFinding, type ConnectionParty, type SourceReference } from "@worlds/shared";

import { CONNECTION_FINDINGS } from "../content/connection-findings.js";
import { normalizeName } from "../lib/matching.js";

/**
 * Look up precomputed connection research for a pair of graph nodes.
 *
 * This is the read side of the connection agent (AGENTS.md §12). It answers one
 * question: has this pair been researched, and if so what did it find? It does
 * no research itself and never calls a provider, so it is safe on the request
 * path and cannot be the reason a graph is slow.
 *
 * ## Matching
 *
 * A relationship is a property of a *pair*, so lookup is order-insensitive:
 * `find(a, b)` and `find(b, a)` return the same finding. Names are compared with
 * exact normalized equality (`normalizeName`), the same rule the rest of the API
 * uses, so "Fela Kuti" never matches "Femi Kuti" and a near-miss cannot attach
 * one entity's citation to another. Category is part of the key because a brand
 * and an artist can share a name.
 *
 * Names, not provider IDs, are the key. Qloo's entity IDs are provider
 * identifiers that AGENTS.md §5 says to keep separate from canonical ones, and
 * the artifact must stay readable and reviewable in a diff. The trade-off is
 * explicit: a finding silently stops applying if Qloo renames an entity, which
 * is the safe direction to fail. A test covers the rename case.
 */
/** A node to look up: its name and the category it is filed under. */
export type NodeIdentity = ConnectionParty;

/** A finding shaped for `explainConnection`'s `documented` input. */
export interface DocumentedConnection {
  statement: string;
  sourceLabel: string;
  sourceUrl: string;
  references: SourceReference[];
}

/** Pair key. Order-independent, because a relationship belongs to the pair. */
function pairKey(a: NodeIdentity, b: NodeIdentity): string {
  const one = `${a.category}\u0000${normalizeName(a.name)}`;
  const two = `${b.category}\u0000${normalizeName(b.name)}`;
  return [one, two].sort().join("\u0001");
}

export class ConnectionFindingsIndex {
  private readonly byPair = new Map<string, ConnectionFinding>();
  private readonly findings: readonly ConnectionFinding[];

  constructor(findings: readonly ConnectionFinding[] = CONNECTION_FINDINGS.findings) {
    this.findings = findings;
    for (const finding of findings) {
      const key = pairKey(finding.subject, finding.target);
      // A duplicate pair would make which finding wins depend on file order.
      // Refuse it rather than pick silently; the artifact is reviewed, so this
      // is a mistake to fix at source.
      if (this.byPair.has(key)) {
        throw new Error(
          `duplicate connection finding for ${finding.subject.name} and ${finding.target.name}`
        );
      }
      this.byPair.set(key, finding);
    }
  }

  get size(): number {
    return this.byPair.size;
  }

  /** The finding for a pair, whichever order it was researched in. */
  find(a: NodeIdentity, b: NodeIdentity): ConnectionFinding | undefined {
    return this.byPair.get(pairKey(a, b));
  }

  /** True when the pair has been researched, whatever the outcome. */
  hasResearched(a: NodeIdentity, b: NodeIdentity): boolean {
    return this.find(a, b) !== undefined;
  }

  /**
   * The cited connection for a pair, or null when there is none.
   *
   * Null covers both "researched and declined" and "never researched". Use
   * {@link find} when the difference matters — it is the difference between
   * "we looked and there is nothing" and "we never looked".
   */
  documented(a: NodeIdentity, b: NodeIdentity): DocumentedConnection | null {
    const finding = this.find(a, b);
    if (!finding || finding.outcome !== "documented" || !finding.statement) return null;

    const references: SourceReference[] = finding.citations.map((citation) => ({
      label: citation.sourceLabel,
      url: citation.sourceUrl,
      // The date a human or the agent last checked the claim against the source.
      reviewedAt: `${finding.reviewedAt}T00:00:00.000Z`
    }));

    // The first citation is the primary source for the statement, and is what
    // the badge links to. A finding must carry at least one to parse.
    const primary = finding.citations[0];
    if (!primary) return null;

    return {
      statement: finding.statement,
      sourceLabel: finding.citations.length > 1
        ? `${primary.sourceLabel} and ${finding.citations.length - 1} more`
        : primary.sourceLabel,
      sourceUrl: primary.sourceUrl,
      references
    };
  }

  /** Every finding, for review tooling and tests. */
  all(): readonly ConnectionFinding[] {
    return this.findings;
  }

  /** Constant-time, source-bound story lookup; no provider or model work on a click. */
  artistConnection(a: string, b: string): ArtistConnectionResponse {
    const finding = this.find({ name: a, category: "artist" }, { name: b, category: "artist" });
    const approved = Boolean(finding?.editorialApproval);
    const documented = approved && finding?.outcome === "documented" && finding.statement;
    return artistConnectionResponseSchema.parse({
      subject: a,
      target: b,
      status: finding ? (approved ? finding.outcome : "pending_review") : "unresearched",
      statement: documented || null,
      claims: documented
        ? [{ text: documented, citations: finding.citations }, ...(finding?.story ?? [])]
        : [],
      reviewedAt: approved ? finding?.editorialApproval?.checkedAt ?? null : null,
      research: approved && finding?.editorialApproval
        ? { consulted: finding.method.consulted, approvedBy: finding.editorialApproval.reviewer }
        : null
    });
  }
}
