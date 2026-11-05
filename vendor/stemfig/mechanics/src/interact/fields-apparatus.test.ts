/**
 * 용수철·도르래·받침대·실의 속성 편집과 연결 참조 저장을 검증한다.
 * 물리 상태를 계산하지 않고 그림의 파라미터와 기존 편집 실패 계약만 확인한다.
 */
import { describe, expect, it } from "vitest";
import type { ApplyCtx, FieldPatch } from "@stemfig/host";
import { initMechanics, referencePoint } from "../init.ts";
import type { MechanicsSpec } from "../schema.ts";
import { applyFieldMechanics, fieldsMechanics, validateFieldMechanics } from "./fields.ts";

const ctx: ApplyCtx = { frame: { x: 0, y: 0, w: 100, h: 100 }, view: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 } };
const spec: MechanicsSpec = { objects: [
  { id: "B", type: "block", width: 1, height: 2, pose: { mode: "free", point: [-4, 0], angle: 0 } },
  { id: "P", type: "pulley", center: [0, 4], radius: 1 },
  { id: "S", type: "support", point: [4, 1], width: 3, height: 2, angle: 0 },
  { id: "K", type: "spring", a: { mode: "anchor", object: "S", anchor: "top" }, b: { mode: "free", point: [4, 6] }, width: 0.6, coils: 8 },
  { id: "R", type: "rope", a: { mode: "free", point: [-4, 4] }, b: { mode: "free", point: [4, 4] }, pulley: "P", wrap: "cw" },
  { id: "F", type: "force", from: { mode: "anchor", object: "P", anchor: "right" }, delta: [2, 0] },
] };

