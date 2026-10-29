import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { artistConnectionResponseSchema, connectionFindingSchema } from "@worlds/shared";

import { ConnectionFindingsIndex } from "../src/services/connection-findings.js";
import { buildTestApp } from "./helpers.js";

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps.length = 0;
});

describe("GET /api/v1/graph/artist-connection", () => {
  it("keeps machine-checked findings unpublished and avoids provider calls", async () => {
    const app = await buildTestApp({ fetchFn: async () => { throw new Error("no provider requests"); } });
    apps.push(app);
    const result = await app.inject("/api/v1/graph/artist-connection?subject=Bob%20Marley&target=Ziggy%20Marley");
    expect(result.statusCode).toBe(200);
    const body = artistConnectionResponseSchema.parse(result.json());
    expect(body).toMatchObject({ status: "pending_review", claims: [], statement: null, reviewedAt: null, research: null });
    expect(result.headers["cache-control"]).toContain("max-age=300");
    expect(result.headers["server-timing"]).toMatch(/^pair;dur=\d+\.\d$/);
  });

  it("publishes the approved agent result for a Qloo-selected pair with its research trail", async () => {
    const app = await buildTestApp({ fetchFn: async () => { throw new Error("no provider requests"); } });
    apps.push(app);
    const body = artistConnectionResponseSchema.parse(
      (await app.inject("/api/v1/graph/artist-connection?subject=Femi%20Kuti&target=Seun%20Kuti")).json());
    expect(body.status).toBe("documented");
    expect(body.claims[0]?.citations[0]?.sourceUrl).toBe("https://musicbrainz.org/artist/702d2b90-eef0-4354-b2c4-6366eba92b7f");
    expect(body.research).toEqual({ consulted: ["MusicBrainz — Femi Kuti"], approvedBy: "Worlds.fm editorial" });
    const declined = artistConnectionResponseSchema.parse(
      (await app.inject("/api/v1/graph/artist-connection?subject=Femi%20Kuti&target=Orlando%20Julius")).json());
    expect(declined).toMatchObject({ status: "declined", claims: [], statement: null });
    expect(declined.research?.consulted).toHaveLength(2);
  });

  it("returns unresearched for a missing pair and validates bounded inputs", async () => {
    const app = await buildTestApp({});
    apps.push(app);
    const missing = await app.inject("/api/v1/graph/artist-connection?subject=Mock%20A&target=Mock%20B");
    expect(artistConnectionResponseSchema.parse(missing.json())).toMatchObject({
      status: "unresearched", claims: [], statement: null, reviewedAt: null
    });
    expect((await app.inject("/api/v1/graph/artist-connection?subject=Mock%20A")).statusCode).toBe(400);
  });
});

describe("per-claim publication boundary", () => {
  const citation = { sourceLabel: "Source", sourceUrl: "https://example.test/source", license: null };
  const base = {
    subject: { name: "Mock A", category: "artist" },
    target: { name: "Mock B", category: "artist" },
    outcome: "documented", statement: "A cited statement", citations: [citation],
    method: { consulted: ["Source"], query: "mock" }, reviewedAt: "2026-10-27", reviewedBy: "editor"
  };
  it("exposes only individually cited claims and refuses uncited story lines", () => {
    expect(connectionFindingSchema.safeParse({
      ...base, story: [{ text: "Unsourced story", citations: [] }]
    }).success).toBe(false);
    const finding = connectionFindingSchema.parse({
      ...base, editorialApproval: { reviewer: "Human editor", checkedAt: "2026-10-27" },
      story: [{ text: "Another sourced fact", citations: [citation] }]
    });
    const detail = new ConnectionFindingsIndex([finding]).artistConnection("Mock A", "Mock B");
    expect(detail.claims.map((claim) => claim.text)).toEqual(["A cited statement", "Another sourced fact"]);
    expect(detail.claims.every((claim) => claim.citations.length > 0)).toBe(true);
    expect(detail.research).toEqual({ consulted: ["Source"], approvedBy: "Human editor" });
    expect(connectionFindingSchema.safeParse({
      ...base, editorialApproval: { reviewer: "draft:fixture", checkedAt: "2026-10-27" }
    }).success).toBe(false);
  });
});
