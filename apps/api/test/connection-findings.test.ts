import {
  CONNECTION_FINDINGS_VERSION,
  connectionFindingSchema,
  connectionFindingsArtifactSchema,
  type ConnectionFinding,
  type QlooEntity,
  type QlooInsightsResponse
} from "@worlds/shared";
import { describe, expect, it } from "vitest";

import { CONNECTION_FINDINGS } from "../src/content/connection-findings.js";
import { buildCulturalGraph } from "../src/graph/cultural-graph-builder.js";
import {
  UnconfiguredResearchModel,
  parseResearchOutput,
  researchFailureFrom
} from "../src/integrations/research/index.js";
import { ConnectionFindingsIndex } from "../src/services/connection-findings.js";
import { ProviderError } from "../src/lib/errors.js";

/**
 * MOCK FIXTURES. Findings and Qloo entities are hand-written and invented.
 * Nothing here is a real claim about a real artist.
 */
const REVIEWED = { reviewedAt: "2026-10-24", reviewedBy: "test" };

function finding(over: Partial<ConnectionFinding> = {}): ConnectionFinding {
  const base = {
    subject: { name: "Mock Artist", category: "artist" as const },
    target: { name: "Mock Artist B", category: "artist" as const },
    outcome: "documented" as const,
    statement: "Mock Source records Mock Artist and Mock Artist B in the same mock group.",
    citations: [{ sourceLabel: "Mock Source", sourceUrl: "https://example.test/one", license: "CC0 1.0" }],
    method: { consulted: ["Mock Source"], query: "mock query" },
    ...REVIEWED,
    ...over
  };
  return connectionFindingSchema.parse(base);
}

/* ------------------------------- The contract ------------------------------ */

describe("connection finding contract (AGENTS.md §12)", () => {
  it("refuses a documented finding with no citation", () => {
    const result = connectionFindingSchema.safeParse({
      subject: { name: "A", category: "artist" },
      target: { name: "B", category: "artist" },
      outcome: "documented",
      statement: "Something is true.",
      citations: [],
      method: { consulted: ["Mock Source"], query: "q" },
      ...REVIEWED
    });
    expect(result.success).toBe(false);
    // The rule that matters: no citation, no documented claim.
    expect(JSON.stringify(result.error?.issues)).toContain("must cite the source");
  });

  it("refuses a documented finding with no statement", () => {
    const result = connectionFindingSchema.safeParse({
      subject: { name: "A", category: "artist" },
      target: { name: "B", category: "artist" },
      outcome: "documented",
      statement: null,
      citations: [{ sourceLabel: "S", sourceUrl: "https://example.test/x", license: null }],
      method: { consulted: ["Mock Source"], query: "q" },
      ...REVIEWED
    });
    expect(result.success).toBe(false);
  });

  it("refuses a decline that smuggles in a statement or a citation", () => {
    const withStatement = connectionFindingSchema.safeParse({
      subject: { name: "A", category: "artist" },
      target: { name: "B", category: "artist" },
      outcome: "declined",
      statement: "Probably connected.",
      citations: [],
      method: { consulted: ["Mock Source"], query: "q" },
      ...REVIEWED
    });
    expect(withStatement.success).toBe(false);

    const withCitation = connectionFindingSchema.safeParse({
      subject: { name: "A", category: "artist" },
      target: { name: "B", category: "artist" },
      outcome: "declined",
      statement: null,
      citations: [{ sourceLabel: "S", sourceUrl: "https://example.test/x", license: null }],
      method: { consulted: ["Mock Source"], query: "q" },
      ...REVIEWED
    });
    expect(withCitation.success).toBe(false);
  });

  it("accepts an honest decline", () => {
    expect(
      connectionFindingSchema.safeParse({
        subject: { name: "A", category: "artist" },
        target: { name: "B", category: "brand" },
        outcome: "declined",
        statement: null,
        citations: [],
        method: { consulted: ["Mock Source"], query: "q" },
        ...REVIEWED
      }).success
    ).toBe(true);
  });

  it("requires research to name what it consulted", () => {
    expect(
      connectionFindingSchema.safeParse({
        subject: { name: "A", category: "artist" },
        target: { name: "B", category: "brand" },
        outcome: "declined",
        statement: null,
        citations: [],
        method: { consulted: [], query: "q" },
        ...REVIEWED
      }).success
    ).toBe(false);
  });
});

/* ------------------------------ The artifact ------------------------------- */