describe("역학 기구 속성", () => {
  it("도르래 중심과 반지름 손잡이는 해당 파라미터만 편집한다", () => {
    const state = initMechanics(spec);
    expect(fieldsMechanics({ ...ctx, focus: "P:center" }, state).map(field => field.key)).toEqual(["x", "y"]);
    expect(fieldsMechanics({ ...ctx, focus: "P:radius" }, state).map(field => field.key)).toEqual(["radius"]);
    const moved = applyFieldMechanics(ctx, state, { id: "P:center", key: "x", value: 1 });
    const resized = applyFieldMechanics(ctx, moved, { id: "P:radius", key: "radius", value: 1.5 });
    expect(resized.byId.get("P")).toMatchObject({ center: [1, 4], radius: 1.5 });
    expect(referencePoint({ mode: "anchor", object: "P", anchor: "right" }, resized)).toEqual([2.5, 4]);
    expect(resized.byId.get("F")).toEqual(state.byId.get("F"));
    expect(applyFieldMechanics(ctx, state, { id: "P:radius", key: "x", value: 10 })).toBe(state);
  });

  it("받침대 꼭짓점·크기·회전은 원본을 바꾸고 부착 용수철을 다시 계산한다", () => {
    const state = initMechanics(spec);
    const moved = applyFieldMechanics(ctx, state, { id: "S:point", key: "y", value: 2 });
    expect(moved.byId.get("S")).toMatchObject({ point: [4, 2] });
    expect(referencePoint({ mode: "anchor", object: "S", anchor: "top" }, moved)).toEqual([4, 2]);
    let changed = applyFieldMechanics(ctx, moved, { id: "S", key: "width", value: 4 });
    changed = applyFieldMechanics(ctx, changed, { id: "S", key: "height", value: 3 });
    changed = applyFieldMechanics(ctx, changed, { id: "S", key: "angle", value: 90 });
    expect(changed.byId.get("S")).toMatchObject({ width: 4, height: 3, angle: 90 });
    expect(changed.byId.get("K")).toEqual(state.byId.get("K"));
    expect(fieldsMechanics({ ...ctx, focus: "S:point", handles: ["S"] }, changed).every(field => !field.disabled)).toBe(true);
    expect(fieldsMechanics({ ...ctx, focus: "P:radius", handles: ["P:center"] }, changed).every(field => field.disabled)).toBe(true);
  });

  it("용수철 끝을 이동해 압축해도 폭과 감김 수를 보존한다", () => {
    const state = initMechanics(spec);
    const compressed = applyFieldMechanics(ctx, state, { id: "K:b", key: "y", value: 3 });
    expect(compressed.byId.get("K")).toMatchObject({ b: { point: [4, 3] }, width: 0.6, coils: 8 });
    const rewound = applyFieldMechanics(ctx, compressed, { id: "K", key: "coils", value: 12 });
    expect(rewound.byId.get("K")).toMatchObject({ coils: 12, b: { point: [4, 3] } });
    const wider = applyFieldMechanics(ctx, rewound, { id: "K", key: "width", value: 1 });
    expect(wider.byId.get("K")).toMatchObject({ width: 1, coils: 12 });
    expect(spec.objects.find(object => object.id === "K")).toMatchObject({ width: 0.6, coils: 8, b: { point: [4, 6] } });
  });

  it("기존 block 접두사를 유지하면서 도르래·받침대 연결과 해제를 지원한다", () => {
    const state = initMechanics(spec);
    const field = fieldsMechanics({ ...ctx, focus: "K:a" }, state).find(item => item.key === "target");
    expect(field).toMatchObject({ type: "enum", value: "support:S" });
    if (field?.type !== "enum") throw new Error("missing target options");
    expect(field.options.map(option => option.value)).toEqual(["free", "block:B", "pulley:P", "support:S"]);
    const attached = applyFieldMechanics(ctx, state, { id: "K", key: "a.target", value: "pulley:P" });
    const top = applyFieldMechanics(ctx, attached, { id: "K:a", key: "anchor", value: "top" });
    expect(top.byId.get("K")).toMatchObject({ a: { mode: "anchor", object: "P", anchor: "top" } });
    const free = applyFieldMechanics(ctx, top, { id: "K:a", key: "target", value: "free" });
    expect(free.byId.get("K")).toMatchObject({ a: { mode: "free", point: [0, 5] } });
    const block = applyFieldMechanics(ctx, free, { id: "K:a", key: "target", value: "block:B" });
    expect(block.byId.get("K")).toMatchObject({ a: { mode: "anchor", object: "B", anchor: "center" } });
  });

  it("실의 경유 도르래를 제거하거나 다시 고를 때 끝점과 감는 방향을 유지한다", () => {
    const state = initMechanics(spec);
    const reversed = applyFieldMechanics(ctx, state, { id: "R", key: "wrap", value: "ccw" });
    const straight = applyFieldMechanics(ctx, reversed, { id: "R", key: "pulley", value: "none" });
    expect(straight.byId.get("R")).not.toHaveProperty("pulley");
    expect(straight.byId.get("R")).toMatchObject({ wrap: "ccw", a: { point: [-4, 4] }, b: { point: [4, 4] } });
    const routed = applyFieldMechanics(ctx, straight, { id: "R", key: "pulley", value: "pulley:P" });
    const end = applyFieldMechanics(ctx, routed, { id: "R:a", key: "x", value: -5 });
    expect(end.byId.get("R")).toMatchObject({ pulley: "P", wrap: "ccw", a: { point: [-5, 4] } });
  });

  it("권수·기구 크기·잘못된 종류의 참조는 저장 전에 거절한다", () => {
    const state = initMechanics(spec);
    const patches: FieldPatch[] = [
      { id: "K", key: "coils", value: 1 }, { id: "K", key: "coils", value: 41 },
      { id: "K", key: "coils", value: 2.5 }, { id: "K", key: "coils", value: Infinity },
      { id: "K", key: "width", value: 0 }, { id: "P:radius", key: "radius", value: 0 },
      { id: "S", key: "height", value: -1 }, { id: "S", key: "angle", value: NaN },
      { id: "R", key: "pulley", value: "pulley:missing" }, { id: "R", key: "pulley", value: "pulley:S" },
      { id: "R", key: "wrap", value: "clockwise" }, { id: "K:a", key: "target", value: "block:P" },
    ];
    for (const patch of patches) {
      expect(validateFieldMechanics(ctx, state, patch)).toBeTypeOf("string");
      expect(applyFieldMechanics(ctx, state, patch)).toBe(state);
    }
    expect(applyFieldMechanics(ctx, state, { id: "S:radius", key: "radius", value: 2 })).toBe(state);
    expect(applyFieldMechanics(ctx, state, { id: "K", key: "coils", value: 8 })).toBe(state);
    expect(fieldsMechanics({ ...ctx, focus: "S:point:0" }, state)).toEqual([]);
  });

  it("연결된 그림을 퇴화시키거나 실 끝을 도르래 안에 넣는 수정은 되돌린다", () => {
    const state = initMechanics(spec);
    const patches: FieldPatch[] = [
      { id: "K:b", key: "y", value: 1 },
      { id: "P", key: "radius", value: 5 },
      { id: "R:a", key: "x", value: 0 },
    ];
    for (const patch of patches) {
      expect(validateFieldMechanics(ctx, state, patch)).toBeTypeOf("string");
      expect(applyFieldMechanics(ctx, state, patch)).toBe(state);
    }
  });
});
