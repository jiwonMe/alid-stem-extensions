/**
 * 실제 페이지 mm 입력으로 클릭→부착→드래그→삭제 흐름을 검증한다.
 * 원본 spec은 저장 상태이고 미리보기·파생 자세는 임시 계산이라는 경계를 확인한다.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE, toPage } from "@stemfig/display";
import type { ApplyCtx, PlaceCtx } from "@stemfig/host";
import { compileMechanics } from "../compile.ts";
import { initMechanics, referencePoint, type MechanicsState } from "../init.ts";
import { mechanicsSpecSchema, type Vec } from "../schema.ts";
import { applyMechanics, removeMechanics } from "./apply.ts";
import { cancelMechanics, guidanceMechanics, placeMechanics } from "./place.ts";
import { previewMechanics } from "./preview.ts";

const ctx: ApplyCtx = { frame: { x: 20, y: 30, w: 100, h: 100 }, view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 } };
const compileCtx = { ...ctx, style: DEFAULT_STYLE, mmToPage: (x: number, y: number): Vec => [ctx.frame.x + x, ctx.frame.y + y] };

function at(tool: string, point: Vec, unsnap = false): PlaceCtx {
  const [x_mm, y_mm] = toPage(ctx.view, ctx.frame)(...point);
  return { ...ctx, tool, x_mm, y_mm, px_per_mm: 4, unsnap };
}

function click(state: MechanicsState, tool: string, point: Vec, unsnap = false): MechanicsState {
  const result = placeMechanics(at(tool, point, unsnap), state);
  if (!result) throw new Error(`unknown test tool: ${tool}`);
  return result.state;
}

function placedScene(): MechanicsState {
  let state = initMechanics({ objects: [] });
  for (const point of [[1, 2], [9, 2], [9, 2]] as Vec[]) state = click(state, "track", point);
  state = click(state, "block", [5, 2]);
  const center = referencePoint({ mode: "anchor", object: "block1", anchor: "center" }, state);
  state = click(state, "force", center);
  return click(state, "force", [center[0] + 2, center[1]]);
}

describe("도구 클릭과 미완성 상태", () => {
  it("경로는 꼭짓점을 여러 번 추가한 뒤 마지막 점을 다시 클릭해야 완성된다", () => {
    const empty = initMechanics({ objects: [] });
    const first = click(empty, "track", [1, 2]);
    expect(first.spec.objects).toEqual([]);
    expect(click(first, "track", [1, 2])).toBe(first);
    const second = click(first, "track", [5, 2]);
    const third = click(second, "track", [9, 6]);
    expect(compileMechanics(compileCtx, third)).toEqual([]);
    expect(guidanceMechanics({ tool: "track" }, third)).toMatchObject({ canCancel: true });
    const result = placeMechanics(at("track", [9, 6]), third)!;
    expect(result.handles).toEqual(["track1"]);
    expect(result.state.spec).not.toHaveProperty("draft");
    expect(result.state.byId.get("track1")).toMatchObject({ points: [[1, 2], [5, 2], [9, 6]] });
    expect(compileMechanics(compileCtx, result.state).length).toBeGreaterThan(0);
    expect(empty.spec.objects).toEqual([]);
  });

  it("도구 취소는 완성된 객체를 보존하고 진행 중인 점만 지운다", () => {
    const state = placedScene();
    const draft = click(state, "guide", [2, 8]);
    const cancelled = cancelMechanics(ctx, draft);
    expect(cancelled.spec).toEqual(state.spec);
    expect(cancelMechanics(ctx, cancelled)).toBe(cancelled);
    const switched = click(draft, "dimension", [3, 8]);
    expect(switched.spec.draft).toMatchObject({ tool: "dimension", points: [[3, 8]] });
    expect(placeMechanics(at("missing", [0, 0]), state)).toBeUndefined();
  });

  it("경로 가까이 놓은 물체는 부착되고 Alt 배치는 자유 좌표를 저장한다", () => {
    const state = placedScene();
    expect(state.byId.get("block1")).toMatchObject({ pose: { mode: "track", track: "track1", t: 0.5 } });
    const free = click(state, "block", [7, 2], true);
    expect(free.byId.get("block2")).toMatchObject({ pose: { mode: "free", point: [7, 2], angle: 0 } });
    expect(free.spec).not.toHaveProperty("draft");
    expect(mechanicsSpecSchema.safeParse(free.spec).success).toBe(true);
  });

  it("힘·치수·보조선은 두 번 클릭으로 만들고 같은 시작점 클릭은 무시한다", () => {
    const state = placedScene();
    expect(state.byId.get("force1")).toMatchObject({ from: { mode: "anchor", object: "block1", anchor: "center" }, delta: [2, 0] });
    const started = click(state, "dimension", [1, 0]);
    expect(click(started, "dimension", [1, 0])).toBe(started);
    const dimension = click(started, "dimension", [1, 4]);
    expect(dimension.byId.get("dimension1")).toMatchObject({ axis: "vertical", a: { point: [1, 0] }, b: { point: [1, 4] } });
    const guide = click(click(dimension, "guide", [0, 0]), "guide", [9, 0]);
    expect(guide.byId.get("guide1")).toMatchObject({ dashed: true, a: { point: [0, 0] }, b: { point: [9, 0] } });
    const label = click(guide, "label", [8, 8], true);
    expect(label.byId.get("label1")).toMatchObject({ at: { mode: "free", point: [8, 8] } });
  });
});

describe("관계를 보존하는 드래그", () => {
  it("부착 물체는 경로상 위치만 바꾸고 힘의 연결점은 함께 움직인다", () => {
    const state = placedScene();
    const before = referencePoint({ mode: "anchor", object: "block1", anchor: "center" }, state);
    const moved = applyMechanics(ctx, state, { id: "block1", dx_mm: 20, dy_mm: -10 });
    expect(moved.byId.get("block1")).toMatchObject({ pose: { mode: "track", t: 0.75 } });
    expect(moved.poses.get("block1")!.point).toEqual([7, 2]);
    const after = referencePoint({ mode: "anchor", object: "block1", anchor: "center" }, moved);
    expect(after).toEqual([before[0] + 2, before[1]]);
    expect(moved.byId.get("force1")).toEqual(state.byId.get("force1"));
    const shifted = applyMechanics(ctx, moved, { id: "track1", dx_mm: -10, dy_mm: -20 });
    expect(shifted.poses.get("block1")!.point).toEqual([6, 4]);
    expect(referencePoint({ mode: "anchor", object: "block1", anchor: "center" }, shifted)).toEqual([after[0] - 1, after[1] + 2]);
  });

  it("자유 물체는 mm를 장면 좌표로 바꾸고 꼭짓점 이동은 부착 물체를 회전시킨다", () => {
    const state = click(placedScene(), "block", [7, 4], true);
    const free = applyMechanics(ctx, state, { id: "block2", dx_mm: 10, dy_mm: -20 });
    expect(free.byId.get("block2")).toMatchObject({ pose: { mode: "free", point: [8, 6] } });
    const sloped = applyMechanics(ctx, free, { id: "track1:point:1", dx_mm: 0, dy_mm: -80 });
    expect(sloped.poses.get("block1")!.point).toEqual([5, 6]);
    expect(sloped.poses.get("block1")!.angle).toBeCloseTo(45);
    expect(sloped.byId.get("force1")).toEqual(state.byId.get("force1"));
  });

  it("화살표 끝 드래그는 방향 벡터만 바꾸고 시작점 드래그는 연결을 보존한다", () => {
    const state = placedScene();
    const end = applyMechanics(ctx, state, { id: "force1:end", dx_mm: 10, dy_mm: -20 });
    expect(end.byId.get("force1")).toMatchObject({ delta: [3, 2], from: { mode: "anchor", object: "block1" } });
    const from = applyMechanics(ctx, end, { id: "force1:from", dx_mm: -10, dy_mm: 10 });
    expect(from.byId.get("force1")).toMatchObject({ delta: [3, 2], from: { mode: "anchor", object: "block1", offset: [-1, -1] } });
  });

  it("치수선 본체 이동은 간격만 바꾸고 끝점 이동은 기준점만 바꾼다", () => {
    const state = click(click(placedScene(), "dimension", [1, 0]), "dimension", [1, 4]);
    const line = applyMechanics(ctx, state, { id: "dimension1", dx_mm: 20, dy_mm: -10 });
    expect(line.byId.get("dimension1")).toMatchObject({ offset: 2, a: { point: [1, 0] }, b: { point: [1, 4] } });
    const endpoint = applyMechanics(ctx, line, { id: "dimension1:b", dx_mm: 10, dy_mm: -20 });
    expect(endpoint.byId.get("dimension1")).toMatchObject({ offset: 2, a: { point: [1, 0] }, b: { point: [2, 6] } });
    const label = applyMechanics(ctx, endpoint, { id: "dimension1:label", dx_mm: 1, dy_mm: -2 });
    expect(label.byId.get("dimension1")).toMatchObject({ labelOffset: [1, -2] });
  });
});

describe("삭제·실패·미리보기 경계", () => {
  it("경로 삭제는 물체와 연결 주석을 함께 지우고 draft를 취소한다", () => {
    const state = click(placedScene(), "label", [8, 8], true);
    const withDraft = click(state, "force", [5, 2]);
    const result = removeMechanics(ctx, withDraft, ["track1:point:1"])!;
    expect(new Set(result.removed)).toEqual(new Set(["track1", "block1", "force1", "track1:point:1"]));
    expect(result.state.spec.objects.map(object => object.id)).toEqual(["label1"]);
    expect(result.state.spec).not.toHaveProperty("draft");
    expect(withDraft.spec.objects).toHaveLength(4);
    expect(removeMechanics(ctx, state, ["missing"])).toBeUndefined();
  });

  it("미지원·비유한 값·영 이동·잘못된 손잡이는 현재 상태를 보존한다", () => {
    const state = placedScene();
    for (const patch of [
      { id: "missing", dx_mm: 10, dy_mm: 0 },
      { id: "block1:end", dx_mm: 10, dy_mm: 0 },
      { id: "track1:point:99", dx_mm: 10, dy_mm: 0 },
      { id: "block1", dx_mm: NaN, dy_mm: 0 },
      { id: "block1", dx_mm: Infinity, dy_mm: 0 },
      { id: "block1", dx_mm: 0, dy_mm: 0 },
      { id: "track1:point:01", dx_mm: 10, dy_mm: 0 },
      { id: "track1:point:", dx_mm: 10, dy_mm: 0 },
    ]) expect(applyMechanics(ctx, state, patch)).toBe(state);
    expect(applyMechanics(ctx, state, { id: "track1:point:1", dx_mm: -80, dy_mm: 0 })).toBe(state);
    const free = click(state, "block", [7, 4], true);
    const tinyFrame = { ...ctx, frame: { ...ctx.frame, w: 1, h: 1 } };
    expect(applyMechanics(tinyFrame, free, { id: "block2", dx_mm: 1e308, dy_mm: 0 })).toBe(free);
  });

  it("미리보기는 현재 spec을 바꾸지 않고 커서에 해당하는 객체만 출력한다", () => {
    const state = placedScene();
    const draft = click(state, "track", [1, 5]);
    const before = JSON.stringify(draft.spec);
    const preview = previewMechanics(at("track", [8, 5]), draft);
    expect(preview.length).toBeGreaterThan(0);
    expect(JSON.stringify(draft.spec)).toBe(before);
    expect(previewMechanics(at("force", [8, 5]), state)).toEqual([]);
    expect(previewMechanics(at("missing", [8, 5]), state)).toEqual([]);
    const blockPreview = previewMechanics(at("block", [8, 2]), state);
    expect(blockPreview.filter(item => item.op === "polygon")).toHaveLength(1);
    expect(state.spec.objects).toHaveLength(3);
  });
});
