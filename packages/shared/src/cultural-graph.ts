import { z } from "zod";

import { QLOO_ENTITY_TYPES } from "./qloo.js";

/**
 * Cultural graph contracts for Backend Milestone B1.2.
 *
 * The graph carries *what a link means* and *where it came from* (AGENTS.md
 * section 5). It deliberately holds no layout, coordinates for display, or
 * animation data: those belong to the frontend.
 */

export const CULTURAL_PROVIDERS = ["qloo"] as const;
export const culturalProviderSchema = z.enum(CULTURAL_PROVIDERS);
export type CulturalProvider = z.infer<typeof culturalProviderSchema>;

/** `unknown` is the safe bucket for categories we cannot confirm. */
export const CULTURAL_CATEGORIES = [...QLOO_ENTITY_TYPES, "unknown"] as const;
export const culturalCategorySchema = z.enum(CULTURAL_CATEGORIES);
export type CulturalCategory = z.infer<typeof culturalCategorySchema>;

/**
 * Evidence kinds stay distinct. Only `qloo_affinity` is produced in B1.2; the
 * others are reserved for future verified-source adapters and must never be
 * derived from Qloo output.
 */
export const EVIDENCE_KINDS = [
  "verified_fact",
  "qloo_affinity",
  "community_report",
  "editorial_interpretation"
] as const;
export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

/** `related_to` is reserved for non-affinity evidence kinds. */
export const RELATIONSHIP_TYPES = ["affinity_recommendation", "related_to"] as const;
export const relationshipTypeSchema = z.enum(RELATIONSHIP_TYPES);
export type RelationshipType = z.infer<typeof relationshipTypeSchema>;

/**
 * What a connection is *based on*, strongest first. Evidence kind says what
 * sort of evidence a link is; basis says how specific the explanation behind
 * it can be. A link never hides which rung it sits on, so a reader can tell a
 * documented relationship from a shared trait from a bare audience overlap.
 *
 * - `documented`: a cited source states the relationship. Requires references.
 * - `provider_attribute`: the provider states a relationship or trait that
 *   connects the two. Attributed to the provider, never asserted as history.
 * - `shared_attribute`: the two entities share a trait the provider records.
 * - `audience_overlap`: nothing but the affinity score itself.
 */
export const CONNECTION_BASES = [
  "documented",
  "provider_attribute",
  "shared_attribute",
  "audience_overlap"
] as const;
export const connectionBasisSchema = z.enum(CONNECTION_BASES);
export type ConnectionBasis = z.infer<typeof connectionBasisSchema>;

export const edgeBasisSchema = z.object({
  kind: connectionBasisSchema,
  /** One plain sentence naming what the link is based on. */
  statement: z.string().min(1),
  /** The concrete values behind the statement, for display as-is. */
  shared: z.array(z.string()),
  /** Who supplied the basis, so the reader can weigh it. */
  sourceLabel: z.string().min(1),
  sourceUrl: z.url().nullable()
});
export type EdgeBasis = z.infer<typeof edgeBasisSchema>;

export const sourceReferenceSchema = z.object({
  label: z.string().min(1),
  url: z.url().optional(),
  reviewedAt: z.iso.datetime().optional()
});
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

/**
 * Geographic data exists only when independently verified, with a cited
 * source. Affinity results never populate it.
 */
export const verifiedGeoSchema = z.object({
  verified: z.literal(true),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: sourceReferenceSchema.extend({ url: z.url() })
});
export type VerifiedGeo = z.infer<typeof verifiedGeoSchema>;

export const nodeExpansionSchema = z.object({
  /** True when a later request may use this node as the graph root. */
  eligible: z.boolean(),
  reason: z.string().min(1),
  /** Target categories known to work when expanding from this node. */
  targetCategories: z.array(culturalCategorySchema)
});
export type NodeExpansion = z.infer<typeof nodeExpansionSchema>;

/**
 * A display image supplied by the provider for the entity itself. It
 * illustrates the node only; it is not evidence for any relationship.
 */
export const nodeImageSchema = z.object({
  url: z.url(),
  provider: culturalProviderSchema
});
export type NodeImage = z.infer<typeof nodeImageSchema>;

