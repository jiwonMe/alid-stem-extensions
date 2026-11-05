/**
 * 각·변 마크 ghost. objects 가 아니다.
 * 각은 2클릭 뒤 겹호. 변은 1클릭 뒤 다른 끝점 위 틱.
 */
import type { DisplayItem } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import type { GeometryState } from "../init.ts";
import { equalArcs, segmentTicks } from "../mark-geom.ts";
import {
  ghostEnd,
  ghostPolyline,
  pagePt,
  previewPoint,
  toPageAt,
} from "./preview-draw.ts";
import { snapGeometry } from "./snap.ts";

/**
 * 2클릭 뒤 커서(세 번째 점)로 겹호. 1클릭 전은 점과 같음.
 */
export function previewAngle(
  ctx: PlaceCtx,
  state: GeometryState,
): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== "angle-annotation" || draft.vertices.length < 2) {
    return previewPoint(ctx, state);
  }
  const a = pagePt(ctx, state, draft.vertices[0]!);
  const v = pagePt(ctx, state, draft.vertices[1]!);
  const end = ghostEnd(ctx, state, draft.vertices[1]!);
  if (!a || !v || !end) {
    return [];
  }
  const [bx, by] = toPageAt(ctx, state, end.x, end.y);
  const arcs = equalArcs(v, a, { x: bx, y: by }, 1);
  if (!arcs?.[0]) {
    return [];
  }
  return [ghostPolyline(arcs[0].map((p) => [p.x, p.y]))];
}

/**
 * 1클릭 전은 점 ghost. 1클릭 뒤 다른 점 위면 틱.
 * segment 객체는 보지 않는다.
 */
export function previewMark(
  ctx: PlaceCtx,
  state: GeometryState,
): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== "segment-annotation") {
    return previewPoint(ctx, state);
  }
  const snap = snapGeometry(ctx, state);
  if (snap?.kind !== "point" || snap.id === draft.from) {
    return [];
  }
  const a = pagePt(ctx, state, draft.from);
  const b = pagePt(ctx, state, snap.id);
  if (!a || !b) {
    return [];
  }
  const ticks = segmentTicks(a, b, 1);
  if (!ticks?.[0]) {
    return [];
  }
  return [ghostPolyline(ticks[0].map((p) => [p.x, p.y]))];
}
