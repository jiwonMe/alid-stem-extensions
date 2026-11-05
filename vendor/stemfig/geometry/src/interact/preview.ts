/**
 * 도구 커서 ghost.
 * 점은 커서 원. 선분·직선은 1클릭 뒤 고무줄. 원은 중심→원주.
 * 다각형은 vertices+커서. 내분점은 from–커서 1:1. 교점은 후보 점, 수선은 발.
 * spec 을 쓰지 않는다. 호스트 transact / undo 금지.
 * 좌표는 place 와 같은 페이지 mm → view. @grida/* 금지.
 */
import { DEFAULT_STYLE, type DisplayItem } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import { compileMathCircle } from "../compile-path.ts";
import type { GeometryState } from "../init.ts";
import { listIntersections, nearestIntersection, pathGeomOf } from "../intersect.ts";
import { projectPoint } from "../project.ts";
import { previewAngle, previewMark } from "./preview-annot.ts";
import {
  previewBisector,
  previewThroughLine,
  previewTriCircle,
} from "./preview-derived.ts";
import {
  clickView,
  ghostCircle,
  ghostEnd,
  ghostPolyline,
  previewPoint,
  toPageAt,
  ZERO_MM,
} from "./preview-draw.ts";
import { snapGeometry } from "./snap.ts";

const POINT_TOOL = "point";
const SEGMENT_TOOL = "segment";
const LINE_TOOL = "line";
const CIRCLE_TOOL = "circle";
const POLYGON_TOOL = "polygon";
const DIVISION_TOOL = "division";
const INTERSECTION_TOOL = "intersection";
const PERPENDICULAR_TOOL = "perpendicular";
const ANGLE_TOOL = "angle-annotation";
const MARK_TOOL = "segment-annotation";
const PARALLEL_TOOL = "parallel-line";
const PERP_LINE_TOOL = "perpendicular-line";
const BISECTOR_TOOL = "angle-bisector";
const CIRCUM_TOOL = "circle-three-points";
const IN_TOOL = "circle-incircle";

/**
 * 점: 빈 곳·경로 위는 원. 기존 꼭짓점이면 재사용이라 숨긴다.
 * 선분: draft 없으면 점과 같고, 있으면 from → 커서.
 * 원: draft 없으면 점과 같고, 있으면 중심에서 커서까지 반지름.
 * @param ctx place 와 동일. tool + 페이지 mm
 * @returns 페이지 mm DisplayItem. 이 tool 은 미리보기 없으면 undefined
 */
export function previewGeometry(
  ctx: PlaceCtx,
  state: GeometryState,
): DisplayItem[] | undefined {
  if (ctx.tool === POINT_TOOL) {
    return previewPoint(ctx, state);
  }
  if (ctx.tool === SEGMENT_TOOL || ctx.tool === LINE_TOOL) {
    return previewSegment(ctx, state, ctx.tool);
  }
  if (ctx.tool === CIRCLE_TOOL) {
    return previewCircle(ctx, state);
  }
  if (ctx.tool === POLYGON_TOOL) {
    return previewPolygon(ctx, state);
  }
  if (ctx.tool === DIVISION_TOOL) {
    return previewDivision(ctx, state);
  }
  if (ctx.tool === INTERSECTION_TOOL) {
    return previewIntersect(ctx, state);
  }
  if (ctx.tool === PERPENDICULAR_TOOL) {
    return previewProjection(ctx, state);
  }
  if (ctx.tool === ANGLE_TOOL) {
    return previewAngle(ctx, state);
  }
  if (ctx.tool === MARK_TOOL) {
    return previewMark(ctx, state);
  }
  if (ctx.tool === PARALLEL_TOOL || ctx.tool === PERP_LINE_TOOL) {
    return previewThroughLine(ctx, state, ctx.tool);
  }
  if (ctx.tool === BISECTOR_TOOL) {
    return previewBisector(ctx, state);
  }
  if (ctx.tool === CIRCUM_TOOL || ctx.tool === IN_TOOL) {
    return previewTriCircle(ctx, state, ctx.tool);
  }
  return undefined;
}

/**
 * 1클릭 전은 점 ghost. 1클릭 뒤는 고무줄 + 끝점.
 */
function previewSegment(
  ctx: PlaceCtx,
  state: GeometryState,
  tool: "segment" | "line",
): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== tool) {
    return previewPoint(ctx, state);
  }
  const from = state.points.get(draft.from);
  if (!from) {
    return [];
  }
  const end = ghostEnd(ctx, state, draft.from);
  if (!end) {
    return [];
  }
  const [x1, y1] = toPageAt(ctx, state, from.x, from.y);
  const [x2, y2] = toPageAt(ctx, state, end.x, end.y);
  if (Math.hypot(x2 - x1, y2 - y1) < ZERO_MM) {
    return [];
  }
  return [
    {
      op: "polyline",
      points: [
        [x1, y1],
        [x2, y2],
      ],
      stroke: DEFAULT_STYLE.stroke,
      width: DEFAULT_STYLE.width,
    },
    ghostCircle(x2, y2),
  ];
}

