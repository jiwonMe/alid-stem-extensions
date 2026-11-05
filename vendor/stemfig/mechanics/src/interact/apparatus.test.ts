/**
 * 기구의 배치·연결·드래그·삭제를 실제 페이지 입력으로 검증한다.
 * 렌더러·속성 패널을 흉내 내지 않고 원본 참조 보존과 보이는 손잡이의 결과를 확인한다.
 */
import { DEFAULT_STYLE, toPage } from "@stemfig/display";
import type { ApplyCtx, PlaceCtx } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import { initMechanics, referencePoint, type MechanicsState } from "../init.ts";
import { mechanicsSpecSchema, type MechanicsObject, type Vec } from "../schema.ts";
import { applyMechanics, removeMechanics } from "./apply.ts";
import { anchorsMechanics, hitMechanics, snapMechanics } from "./hit.ts";
import { cancelMechanics, guidanceMechanics, placeMechanics } from "./place.ts";
import { previewMechanics } from "./preview.ts";

const ctx: ApplyCtx = { frame: { x: 10, y: 20, w: 100, h: 100 }, view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 } };
const compileCtx = { ...ctx, style: DEFAULT_STYLE, mmToPage: (x: number, y: number): Vec => [10 + x, 20 + y] };
const support: MechanicsObject = { id: "support", type: "support", point: [2, 7], width: 2, height: 2, angle: 0 };
const pulley: MechanicsObject = { id: "pulley", type: "pulley", center: [8, 7], radius: 1 };

function at(tool: string, point: Vec, unsnap = false): PlaceCtx {
  const [x_mm, y_mm] = toPage(ctx.view, ctx.frame)(...point);
  return { ...ctx, tool, x_mm, y_mm, px_per_mm: 4, unsnap };
}

function click(state: MechanicsState, tool: string, point: Vec, unsnap = false): MechanicsState {
  const result = placeMechanics(at(tool, point, unsnap), state);
  if (!result) throw new Error(`unknown test tool ${tool}`);
  return result.state;
}

function connectedScene(): MechanicsState {
  const state = initMechanics({ objects: [support, pulley] });
  return click(click(state, "spring", [2, 7]), "spring", [7, 7]);
}

describe("기구의 클릭 배치", () => {
  it("도르래는 중심과 반지름으로 만들고 0 반지름이나 비유한 입력은 무시한다", () => {
    const empty = initMechanics({ objects: [] });
    const draft = click(empty, "pulley", [5, 5]);
    expect(draft.spec.objects).toEqual([]);
    expect(draft.spec.draft).toMatchObject({ tool: "pulley", points: [[5, 5]] });
    expect(click(draft, "pulley", [5, 5])).toBe(draft);
    expect(placeMechanics({ ...at("pulley", [5, 5]), x_mm: Infinity }, draft)?.state).toBe(draft);
    const made = click(draft, "pulley", [6, 5]);
    expect(made.byId.get("pulley1")).toMatchObject({ center: [5, 5], radius: 1 });
    expect(made.spec).not.toHaveProperty("draft");
    expect(mechanicsSpecSchema.safeParse(made.spec).success).toBe(true);
    expect(cancelMechanics(ctx, draft).spec).toEqual(empty.spec);
  });

  it("받침대는 클릭점을 꼭짓점으로 삼고 크기는 장면 폭을 따른다", () => {
    const made = click(initMechanics({ objects: [] }), "support", [3, 6]);
    const object = made.byId.get("support1");
    expect(object).toMatchObject({ type: "support", point: [3, 6], width: 10 / 16, height: 10 / 16 * 0.75, angle: 0 });
    expect(referencePoint({ mode: "anchor", object: "support1", anchor: "top" }, made)).toEqual([3, 6]);
  });

  it("용수철 양 끝은 받침대와 도르래 연결점을 참조하고 Alt는 자유점을 저장한다", () => {
    const made = connectedScene();
    expect(made.byId.get("spring1")).toMatchObject({ type: "spring", coils: 8,
      a: { mode: "anchor", object: "support", anchor: "top" },
      b: { mode: "anchor", object: "pulley", anchor: "left" } });
    expect(made.paths.get("spring1")![0]).toEqual([2, 7]);
    expect(made.paths.get("spring1")!.at(-1)).toEqual([7, 7]);
    const free = click(click(made, "spring", [2, 7], true), "spring", [7, 7], true);
    expect(free.byId.get("spring2")).toMatchObject({ a: { mode: "free", point: [2, 7] }, b: { mode: "free", point: [7, 7] } });
    const draft = click(made, "spring", [2, 7]);
    expect(click(draft, "spring", [2.001, 7])).toBe(draft);
  });

  it("실은 기본 직선으로 생성하고 도르래 선택 안내를 제공한다", () => {
    const started = click(initMechanics({ objects: [] }), "rope", [1, 2]);
    expect(guidanceMechanics({ tool: "rope" }, started)?.message).toContain("도르래");
    const made = click(started, "rope", [8, 2]);
    expect(made.byId.get("rope1")).toMatchObject({ type: "rope", wrap: "cw" });
    expect(made.byId.get("rope1")).not.toHaveProperty("pulley");
    expect(made.paths.get("rope1")).toEqual([[1, 2], [8, 2]]);
  });

  it("용수철·실·도르래 미리보기는 draft와 완성 객체를 변경하지 않는다", () => {
    for (const tool of ["spring", "rope", "pulley"]) {
      const started = click(initMechanics({ objects: [] }), tool, [2, 3]);
      const before = JSON.stringify(started.spec);
      expect(previewMechanics(at(tool, [7, 3]), started).length).toBeGreaterThan(0);
      expect(previewMechanics(at(tool, [2, 3]), started)).toEqual([]);
      expect(JSON.stringify(started.spec)).toBe(before);
    }
    expect(previewMechanics(at("support", [2, 3]), initMechanics({ objects: [] })).length).toBeGreaterThan(0);
  });
});

