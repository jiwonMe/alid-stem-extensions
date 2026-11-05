import { describe, expect, it } from "vitest";
import { bisectorDir, parallelDir, perpDir } from "./derived-line.ts";

describe("derived-line", () => {
  it("returns AB as the parallel direction", () => {
    expect(parallelDir({ x: 0, y: 0 }, { x: 4, y: 0 })).toEqual({ x: 4, y: 0 });
  });

  it("omits a zero-length parallel", () => {
    expect(parallelDir({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeUndefined();
  });

  it("rotates AB to a perpendicular", () => {
    const dir = perpDir({ x: 0, y: 0 }, { x: 4, y: 0 });
    expect(dir?.x).toBeCloseTo(0);
    expect(dir?.y).toBeCloseTo(4);
  });

  it("bisects a right angle internally along the unit sum", () => {
    const dir = bisectorDir(
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      "internal",
    );
    expect(dir?.x).toBeCloseTo(1);
    expect(dir?.y).toBeCloseTo(1);
  });

  it("omits a bisector when a ray collapses", () => {
    expect(
      bisectorDir({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, "internal"),
    ).toBeUndefined();
  });
});