/**
 * 1클릭 전은 점 ghost. 1클릭 뒤는 원 + 원주 점.
 */
function previewCircle(ctx: PlaceCtx, state: GeometryState): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== CIRCLE_TOOL) {
    return previewPoint(ctx, state);
  }
  const from = state.points.get(draft.from);
  if (!from) {
    return [];
  }
  const end = ghostEnd(ctx, state, draft.from);
  if (!end) {
    return [];
  }
  const [x2, y2] = toPageAt(ctx, state, end.x, end.y);
  const ring = compileMathCircle(
    from,
    end,
    (x, y) => toPageAt(ctx, state, x, y),
    DEFAULT_STYLE,
  );
  if (ring.length === 0) {
    return [];
  }
  return [...ring, ghostCircle(x2, y2)];
}

/**
 * vertices 를 잇고 커서까지. 첫 점 위고 3점 이상이면 닫힌 미리보기.
 */
function previewPolygon(ctx: PlaceCtx, state: GeometryState): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== POLYGON_TOOL) {
    return previewPoint(ctx, state);
  }
  const pagePts: [number, number][] = [];
  for (const id of draft.vertices) {
    const pt = state.points.get(id);
    if (!pt) {
      return [];
    }
    pagePts.push(toPageAt(ctx, state, pt.x, pt.y));
  }
  const first = draft.vertices[0];
  const snap = snapGeometry(ctx, state);
  const closing = Boolean(
    first &&
      draft.vertices.length >= 3 &&
      snap?.kind === "point" &&
      snap.id === first,
  );
  if (closing && first) {
    const start = state.points.get(first);
    if (start) {
      pagePts.push(toPageAt(ctx, state, start.x, start.y));
    }
    return [ghostPolyline(pagePts)];
  }
  const end = ghostEnd(ctx, state, draft.vertices[draft.vertices.length - 1]!);
  if (!end) {
    return pagePts.length >= 2 ? [ghostPolyline(pagePts)] : [];
  }
  const tip = toPageAt(ctx, state, end.x, end.y);
  pagePts.push(tip);
  if (pagePts.length < 2) {
    return [ghostCircle(tip[0], tip[1])];
  }
  return [ghostPolyline(pagePts), ghostCircle(tip[0], tip[1])];
}

/**
 * 1클릭 전은 점 ghost. 1클릭 뒤는 from–커서 1:1 내분.
 */
function previewDivision(ctx: PlaceCtx, state: GeometryState): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== DIVISION_TOOL) {
    return previewPoint(ctx, state);
  }
  const from = state.points.get(draft.from);
  if (!from) {
    return [];
  }
  const end = ghostEnd(ctx, state, draft.from);
  if (!end) {
    return [];
  }
  const [x, y] = toPageAt(
    ctx,
    state,
    (from.x + end.x) / 2,
    (from.y + end.y) / 2,
  );
  return [ghostCircle(x, y)];
}

/**
 * 1클릭 전은 점 ghost. 1클릭 뒤는 커서에 가까운 교점.
 */
function previewIntersect(ctx: PlaceCtx, state: GeometryState): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== INTERSECTION_TOOL) {
    return previewPoint(ctx, state);
  }
  const [x, y] = clickView(ctx, state);
  const from = pathGeomOf(state.byId.get(draft.path)!, state.points);
  const snap = snapGeometry(ctx, state);
  if (from && snap?.kind === "path" && snap.id !== draft.path) {
    const other = pathGeomOf(state.byId.get(snap.id)!, state.points);
    const hits = other ? listIntersections(from, other) : null;
    const hit = hits?.reduce((best, item) => {
      const d = Math.hypot(item.x - x, item.y - y);
      const bd = Math.hypot(best.x - x, best.y - y);
      return d < bd ? item : best;
    });
    if (hit) {
      return [ghostCircle(...toPageAt(ctx, state, hit.x, hit.y))];
    }
  }
  const near = nearestIntersection(state.spec.objects, state.points, x, y);
  if (!near) {
    return [];
  }
  return [ghostCircle(...toPageAt(ctx, state, near.point.x, near.point.y))];
}

/**
 * 1클릭 전은 점 ghost. 1클릭 뒤는 선분·직선 위 발.
 */
function previewProjection(ctx: PlaceCtx, state: GeometryState): DisplayItem[] {
  const draft = state.spec.draft;
  if (!draft || draft.tool !== PERPENDICULAR_TOOL) {
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
  const foot = projectPoint(p, a, b);
  if (!foot) {
    return [];
  }
  return [ghostCircle(...toPageAt(ctx, state, foot.x, foot.y))];
}