describe("기구의 참조와 드래그", () => {
  it("도르래 중심·반지름과 받침대 꼭짓점 이동을 연결된 용수철이 따른다", () => {
    const state = connectedScene();
    const moved = applyMechanics(ctx, state, { id: "pulley:center", dx_mm: 10, dy_mm: -10 });
    expect(moved.byId.get("pulley")).toMatchObject({ center: [9, 8] });
    expect(moved.paths.get("spring1")!.at(-1)).toEqual([8, 8]);
    const enlarged = applyMechanics(ctx, moved, { id: "pulley:radius", dx_mm: 10, dy_mm: 0 });
    expect(enlarged.byId.get("pulley")).toMatchObject({ radius: 2 });
    expect(enlarged.paths.get("spring1")!.at(-1)).toEqual([7, 8]);
    const supported = applyMechanics(ctx, enlarged, { id: "support:point", dx_mm: 10, dy_mm: 10 });
    expect(supported.paths.get("spring1")![0]).toEqual([3, 6]);
    expect(supported.byId.get("spring1")).toEqual(state.byId.get("spring1"));
  });

  it("용수철 본체와 끝점 드래그는 연결을 끊지 않고 연결 간격을 저장한다", () => {
    const state = connectedScene();
    const shifted = applyMechanics(ctx, state, { id: "spring1", dx_mm: 10, dy_mm: -20 });
    expect(shifted.byId.get("spring1")).toMatchObject({
      a: { mode: "anchor", object: "support", offset: [1, 2] }, b: { mode: "anchor", object: "pulley", offset: [1, 2] },
    });
    const endpoint = applyMechanics(ctx, shifted, { id: "spring1:b", dx_mm: -10, dy_mm: 10 });
    expect(endpoint.byId.get("spring1")).toMatchObject({ a: { offset: [1, 2] }, b: { offset: [0, 1] } });
    expect(endpoint.byId.get("pulley")).toEqual(pulley);
  });

  it("실의 경유 도르래를 움직이면 경로를 다시 계산하고 내부 끝점 이동은 거절한다", () => {
    const state = initMechanics({ objects: [
      { id: "wheel", type: "pulley", center: [5, 5], radius: 1 },
      { id: "rope", type: "rope", a: { mode: "free", point: [1, 2] }, b: { mode: "free", point: [9, 2] }, pulley: "wheel", wrap: "cw" },
    ] });
    const moved = applyMechanics(ctx, state, { id: "wheel", dx_mm: 10, dy_mm: 0 });
    expect(moved.paths.get("rope")).not.toEqual(state.paths.get("rope"));
    expect(moved.byId.get("rope")).toEqual(state.byId.get("rope"));
    expect(applyMechanics(ctx, state, { id: "rope:a", dx_mm: 40, dy_mm: -30 })).toBe(state);
    const whole = applyMechanics(ctx, state, { id: "rope", dx_mm: 0, dy_mm: 10 });
    expect(whole.byId.get("rope")).toMatchObject({ a: { point: [1, 1] }, b: { point: [9, 1] }, pulley: "wheel" });
  });

  it("퇴화 반지름·용수철·실과 미지원 손잡이는 기존 상태를 보존한다", () => {
    const state = connectedScene();
    expect(applyMechanics(ctx, state, { id: "pulley:radius", dx_mm: -10, dy_mm: 0 })).toBe(state);
    expect(applyMechanics(ctx, state, { id: "spring1:b", dx_mm: -50, dy_mm: 0 })).toBe(state);
    for (const id of ["pulley:missing", "support:radius", "spring1:radius"]) {
      expect(applyMechanics(ctx, state, { id, dx_mm: 10, dy_mm: 0 })).toBe(state);
    }
    const rope = click(click(state, "rope", [1, 1], true), "rope", [9, 1], true);
    expect(applyMechanics(ctx, rope, { id: "rope1:b", dx_mm: -80, dy_mm: 0 })).toBe(rope);
  });

  it("도르래 삭제는 참조 연결선과 경유 실을 지우고 독립 받침대는 보존한다", () => {
    const base = connectedScene();
    const state = initMechanics({ ...base.spec, objects: [...base.spec.objects,
      { id: "routed", type: "rope", a: { mode: "free", point: [5, 2] }, b: { mode: "free", point: [9, 2] }, pulley: "pulley", wrap: "cw" },
      { id: "caption", type: "label", label: "도르래", at: { mode: "anchor", object: "pulley", anchor: "top" } },
    ] });
    const result = removeMechanics(ctx, state, ["pulley:center"])!;
    expect(result.state.spec.objects.map(object => object.id)).toEqual(["support"]);
    expect(new Set(result.removed)).toEqual(new Set(["pulley", "spring1", "routed", "caption", "pulley:center"]));
    expect(removeMechanics(ctx, base, ["support:point"])!.state.spec.objects.map(object => object.id)).toEqual(["pulley"]);
  });
});

