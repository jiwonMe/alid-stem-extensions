import { describe, expect, it } from "vitest";
import { fitView } from "../fit-view.ts";
import { renderSvg } from "./render-svg.ts";
import type { DisplayList } from "../types.ts";

/** 시트 한 장짜리 기본 문서. 프레임은 원점에 80x60. */
const SHEET = { x: 0, y: 0, w: 80, h: 60 };

describe("renderSvg", () => {
  it("renders an empty sheet", () => {
    const svg = renderSvg({
      width_mm: 80,
      height_mm: 60,
      frames: [SHEET],
      items: [],
    });
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("viewBox=\"0 0 320 240\"");
    expect(svg).toContain("width=\"320\" height=\"240\"");
    expect(svg).toContain("fill=\"#ffffff\"");
    expect(svg).not.toContain("id=\"page\"");
  });

  it("fills a sheet with DisplaySheet.fill", () => {
    const svg = renderSvg({
      width_mm: 80,
      height_mm: 60,
      frames: [{ ...SHEET, fill: "#ffeecc" }],
      items: [],
    });
    expect(svg).toContain('fill="#ffeecc"');
    expect(svg).not.toContain('fill="#ffffff"');
  });

  it("draws one white sheet per frame", () => {
    const svg = renderSvg({
      width_mm: 180,
      height_mm: 60,
      frames: [SHEET, { x: 100, y: 0, w: 80, h: 60 }],
      items: [],
    });
    expect(svg.match(/fill="#ffffff"/g)).toHaveLength(2);
    expect(svg).toContain("x=\"0\" y=\"0\" width=\"320\" height=\"240\"");
    expect(svg).toContain("x=\"400\" y=\"0\" width=\"320\" height=\"240\"");
  });

  it("keeps the canvas viewBox when a figure sits left of the sheet", () => {
    const svg = renderSvg({
      width_mm: 80,
      height_mm: 60,
      frames: [SHEET],
      items: [
        {
          op: "circle",
          cx: -10,
          cy: 10,
          r: 2,
          stroke: "#111111",
          width: 0.35,
        },
      ],
    });
    expect(svg).toContain("viewBox=\"0 0 320 240\"");
    expect(svg).toContain("<circle");
    expect(svg).not.toContain("<polygon");
    /* r 는 페이지 mm. 중심 -10,10 → -40,40 px */
    expect(svg).toContain("cx=\"-40\"");
  });

  it("expands the viewBox by a fixed pad without moving the canvas origin", () => {
    const svg = renderSvg(
      {
        width_mm: 80,
        height_mm: 60,
        frames: [SHEET],
        items: [
          {
            op: "circle",
            cx: -10,
            cy: 10,
            r: 2,
            stroke: "#111111",
            width: 0.35,
          },
        ],
      },
      { padPx: 40 },
    );
    expect(svg).toContain("viewBox=\"-40 -40 400 320\"");
    expect(svg).toContain("width=\"400\" height=\"320\"");
    expect(svg).toContain("cx=\"-40\"");
    expect(svg).toContain("x=\"0\" y=\"0\" width=\"320\" height=\"240\"");
  });

  it("renders polyline, ellipse, and clipped group", () => {
    const list: DisplayList = {
      width_mm: 80,
      height_mm: 60,
      frames: [SHEET],
      items: [
        {
          op: "polyline",
          points: [
            [0, 0],
            [10, 10],
          ],
          stroke: "#111111",
          width: 0.35,
        },
        {
          op: "ellipse",
          cx: 20,
          cy: 20,
          rx: 3,
          ry: 2,
          stroke: "#111111",
          width: 0.35,
        },
        {
          op: "group",
          clip: { x: 0, y: 0, w: 40, h: 40 },
          items: [
            {
              op: "circle",
              cx: 5,
              cy: 5,
              r: 1,
              stroke: "#111111",
              width: 0.35,
            },
          ],
        },
      ],
    };
    const svg = renderSvg(list);
    expect(svg).toContain("points=\"0,0 40,40\"");
    expect(svg).toContain("<polyline");
    expect(svg).toContain("stroke-linecap=\"round\"");
    expect(svg).toContain("stroke-linejoin=\"round\"");
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("<circle");
    expect(svg).not.toContain("<polygon");
    expect(svg).not.toContain("mask=");
    expect(svg).not.toContain("overflow=\"hidden\"");
  });

  it("clips an overflowing label to path coordinates inside the figure", () => {
    const clip = { x: 5, y: 5, w: 70, h: 50 };
    const svg = renderSvg({
      width_mm: 80,
      height_mm: 60,
      frames: [SHEET],
      items: [
        {
          op: "group",
          clip,
          items: [
            {
              op: "text",
              x: 72,
              y: 30,
              text: "Ma",
              size: 3.2,
              fill: "#111111",
            },
          ],
        },
      ],
    });
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).not.toContain("mask=");
    const nums = [...svg.matchAll(/[ML](-?[0-9.]+)\s+(-?[0-9.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(nums.length).toBeGreaterThan(4);
    const right = (clip.x + clip.w) * 4 + 1e-6;
    const left = clip.x * 4 - 1e-6;
    expect(nums.every(([x]) => x >= left && x <= right)).toBe(true);
  });

  it("crops the viewBox to a page-mm box without moving item coordinates", () => {
    const svg = renderSvg(
      {
        width_mm: 80,
        height_mm: 60,
        frames: [SHEET],
        items: [
          {
            op: "circle",
            cx: 15,
            cy: 15,
            r: 2,
            stroke: "#111111",
            width: 0.35,
          },
        ],
      },
      { crop: { x: 5, y: 5, w: 20, h: 10 } },
    );
    expect(svg).toContain('viewBox="20 20 80 40"');
    expect(svg).toContain('width="80" height="40"');
    expect(svg).toContain('cx="60"');
  });
});

describe("fitView", () => {
  it("maps (xmin, ymax) to the content top-left with contain", () => {
    const fitted = fitView(
      { xmin: 0, xmax: 10, ymin: 0, ymax: 5 },
      { x: 0, y: 0, w: 100, h: 100 },
    );
    const [lx, ly] = fitted.toLocal(0, 5);
    expect(lx).toBe(0);
    expect(ly).toBe(25);
    const [vx, vy] = fitted.fromLocal(lx, ly);
    expect(vx).toBeCloseTo(0);
    expect(vy).toBeCloseTo(5);
    expect(fitted.scaleX).toBe(fitted.scaleY);
  });

  it("fills the frame independently when stretch is on", () => {
    const fitted = fitView(
      { xmin: 0, xmax: 10, ymin: 0, ymax: 5, stretch: true },
      { x: 0, y: 0, w: 100, h: 100 },
    );
    expect(fitted.scaleX).toBe(10);
    expect(fitted.scaleY).toBe(20);
    expect(fitted.toLocal(0, 5)).toEqual([0, 0]);
    expect(fitted.toLocal(10, 0)).toEqual([100, 100]);
  });
});
