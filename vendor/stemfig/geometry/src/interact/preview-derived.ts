/**
 * 파생 직선·원 ghost. spec 을 쓰지 않는다.
 * 평행·수선은 경로 스냅 뒤 clip. 이등분·세 점은 2클릭 뒤.
 */
import { DEFAULT_STYLE, type DisplayItem } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import { clipLineToFrame, compileMathCircle } from "../compile-path.ts";
import { circumcircleOf, incircleOf } from "../derived-circle.ts";
import { bisectorDir, parallelDir, perpDir } from "../derived-line.ts";
import type { GeometryState, Point } from "../init.ts";
import {
  ghostEnd,
  previewPoint,
  toPageAt,
  ZERO_MM,
} from "./preview-draw.ts";
import { snapGeometry } from "./snap.ts";

/**
 * 1클릭 전은 점 ghost. 1클릭 뒤는 P 지나 스냅 선에 평행·수직.
 */
export function previewThroughLine(
  ctx: PlaceCtx,
  state: GeometryState,
  tool: "parallel-line" | "perpendicular-line",
): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== tool) {
    return previewPoint(ctx, state);
  }
  const p = state.points.get(draft.from);
  if (!p) {
    return [];
  }
  const snap = snapGeometry(ctx, state);
  if (snap?.kind !== "path") {
    return [];
  }
  const obj = state.byId.get(snap.id);
  if (!obj || (obj.def[0] !== "segment" && obj.def[0] !== "line")) {
    return [];
  }
  const a = state.points.get(obj.def[1]);
  const b = state.points.get(obj.def[2]);
  if (!a || !b) {
    return [];
  }
  const dir = tool === "parallel-line" ? parallelDir(a, b) : perpDir(a, b);
  if (!dir) {
    return [];
  }
  return lineGhost(ctx, state, p, { x: p.x + dir.x, y: p.y + dir.y });
}

/**
 * 2클릭 뒤 커서(B)로 이등분선. 기본 internal.
 */
export function previewBisector(
  ctx: PlaceCtx,
  state: GeometryState,
): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== "angle-bisector" || draft.vertices.length < 2) {
    return previewPoint(ctx, state);
  }
  const a = state.points.get(draft.vertices[0]!);
  const v = state.points.get(draft.vertices[1]!);
  const end = ghostEnd(ctx, state, draft.vertices[1]!);
  if (!a || !v || !end) {
    return [];
  }
  const dir = bisectorDir(a, v, end, "internal");
  if (!dir) {
    return [];
  }
  return lineGhost(ctx, state, v, { x: v.x + dir.x, y: v.y + dir.y });
}

/**
 * 2클릭 뒤 커서로 외접·내접 미리보기.
 */
export function previewTriCircle(
  ctx: PlaceCtx,
  state: GeometryState,
  tool: "circle-three-points" | "circle-incircle",
): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== tool || draft.vertices.length < 2) {
    return previewPoint(ctx, state);
  }
  const a = state.points.get(draft.vertices[0]!);
  const b = state.points.get(draft.vertices[1]!);
  const end = ghostEnd(ctx, state, draft.vertices[1]!);
  if (!a || !b || !end) {
    return [];
  }
  const ring =
    tool === "circle-three-points"
      ? circumcircleOf(a, b, end)
      : incircleOf(a, b, end);
  if (!ring) {
    return [];
  }
  return circleGhost(ctx, state, ring.c, ring.through);
}

function lineGhost(
  ctx: PlaceCtx,
  state: GeometryState,
  a: Point,
  b: Point,
): DisplayItem[] {
  const p0 = toPageAt(ctx, state, a.x, a.y);
  const p1 = toPageAt(ctx, state, b.x, b.y);
  const clipped = clipLineToFrame(
    { x: p0[0], y: p0[1] },
    { x: p1[0], y: p1[1] },
    ctx.frame,
  );
  if (!clipped) {
    return [];
  }
  const q0: [number, number] = [clipped[0].x, clipped[0].y];
  const q1: [number, number] = [clipped[1].x, clipped[1].y];
  if (Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) < ZERO_MM) {
    return [];
  }
  return [
    {
      op: "polyline",
      points: [q0, q1],
      stroke: DEFAULT_STYLE.stroke,
      width: DEFAULT_STYLE.width,
    },
  ];
}

function circleGhost(
  ctx: PlaceCtx,
  state: GeometryState,
  c: Point,
  through: Point,
): DisplayItem[] {
  return compileMathCircle(
    c,
    through,
    (x, y) => toPageAt(ctx, state, x, y),
    DEFAULT_STYLE,
  );
}
