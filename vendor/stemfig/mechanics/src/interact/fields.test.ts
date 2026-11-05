/**
 * 속성 편집의 저장 경계와 부착 관계 보존을 검증한다.
 * 호스트/UI를 흉내 내지 않고 플러그인에 들어오는 절대값 패치를 사용한다.
 */
import { describe, expect, it } from "vitest";
import type { ApplyCtx } from "@stemfig/host";
import { DEFAULT_STYLE } from "@stemfig/display";
import { initMechanics, referencePoint } from "../init.ts";
import type { MechanicsSpec } from "../schema.ts";
import { applyFieldMechanics, fieldsMechanics, validateFieldMechanics } from "./fields.ts";

const ctx: ApplyCtx = { frame: { x: 0, y: 0, w: 100, h: 100 }, view: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 } };
const spec: MechanicsSpec = { objects: [
  { id: "track", type: "track", points: [[0, 0], [10, 10]], rounding: 0 },
  { id: "block", type: "block", width: 2, height: 2, pose: { mode: "track", track: "track", t: 0.5, offset: 2 }, label: "A" },
  { id: "force", type: "force", from: { mode: "anchor", object: "block", anchor: "top" }, delta: [3, 0] },
  { id: "dim", type: "dimension", a: { mode: "free", point: [0, 0] }, b: { mode: "anchor", object: "block", anchor: "bottom" }, axis: "vertical", offset: 3 },
] };

describe("역학 속성 경계", () => {
  it("라벨 크기는 기본값을 상속하고 양의 유한한 mm 값만 저장한다", () => {
    const state = initMechanics(spec);
    expect(fieldsMechanics({ ...ctx, focus: "block" }, state).find(field => field.key === "labelSize"))
      .toMatchObject({ label: "라벨 크기", value: DEFAULT_STYLE.textSize, unit: "mm" });
    const larger = applyFieldMechanics(ctx, state, { id: "block:label", key: "labelSize", value: 3 });
    expect(larger.byId.get("block")).toMatchObject({ labelSize: 3 });
    expect(fieldsMechanics({ ...ctx, focus: "block" }, larger).find(field => field.key === "labelSize")?.value).toBe(3);
    for (const value of [0, -1, Infinity, NaN, "3"]) {
      const patch = { id: "block", key: "labelSize", value };
      expect(validateFieldMechanics(ctx, larger, patch)).toBeTypeOf("string");
      expect(applyFieldMechanics(ctx, larger, patch)).toBe(larger);
    }
  });

  it("숨김·점선·라벨 간격을 원본에 저장하며 편집 허용 목록을 반영한다", () => {
    const initial = initMechanics(spec);
    const all = fieldsMechanics({ ...ctx, focus: "block" }, initial);
    expect(all.some(field => field.key === "width")).toBe(true);
    expect(all.every(field => !field.disabled)).toBe(true);
    expect(fieldsMechanics({ ...ctx, focus: "block", handles: [] }, initial).every(field => field.disabled)).toBe(true);
    expect(fieldsMechanics({ ...ctx, focus: "track:point:0", handles: ["track"] }, initial).every(field => !field.disabled)).toBe(true);
    expect(fieldsMechanics({ ...ctx, focus: "track:point:0", handles: ["track:point:1"] }, initial).every(field => field.disabled)).toBe(true);
    const hidden = applyFieldMechanics(ctx, initial, { id: "block", key: "show", value: false });
    const dashed = applyFieldMechanics(ctx, hidden, { id: "block", key: "stroke", value: "dash" });
    const labelled = applyFieldMechanics(ctx, dashed, { id: "block:label", key: "labelOffsetY", value: 1.5 });
    expect(labelled.byId.get("block")).toMatchObject({ show: false, dashed: true, labelOffset: [0, 1.5] });
    expect(initial.byId.get("block")).not.toHaveProperty("show");
  });

  it("유효하지 않은 숫자·타입·참조를 거절하고 모르는 키는 원본을 유지한다", () => {
    const state = initMechanics(spec);
    for (const patch of [
      { id: "block", key: "width", value: 0 },
      { id: "block", key: "height", value: -1 },
      { id: "block", key: "t", value: 101 },
      { id: "block", key: "t", value: Number.NaN },
      { id: "block", key: "show", value: "false" },
      { id: "block", key: "track", value: "track:missing" },
      { id: "force:from", key: "target", value: "block:missing" },
      { id: "dim", key: "axis", value: "diagonal" },
    ]) {
      expect(validateFieldMechanics(ctx, state, patch)).toBeTypeOf("string");
      expect(applyFieldMechanics(ctx, state, patch)).toBe(state);
    }
    for (const patch of [
      { id: "block", key: "x", value: 4 },
      { id: "block:label", key: "width", value: 4 },
      { id: "missing", key: "width", value: 4 },
      { id: "track:point:9", key: "x", value: 4 },
      { id: "track:point:01", key: "x", value: 4 },
      { id: "block:", key: "width", value: 4 },
    ]) expect(applyFieldMechanics(ctx, state, patch)).toBe(state);
    expect(fieldsMechanics(ctx, state)).toEqual([]);
  });

  it("경로를 완전히 무너뜨리는 꼭짓점 변경은 저장하지 않는다", () => {
    const state = initMechanics({ objects: [{ id: "track", type: "track", points: [[0, 0], [10, 0]], rounding: 0 }] });
    const patch = { id: "track:point:1", key: "x", value: 0 };
    expect(validateFieldMechanics(ctx, state, patch)).toBeTypeOf("string");
    expect(applyFieldMechanics(ctx, state, patch)).toBe(state);
  });
});

