/**
 * preview 공용 ghost. spec 을 쓰지 않는다.
 * 페이지 mm. 호스트·앱은 이 모듈을 모른다.
 */
import { DEFAULT_STYLE, fitView, type DisplayItem } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import { pageToLocal, POINT_R_MM, projectView } from "@stemfig/plugin-kit";
import type { GeometryState } from "../init.ts";
import { snapGeometry } from "./snap.ts";

/** 페이지 mm. 시작=끝이면 고무줄이 점이다. */
export const ZERO_MM = 1e-6;

/**
 * 새 점이 생길 자리만. 꼭짓점 재사용이면 숨긴다. 경로 위는 발에 그린다.
 */
export function previewPoint(ctx: PlaceCtx, state: GeometryState): DisplayItem[] {
  const snap = snapGeometry(ctx, state);
  if (snap?.kind === "point") {
    return [];
  }
  if (snap?.kind === "path" || snap?.kind === "feature") {
    return [ghostCircle(snap.x_mm, snap.y_mm)];
  }
  const [cx, cy] = toPageAt(ctx, state, ...clickView(ctx, state));
  return [ghostCircle(cx, cy)];
}

/**
 * @param points 페이지 mm
 */
export function ghostPolyline(points: [number, number][]): DisplayItem {
  return {
    op: "polyline",
    points,
    stroke: DEFAULT_STYLE.stroke,
    width: DEFAULT_STYLE.width,
  };
}

/**
 * 꼭짓점·경로 발. 시작점과 같으면 숨긴다.
 * 커서를 spec 에 넣지 말 것.
 */
export function ghostEnd(
  ctx: PlaceCtx,
  state: GeometryState,
  fromId: string,
): { x: number; y: number } | null {
  const snap = snapGeometry(ctx, state);
  if (snap?.kind === "point") {
    if (snap.id === fromId) {
      return null;
    }
    return state.points.get(snap.id) ?? null;
  }
  if (snap?.kind === "path" || snap?.kind === "feature") {
    const [lx, ly] = pageToLocal(ctx.frame, snap.x_mm, snap.y_mm);
    const [x, y] = fitView(ctx.view, ctx.frame).fromLocal(lx, ly);
    return { x, y };
  }
  const [x, y] = clickView(ctx, state);
  return { x, y };
}

/**
 * 클릭 페이지 mm → view.
 */
export function clickView(ctx: PlaceCtx, _state: GeometryState): [number, number] {
  const [lx, ly] = pageToLocal(ctx.frame, ctx.x_mm, ctx.y_mm);
  return fitView(ctx.view, ctx.frame).fromLocal(lx, ly);
}

/**
 * view → 페이지 mm. place 와 같은 원점.
 */
export function toPageAt(
  ctx: PlaceCtx,
  _state: GeometryState,
  x: number,
  y: number,
): [number, number] {
  const { toPage } = projectView(
    {
      frame: ctx.frame,
      mmToPage: (lx, ly) => [ctx.frame.x + lx, ctx.frame.y + ly],
    },
    ctx.view,
  );
  return toPage(x, y);
}

/**
 * 점 id → 페이지 mm.
 */
export function pagePt(
  ctx: PlaceCtx,
  state: GeometryState,
  id: string,
): { x: number; y: number } | undefined {
  const pt = state.points.get(id);
  if (!pt) {
    return undefined;
  }
  const [x, y] = toPageAt(ctx, state, pt.x, pt.y);
  return { x, y };
}

/**
 * @param cx 페이지 mm
 * @param cy 페이지 mm
 */
export function ghostCircle(cx: number, cy: number): DisplayItem {
  return {
    op: "circle",
    cx,
    cy,
    r: POINT_R_MM,
    stroke: DEFAULT_STYLE.stroke,
    fill: DEFAULT_STYLE.stroke,
    width: DEFAULT_STYLE.width,
  };
}
