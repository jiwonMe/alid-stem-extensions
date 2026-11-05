import { describe, expect, it } from "vitest";
import { GRID_DEFAULT } from "./chrome.ts";
import { compileChrome } from "./compile-chrome.ts";
import { DEFAULT_STYLE } from "./style.ts";

const frame = { x: 0, y: 0, w: 40, h: 40 };
const view = { xmin: -2, xmax: 2, ymin: -2, ymax: 2 };

describe("compileChrome", () => {
  it("draws nothing when grid and axes are omitted", () => {
    expect(compileChrome({ view, frame, style: DEFAULT_STYLE })).toEqual([]);
  });

  it("draws integer grid lines behind any axes", () => {
    const items = compileChrome({
      view,
      frame,
      style: DEFAULT_STYLE,
      grid: {},
    });
    const lines = items.filter((item) => item.op === "polyline");
    expect(lines.length).toBe(10);
    expect(lines.every((item) => item.op === "polyline" && item.stroke === GRID_DEFAULT.stroke)).toBe(
      true,
    );
  });

  it("draws textbook axes: math labels, origin O, and deltoid arrows", () => {
    const items = compileChrome({
      view,
      frame,
      style: DEFAULT_STYLE,
      axes: {},
    });
    const texts = items.filter((item) => item.op === "text");
    expect(texts.some((item) => item.op === "text" && item.text === "$x$")).toBe(true);
    expect(texts.some((item) => item.op === "text" && item.text === "$y$")).toBe(true);
    const origin = texts.find((item) => item.op === "text" && item.text === "$\\rm{O}$");
    expect(origin).toBeDefined();
    /* 원점 (20,20) 왼쪽 아래. */
    expect(origin && origin.op === "text" ? origin.x : 0).toBeLessThan(20);
    expect(origin && origin.op === "text" ? origin.y : 0).toBeGreaterThan(20);
    expect(texts.some((item) => item.op === "text" && item.text === "$1$")).toBe(false);
    expect(texts.some((item) => item.op === "text" && item.plain)).toBe(false);
    const arrows = items.filter((item) => item.op === "polygon");
    expect(arrows).toHaveLength(2);
    expect(arrows.every((item) => item.op === "polygon" && item.points.length === 6)).toBe(
      true,
    );
    const xName = texts.find((item) => item.op === "text" && item.text === "$x$");
    const yName = texts.find((item) => item.op === "text" && item.text === "$y$");
    /* x축 끝 (40,20) 아래, y축 끝 (20,0) 왼쪽. */
    expect(xName && xName.op === "text" ? xName.y : 0).toBeGreaterThan(20);
    expect(xName && xName.op === "text" ? xName.x : 0).toBeGreaterThan(35);
    expect(yName && yName.op === "text" ? yName.x : 0).toBeLessThan(20);
    expect(yName && yName.op === "text" ? yName.y : -1).toBeGreaterThan(-0.5);
  });

  it("draws tick numbers only when ticks are turned on", () => {
    const off = compileChrome({
      view,
      frame,
      style: DEFAULT_STYLE,
      axes: {},
    });
    expect(off.some((item) => item.op === "text" && item.text === "$1$")).toBe(false);
    const on = compileChrome({
      view,
      frame,
      style: DEFAULT_STYLE,
      axes: { ticks: { show: true } },
    });
    expect(on.some((item) => item.op === "text" && item.text === "$1$")).toBe(true);
    const items = compileChrome({
      view,
      frame,
      style: DEFAULT_STYLE,
      axes: { ticks: { show: true, labels: false } },
    });
    const texts = items.filter((item) => item.op === "text").map((item) =>
      item.op === "text" ? item.text : "",
    );
    expect(texts).toEqual(["$x$", "$y$", "$\\rm{O}$"]);
  });

  it("runs the x-axis to both frame edges when contain leaves side gaps", () => {
    const wide = { x: 10, y: 5, w: 80, h: 40 };
    const items = compileChrome({
      view,
      frame: wide,
      style: DEFAULT_STYLE,
      axes: { arrows: false, origin: false, ticks: { show: false } },
    });
    const xAxis = items.find((item) => item.op === "polyline");
    expect(xAxis && xAxis.op === "polyline" ? xAxis.points[0] : null).toEqual([
      10, 25,
    ]);
    expect(xAxis && xAxis.op === "polyline" ? xAxis.points[1] : null).toEqual([
      90, 25,
    ]);
  });

  it("hides arrows and origin when asked", () => {
    const items = compileChrome({
      view,
      frame,
      style: DEFAULT_STYLE,
      axes: { arrows: false, origin: false, ticks: { labels: false } },
    });
    expect(items.some((item) => item.op === "polygon")).toBe(false);
    expect(items.filter((item) => item.op === "text").map((item) =>
      item.op === "text" ? item.text : "",
    )).toEqual(["$x$", "$y$"]);
  });
});
