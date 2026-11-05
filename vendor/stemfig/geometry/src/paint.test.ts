/**
 * 객체 스타일은 저장·패널·DisplayList·SVG 가 같은 값을 가져야 한다.
 * 점선은 렌더러 전용 옵션이 아니라 실제 선 토막이므로 모든 소비자가 같은 모양을 받는다.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE, MM_TO_PX, renderSvg, type DisplayItem } from "@stemfig/display";
import { compileGeometry } from "./compile.ts";
import { initGeometry } from "./init.ts";
import { geometrySpecSchema } from "./schema.ts";
import { applyFieldGeometry, fieldsGeometry } from "./interact/fields.ts";
import { anchorsGeometry } from "./interact/anchors.ts";

const ctx = { frame: { x: 0, y: 0, w: 100, h: 100 }, view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 }, style: DEFAULT_STYLE, mmToPage: (x: number, y: number): [number, number] => [x, y] };
const original = initGeometry(geometrySpecSchema.parse({
  objects: [
    { id: "A", def: ["point", 1, 1], label: "A" },
    { id: "B", def: ["point", 8, 1] },
    { id: "C", def: ["point", 4, 8] },
    { id: "edge", def: ["segment", "A", "B"] },
    { id: "poly", def: ["polygon", "A", "B", "C"] },
    { id: "ring", def: ["circle", "C", "A"] },
  ], angles: [{ id: "angle", a: "A", v: "B", b: "C", mark: "equal", label: "x" }],
}));

function findLine(items: DisplayItem[], color: string) { return items.filter((item) => item.op === "polyline" && item.stroke === color); }

describe("per-object paint", () => {
  it("persists independent stroke color/width and materializes dashed segments", () => {
    let state = original;
    for (const [key, value] of [["stroke", "#cc2233"], ["strokeWidth", 0.6], ["lineStyle", "dashed"]] as const) {
      state = applyFieldGeometry(ctx, state, { id: "edge", key, value });
    }
    const parsed = geometrySpecSchema.parse(state.spec);
    expect(parsed.objects.find((obj) => obj.id === "edge")).toMatchObject({ stroke: "#cc2233", strokeWidth: 0.6, lineStyle: "dashed" });
    const items = compileGeometry(ctx, initGeometry(parsed));
    const lines = findLine(items, "#cc2233");
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.every((item) => item.op === "polyline" && item.width === 0.6)).toBe(true);
    const svg = renderSvg({ width_mm: 100, height_mm: 100, frames: [], items });
    expect(svg).toContain("#cc2233");
    expect(svg).toContain(`stroke-width="${0.6 * MM_TO_PX}"`);
    expect(original.byId.get("edge")?.stroke).toBeUndefined();
  });

  it("keeps continuous fill behind dashed polygon and circle outlines", () => {
    let state = original;
    for (const id of ["poly", "ring"]) {
      state = applyFieldGeometry(ctx, state, { id, key: "fill", value: "#aabbcc" });
      state = applyFieldGeometry(ctx, state, { id, key: "lineStyle", value: "dashed" });
    }
    const items = compileGeometry(ctx, state);
    expect(items.filter((item) => (item.op === "circle" || item.op === "polygon") && item.fill === "#aabbcc" && item.width === 0)).toHaveLength(2);
    expect(findLine(items, DEFAULT_STYLE.stroke).length).toBeGreaterThan(50);
    state = applyFieldGeometry(ctx, state, { id: "ring", key: "fillEnabled", value: false });
    expect(state.byId.get("ring")?.fill).toBeUndefined();
  });

  it("label aliases resize text and HUD together without moving points", () => {
    const state = applyFieldGeometry(ctx, original, { id: "A:label", key: "labelSize", value: 3.2 });
    expect(compileGeometry(ctx, state).find((item) => item.op === "text" && item.text === "A")).toMatchObject({ size: 3.2 });
    expect(anchorsGeometry(ctx, state).find((item) => item.id === "A:label")).toMatchObject({ size_mm: 3.2 });
    expect(state.points.get("A")).toEqual(original.points.get("A"));
    expect(fieldsGeometry({ ...ctx, focus: "A:label" }, state).find((field) => field.key === "labelSize")?.value).toBe(3.2);
  });

  it("annotation ink and label size use the same object override", () => {
    let state = applyFieldGeometry(ctx, original, { id: "angle", key: "stroke", value: "#00aa99" });
    state = applyFieldGeometry(ctx, state, { id: "angle", key: "labelSize", value: 2.4 });
    state = applyFieldGeometry(ctx, state, { id: "angle", key: "strokeWidth", value: 0.7 });
    const items = compileGeometry(ctx, state);
    expect(items.find((item) => item.op === "text" && item.text === "x")).toMatchObject({ size: 2.4, fill: "#00aa99" });
    expect(findLine(items, "#00aa99")[0]).toMatchObject({ width: 0.7 });
  });

  it("styles graph and SVG path samples without renderer-specific options", () => {
    const state = initGeometry(geometrySpecSchema.parse({ objects: [
      { id: "graph", def: ["graph", "y=x"], stroke: "#123456", strokeWidth: 0.4, lineStyle: "dashed" },
      { id: "path", def: ["path", "M 1 2 C 2 4 5 6 8 7"], stroke: "#654321", strokeWidth: 0.5, lineStyle: "dashed" },
    ] }));
    const items = compileGeometry(ctx, state);
    for (const [stroke, width] of [["#123456", 0.4], ["#654321", 0.5]] as const) {
      const lines = findLine(items, stroke);
      expect(lines.length).toBeGreaterThan(10);
      expect(lines.every((item) => item.op === "polyline" && item.width === width)).toBe(true);
    }
  });

  it("shows inherited ink and renders it for labels without an explicit object color", () => {
    const inherited = { ...DEFAULT_STYLE, stroke: "#aa44bb", textFill: "#aa44bb" };
    const rows = fieldsGeometry({ ...ctx, focus: "A", style: inherited }, original);
    expect(rows.find((row) => row.key === "stroke")?.value).toBe("#aa44bb");
    expect(compileGeometry({ ...ctx, style: inherited }, original).find((item) => item.op === "text" && item.text === "A")).toMatchObject({ fill: "#aa44bb" });
  });
});
