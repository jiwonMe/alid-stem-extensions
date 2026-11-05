/**
 * 점·경로·feature 자석. 파생점도 꼭짓점이다. 드래그 손잡이는 아니다.
 * feature 는 교차·선분 중점·원 중심. id 없음. 호스트는 뜻을 모른다.
 * path 는 pathGeomOf 선·원(파생 포함). spec 을 쓰지 않는다. HUD 크롬 금지.
 */
import { fitView } from "@stemfig/display";
import type { SnapCtx, SnapHit } from "@stemfig/host";
import {
  closestOnCircle,
  closestOnPath,
  pageToLocal,
  projectView,
  snapRadiusMm,
  snapVertexRadiusMm,
  type PathCircle,
  type PathSeg,
  type PathSnap,
} from "@stemfig/plugin-kit";
import { curvePolylines } from "../compile-curve.ts";
import type { GeometryState } from "../init.ts";
import { listFeatures, pathGeomOf } from "../intersect.ts";
import { isCurveEdge, type GeoDef } from "../schema.ts";
import { snapFreePoint } from "./hit.ts";

/**
 * 꼭짓점 우선, 그다음 경로 위 발.
 * exclude 가 끝인 선분·원의 중심/원주점은 빼다. 자기 경로에 붙으면 못 벗어난다.
 * unsnap 이면 자석을 끈다. Alt. 좌표는 호출 측이 그대로 쓴다.
 * 꼭짓점은 SNAP_VERTEX_PX, 경로는 SNAP_PATH_PX. 중점이 선분에 지지 않게.
 * @returns 페이지 mm. 없으면 undefined
 */
export function snapGeometry(
  ctx: SnapCtx,
  state: GeometryState,
): SnapHit | undefined {
  if (ctx.unsnap) {
    return undefined;
  }
  const exclude = ctx.exclude ?? null;
  const vertexR = snapVertexRadiusMm(ctx.px_per_mm);
  const pathR = snapRadiusMm(ctx.px_per_mm);
  const vertex = snapVertex(ctx, state, exclude, vertexR);
  if (vertex) {
    return vertex;
  }
  const feature = snapFeature(ctx, state, exclude, vertexR);
  if (feature) {
    return feature;
  }
  return snapOnPath(ctx, state, exclude, pathR, vertexR);
}

/**
 * 교차·선분 중점·원 중심. id 없는 feature. 꼭짓점보다 뒤에, 경로보다 앞.
 * 드래그 중인 점과 같은 자리 교차는 빼다. 자기 발에 붙으면 못 벗어난다.
 */
function snapFeature(
  ctx: SnapCtx,
  state: GeometryState,
  exclude: string | null,
  maxD: number,
): SnapHit | undefined {
  const skip = exclude ? state.points.get(exclude) : undefined;
  let best: { x_mm: number; y_mm: number; d: number } | undefined;
  for (const pt of listFeatures(state.spec.objects, state.points)) {
    if (
      skip &&
      Math.hypot(pt.x - skip.x, pt.y - skip.y) < 1e-9
    ) {
      continue;
    }
    const [x_mm, y_mm] = toPage(ctx, state, pt.x, pt.y);
    const d = Math.hypot(x_mm - ctx.x_mm, y_mm - ctx.y_mm);
    if (d > maxD) {
      continue;
    }
    if (!best || d < best.d) {
      best = { x_mm, y_mm, d };
    }
  }
  return best
    ? { kind: "feature", x_mm: best.x_mm, y_mm: best.y_mm }
    : undefined;
}

function snapVertex(
  ctx: SnapCtx,
  state: GeometryState,
  exclude: string | null,
  maxD: number,
): SnapHit | undefined {
  const id = snapFreePoint(
    state,
    ctx.frame,
    ctx.view,
    ctx.x_mm,
    ctx.y_mm,
    exclude,
    maxD,
  );
  return id ? pointSnap(ctx, state, id) : undefined;
}

/**
 * 점의 실제 좌표. 커서 mm 을 쓰지 않는다.
 */
function pointSnap(
  ctx: SnapCtx,
  state: GeometryState,
  id: string,
): SnapHit | undefined {
  const pt = state.points.get(id);
  if (!pt) {
    return undefined;
  }
  const [x_mm, y_mm] = toPage(ctx, state, pt.x, pt.y);
  return { kind: "point", id, x_mm, y_mm };
}

/**
 * 발 좌표가 꼭짓점이면 point 로 되돌린다. place 가 점을 겹쳐 만들지 않게.
 */
