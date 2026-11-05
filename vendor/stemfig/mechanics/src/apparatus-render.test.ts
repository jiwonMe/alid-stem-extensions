/**
 * 기구 출력이 연결점과 페이지 투영을 보존하는지 확인한다.
 * 화면용 분기 없이 용수철·실·기구를 기존 DisplayList와 SVG로 내보내야 한다.
 */
import { DEFAULT_STYLE, measureLabelMm, renderSvg, type DisplayItem } from "@stemfig/display";
import { compileDocument, parseDocument, Registry, type CompileCtx } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/apparatus.stemfig.json";
import { compileMechanics } from "./compile.ts";
import { objectLabelAnchor } from "./labels.ts";
import { physicsMechanicsPlugin } from "./index.ts";
import { initMechanics } from "./init.ts";
import type { MechanicsObject, Vec } from "./schema.ts";

const ctx: CompileCtx = { frame: { x: 10, y: 20, w: 100, h: 100 },
  view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  mmToPage: (x, y) => [10 + x, 20 + y], style: DEFAULT_STYLE };
const spring: MechanicsObject = { id: "spring", type: "spring", width: 1, coils: 6,
  a: { mode: "free", point: [3, 2] }, b: { mode: "free", point: [3, 8] }, label: "k", labelSize: 3 };
const pulley: MechanicsObject = { id: "pulley", type: "pulley", center: [5, 5], radius: 1 };

function numbers(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(numbers);
}

describe("mechanics apparatus rendering", () => {
  it("preserves spring terminals and puts its measured label outside every coil", () => {
    const state = initMechanics({ objects: [spring] });
    const items = compileMechanics(ctx, state);
    const coil = items.find((item) => item.op === "polyline")!;
    expect(coil.points[0]).toEqual([40, 100]);
    expect(coil.points.at(-1)).toEqual([40, 40]);
    expect(coil.points.length).toBeGreaterThan(6 * 20);
    const label = items.find((item) => item.op === "text")!;
    const box = measureLabelMm(label.text, label.size);
    expect(label.x + box.x).toBeGreaterThan(Math.max(...coil.points.map(([x]) => x)));
    expect(label).toMatchObject(objectLabelAnchor(ctx, state, spring)!);
  });

  it("keeps the pulley rim aligned with a stretched scene and an ink-filled axle", () => {
    const items = compileMechanics({ ...ctx, frame: { ...ctx.frame, w: 200 }, view: { ...ctx.view, stretch: true } }, initMechanics({ objects: [pulley] }));
    expect(items[0]).toMatchObject({ op: "ellipse", cx: 110, cy: 70, rx: 20, ry: 10, fill: "#ffffff" });
    expect(items[1]).toMatchObject({ op: "circle", cx: 110, cy: 70, r: 0.45, fill: DEFAULT_STYLE.stroke });
  });

  it("draws a rotated support with all base hatching outside its triangle", () => {
    const object: MechanicsObject = { id: "support", type: "support", point: [5, 5], width: 2, height: 2, angle: 90 };
    const items = compileMechanics(ctx, initMechanics({ objects: [object] }));
    const triangle = items.find((item) => item.op === "polygon")!;
    expect(triangle.fill).toBe("#eeeeee");
    const expected: Vec[] = [[60, 70], [80, 80], [80, 60]];
    triangle.points.forEach((point, index) => point.forEach((value, axis) => expect(value).toBeCloseTo(expected[index]![axis]!)));
    const hatch = items.filter((item) => item.op === "polyline");
    expect(hatch.length).toBeGreaterThan(2);
    expect(hatch.every((item) => item.points[1]![0] > item.points[0]![0])).toBe(true);
  });

  it("follows the resolved tangent rope, including anchored block endpoints", () => {
    const rope: MechanicsObject = { id: "rope", type: "rope", pulley: "pulley", wrap: "cw",
      a: { mode: "free", point: [1, 6] }, b: { mode: "anchor", object: "mass", anchor: "top" }, label: "T" };
    const state = initMechanics({ objects: [pulley,
      { id: "mass", type: "block", width: 1, height: 1, pose: { mode: "free", point: [6, 1], angle: 0 } }, rope] });
    const items = compileMechanics(ctx, state);
    const line = items.find((item) => item.op === "polyline")!;
    expect(line.points[0]).toEqual([20, 60]);
    expect(line.points.at(-1)).toEqual([70, 100]);
    expect(line.points.length).toBe(state.paths.get("rope")!.length);
    const arc = line.points.slice(1, -1);
    expect(arc.length).toBeGreaterThan(5);
    expect(arc.every(([x, y]) => Math.abs(Math.hypot(x - 60, y - 70) - 10) < 1e-8)).toBe(true);
  });

  it("splits dashed apparatus strokes and omits hidden apparatus labels", () => {
    const items = compileMechanics(ctx, initMechanics({ objects: [{ ...spring, dashed: true }, { ...pulley, dashed: true },
      { id: "hidden", type: "support", point: [5, 5], width: 2, height: 2, angle: 0, label: "hidden", show: false }] }));
    expect(items.filter((item) => item.op === "polyline").length).toBeGreaterThan(30);
    expect(items.filter((item) => item.op === "text").map((item) => item.text)).toEqual(["k"]);
    expect(numbers(items).every(Number.isFinite)).toBe(true);
    expect(items.find((item) => item.op === "ellipse")?.width).toBe(0);
  });

  it("compiles all three fixture panels through the host and exports finite SVG", () => {
    const registry = new Registry();
    registry.register(physicsMechanicsPlugin);
    const list = compileDocument(parseDocument(fixture), registry);
    const flatten = (items: DisplayItem[]): DisplayItem[] => items.flatMap((item) => item.op === "group" ? flatten(item.items) : [item]);
    const items = flatten(list.items);
    expect(list.frames).toHaveLength(1);
    expect(items.length).toBeGreaterThan(30);
    expect(items.filter((item) => item.op === "text").map((item) => item.text)).toEqual(expect.arrayContaining(["용수철", "도르래와 실", "막대와 받침대"]));
    expect(numbers(list).every(Number.isFinite)).toBe(true);
    const svg = renderSvg(list);
    expect(svg).toContain("도르래와 실");
    expect(svg).not.toMatch(/NaN|Infinity|missing plugin/);
  });
});
