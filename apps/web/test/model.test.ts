import { describe, expect, it } from "vitest";
import {
  CENTER,
  VIEWBOX,
  filterGraph,
  formatAffinity,
  layoutConstellation,
  presentCategories,
  presentEvidence,
  truncateLabel,
} from "../src/lib/explorer/model";
import { FIXTURE_GRAPH } from "./fixtures";

const all = {
  categories: new Set(presentCategories(FIXTURE_GRAPH).map((c) => c.category)),
  evidence: new Set(presentEvidence(FIXTURE_GRAPH).map((e) => e.kind)),
};

describe("layoutConstellation (fixture graph)", () => {
  it("puts the root at the center and every node inside the viewBox", () => {
    const pos = layoutConstellation(FIXTURE_GRAPH);
    expect(pos.get(FIXTURE_GRAPH.rootId)).toMatchObject({ x: CENTER, y: CENTER });
    expect(pos.size).toBe(FIXTURE_GRAPH.nodes.length);
    for (const p of pos.values()) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(VIEWBOX);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(VIEWBOX);
    }
  });

  it("is deterministic and keeps higher affinity closer than lower or missing", () => {
    const a = layoutConstellation(FIXTURE_GRAPH);
    const b = layoutConstellation(FIXTURE_GRAPH);
    expect([...a]).toEqual([...b]);
    const radius = (name: string) => a.get(FIXTURE_GRAPH.nodes.find((n) => n.name === name)!.id)!.radius;
    expect(radius("Mock Brand")).toBeLessThan(radius("Mock Destination"));
    expect(radius("No Score Artist")).toBeGreaterThanOrEqual(radius("Mock Destination") - 44);
  });

  it("does not move nodes when filters change", () => {
    const before = layoutConstellation(FIXTURE_GRAPH);
    filterGraph(FIXTURE_GRAPH, { ...all, categories: new Set(["brand"]) });
    expect([...layoutConstellation(FIXTURE_GRAPH)]).toEqual([...before]);
  });
});

describe("filterGraph", () => {
  it("keeps everything with all filters on", () => {
    const v = filterGraph(FIXTURE_GRAPH, all);
    expect(v.nodes).toHaveLength(5);
    expect(v.edges).toHaveLength(4);
  });

  it("always keeps the root and drops filtered categories with their edges", () => {
    const v = filterGraph(FIXTURE_GRAPH, { ...all, categories: new Set(["brand"]) });
    expect(v.nodes.map((n) => n.name)).toEqual(["Mock Artist", "Mock Brand"]);
    expect(v.edges).toHaveLength(1);
    const none = filterGraph(FIXTURE_GRAPH, { ...all, categories: new Set() });
    expect(none.nodes.map((n) => n.id)).toEqual([FIXTURE_GRAPH.rootId]);
  });

  it("hides neighbours when their evidence kind is filtered out", () => {
    const v = filterGraph(FIXTURE_GRAPH, { ...all, evidence: new Set(["verified_fact"]) });
    expect(v.nodes).toHaveLength(1);
    expect(v.edges).toEqual([]);
  });
});

describe("summaries and formatting", () => {
  it("reports categories and evidence kinds actually present", () => {
    expect(presentCategories(FIXTURE_GRAPH)).toEqual([
      { category: "artist", count: 2 },
      { category: "brand", count: 1 },
      { category: "destination", count: 1 },
    ]);
    expect(presentEvidence(FIXTURE_GRAPH)).toEqual([{ kind: "qloo_affinity", count: 4 }]);
  });

  it("never invents a score or a coordinate", () => {
    expect(formatAffinity(null)).toBe("No score from Qloo");
    expect(formatAffinity(0.9754)).toBe("0.98");
    expect(FIXTURE_GRAPH.nodes.every((n) => n.geo === null)).toBe(true);
  });

  it("truncates long labels without losing short ones", () => {
    expect(truncateLabel("Short")).toBe("Short");
    expect(truncateLabel("A very long artist name indeed", 12)).toHaveLength(12);
  });
});

describe("layoutLabels", () => {
  it("places every neighbour label, avoids overlaps and never invents text", async () => {
    const { layoutLabels } = await import("../src/lib/explorer/model");
    const pos = layoutConstellation(FIXTURE_GRAPH);
    const labels = layoutLabels(FIXTURE_GRAPH, pos);
    expect(labels.size).toBe(FIXTURE_GRAPH.nodes.length - 1);
    for (const node of FIXTURE_GRAPH.nodes.filter((n) => n.id !== FIXTURE_GRAPH.rootId)) {
      const label = labels.get(node.id)!;
      expect(["start", "end"]).toContain(label.anchor);
      expect(node.name.startsWith(label.text.replace("…", ""))).toBe(true);
    }
  });
});