describe("부착 관계의 속성 편집", () => {
  it("블록을 경로에서 풀면 현재 접촉점과 회전을 보존하고 다시 붙이면 가까운 지점을 쓴다", () => {
    const state = initMechanics(spec);
    const pose = state.poses.get("block")!;
    expect(applyFieldMechanics(ctx, state, { id: "block", key: "track", value: "track:track" })).toBe(state);
    const free = applyFieldMechanics(ctx, state, { id: "block", key: "track", value: "free" });
    expect(free.byId.get("block")).toMatchObject({ pose: { mode: "free", point: pose.point, angle: pose.angle } });
    const placed = applyFieldMechanics(ctx, free, { id: "block", key: "x", value: 8 });
    const attached = applyFieldMechanics(ctx, placed, { id: "block", key: "track", value: "track:track" });
    expect(attached.byId.get("block")).toMatchObject({ pose: { mode: "track", track: "track", offset: 0 } });
    expect(attached.poses.get("block")!.point[0]).toBeCloseTo((8 + pose.point[1]) / 2);
    expect(attached.poses.get("block")!.angle).toBeCloseTo(45);
  });

  it("붙은 주석을 해제해도 위치가 유지되고 본체 이동에는 해제 전 주석만 따라간다", () => {
    const state = initMechanics(spec);
    const force = state.byId.get("force")!;
    if (force.type !== "force") throw new Error("fixture");
    const before = referencePoint(force.from, state);
    const free = applyFieldMechanics(ctx, state, { id: "force:from", key: "target", value: "free" });
    expect(free.byId.get("force")).toMatchObject({ from: { mode: "free", point: before } });
    const moved = applyFieldMechanics(ctx, free, { id: "block", key: "t", value: 80 });
    expect(moved.byId.get("force")).toMatchObject({ from: { point: before } });
    const attached = applyFieldMechanics(ctx, moved, { id: "force", key: "from.target", value: "block:block" });
    const top = applyFieldMechanics(ctx, attached, { id: "force:from", key: "anchor", value: "top" });
    const withOffset = applyFieldMechanics(ctx, top, { id: "force:from", key: "offsetX", value: 1 });
    expect(withOffset.byId.get("force")).toMatchObject({ from: { mode: "anchor", object: "block", anchor: "top", offset: [1, 0] } });
  });

  it("화살표 끝점과 치수선 양 끝점을 각각의 원본 표현으로 저장한다", () => {
    const state = initMechanics(spec);
    const force = state.byId.get("force")!;
    if (force.type !== "force") throw new Error("fixture");
    const from = referencePoint(force.from, state);
    const end = applyFieldMechanics(ctx, state, { id: "force:end", key: "x", value: 20 });
    expect(end.byId.get("force")).toMatchObject({ delta: [20 - from[0], 0] });
    const dim = applyFieldMechanics(ctx, end, { id: "dim", key: "a.y", value: -4 });
    expect(dim.byId.get("dim")).toMatchObject({ a: { point: [0, -4] } });
    expect(spec.objects[0]).toMatchObject({ points: [[0, 0], [10, 10]] });
  });
});
