import { describe, expect, it } from "vitest";
import { StemfigValidationError } from "@stemfig/host";
import { segAt } from "./bezier.ts";
import { parseD, serializeD } from "./svg-path.ts";

describe("parseD", () => {
  it("normalizes relative C to absolute", () => {
    const segs = parseD("M 0 0 c 1 2 3 -1 4 0", "d");
    expect(segs).toEqual([
      { op: "M", x: 0, y: 0 },
      { op: "C", x1: 1, y1: 2, x2: 3, y2: -1, x: 4, y: 0 },
    ]);
  });

  it("turns H and V into L", () => {
    const segs = parseD("M 1 2 H 4 V 5", "d");
    expect(segs).toEqual([
      { op: "M", x: 1, y: 2 },
      { op: "L", x: 4, y: 2 },
      { op: "L", x: 4, y: 5 },
    ]);
  });

  it("turns subsequent M pairs into L", () => {
    const segs = parseD("M 0 0 1 1", "d");
    expect(segs[1]).toEqual({ op: "L", x: 1, y: 1 });
  });

  it("reflects S into C", () => {
    const segs = parseD("M 0 0 C 0 1 1 1 1 0 S 2 -1 2 0", "d");
    expect(segs[2]).toMatchObject({ op: "C", x1: 1, y1: -1, x: 2, y: 0 });
  });

  it("rejects a bad command", () => {
    expect(() => parseD("M 0 0 X 1", "d")).toThrow(StemfigValidationError);
  });
});

describe("serializeD", () => {
  it("rewrites with 6 significant digits", () => {
    const d = serializeD(parseD("M 0 0 C 1 2 3 -1 4 0", "d"));
    expect(d).toBe("M 0 0 C 1 2 3 -1 4 0");
    const noisy = serializeD([
      { op: "M", x: 0, y: 0 },
      { op: "L", x: 1.2000000000000002, y: 0 },
    ]);
    expect(noisy).toBe("M 0 0 L 1.2 0");
  });
});

describe("flatten", () => {
  it("places a cubic midpoint on the curve", () => {
    const segs = parseD("M 0 0 C 0 1 1 1 1 0", "d");
    const mid = segAt({ x: 0, y: 0 }, { x: 0, y: 0 }, segs[1]!, 0.5);
    expect(mid.x).toBeCloseTo(0.5);
    expect(mid.y).toBeCloseTo(0.75);
  });
});
