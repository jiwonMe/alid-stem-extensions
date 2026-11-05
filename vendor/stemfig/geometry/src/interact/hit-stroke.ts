/**
 * 선·원 스트로크 히트. 점은 hit.ts 가 먼저 본다.
 * line 은 끝점 잠금 없이 무한직선. segment·circle 은 보이는 끝.
 * 파생 EDGE 는 잠금 없이 링·무한직선.
 */
import type { Frame, View } from "@stemfig/display";
import type { HandleId } from "@stemfig/host";
import type { GeometryState } from "../init.ts";
import { pathGeomOf } from "../intersect.ts";
import { isDerivedEdge } from "../schema.ts";
import { isSegHandle } from "./free.ts";
import { curveStrokeDist } from "./hit-curve.ts";

/**
 * 선폭보다 넓게. 점보다 약하게 해서 점 근처는 점이 이긴다.
 * hit.ts 마크와 같은 값.
 */
export const HIT_SEG_MM = 1.1;

/**
 * @returns 가장 가까운 스트로크 id. 없으면 null
 */
export function nearestStroke(
  state: GeometryState,
  view: View,
  frame: Frame,
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
  allowed: Set<string> | null,
): HandleId | null {
  let best: { id: string; d: number } | null = null;
  for (const obj of state.spec.objects) {
    const d =
      curveStrokeDist(state, obj, view, frame, toLocal, local) ??
      strokeDist(state, obj, toLocal, local, allowed);
    if (d === undefined) {
      continue;
    }
    if (d <= HIT_SEG_MM && (!best || d < best.d)) {
      best = { id: obj.id, d };
    }
  }
  return best?.id ?? null;
}

function strokeDist(
  state: GeometryState,
  obj: GeometryState["spec"]["objects"][number],
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
  allowed: Set<string> | null,
): number | undefined {
  if (obj.def[0] === "line") {
    /* 끝점이 파생이어도 고른다. 손잡이 잠금은 선분에만. */
    const a = state.points.get(obj.def[1]);
    const b = state.points.get(obj.def[2]);
    if (!a || !b) {
      return undefined;
    }
    return distToLine(local, toLocal(a.x, a.y), toLocal(b.x, b.y));
  }
  if (obj.def[0] === "segment" || obj.def[0] === "circle") {
    if (!isSegHandle(state, obj.def[1], obj.def[2], allowed)) {
      return undefined;
    }
    const a = state.points.get(obj.def[1]);
    const b = state.points.get(obj.def[2]);
    if (!a || !b) {
      return undefined;
    }
    return obj.def[0] === "circle"
      ? distToCircle(local, toLocal, a, b)
      : distToSeg(local, toLocal(a.x, a.y), toLocal(b.x, b.y));
  }
  if (!isDerivedEdge(obj.def[0])) {
    return undefined;
  }
  const geom = pathGeomOf(obj, state.points);
  if (!geom) {
    return undefined;
  }
  if (geom.kind === "circle") {
    return distToCircle(local, toLocal, geom.c, geom.through);
  }
  return distToLine(
    local,
    toLocal(geom.a.x, geom.a.y),
    toLocal(geom.b.x, geom.b.y),
  );
}

function distToCircle(
  local: [number, number],
  toLocal: (x: number, y: number) => [number, number],
  center: { x: number; y: number },
  through: { x: number; y: number },
): number {
  const rMath = Math.hypot(through.x - center.x, through.y - center.y);
  const [cx, cy] = toLocal(center.x, center.y);
  const [rx] = toLocal(center.x + rMath, center.y);
  const r = Math.abs(rx - cx);
  return Math.abs(Math.hypot(local[0] - cx, local[1] - cy) - r);
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distToSeg(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return dist(p, a);
  }
  const t = Math.min(
    1,
    Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2),
  );
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}

/** 무한직선. 파생 EDGE 히트. t 를 [0,1] 로 자르지 않는다. */
function distToLine(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return dist(p, a);
  }
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}