export const culturalNodeSchema = z.object({
  /** `<provider>:<lowercased external id>`. Stable across requests. */
  id: z.string().min(1),
  name: z.string().min(1),
  category: culturalCategorySchema,
  provider: culturalProviderSchema,
  /** The provider's own identifier, preserved exactly as received. */
  externalId: z.string().min(1),
  description: z.string().nullable(),
  /** Provider popularity signal (not an affinity), when supplied. */
  popularity: z.number().nullable(),
  /** Provider tag names, kept for category filtering. */
  tags: z.array(z.string()),
  geo: verifiedGeoSchema.nullable(),
  /** Null when the provider supplied no image. Never substituted or guessed. */
  image: nodeImageSchema.nullable(),
  expansion: nodeExpansionSchema
});
export type CulturalNode = z.infer<typeof culturalNodeSchema>;

export const edgeProvenanceSchema = z.object({
  provider: culturalProviderSchema,
  /** Provider endpoint that supplied the link. */
  endpoint: z.string().min(1),
  /** `live` means a provider response, never a fixture. */
  mode: z.literal("live"),
  environment: z.string().min(1),
  retrievedAt: z.iso.datetime()
});
export type EdgeProvenance = z.infer<typeof edgeProvenanceSchema>;

export const culturalEdgeSchema = z
  .object({
    /** `<source id>|<relationship type>|<target id>`. Stable across requests. */
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    relationship: relationshipTypeSchema,
    evidence: evidenceKindSchema,
    provenance: edgeProvenanceSchema,
    /** Provider's original score, untouched. Null when not supplied. */
    affinity: z.number().nullable(),
    references: z.array(sourceReferenceSchema),
    /** Review outcome for this pair, independent from its Qloo affinity. */
    researchStatus: z.enum(["unresearched", "documented", "declined"]),
    /** What the link means, in words a user can read. */
    label: z.string().min(1),
    /** What the link is based on, and how strong that basis is. */
    basis: edgeBasisSchema
  })
  .superRefine((edge, ctx) => {
    if (edge.evidence === "qloo_affinity") {
      if (edge.provenance.provider !== "qloo" || edge.relationship !== "affinity_recommendation") {
        ctx.addIssue({
          code: "custom",
          message: "qloo_affinity edges must be Qloo affinity_recommendation links"
        });
      }
    } else if (edge.affinity !== null) {
      ctx.addIssue({ code: "custom", message: "Only qloo_affinity edges may carry an affinity score" });
    }
    if (edge.evidence === "verified_fact" && edge.references.length === 0) {
      ctx.addIssue({ code: "custom", message: "verified_fact edges require a source reference" });
    }
    if (edge.basis.kind === "documented" && edge.references.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "a documented basis requires the source it is documented in"
      });
    }
    if ((edge.researchStatus === "documented") !== (edge.basis.kind === "documented")) {
      ctx.addIssue({ code: "custom", message: "only documented research may supply a documented basis" });
    }
  });
export type CulturalEdge = z.infer<typeof culturalEdgeSchema>;

export const graphWarningSchema = z.object({
  code: z.enum([
    "no_affinity_results",
    "missing_affinity",
    "invalid_entity_skipped",
    "self_reference_skipped",
    "category_truncated",
    "graph_truncated"
  ]),
  message: z.string().min(1)
});
export type GraphWarning = z.infer<typeof graphWarningSchema>;

export const culturalGraphSchema = z.object({
  rootId: z.string().min(1),
  nodes: z.array(culturalNodeSchema),
  edges: z.array(culturalEdgeSchema),
  retrieval: z.object({
    retrievedAt: z.iso.datetime(),
    providers: z.array(culturalProviderSchema),
    limits: z.object({
      maxNodes: z.number().int().min(1),
      maxPerCategory: z.number().int().min(1)
    }),
    nodeCount: z.number().int().min(1),
    edgeCount: z.number().int().min(0),
    nodesByCategory: z.record(z.string(), z.number().int()),
    edgesByEvidence: z.record(z.string(), z.number().int())
  }),
  warnings: z.array(graphWarningSchema),
  limitations: z.array(z.string().min(1))
});
export type CulturalGraph = z.infer<typeof culturalGraphSchema>;

export const CULTURAL_GRAPH_LIMITATIONS = [
  "Qloo links are cultural affinity signals between audiences, not verified history, influence, collaboration, endorsement or causation.",
  "An affinity score ranks items for a population. It is not the probability that an individual likes an item.",
  "Place and destination results are recommendations, not verified locations. No coordinates or map pins are derived from them.",
  "Only artist nodes are confirmed as expansion roots.",
  "Every link states its basis and which rung of the ladder that basis sits on. A documented basis carries its source; a provider-stated or shared trait is Qloo's description of the entities, not independent verification."
] as const;
