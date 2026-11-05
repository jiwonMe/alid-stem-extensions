/**
 * 역학 작도의 출력 계약을 실제 페이지 좌표로 검증한다.
 * 화살촉·점선·치수 여백은 view 배율과 분리되고 라벨 편집 기준점은 출력과 일치해야 한다.
 * 렌더러 구현을 복제하지 않고 블록 회전·0 길이·참조·숨김의 관찰 가능한 결과를 확인한다.
 */
import { DEFAULT_STYLE, measureLabelMm, type DisplayItem } from "@stemfig/display";
import type { CompileCtx } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import { compileMechanics } from "./compile.ts";
import { objectLabelAnchor } from "./labels.ts";
import { initMechanics } from "./init.ts";
import type { MechanicsObject, MechanicsSpec, Vec } from "./schema.ts";

const ctx: CompileCtx = { frame: { x: 10, y: 20, w: 100, h: 100 },
  view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  mmToPage: (x, y) => [10 + x, 20 + y], style: DEFAULT_STYLE };

function compile(objects: MechanicsObject[], context = ctx): DisplayItem[] {
  return compileMechanics(context, initMechanics({ objects }));
}

function numericValues(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(numericValues);
}

function labelCenter(item: Extract<DisplayItem, { op: "text" }>): Vec {
  const box = measureLabelMm(item.text, item.size);
  return [item.x + box.x + box.w / 2, item.y + box.y + box.h / 2];
}

