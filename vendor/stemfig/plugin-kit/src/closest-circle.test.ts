import { describe, expect, it } from "vitest";
import { closestOnCircle, SNAP_PATH_MM } from "./index.ts";

describe("closestOnCircle", () => {
  it("snaps onto the circumference and not the center", () => {
    const rings = [{ id: "d", c: [0, 0] as [number, number], r: 4 }];
    const hit = closestOnCircle([0, 4.5], rings, SNAP_PATH_MM);
    expect(hit).toMatchObject({ id: "d", x: 0, y: 4 });
    expect(hit?.t).toBeCloseTo(Math.PI / 2);
    expect(hit?.d).toBeCloseTo(0.5);
  });

  it("returns null outside the radius", () => {
    const rings = [{ id: "d", c: [0, 0] as [number, number], r: 4 }];
    expect(closestOnCircle([0, 8], rings, SNAP_PATH_MM)).toBeNull();
  });

  it("skips a zero radius", () => {
    const rings = [{ id: "d", c: [0, 0] as [number, number], r: 0 }];
    expect(closestOnCircle([1, 0], rings, SNAP_PATH_MM)).toBeNull();
  });
});
