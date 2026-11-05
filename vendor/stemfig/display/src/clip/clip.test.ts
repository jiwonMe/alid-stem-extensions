import { describe, expect, it } from "vitest";
import { clipItems } from "./clip.ts";
import type { DisplayItem, Frame } from "../types.ts";

const page: Frame = { x: 0, y: 0, w: 80, h: 60 };

describe("clipItems", () => {
  it("cuts a polyline at the page edge", () => {
    const items: DisplayItem[] = [
      {
        op: "polyline",
        points: [
          [-10, 10],
          [20, 10],
        ],
        stroke: "#111111",
        width: 0.35,
      },
    ];
    const next = clipItems(items, page);
    expect(next).toHaveLength(1);
    const line = next[0];
    expect(line?.op).toBe("polyline");
    if (line && line.op === "polyline") {
      expect(line.points[0]?.[0]).toBeCloseTo(0);
      expect(line.points[0]?.[1]).toBeCloseTo(10);
      expect(line.points[1]).toEqual([20, 10]);
    }
  });

  it("drops a circle that sits left of the page", () => {
    const next = clipItems(
      [
        {
          op: "circle",
          cx: -5,
          cy: 10,
          r: 1,
          stroke: "#111111",
          width: 0.35,
        },
      ],
      page,
    );
    expect(next).toEqual([]);
  });

  it("keeps a circle that is fully on the page", () => {
    const circle: DisplayItem = {
      op: "circle",
      cx: 10,
      cy: 10,
      r: 2,
      stroke: "#111111",
      width: 0.35,
    };
    expect(clipItems([circle], page)).toEqual([circle]);
  });

  it("samples a circle that crosses the clip and drops the outside", () => {
    const next = clipItems(
      [
        {
          op: "circle",
          cx: 2,
          cy: 10,
          r: 5,
          stroke: "#111111",
          width: 0.35,
        },
      ],
      page,
    );
    expect(next.length).toBeGreaterThan(0);
    expect(next.every((item) => item.op === "polyline")).toBe(true);
    for (const item of next) {
      if (item.op !== "polyline") {
        continue;
      }
      expect(
        item.points.every(
          ([x, y]) =>
            x >= -1e-6 && x <= 80 + 1e-6 && y >= -1e-6 && y <= 60 + 1e-6,
        ),
      ).toBe(true);
    }
  });

  it("clips a filled circle that crosses the edge to a polygon", () => {
    const next = clipItems(
      [
        {
          op: "circle",
          cx: 0,
          cy: 10,
          r: 4,
          stroke: "#111111",
          fill: "#111111",
          width: 0.35,
        },
      ],
      page,
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.op).toBe("polygon");
  });

  it("clips a polygon that crosses the left edge", () => {
    const next = clipItems(
      [
        {
          op: "polygon",
          points: [
            [-10, 0],
            [10, 0],
            [10, 10],
            [-10, 10],
          ],
          stroke: "#111111",
          width: 0.35,
        },
      ],
      page,
    );
    expect(next).toHaveLength(1);
    const poly = next[0];
    expect(poly?.op).toBe("polygon");
    if (poly && poly.op === "polygon") {
      expect(poly.points.every(([x]) => x >= -1e-9)).toBe(true);
    }
  });

  it("turns an overflowing label into glyphs and drops one that sits outside", () => {
    const edge: DisplayItem = {
      op: "text",
      x: 79,
      y: 10,
      text: "A",
      size: 3.2,
      fill: "#111111",
    };
    const far: DisplayItem = {
      op: "text",
      x: 120,
      y: 10,
      text: "A",
      size: 1.6,
      fill: "#111111",
    };
    const next = clipItems([edge, far], page);
    expect(next).toHaveLength(1);
    expect(next[0]?.op).toBe("glyphs");
    if (next[0]?.op === "glyphs") {
      expect(
        next[0].rings.every((ring) =>
          ring.every(([x]) => x >= -1e-6 && x <= 80 + 1e-6),
        ),
      ).toBe(true);
    }
  });
});
