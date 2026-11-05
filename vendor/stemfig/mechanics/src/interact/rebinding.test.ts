/** 연결점 드래그의 저장 의미를 검증한다. 화면 좌표와 참조가 따로 움직이면 실패한다. */
import { toPage } from "@stemfig/display";
import type { ApplyCtx, HandlePatch } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import { initMechanics, referencePoint } from "../init.ts";
import type { MechanicsObject, PointRef, Vec } from "../schema.ts";
import { applyMechanics } from "./apply.ts";

const ctx: ApplyCtx = { frame: { x: 10, y: 20, w: 100, h: 100 }, view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 } };
const free = (point: Vec): PointRef => ({ mode: "free", point });
const blocks: MechanicsObject[] = [
  { id: "A", type: "block", width: 1, height: 1, pose: { mode: "free", point: [2, 2], angle: 0 } },
  { id: "B", type: "block", width: 1, height: 1, pose: { mode: "free", point: [8, 2], angle: 0 } },
];
function patch(id: string, point: Vec, unsnap = false): HandlePatch {
  const [x_mm, y_mm] = toPage(ctx.view, ctx.frame)(...point);
  return { id, dx_mm: 0, dy_mm: 0, pointer: { x_mm, y_mm, unsnap, px_per_mm: 4 } };
}

describe("연결점 드래그", () => {
  it("자유 끝을 연결하고 다른 물체로 옮기면 새 참조가 저장되어 이후 이동을 따른다", () => {
    const initial = initMechanics({ objects: [...blocks, { id: "s", type: "spring", a: free([0, 8]), b: free([4, 5]), width: 0.3, coils: 8 }] });
    const bound = applyMechanics(ctx, initial, patch("s:b", [2, 3]));
    expect(bound.byId.get("s")).toMatchObject({ b: { mode: "anchor", object: "A", anchor: "top" } });
    const rebound = applyMechanics(ctx, bound, patch("s:b", [8, 3]));
    expect(rebound.byId.get("s")).toMatchObject({ b: { mode: "anchor", object: "B", anchor: "top" } });
    const moved = applyMechanics(ctx, rebound, { id: "B", dx_mm: 10, dy_mm: -10 });
    expect(moved.paths.get("s")!.at(-1)).toEqual([9, 4]);
    expect(moved.byId.get("s")).toEqual(rebound.byId.get("s"));
  });

  it("같은 위치의 Alt 드래그도 참조를 끊고 반복 입력은 같은 상태를 돌려준다", () => {
    const initial = initMechanics({ objects: [...blocks, { id: "r", type: "rope", a: free([0, 8]),
      b: { mode: "anchor", object: "A", anchor: "top" }, wrap: "cw" }] });
    const detached = applyMechanics(ctx, initial, patch("r:b", [2, 3], true));
    expect(detached.byId.get("r")).toMatchObject({ b: free([2, 3]) });
    expect(applyMechanics(ctx, detached, patch("r:b", [2, 3], true))).toBe(detached);
    const moved = applyMechanics(ctx, detached, { id: "A", dx_mm: 10, dy_mm: 0 });
    expect(moved.paths.get("r")!.at(-1)).toEqual([2, 3]);
  });

  it("힘·치수·보조선·라벨의 원점도 같은 참조 계약을 따른다", () => {
    const objects: MechanicsObject[] = [
      { id: "force", type: "force", from: free([0, 8]), delta: [1, 0] },
      { id: "dim", type: "dimension", a: free([0, 8]), b: free([9, 8]), axis: "horizontal", offset: 0 },
      { id: "guide", type: "guide", a: free([0, 8]), b: free([9, 8]) },
      { id: "label", type: "label", at: free([0, 8]), label: "표시" },
    ];
    let state = initMechanics({ objects: [...blocks, ...objects] });
    for (const id of ["force:from", "dim:a", "guide:b", "label:at"]) state = applyMechanics(ctx, state, patch(id, [2, 3]));
    const expected = { mode: "anchor", object: "A", anchor: "top" };
    expect(state.byId.get("force")).toMatchObject({ from: expected });
    expect(state.byId.get("dim")).toMatchObject({ a: expected });
    expect(state.byId.get("guide")).toMatchObject({ b: expected });
    expect(state.byId.get("label")).toMatchObject({ at: expected });
  });

  it("포인터 없는 끝점 nudge는 연결과 offset을 보존하며 비유한 포인터는 거절한다", () => {
    const initial = initMechanics({ objects: [...blocks, { id: "g", type: "guide", a: free([0, 8]),
      b: { mode: "anchor", object: "A", anchor: "top" } }] });
    const moved = applyMechanics(ctx, initial, { id: "g:b", dx_mm: 10, dy_mm: -20 });
    const object = moved.byId.get("g");
    expect(object).toMatchObject({ b: { mode: "anchor", object: "A", offset: [1, 2] } });
    if (object?.type === "guide") expect(referencePoint(object.b, moved)).toEqual([3, 5]);
    expect(applyMechanics(ctx, initial, { ...patch("g:b", [2, 3]), pointer: { x_mm: Infinity, y_mm: 0 } })).toBe(initial);
  });
});
