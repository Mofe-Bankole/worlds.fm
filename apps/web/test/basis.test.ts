import { CONNECTION_BASES } from "@worlds/shared";
import { describe, expect, it } from "vitest";

import { BASIS, BASIS_ORDER } from "../src/lib/connection-basis";

describe("connection basis metadata", () => {
  it("describes every rung of the ladder", () => {
    // A missing entry would render an undefined label in the node card.
    expect(Object.keys(BASIS).sort()).toEqual([...CONNECTION_BASES].sort());
    for (const kind of CONNECTION_BASES) {
      const meta = BASIS[kind];
      expect(meta.label).toBeTruthy();
      expect(meta.meaning).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.toneClass).toMatch(/^text-/);
    }
  });

  it("keeps the rungs distinguishable without color", () => {
    // Label and dash pattern carry the rung; color only adds to them.
    const labels = CONNECTION_BASES.map((kind) => BASIS[kind].label);
    expect(new Set(labels).size).toBe(labels.length);

    const patterns = CONNECTION_BASES.map((kind) => BASIS[kind].dashArray);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it("orders the ladder strongest first and never implies causation", () => {
    expect(BASIS_ORDER[0]).toBe("documented");
    expect(BASIS_ORDER[BASIS_ORDER.length - 1]).toBe("audience_overlap");
    expect([...BASIS_ORDER].sort()).toEqual([...CONNECTION_BASES].sort());

    for (const kind of CONNECTION_BASES) {
      expect(BASIS[kind].meaning.toLowerCase()).not.toMatch(/endorsement|inspiration|causation/);
    }
    // The weakest rung must say what it is not.
    expect(BASIS.audience_overlap.meaning).toContain("Nothing beyond the affinity score");
  });
});