describe("compileMechanics", () => {
  it("projects a rotated white block and centers its horizontal label", () => {
    const items = compile([{ id: "A", type: "block", width: 2, height: 1,
      pose: { mode: "free", point: [3, 4], angle: 90 }, label: "A" }]);
    const polygon = items.find((item) => item.op === "polygon");
    const label = items.find((item) => item.op === "text");
    expect(polygon?.fill).toBe("#ffffff");
    const expected = [[40, 90], [40, 70], [30, 70], [30, 90]];
    polygon!.points.forEach((point, index) => {
      expect(point[0]).toBeCloseTo(expected[index]![0]!);
      expect(point[1]).toBeCloseTo(expected[index]![1]!);
    });
    expect(labelCenter(label!)).toEqual([35, 80]);
  });

  it("attaches force to a block and keeps arrowheads at print size across zoom", () => {
    const objects: MechanicsObject[] = [
      { id: "A", type: "block", width: 2, height: 1, pose: { mode: "free", point: [3, 4], angle: 0 } },
      { id: "F", type: "force", from: { mode: "anchor", object: "A", anchor: "right" }, delta: [4, 0], label: "F" },
    ];
    const normal = compile(objects);
    const zoomed = compile(objects, { ...ctx, view: { xmin: 0, xmax: 20, ymin: 0, ymax: 20 } });
    for (const items of [normal, zoomed]) {
      const head = items.filter((item) => item.op === "polygon").find((item) => item.fill === ctx.style.stroke);
      expect(head?.width).toBe(0);
      const xs = head!.points.map((point) => point[0]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2);
      const label = items.find((item) => item.op === "text");
      expect(labelCenter(label!)[1]).toBeLessThan(head!.points[0]![1]);
    }
    const shaft = normal.find((item) => item.op === "polyline");
    expect(shaft?.points[0]).toEqual([50, 75]);
    expect(shaft?.points[1]?.[0]).toBeCloseTo(90 - 2 * 0.82);
  });

  it("draws default guides as separated dashes and preserves white ghost fill", () => {
    const guide: MechanicsObject = { id: "ground", type: "guide", a: { mode: "free", point: [1, 1] }, b: { mode: "free", point: [3, 1] } };
    const dashes = compile([guide]).filter((item) => item.op === "polyline");
    expect(dashes.length).toBeGreaterThan(1);
    expect(dashes[0]!.points).toEqual([[20, 110], [21.2, 110]]);
    expect(dashes[1]!.points[0]![0]).toBeCloseTo(22);
    expect(compile([{ ...guide, dashed: false }])).toHaveLength(1);
    const ghost = compile([{ id: "old", type: "block", width: 2, height: 1, dashed: true,
      pose: { mode: "free", point: [3, 4], angle: 0 } }]);
    expect(ghost[0]).toMatchObject({ op: "polygon", fill: "#ffffff", width: 0 });
    expect(ghost.filter((item) => item.op === "polyline").length).toBeGreaterThan(4);
  });

  it("leaves a measured label gap in a vertical dimension with two tips", () => {
    const items = compile([{ id: "height", type: "dimension", a: { mode: "free", point: [1, 1] },
      b: { mode: "free", point: [1, 7] }, axis: "vertical", offset: 1, label: "2h" }]);
    const tips = items.filter((item) => item.op === "polygon").map((item) => item.points[0]);
    expect(tips).toEqual([[30, 110], [30, 50]]);
    const label = items.find((item) => item.op === "text")!;
    expect(labelCenter(label)).toEqual([30, 80]);
    const box = measureLabelMm(label.text, label.size);
    const shaft = items.filter((item) => item.op === "polyline").filter((item) => item.points.every(([x]) => x === 30));
    expect(shaft).toHaveLength(2);
    for (const item of shaft) {
      const ys = item.points.map(([, y]) => y);
      expect(Math.max(...ys) <= label.y + box.y - 0.59 || Math.min(...ys) >= label.y + box.y + box.h + 0.59).toBe(true);
    }
  });

  it("shares the exact moved label baseline with editing and restores the shaft", () => {
    const object: MechanicsObject = { id: "height", type: "dimension", a: { mode: "free", point: [1, 1] },
      b: { mode: "free", point: [1, 7] }, axis: "vertical", offset: 1, label: "h", labelOffset: [8, 3] };
    const state = initMechanics({ objects: [object] });
    const items = compileMechanics(ctx, state);
    const label = items.find((item) => item.op === "text")!;
    expect(label).toMatchObject(objectLabelAnchor(ctx, state, object)!);
    expect(labelCenter(label)).toEqual([38, 83]);
    expect(items.filter((item) => item.op === "polyline" && item.points.every(([x]) => x === 30)))
      .toEqual([{ op: "polyline", points: [[30, 110 - 2 * 0.82], [30, 50 + 2 * 0.82]], stroke: ctx.style.stroke, width: ctx.style.width * 0.75 }]);
  });

  it("keeps rounded track, attached block, zero-length annotations and draft finite", () => {
    const spec: MechanicsSpec = { objects: [
      { id: "track", type: "track", points: [[0, 2], [2, 0], [4, 0], [6, 2], [8, 2]], rounding: 0.5, dashed: true, label: "지면" },
      { id: "A", type: "block", width: 1, height: 1, pose: { mode: "track", track: "track", t: 0.1, offset: 0 } },
      { id: "zero", type: "force", from: { mode: "anchor", object: "A", anchor: "center" }, delta: [0, 0], label: "F" },
      { id: "zeroDimension", type: "dimension", a: { mode: "free", point: [3, 4] }, b: { mode: "free", point: [3, 4] }, axis: "horizontal", offset: 0, label: "0" },
      { id: "hidden", type: "label", at: { mode: "free", point: [1, 1] }, label: "숨김", show: false },
    ], draft: { tool: "track", points: [[9, 9]] } };
    const items = compileMechanics(ctx, initMechanics(spec));
    expect(items.length).toBeGreaterThan(10);
    expect(numericValues(items).every(Number.isFinite)).toBe(true);
    expect(items.filter((item) => item.op === "text").map((item) => item.text)).toEqual(["지면", "F", "0"]);
    expect(items).toEqual(compileMechanics(ctx, initMechanics({ objects: spec.objects })));
  });
});