function snapOnPath(
  ctx: SnapCtx,
  state: GeometryState,
  exclude: string | null,
  pathR: number,
  vertexR: number,
): SnapHit | undefined {
  const { toLocal } = fitView(ctx.view, ctx.frame);
  const local = pageToLocal(ctx.frame, ctx.x_mm, ctx.y_mm);
  const hit = nearer(
    closestOnPath(local, pathSegs(state, ctx, toLocal, exclude), pathR),
    closestOnCircle(local, pathRings(state, toLocal, exclude), pathR),
  );
  if (!hit) {
    return undefined;
  }
  const x_mm = ctx.frame.x + hit.x;
  const y_mm = ctx.frame.y + hit.y;
  /* 발·커서 둘 다 본다. 선분 위여도 가까운 중점이 이긴다. */
  const atFoot = snapFreePoint(
    state,
    ctx.frame,
    ctx.view,
    x_mm,
    y_mm,
    exclude,
    vertexR,
  );
  const atCursor = snapFreePoint(
    state,
    ctx.frame,
    ctx.view,
    ctx.x_mm,
    ctx.y_mm,
    exclude,
    vertexR,
  );
  const onVertex = atFoot ?? atCursor;
  if (onVertex) {
    return pointSnap(ctx, state, onVertex);
  }
  return { kind: "path", id: hit.id, x_mm, y_mm };
}

function pathSegs(
  state: GeometryState,
  ctx: SnapCtx,
  toLocal: (x: number, y: number) => [number, number],
  exclude: string | null,
): PathSeg[] {
  const out: PathSeg[] = [];
  for (const obj of state.spec.objects) {
    if (isCurveEdge(obj.def[0])) {
      for (const part of curvePolylines(obj, state.points, ctx.view, ctx.frame)) {
        for (let i = 1; i < part.length; i += 1) {
          const a = part[i - 1]!;
          const b = part[i]!;
          out.push({
            id: obj.id,
            a: toLocal(a.x, a.y),
            b: toLocal(b.x, b.y),
          });
        }
      }
      continue;
    }
    const geom = pathGeomOf(obj, state.points);
    if (!geom || geom.kind !== "line" || skipsExclude(obj, exclude)) {
      continue;
    }
    out.push({
      id: obj.id,
      a: toLocal(geom.a.x, geom.a.y),
      b: toLocal(geom.b.x, geom.b.y),
      unbound: !geom.bound,
    });
  }
  return out;
}

/**
 * 자기 둘레에 붙으면 못 벗어난다. pathGeom 원이면 파생 원도 넣는다.
 */
function pathRings(
  state: GeometryState,
  toLocal: (x: number, y: number) => [number, number],
  exclude: string | null,
): PathCircle[] {
  const out: PathCircle[] = [];
  for (const obj of state.spec.objects) {
    const geom = pathGeomOf(obj, state.points);
    if (!geom || geom.kind !== "circle" || skipsExclude(obj, exclude)) {
      continue;
    }
    const [cx, cy] = toLocal(geom.c.x, geom.c.y);
    const [tx, ty] = toLocal(geom.through.x, geom.through.y);
    out.push({
      id: obj.id,
      c: [cx, cy],
      r: Math.hypot(tx - cx, ty - cy),
    });
  }
  return out;
}

/**
 * 끝점·원심·원주·파생 기준점을 끌 때 자기 경로는 빼다.
 */
function skipsExclude(obj: GeoDef, exclude: string | null): boolean {
  if (!exclude) {
    return false;
  }
  const head = obj.def[0];
  if (head === "segment" || head === "line" || head === "circle") {
    return obj.def[1] === exclude || obj.def[2] === exclude;
  }
  if (head === "parallel_line" || head === "perp_line") {
    return obj.def[1] === exclude;
  }
  if (head === "bisector") {
    return obj.def[2] === exclude;
  }
  if (head === "circumcircle") {
    return (
      obj.def[1] === exclude ||
      obj.def[2] === exclude ||
      obj.def[3] === exclude
    );
  }
  return false;
}

function nearer(a: PathSnap | null, b: PathSnap | null): PathSnap | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return a.d <= b.d ? a : b;
}

function toPage(
  ctx: SnapCtx,
  _state: GeometryState,
  x: number,
  y: number,
): [number, number] {
  const { toPage: map } = projectView(
    {
      frame: ctx.frame,
      mmToPage: (lx, ly) => [ctx.frame.x + lx, ctx.frame.y + ly],
    },
    ctx.view,
  );
  return map(x, y);
}
