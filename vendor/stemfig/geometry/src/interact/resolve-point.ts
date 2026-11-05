/**
 * 클릭 → 점. place / preview 가 같은 규칙을 쓴다.
 * 꼭짓점 재사용, 경로 위면 on_path. spec.draft 는 여기서 지우기만.
 */
import { fitView } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import { pageToLocal } from "@stemfig/plugin-kit";
import { initGeometry, type GeometryState } from "../init.ts";
import { tAlongPath } from "../path-point.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextPointId } from "./ids.ts";
import { snapGeometry } from "./snap.ts";

/** 클릭의 수학 좌표와 재사용·생성 결정을 함께 보존한다. 경로 제약 해석은 geometry 내부 책임이다. */
export type Resolved = {
  id: string;
  x: number;
  y: number;
  created: boolean;
  pathId?: string;
  t?: number;
};

/**
 * 꼭짓점이면 재사용. 경로 위면 on_path (t).
 * 호스트는 kind 를 모른다. snapGeometry 만.
 */
export function resolvePoint(ctx: PlaceCtx, state: GeometryState): Resolved {
  const snap = snapGeometry(ctx, state);
  const [x, y] = clickView(ctx, state);
  if (snap?.kind === "point") {
    const pt = state.points.get(snap.id);
    return { id: snap.id, x: pt?.x ?? x, y: pt?.y ?? y, created: false };
  }
  if (snap?.kind === "path") {
    const [px, py] = pageToView(ctx, state, snap.x_mm, snap.y_mm);
    const t = tAlongPath(state, snap.id, px, py);
    return {
      id: nextPointId(state),
      x: px,
      y: py,
      created: true,
      pathId: snap.id,
      t: t ?? 0,
    };
  }
  if (snap?.kind === "feature") {
    const [px, py] = pageToView(ctx, state, snap.x_mm, snap.y_mm);
    return { id: nextPointId(state), x: px, y: py, created: true };
  }
  return { id: nextPointId(state), x, y, created: true };
}

/**
 * 새 점이면 spec 에 붙이고 init. 아니면 입력 상태.
 * @param state 클릭 전
 * @param at resolvePoint 결과
 * @returns spec 과 그걸로 init 한 상태
 */
export function liveAfter(
  state: GeometryState,
  at: Resolved,
): { spec: GeometrySpec; live: GeometryState } {
  const spec = at.created ? withResolved(state.spec, at) : state.spec;
  return { spec, live: at.created ? initGeometry(spec) : state };
}

/**
 * 자유점 또는 on_path. 이미 있는 id 는 그대로.
 */
export function withResolved(spec: GeometrySpec, at: Resolved): GeometrySpec {
  if (at.pathId !== undefined && at.t !== undefined) {
    return withOnPath(spec, at.id, at.pathId, at.t);
  }
  return withPoint(spec, at.id, at.x, at.y);
}

/**
 * 클릭 페이지 mm → 수학 view.
 */
export function clickView(
  ctx: PlaceCtx,
  _state: GeometryState,
): [number, number] {
  const [lx, ly] = pageToLocal(ctx.frame, ctx.x_mm, ctx.y_mm);
  return fitView(ctx.view, ctx.frame).fromLocal(lx, ly);
}

/**
 * 스냅 발 페이지 mm → 수학 view.
 */
function pageToView(
  ctx: PlaceCtx,
  _state: GeometryState,
  x_mm: number,
  y_mm: number,
): [number, number] {
  const [lx, ly] = pageToLocal(ctx.frame, x_mm, y_mm);
  return fitView(ctx.view, ctx.frame).fromLocal(lx, ly);
}

/**
 * draft 만 뺀다. 객체는 그대로.
 */
export function clearDraft(spec: GeometrySpec): GeometrySpec {
  if (!spec.draft) {
    return spec;
  }
  const { draft: _draft, ...rest } = spec;
  return rest;
}

function withPoint(
  spec: GeometrySpec,
  id: string,
  x: number,
  y: number,
): GeometrySpec {
  if (spec.objects.some((obj) => obj.id === id)) {
    return spec;
  }
  return {
    ...spec,
    objects: [...spec.objects, { id, def: ["point", x, y], label: id }],
  };
}

function withOnPath(
  spec: GeometrySpec,
  id: string,
  pathId: string,
  t: number,
): GeometrySpec {
  if (spec.objects.some((obj) => obj.id === id)) {
    return spec;
  }
  return {
    ...spec,
    objects: [...spec.objects, { id, def: ["on_path", pathId, t], label: id }],
  };
}
