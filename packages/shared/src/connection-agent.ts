import { z } from "zod";

import { culturalCategorySchema } from "./cultural-graph.js";

/**
 * Connection research — the product agent's output (AGENTS.md §12).
 *
 * The agent takes two nodes and establishes whether a **real, documented**
 * connection between them exists. It either cites a source or declines; there
 * is no third option, and a decline is a correct answer rather than a failure.
 *
 * This file is the contract half of §12. The load-bearing rule is encoded in
 * `connectionFindingSchema`'s refinement: a `documented` finding without a
 * citation does not parse, so an uncited claim cannot reach a graph.
 *
 * Qloo's role is to decide *which* pair is worth researching. It is never the
 * evidence for a statement, which is why nothing here accepts an affinity as
 * support for a finding.
 */

export const CONNECTION_OUTCOMES = [
  /** A source states the relationship, and it is cited below. */
  "documented",
  /** Research found nothing citable. Not an error: the honest answer. */
  "declined"
] as const;
export const connectionOutcomeSchema = z.enum(CONNECTION_OUTCOMES);
export type ConnectionOutcome = z.infer<typeof connectionOutcomeSchema>;

/** Which node a finding is about, and what kind of thing it is. */
export const connectionPartySchema = z.object({
  name: z.string().min(1),
  category: culturalCategorySchema
});
export type ConnectionParty = z.infer<typeof connectionPartySchema>;

/**
 * One resolvable source behind one claim. `license` is present when the source
 * states one, because reused text must carry its licence (AGENTS.md §5).
 */
export const connectionCitationSchema = z.object({
  sourceLabel: z.string().min(1),
  sourceUrl: z.url(),
  license: z.string().min(1).nullable()
});
export type ConnectionCitation = z.infer<typeof connectionCitationSchema>;

/**
 * What the research did, so a decline is as auditable as a statement. A reader
 * can tell "we looked and there is nothing" from "we never looked", and a
 * reviewer can see which sources were consulted.
 */
export const researchMethodSchema = z.object({
  /** Named sources consulted, e.g. ["MusicBrainz"]. */
  consulted: z.array(z.string().min(1)).min(1),
  /** What was searched for, in words. */
  query: z.string().min(1)
});
export type ResearchMethod = z.infer<typeof researchMethodSchema>;

/**
 * One pair, researched.
 *
 * `subject` and `target` are matched in either order when a finding is looked
 * up, because a relationship is a property of the pair. The statement is
 * written to read correctly whichever node the reader started from, and it
 * names both parties rather than relying on the graph's direction.
 */
export const connectionFindingSchema = z
  .object({
    subject: connectionPartySchema,
    target: connectionPartySchema,
    outcome: connectionOutcomeSchema,
    /** The cited statement. Present only when `outcome` is `documented`. */
    statement: z.string().min(1).max(400).nullable(),
    /** At least one for a `documented` finding. Empty for a decline. */
    citations: z.array(connectionCitationSchema),
    method: researchMethodSchema,
    /** When a human last checked this finding against its sources. */
    reviewedAt: z.iso.date(),
    /** Who reviewed it. Named, so the claim has an owner. */
    reviewedBy: z.string().min(1)
  })
  .superRefine((finding, ctx) => {
    if (finding.outcome === "documented") {
      if (!finding.statement) {
        ctx.addIssue({ code: "custom", message: "a documented finding must state the relationship" });
      }
      if (finding.citations.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "a documented finding must cite the source it is documented in"
        });
      }
      return;
    }
    // A decline says what was searched for and found nothing. It must not
    // smuggle in an uncited statement, which is how a guess becomes a fact.
    if (finding.statement !== null) {
      ctx.addIssue({ code: "custom", message: "a declined finding must not carry a statement" });
    }
    if (finding.citations.length > 0) {
      ctx.addIssue({ code: "custom", message: "a declined finding must not carry citations" });
    }
  });
export type ConnectionFinding = z.infer<typeof connectionFindingSchema>;

/**
 * The precomputed corpus. Versioned and reviewed as a whole, so a reviewer can
 * read the diff and see exactly which claims were added or changed.
 */
export const CONNECTION_FINDINGS_VERSION = 1;

export const connectionFindingsArtifactSchema = z.object({
  version: z.literal(CONNECTION_FINDINGS_VERSION),
  /**
   * Which agent produced this, and how. Free text, shown in review, not in UI.
   */
  producedBy: z.string().min(1),
  findings: z.array(connectionFindingSchema)
});
export type ConnectionFindingsArtifact = z.infer<typeof connectionFindingsArtifactSchema>;

export const CONNECTION_RESEARCH_NOTICE =
  "Connections marked Documented are stated by the cited source and claim nothing beyond it. Everything else is Qloo's description of the entities or a bare audience overlap, not independent verification.";
