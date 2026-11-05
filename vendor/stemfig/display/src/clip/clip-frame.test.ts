import { describe, expect, it } from "vitest";
import { frameContains, framesOverlap, intersectFrames } from "./clip-frame.ts";

const sheet = { x: 0, y: 0, w: 80, h: 60 };
const figure = { x: 5, y: 5, w: 70, h: 50 };

describe("clip-frame", () => {
  it("intersects a figure with its sheet", () => {
    expect(intersectFrames(figure, sheet)).toEqual(figure);
  });

  it("returns undefined when boxes miss", () => {
    expect(intersectFrames(figure, { x: 200, y: 0, w: 10, h: 10 })).toBeUndefined();
  });

  it("treats a contained box as overlap", () => {
    expect(framesOverlap(sheet, figure)).toBe(true);
    expect(frameContains(sheet, figure)).toBe(true);
    expect(frameContains(figure, sheet)).toBe(false);
  });
});
