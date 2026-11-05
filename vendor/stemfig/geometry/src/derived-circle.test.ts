import { describe, expect, it } from "vitest";
import { circumcircleOf, incircleOf } from "./derived-circle.ts";

describe("derived-circle", () => {
  it("puts the circumcenter of a 3-4-5 at the hypotenuse midpoint", () => {
    const ring = circumcircleOf(
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    );
    expect(ring?.c).toEqual({ x: 2, y: 1.5 });
    expect(ring?.through).toEqual({ x: 0, y: 0 });
  });

  it("puts the incenter of a 3-4-5 at (1, 1)", () => {
    const ring = incircleOf({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 });
    expect(ring?.c.x).toBeCloseTo(1);
    expect(ring?.c.y).toBeCloseTo(1);
    expect(
      Math.hypot(ring!.through.x - ring!.c.x, ring!.through.y - ring!.c.y),
    ).toBeCloseTo(1);
  });

  it("omits collinear triples", () => {
    expect(
      circumcircleOf({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ).toBeUndefined();
    expect(
      incircleOf({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ).toBeUndefined();
  });
});
