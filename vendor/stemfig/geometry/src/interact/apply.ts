/**
 * 자유점은 x,y. 경로점은 t. 중점은 pointRole.drag 가 꺼져 apply 가 그대로.
 * 선분/직선/원 손잡이는 양 끝 자유점을 같이 민다.
 * frame 은 ApplyCtx. spec 에 frame 을 넣지 말 것.
 */
import type { ApplyCtx, HandlePatch } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { pathOf } from "../path-of.ts";
import { clampT } from "../path.ts";
import { tAlongPath } from "../path-point.ts";
import type { GeometrySpec } from "../schema.ts";
import { applyLabelPose } from "./apply-label.ts";
import { isMovablePair } from "./free.ts";
import { applyPathHandle } from "./path-ctrl.ts";
import { viewDelta } from "./view-map.ts";

/**
 * 자유점은 x,y. on_path 는 의도 위치를 자기 경로에 투영해 t 만.
 * A:label 은 각·거리. k:label 은 변 거리·좌우. 점은 안 옮긴다.
 * @returns 새 상태. 원본 spec 을 변이하지 않는다.
 * 모르는 id · 중점만 있으면 입력을 그대로.
 */
export function applyGeometry(
  ctx: ApplyCtx,
  state: GeometryState,
  patch: HandlePatch,
): GeometryState {
  const posed = applyLabelPose(ctx, state, patch);
  if (posed) {
    return posed;
  }
  const moved = applyPathHandle(ctx, state, patch);
  if (moved) {
    return moved;
  }
  const obj = state.byId.get(patch.id);
  if (!obj) {
    return state;
  }
  if (obj.def[0] === "on_path") {
    return slideOnPath(ctx, state, patch);
  }
  const ids = targetPointIds(state, obj.id);
  if (ids.length === 0) {
    return state;
  }
  const delta = viewDelta(ctx.view, ctx.frame, patch.dx_mm, patch.dy_mm);
  return initGeometry(movePoints(state.spec, ids, delta.x, delta.y));
}

/**
 * 의도 좌표를 자기 경로에 투영한다. 경로를 벗어나면 t 만 끝으로.
 */
function slideOnPath(
  ctx: ApplyCtx,
  state: GeometryState,
  patch: HandlePatch,
): GeometryState {
  const obj = state.byId.get(patch.id);
  if (!obj || obj.def[0] !== "on_path") {
    return state;
  }
  const cur = state.points.get(obj.id);
  if (!cur) {
    return state;
  }
  const delta = viewDelta(ctx.view, ctx.frame, patch.dx_mm, patch.dy_mm);
  const t = tAlongPath(state, obj.def[1], cur.x + delta.x, cur.y + delta.y);
  if (t === undefined) {
    return state;
  }
  const parent = state.byId.get(obj.def[1]);
  const path = parent ? pathOf(parent, state.points) : undefined;
  const next = path ? clampT(path, t) : t;
  return initGeometry(setOnPathT(state.spec, obj.id, next));
}

function setOnPathT(
  spec: GeometrySpec,
  id: string,
  t: number,
): GeometrySpec {
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id && obj.def[0] === "on_path"
        ? { ...obj, def: ["on_path", obj.def[1], t] }
        : obj,
    ),
  };
}

function targetPointIds(state: GeometryState, id: string): string[] {
  const obj = state.byId.get(id);
  if (!obj) {
    return [];
  }
  if (obj.def[0] === "point") {
    return [obj.id];
  }
  /* 파생 직선·원은 target 이 비다. P/A/B 역전파는 Phase 7. */
  if (
    obj.def[0] === "segment" ||
    obj.def[0] === "line" ||
    obj.def[0] === "circle"
  ) {
    /* 한쪽만 밀면 반지름·선분이 깨진다. 양 끝 자유점일 때만. */
    if (!isMovablePair(state, obj.def[1], obj.def[2], null)) {
      return [];
    }
    return [obj.def[1], obj.def[2]];
  }
  return [];
}

function movePoints(
  spec: GeometrySpec,
  ids: string[],
  dx: number,
  dy: number,
): GeometrySpec {
  const want = new Set(ids);
  return {
    ...spec,
    objects: spec.objects.map((obj) => {
      if (!want.has(obj.id) || obj.def[0] !== "point") {
        return obj;
      }
      return {
        ...obj,
        def: ["point", obj.def[1] + dx, obj.def[2] + dy],
      };
    }),
  };
}
