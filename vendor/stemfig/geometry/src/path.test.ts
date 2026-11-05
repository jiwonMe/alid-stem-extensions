import { describe, expect, it } from "vitest";
import { atT, project, tangentDir, type Path } from "./path.ts";

describe("Path", () => {
  it("places a segment point by t in [0,1]", () => {
    const path: Path = {
      kind: "line",
      a: { x: 0, y: 0 },
      b: { x: 4, y: 0 },
      bound: true,
    };
    expect(atT(path, 0.25)).toEqual({ x: 1, y: 0 });
  });

  it("keeps circle t as atan2", () => {
    const path: Path = {
      kind: "circle",
      c: { x: 0, y: 0 },
      through: { x: 1, y: 0 },
    };
    const at = atT(path, Math.PI / 2);
    expect(at?.x).toBeCloseTo(0);
    expect(at?.y).toBeCloseTo(1);
    expect(project(path, 0, 2).t).toBeCloseTo(Math.PI / 2);
  });

  it("projects explicit t as the x coordinate", () => {
    const path: Path = {
      kind: "explicit",
      f: { t: "num", v: 0 },
      x0: -1,
      x1: 1,
    };
    const hit = project(path, 0, 1);
    expect(hit.t).toBeCloseTo(0);
    expect(hit.at.x).toBeCloseTo(0);
    expect(hit.at.y).toBeCloseTo(0);
    const dir = tangentDir(path, 0);
    expect(dir?.x).toBeCloseTo(1);
    expect(dir?.y).toBeCloseTo(0);
  });

  it("projects explicit-along-y t as the y coordinate", () => {
    const path: Path = {
      kind: "explicit",
      f: { t: "var", name: "y" },
      along: "y",
      x0: -1,
      x1: 1,
    };
    const hit = project(path, 2, 0.5);
    expect(hit.t).toBeCloseTo(0.5);
    expect(hit.at.x).toBeCloseTo(0.5);
    expect(hit.at.y).toBeCloseTo(0.5);
    const dir = tangentDir(path, 0.5);
    expect(dir?.x).toBeCloseTo(Math.SQRT1_2);
    expect(dir?.y).toBeCloseTo(Math.SQRT1_2);
  });

  it("uses segment index plus u on bezier", () => {
    const path: Path = {
      kind: "bezier",
      segs: [
        { op: "M", x: 0, y: 0 },
        { op: "L", x: 2, y: 0 },
        { op: "L", x: 2, y: 2 },
      ],
    };
    const mid = atT(path, 1.5);
    expect(mid?.x).toBeCloseTo(1);
    expect(mid?.y).toBeCloseTo(0);
    const end = atT(path, 2.5);
    expect(end?.x).toBeCloseTo(2);
    expect(end?.y).toBeCloseTo(1);
  });
});