describe("the reviewed findings artifact", () => {
  it("parses as a versioned artifact", () => {
    expect(CONNECTION_FINDINGS.version).toBe(CONNECTION_FINDINGS_VERSION);
    expect(CONNECTION_FINDINGS.findings.length).toBeGreaterThan(0);
    expect(connectionFindingsArtifactSchema.safeParse(CONNECTION_FINDINGS).success).toBe(true);
  });

  it("cites a real, https source for every documented finding", () => {
    for (const item of CONNECTION_FINDINGS.findings) {
      if (item.outcome !== "documented") continue;
      expect(item.citations.length).toBeGreaterThan(0);
      for (const citation of item.citations) {
        expect(citation.sourceUrl.startsWith("https://")).toBe(true);
        // A citation must point at a real host, not a placeholder.
        expect(new URL(citation.sourceUrl).hostname).not.toBe("example.test");
      }
    }
  });

  it("states every documented connection as something the source records", () => {
    // The wording rule from AGENTS.md §5: report what the source says, and never
    // claim biography, influence, ownership, attendance or causation.
    for (const item of CONNECTION_FINDINGS.findings) {
      if (item.outcome !== "documented") continue;
      expect(item.statement).toMatch(/^MusicBrainz records /);
      expect(item.statement).not.toMatch(/endorse|inspired|caused|influenced|attended|owns/i);
    }
  });

  it("records declines with what was searched for, and no claim", () => {
    const declines = CONNECTION_FINDINGS.findings.filter((f) => f.outcome === "declined");
    expect(declines.length).toBeGreaterThan(0);
    for (const decline of declines) {
      expect(decline.statement).toBeNull();
      expect(decline.citations).toEqual([]);
      expect(decline.method.query.length).toBeGreaterThan(0);
    }
  });

  it("names a verifier and a review date on every finding", () => {
    for (const item of CONNECTION_FINDINGS.findings) {
      expect(item.reviewedBy.length).toBeGreaterThan(0);
      expect(item.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

/* ------------------------------- The lookup -------------------------------- */

describe("ConnectionFindingsIndex", () => {
  const index = new ConnectionFindingsIndex([finding()]);
  const a = { name: "Mock Artist", category: "artist" as const };
  const b = { name: "Mock Artist B", category: "artist" as const };

  it("is order-insensitive, because a relationship belongs to the pair", () => {
    expect(index.find(a, b)).toBe(index.find(b, a));
    expect(index.documented(a, b)?.statement).toBe(index.documented(b, a)?.statement);
  });

  it("matches names case- and accent-insensitively, as the rest of the API does", () => {
    expect(index.find({ name: "mock artist", category: "artist" }, { name: "MOCK ARTIST B", category: "artist" }))
      .toBeDefined();
  });

  it("does not match a near-miss name", () => {
    // "Fela Kuti" must never match "Femi Kuti"; the same rule protects citations.
    expect(index.find({ name: "Mock Artists", category: "artist" }, b)).toBeUndefined();
    expect(index.find({ name: "Mock Artist B2", category: "artist" }, a)).toBeUndefined();
  });

  it("keys on category as well as name, so a brand cannot inherit an artist's finding", () => {
    expect(index.find({ name: "Mock Artist", category: "brand" }, b)).toBeUndefined();
  });

  it("returns a citation the badge can link to", () => {
    const documented = index.documented(a, b);
    expect(documented).not.toBeNull();
    expect(documented?.sourceUrl).toBe("https://example.test/one");
    expect(documented?.sourceLabel).toBe("Mock Source");
    expect(documented?.references).toHaveLength(1);
    expect(documented?.references[0]).toMatchObject({ label: "Mock Source", url: "https://example.test/one" });
  });

  it("counts additional sources in the label instead of hiding them", () => {
    const many = new ConnectionFindingsIndex([
      finding({
        citations: [
          { sourceLabel: "First", sourceUrl: "https://example.test/1", license: null },
          { sourceLabel: "Second", sourceUrl: "https://example.test/2", license: null },
          { sourceLabel: "Third", sourceUrl: "https://example.test/3", license: null }
        ]
      })
    ]);
    expect(many.documented(a, b)?.sourceLabel).toBe("First and 2 more");
    expect(many.documented(a, b)?.references).toHaveLength(3);
  });

  it("tells a researched decline apart from an unasked pair", () => {
    const withDecline = new ConnectionFindingsIndex([
      finding({
        outcome: "declined",
        statement: null,
        citations: [],
        target: { name: "Mock Brand", category: "brand" }
      })
    ]);
    const brand = { name: "Mock Brand", category: "brand" as const };
    // Researched, and honestly nothing to say.
    expect(withDecline.hasResearched(a, brand)).toBe(true);
    expect(withDecline.documented(a, brand)).toBeNull();
    // Never looked at: also null, but for a different reason.
    expect(withDecline.hasResearched(a, b)).toBe(false);
    expect(withDecline.documented(a, b)).toBeNull();
  });

  it("refuses a duplicate pair rather than letting file order decide", () => {
    expect(() => new ConnectionFindingsIndex([finding(), finding()])).toThrow(/duplicate connection finding/i);
  });

  it("is empty when given nothing, and says so", () => {
    const empty = new ConnectionFindingsIndex([]);
    expect(empty.size).toBe(0);
    expect(empty.documented(a, b)).toBeNull();
  });
});

/* ------------------------------ Graph wiring ------------------------------- */

describe("documented findings reach the graph", () => {
  const RETRIEVED_AT = "2026-10-24T10:00:00.000Z";
  const ROOT_ID = "AAAAAAAA-0000-4000-8000-000000000001";

  function entity(over: Partial<QlooEntity> & { id: string; name: string }): QlooEntity {
    return {
      type: "urn:entity:artist",
      popularity: 0.5,
      description: null,
      disambiguation: null,
      tags: [],
      attributes: {
        genres: [],
        themes: [],
        audienceTraits: [],
        influences: [],
        collaborators: [],
        brands: [],
        origin: null,
        foundedYear: null
      },
      ...over
    };
  }

  const root = entity({ id: ROOT_ID, name: "Mock Artist" });
  const target = entity({ id: "BBBBBBBB-0000-4000-8000-000000000002", name: "Mock Artist B" });
  const insights: QlooInsightsResponse[] = [
    {
      source: { entityId: ROOT_ID },
      targetType: "artist",
      kind: "affinity",
      notice: "mock",
      results: [{ entity: target, affinity: 0.9 }] as QlooInsightsResponse["results"],
      provenance: { provider: "qloo", mode: "live", environment: "hackathon", retrievedAt: RETRIEVED_AT }
    }
  ];

  it("raises a researched pair to the documented rung, with its source attached", () => {
    const graph = buildCulturalGraph({ root, insights, findings: new ConnectionFindingsIndex([finding()]) });
    const edge = graph.edges[0];
    expect(edge?.basis.kind).toBe("documented");
    expect(edge?.basis.statement).toContain("Mock Source records");
    expect(edge?.basis.sourceUrl).toBe("https://example.test/one");
    expect(edge?.references).toHaveLength(1);
    // Still an affinity edge: Qloo surfaced the pair and supplied the score.
    expect(edge?.evidence).toBe("qloo_affinity");
    expect(edge?.affinity).toBe(0.9);
  });

  it("leaves an unresearched pair on the weaker rungs, with no references", () => {
    const graph = buildCulturalGraph({ root, insights, findings: new ConnectionFindingsIndex([]) });
    const edge = graph.edges[0];
    expect(edge?.basis.kind).not.toBe("documented");
    expect(edge?.references).toEqual([]);
    expect(edge?.affinity).toBe(0.9);
  });

  it("does not let a decline turn into a documented edge", () => {
    const declined = new ConnectionFindingsIndex([
      finding({ outcome: "declined", statement: null, citations: [] })
    ]);
    const graph = buildCulturalGraph({ root, insights, findings: declined });
    expect(graph.edges[0]?.basis.kind).not.toBe("documented");
    expect(graph.edges[0]?.references).toEqual([]);
  });

  it("works with no findings index at all, as the route does without one", () => {
    const graph = buildCulturalGraph({ root, insights });
    expect(graph.edges[0]?.basis.kind).not.toBe("documented");
    expect(graph.edges[0]?.references).toEqual([]);
  });
});

/* ------------------------------- The seam ---------------------------------- */

describe("the research model seam", () => {
  it("reports not_configured rather than throwing when no provider is set", async () => {
    const model = new UnconfiguredResearchModel();
    expect(model.isEnabled).toBe(false);
    const result = await model.research({
      subject: { name: "A", category: "artist" },
      target: { name: "B", category: "artist" },
      affinity: 0.9
    });
    expect(result).toMatchObject({ kind: "unavailable", reason: "not_configured" });
  });

  it("discards a model reply that claims a documented link without a citation", () => {
    // The single most important check: a model cannot talk its way past §12.
    const result = parseResearchOutput({
      subject: { name: "A", category: "artist" },
      target: { name: "B", category: "artist" },
      outcome: "documented",
      statement: "They definitely collaborated.",
      citations: [],
      method: { consulted: ["Model memory"], query: "q" },
      ...REVIEWED
    });
    expect(result).toMatchObject({ kind: "unavailable", reason: "invalid_output" });
  });

  it("discards a reply that is not a finding at all", () => {
    expect(parseResearchOutput("sure, they're connected!")).toMatchObject({
      kind: "unavailable",
      reason: "invalid_output"
    });
    expect(parseResearchOutput(null)).toMatchObject({ kind: "unavailable", reason: "invalid_output" });
  });

  it("accepts a well-formed reply", () => {
    const result = parseResearchOutput({
      subject: { name: "Mock Artist", category: "artist" },
      target: { name: "Mock Artist B", category: "artist" },
      outcome: "documented",
      statement: "Mock Source records both in the same mock group.",
      citations: [{ sourceLabel: "Mock Source", sourceUrl: "https://example.test/one", license: null }],
      method: { consulted: ["Mock Source"], query: "q" },
      ...REVIEWED
    });
    expect(result.kind).toBe("finding");
  });

  it("maps a provider timeout onto a timeout, and does not leak provider text", () => {
    const result = researchFailureFrom(new ProviderError("research", "timeout", "upstream secret detail"));
    expect(result).toMatchObject({ kind: "unavailable", reason: "timeout" });
    expect(JSON.stringify(result)).not.toContain("upstream secret detail");

    expect(researchFailureFrom(new Error("boom"))).toMatchObject({
      kind: "unavailable",
      reason: "provider_error"
    });
  });
});
