import { z } from "zod";

import { connectionStoryClaimSchema } from "./connection-agent.js";
import { QLOO_MAX_QUERY_LENGTH } from "./qloo.js";

/** Read-only pair detail. Identity must be checked against the graph before lookup. */
export const artistConnectionQuerySchema = z.object({
  subject: z.string().trim().min(1).max(QLOO_MAX_QUERY_LENGTH),
  target: z.string().trim().min(1).max(QLOO_MAX_QUERY_LENGTH)
});

export const artistConnectionResponseSchema = z.object({
  subject: z.string().min(1),
  target: z.string().min(1),
  status: z.enum(["documented", "declined", "unresearched", "pending_review"]),
  /** Human-reviewed claim only; never sourced from a model draft. */
  statement: z.string().nullable(),
  claims: z.array(connectionStoryClaimSchema),
  reviewedAt: z.iso.date().nullable(),
  /** How an approved result was reached: the sources the agent consulted and who approved it. */
  research: z.object({
    consulted: z.array(z.string().min(1)).max(10),
    approvedBy: z.string().min(1)
  }).nullable()
}).superRefine((value, ctx) => {
  if (value.status === "documented" && (!value.statement || value.claims.length === 0)) {
    ctx.addIssue({ code: "custom", message: "documented pair needs a cited statement" });
  }
  if ((value.status === "documented" || value.status === "declined") !== (value.research !== null)) {
    ctx.addIssue({ code: "custom", message: "only an approved result carries its research trail" });
  }
  if (value.status !== "documented" && (value.statement !== null || value.claims.length !== 0)) {
    ctx.addIssue({ code: "custom", message: "unsupported pairs cannot carry claims" });
  }
});
export type ArtistConnectionResponse = z.infer<typeof artistConnectionResponseSchema>;
