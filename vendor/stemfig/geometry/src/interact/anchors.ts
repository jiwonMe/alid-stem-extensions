/**
 * HUD 용 페이지 mm. 점/선분 + 주석 글리프. bbox 를 만들지 않는다.
 */
import type { Frame } from "@stemfig/display";
import { projectView } from "@stemfig/plugin-kit";
import type { AnchorsCtx, HandleAnchor } from "@stemfig/host";
import { curvePolylines } from "../compile-curve.ts";
import { clipLineToFrame, projectMathCircle } from "../compile-path.ts";
import { pathGeomOf } from "../intersect.ts";
import { isCurveEdge, isDerivedEdge, isShown } from "../schema.ts";
import { labelAnchor } from "../label-pos.ts";
import { annotAnchors } from "./anchors-annot.ts";
import { isSegHandle, pointRole } from "./free.ts";
import type { GeometryState } from "../init.ts";
import { pathCtrlAnchors } from "./path-ctrl.ts";

/**
 * pointRole.hover 인 점은 point. 양 끝이 hover 인 선분은 line.
 * 중점은 handles 밖이어도 올린다. 무한직선은 끝점 잠금과 무관.
 * 점 라벨은 A:label text. owner 는 점.
 * show: false 면 글자만 빼다. 마크 HUD 는 남긴다.
 * @returns 페이지 mm. 점 손잡이 허용 밖은 빼다. 중점은 보임만.
 */
export function anchorsGeometry(
  ctx: AnchorsCtx,
  state: GeometryState,
): HandleAnchor[] {
  const { toPage } = projectView(ctx, ctx.view);
  const allowed = ctx.handles ? new Set(ctx.handles) : null;
  const out: HandleAnchor[] = [];

  for (const obj of state.spec.objects) {
    if (pointRole(state, obj.id, allowed).hover) {
      const pt = state.points.get(obj.id);
      if (!pt) {
        continue;
      }
      const [x_mm, y_mm] = toPage(pt.x, pt.y);
      out.push({ id: obj.id, kind: "point", x_mm, y_mm });
      /* 숨긴 점 hover 는 흰 원만. 글자 짝을 올리면 HUD 가 라벨을 켠다. */
      if (isShown(obj)) {
        const text = labelAnchor(obj, x_mm, y_mm, obj.labelSize ?? ctx.style.textSize);
        if (text) {
          out.push(text);
        }
      }
      continue;
    }
    if (isDerivedEdge(obj.def[0])) {
      const derived = derivedAnchor(obj, state, ctx.frame, toPage);
      if (derived) {
        out.push(derived);
      }
      continue;
    }
    if (obj.def[0] === "line") {
      const infinite = infiniteLineAnchor(obj, state, ctx.frame, toPage);
      if (infinite) {
        out.push(infinite);
      }
      continue;
    }
    if (isCurveEdge(obj.def[0])) {
      const parts = curvePolylines(obj, state.points, ctx.view, ctx.frame);
      const pts = parts.flatMap((part) => part.map((p) => toPage(p.x, p.y)));
      if (pts.length >= 2) {
        out.push({ id: obj.id, kind: "polyline", points: pts });
      }
      continue;
    }
    if (obj.def[0] !== "segment") {
      continue;
    }
    if (!isSegHandle(state, obj.def[1], obj.def[2], allowed)) {
      continue;
    }
    const a = state.points.get(obj.def[1]);
    const b = state.points.get(obj.def[2]);
    if (!a || !b) {
      continue;
    }
    const [x1, y1] = toPage(a.x, a.y);
    const [x2, y2] = toPage(b.x, b.y);
    out.push({ id: obj.id, kind: "line", x1_mm: x1, y1_mm: y1, x2_mm: x2, y2_mm: y2 });
  }
  out.push(...annotAnchors(ctx, state));
  out.push(...pathCtrlAnchors(state, toPage));
  return out;
}

/**
 * pathGeom → line 또는 circle. 끌리지 않음. handles 잠금 없음.
 */
function derivedAnchor(
  obj: GeometryState["spec"]["objects"][number],
  state: GeometryState,
  frame: Frame,
  toPage: (x: number, y: number) => [number, number],
): HandleAnchor | undefined {
  const geom = pathGeomOf(obj, state.points);
  if (!geom) {
    return undefined;
  }
  if (geom.kind === "circle") {
    const ring = projectMathCircle(geom.c, geom.through, toPage);
    if (!ring) {
      return undefined;
    }
    if (Math.abs(ring.rx - ring.ry) <= 1e-6 * Math.max(1, ring.rx, ring.ry)) {
      return {
        id: obj.id,
        kind: "circle",
        cx_mm: ring.cx,
        cy_mm: ring.cy,
        r_mm: ring.rx,
      };
    }
    return {
      id: obj.id,
      kind: "ellipse",
      cx_mm: ring.cx,
      cy_mm: ring.cy,
      rx_mm: ring.rx,
      ry_mm: ring.ry,
    };
  }
  return clipInfinite(
    obj.id,
    toPage(geom.a.x, geom.a.y),
    toPage(geom.b.x, geom.b.y),
    frame,
  );
}

/**
 * 무한직선 HUD. 끝점이 파생이어도 올린다. knobs 는 끈다.
 */
function infiniteLineAnchor(
  obj: GeometryState["spec"]["objects"][number],
  state: GeometryState,
  frame: Frame,
  toPage: (x: number, y: number) => [number, number],
): HandleAnchor | undefined {
  if (obj.def[0] !== "line") {
    return undefined;
  }
  const a = state.points.get(obj.def[1]);
  const b = state.points.get(obj.def[2]);
  if (!a || !b) {
    return undefined;
  }
  return clipInfinite(obj.id, toPage(a.x, a.y), toPage(b.x, b.y), frame);
}

function clipInfinite(
  id: string,
  p0: [number, number],
  p1: [number, number],
  frame: Frame,
): HandleAnchor | undefined {
  const clipped = clipLineToFrame(
    { x: p0[0], y: p0[1] },
    { x: p1[0], y: p1[1] },
    frame,
  );
  if (!clipped) {
    return undefined;
  }
  return {
    id,
    kind: "line",
    x1_mm: clipped[0].x,
    y1_mm: clipped[0].y,
    x2_mm: clipped[1].x,
    y2_mm: clipped[1].y,
    knobs: false,
  };
}