describe("기구 손잡이와 자석", () => {
  it("도르래 중심·반지름과 면을 구분하고 받침대 내부도 선택한다", () => {
    const wheel = initMechanics({ objects: [pulley] });
    expect(hitMechanics(at("", [8, 7]), wheel)).toBe("pulley:center");
    expect(hitMechanics(at("", [9, 7]), wheel)).toBe("pulley:radius");
    expect(hitMechanics(at("", [8.5, 7.4]), wheel)).toBe("pulley");
    const foot = initMechanics({ objects: [support] });
    expect(hitMechanics(at("", [2, 7]), foot)).toBe("support:point");
    expect(hitMechanics(at("", [2, 6]), foot)).toBe("support");
    expect(anchorsMechanics({ ...compileCtx, handles: ["pulley:radius"] }, wheel).map(anchor => anchor.id)).toEqual(["pulley:radius"]);
  });

  it("용수철과 실의 실제 곡선 및 양 끝을 선택한다", () => {
    const state = connectedScene();
    const path = state.paths.get("spring1")!;
    expect(hitMechanics(at("", path[Math.floor(path.length / 2)]!), state)).toBe("spring1");
    expect(hitMechanics(at("", [7, 7]), state)).toBe("spring1:b");
    const rope = click(click(initMechanics({ objects: [] }), "rope", [1, 2]), "rope", [9, 2]);
    expect(hitMechanics(at("", [5, 2]), rope)).toBe("rope1");
    expect(hitMechanics(at("", [1, 2]), rope)).toBe("rope1:a");
  });

  it("기구 연결점의 자석은 Alt·자기 제외·숨김을 반영한다", () => {
    const state = initMechanics({ objects: [support, pulley] });
    expect(snapMechanics(at("", [8, 8]), state)).toMatchObject({ kind: "point", id: "pulley" });
    expect(snapMechanics(at("", [2, 7]), state)).toMatchObject({ kind: "point", id: "support" });
    expect(snapMechanics(at("", [8, 8], true), state)).toBeUndefined();
    expect(snapMechanics({ ...at("", [8, 8]), exclude: "pulley:radius" }, state)).toBeUndefined();
    const hidden = initMechanics({ objects: [{ ...pulley, show: false }] });
    expect(snapMechanics(at("", [8, 8]), hidden)).toBeUndefined();
    expect(hitMechanics(at("", [8, 7]), hidden)).toBeNull();
  });

  it("가로로 늘어난 도르래 바깥을 짧은 반지름의 거리로 오인하지 않는다", () => {
    const state = initMechanics({ objects: [{ id: "wheel", type: "pulley", center: [5, 5], radius: 2 }] });
    const stretched = { frame: { x: 0, y: 0, w: 1000, h: 10 }, view: { ...ctx.view, stretch: true } };
    expect(hitMechanics({ ...stretched, x_mm: 750, y_mm: 5 }, state)).toBeNull();
    expect(hitMechanics({ ...stretched, x_mm: 600, y_mm: 5 }, state)).toBe("wheel");
  });
});
