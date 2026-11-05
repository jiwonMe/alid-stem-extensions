/**
 * 도구 클릭 → spec.
 * 점은 한 번. 선분·직선·원·내분·교점·수선·평행·수선직선·변 마크는 두 번(draft).
 * 다각형은 vertices. 각·이등분·세 점 원은 vertices.
 * 페이지 mm → view 는 hit 과 같은 fitView.fromLocal.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { placeDivision } from "./place-division.ts";
import { placeIntersect } from "./place-intersect.ts";
import { placePair } from "./place-pair.ts";
import { placePolygon } from "./place-polygon.ts";
import { placeAngle } from "./place-angle.ts";
import { placeMark } from "./place-mark.ts";
import { placeProjection } from "./place-projection.ts";
import { placeThroughLine } from "./place-through-line.ts";
import { placeBisector } from "./place-bisector.ts";
import { placeTriCircle } from "./place-tri-circle.ts";
import { placeCurve } from "./place-curve.ts";
import { clearDraft, resolvePoint, withResolved } from "./resolve-point.ts";

/**
 * @param ctx 페이지 mm 클릭과 tools[].id
 * @returns 새 상태와 손잡이 id. 모르는 tool 이면 undefined
 */
export function placeGeometry(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> | undefined {
  if (ctx.tool === "point") {
    return placePoint(ctx, state);
  }
  if (ctx.tool === "segment" || ctx.tool === "circle" || ctx.tool === "line") {
    return placePair(ctx, state, ctx.tool);
  }
  if (ctx.tool === "polygon") {
    return placePolygon(ctx, state);
  }
  if (ctx.tool === "division") {
    return placeDivision(ctx, state);
  }
  if (ctx.tool === "intersection") {
    return placeIntersect(ctx, state);
  }
  if (ctx.tool === "perpendicular") {
    return placeProjection(ctx, state);
  }
  if (ctx.tool === "angle-annotation") {
    return placeAngle(ctx, state);
  }
  if (ctx.tool === "segment-annotation") {
    return placeMark(ctx, state);
  }
  if (ctx.tool === "parallel-line" || ctx.tool === "perpendicular-line") {
    return placeThroughLine(ctx, state, ctx.tool);
  }
  if (ctx.tool === "angle-bisector") {
    return placeBisector(ctx, state);
  }
  if (ctx.tool === "circle-three-points" || ctx.tool === "circle-incircle") {
    return placeTriCircle(ctx, state, ctx.tool);
  }
  if (ctx.tool === "graph" || ctx.tool === "path") {
    return placeCurve(ctx, state);
  }
  return undefined;
}

/**
 * 빈 곳에 자유점 하나. draft 가 남아 있으면 지운다.
 */
function placePoint(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const at = resolvePoint(ctx, state);
  const spec = at.created
    ? withResolved(clearDraft(state.spec), at)
    : clearDraft(state.spec);
  return {
    state: initGeometry(spec),
    handles: [at.id],
  };
}
