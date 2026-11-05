import { describe, expect, it } from "vitest";
import { pathRings } from "./path-poly.ts";

describe("pathRings", () => {
  it("reads a closed square", () => {
    const rings = pathRings("M0 0 L10 0 L10 10 L0 10 Z");
    expect(rings).toHaveLength(1);
    expect(rings[0]?.[0]).toEqual([0, 0]);
    expect(rings[0]?.[rings[0]!.length - 1]).toEqual([0, 0]);
  });

  it("keeps two subpaths for a hole", () => {
    const rings = pathRings("M0 0 H8 V8 H0 Z M2 2 H6 V6 H2 Z");
    expect(rings).toHaveLength(2);
  });

  it("samples a cubic so the end lands on the last point", () => {
    const rings = pathRings("M0 0 C0 10 10 10 10 0");
    expect(rings).toHaveLength(1);
    const last = rings[0]![rings[0]!.length - 1];
    expect(last).toEqual([10, 0]);
    expect(rings[0]!.length).toBeGreaterThan(4);
  });
});
