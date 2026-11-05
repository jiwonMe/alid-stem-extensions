import { describe, expect, it } from "vitest";
import { MM_TO_PX } from "@stemfig/display";
import {
  closestOnPath,
  snapRadiusMm,
  snapVertexRadiusMm,
  SNAP_PATH_MM,
  SNAP_PATH_PX,
  SNAP_VERTEX_PX,
} from "./closest-path.ts";

describe("closestOnPath", () => {
  it("snaps onto a finite segment and not past the end", () => {
    const segs = [{ id: "c", a: [0, 0] as [number, number], b: [4, 0] as [number, number] }];
    const mid = closestOnPath([2, 0.5], segs, SNAP_PATH_MM);
    expect(mid).toMatchObject({ id: "c", x: 2, y: 0, t: 0.5 });
    expect(mid?.d).toBeCloseTo(0.5);
    const past = closestOnPath([5, 0.2], segs, SNAP_PATH_MM);
    expect(past).toMatchObject({ id: "c", x: 4, y: 0 });
  });

  it("extends an unbound line past the defining points", () => {
    const segs = [
      {
        id: "l",
        a: [0, 0] as [number, number],
        b: [4, 0] as [number, number],
        unbound: true,
      },
    ];
    const hit = closestOnPath([5, 0.2], segs, SNAP_PATH_MM);
    expect(hit).toMatchObject({ id: "l", x: 5, y: 0 });
  });

  it("returns null outside the radius", () => {
    const segs = [{ id: "c", a: [0, 0] as [number, number], b: [4, 0] as [number, number] }];
    expect(closestOnPath([2, 3], segs, SNAP_PATH_MM)).toBeNull();
  });

  it("converts the screen radius to mm by canvas px per mm", () => {
    expect(SNAP_PATH_MM).toBeCloseTo(SNAP_PATH_PX / MM_TO_PX);
    expect(snapRadiusMm(MM_TO_PX * 2)).toBeCloseTo(SNAP_PATH_PX / (MM_TO_PX * 2));
    expect(snapRadiusMm(0)).toBeCloseTo(SNAP_PATH_MM);
    expect(SNAP_VERTEX_PX).toBeGreaterThan(SNAP_PATH_PX);
    expect(snapVertexRadiusMm()).toBeCloseTo(SNAP_VERTEX_PX / MM_TO_PX);
  });
});
