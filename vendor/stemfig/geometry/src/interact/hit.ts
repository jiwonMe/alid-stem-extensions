/**
 * 손잡이 히트. 점, 마크, 라벨, 그다음 선분/직선/원 둘레.
 * 라벨은 A:label. 중점은 호버만. apply 는 움직이지 않는다.
 */
import { fitView } from "@stemfig/display";
import { pageToLocal } from "@stemfig/plugin-kit";
import type { HandleId, HitCtx } from "@stemfig/host";
import {
  equalArcs,
  equalCircles,
  equalDots,
  rightSquare,
  segmentCircles,
  segmentTicks,
  type HollowMark,
  type MarkPoint,
} from "../mark-geom.ts";
import { segmentBow } from "../seg-label-arc.ts";
import { pointRole } from "./free.ts";
import { nearestAnnotLabel } from "./hit-annot-label.ts";
import { nearestLabel } from "./hit-label.ts";
import { HIT_SEG_MM, nearestStroke } from "./hit-stroke.ts";
import type { GeometryState } from "../init.ts";
import { nearestPathCtrl } from "./path-ctrl.ts";

/** 점 원 POINT_R_MM + 여유. 마크·라벨 거리의 절반에 맞춤. */
const HIT_POINT_MM = 1.1;

/**
 * 클릭이 꼭짓점 위면 그 id. place 가 기존 점을 재사용할 때 쓴다.
 * handles 잠금은 보지 않는다. 중점도 붙는다. 드래그는 pointRole.drag.
 * @param frame figure.frame
 * @param x_mm 페이지 mm
 * @param y_mm 페이지 mm
 * @param exclude 드래그 중인 점. 자기 자신은 빼다
 * @param maxD 로컬 mm 반경. 자석은 snapRadiusMm. 기본은 히트와 같음
 * @returns 히트 반경 안 점. 없으면 null
 */
export function snapFreePoint(
  state: GeometryState,
  frame: HitCtx["frame"],
  view: HitCtx["view"],
  x_mm: number,
  y_mm: number,
  exclude: string | null = null,
  maxD: number = HIT_POINT_MM,
): HandleId | null {
  const { toLocal } = fitView(view, frame);
  const local = pageToLocal(frame, x_mm, y_mm);
  return nearestPoint(state, toLocal, local, null, exclude, maxD, true);
}

/**
 * @returns 가장 가까운 허용 손잡이. 없으면 null
 */
export function hitGeometry(ctx: HitCtx, state: GeometryState): HandleId | null {
  const { toLocal } = fitView(ctx.view, ctx.frame);
  const local = pageToLocal(ctx.frame, ctx.x_mm, ctx.y_mm);
  const allowed = ctx.handles ? new Set(ctx.handles) : null;
  const pointHit = nearestPoint(
    state,
    toLocal,
    local,
    allowed,
    null,
    HIT_POINT_MM,
    false,
  );
  if (pointHit) {
    return pointHit;
  }
  /* 호 글자가 호 스트로크에 먹히지 않게. */
  const annotLabel = nearestAnnotLabel(state, toLocal, local);
  if (annotLabel) {
    return annotLabel;
  }
  /* 점이 이긴 뒤 마크. 선이 먼저면 틱을 못 고른다. */
  const markHit = nearestMark(state, toLocal, local);
  if (markHit) {
    return markHit;
  }
  /* 글자가 선에 먹히지 않게. 마크는 이미 이겼다. */
  const labelHit = nearestLabel(state, toLocal, local, allowed);
  if (labelHit) {
    return labelHit;
  }
  const ctrlHit = nearestPathCtrl(state, toLocal, local);
  if (ctrlHit) {
    return ctrlHit;
  }
  return nearestStroke(state, ctx.view, ctx.frame, toLocal, local, allowed);
}

function nearestPoint(
  state: GeometryState,
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
  allowed: Set<string> | null,
  exclude: string | null,
  maxD: number,
  snapVertex: boolean,
): HandleId | null {
  let best: { id: string; d: number } | null = null;
  for (const obj of state.spec.objects) {
    const role = pointRole(state, obj.id, allowed);
    const pick = snapVertex ? role.snap : role.hover;
    if (obj.id === exclude || !pick) {
      continue;
    }
    const pt = state.points.get(obj.id);
    if (!pt) {
      continue;
    }
    const d = dist(local, toLocal(pt.x, pt.y));
    if (d <= maxD && (!best || d < best.d)) {
      best = { id: obj.id, d };
    }
  }
  return best?.id ?? null;
}

/**
 * □·겹호·틱. 로컬 mm. handles 잠금 밖 (주석은 손잡이가 아님).
 */
function nearestMark(
  state: GeometryState,
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
): HandleId | null {
  let best: { id: string; d: number } | null = null;
  for (const ang of state.spec.angles ?? []) {
    const a = atLocal(state, ang.a, toLocal);
    const v = atLocal(state, ang.v, toLocal);
    const b = atLocal(state, ang.b, toLocal);
    if (!a || !v || !b) {
      continue;
    }
    const d = distToAngle(
      local,
      a,
      v,
      b,
      ang.mark,
      ang.style ?? "arc",
      ang.ticks ?? 1,
    );
    if (d !== undefined && d <= HIT_SEG_MM && (!best || d < best.d)) {
      best = { id: ang.id, d };
    }
  }
  for (const mark of state.spec.marks ?? []) {
    const a = atLocal(state, mark.a, toLocal);
    const b = atLocal(state, mark.b, toLocal);
    if (!a || !b) {
      continue;
    }
    const style = mark.style ?? "tick";
    const d =
      style === "circle"
        ? distToHollow(local, segmentCircles(a, b))
        : style === "arc"
          ? distToArcs(
              local,
              wrapBow(segmentBow(a, b, mark.distance, mark.side ?? "left")),
            )
          : distToTicks(local, segmentTicks(a, b, mark.ticks));
    if (d !== undefined && d <= HIT_SEG_MM && (!best || d < best.d)) {
      best = { id: mark.id, d };
    }
  }
  return best?.id ?? null;
}

function distToAngle(
  local: [number, number],
  a: MarkPoint,
  v: MarkPoint,
  b: MarkPoint,
  mark: "none" | "right" | "equal",
  style: "arc" | "circle" | "dot",
  ticks: number,
): number | undefined {
  if (mark === "right") {
    const sq = rightSquare(v, a, b);
    if (!sq) {
      return undefined;
    }
    return Math.min(
      distToSeg(local, [sq[0].x, sq[0].y], [sq[1].x, sq[1].y]),
      distToSeg(local, [sq[1].x, sq[1].y], [sq[2].x, sq[2].y]),
    );
  }
  if (mark !== "equal") {
    return undefined;
  }
  if (style === "circle") {
    const ring = distToHollow(local, equalCircles(v, a, b));
    const arc = distToArcs(local, equalArcs(v, a, b, 1));
    if (ring === undefined) {
      return arc;
    }
    if (arc === undefined) {
      return ring;
    }
    return Math.min(ring, arc);
  }
  if (style === "dot") {
    return distToFilled(local, equalDots(v, a, b, ticks));
  }
  return distToArcs(local, equalArcs(v, a, b, ticks));
}

function wrapBow(pts: MarkPoint[] | undefined): MarkPoint[][] | undefined {
  return pts ? [pts] : undefined;
}

function distToTicks(
  local: [number, number],
  ticks: [MarkPoint, MarkPoint][] | undefined,
): number | undefined {
  if (!ticks?.length) {
    return undefined;
  }
  let best = Infinity;
  for (const tick of ticks) {
    best = Math.min(
      best,
      distToSeg(local, [tick[0].x, tick[0].y], [tick[1].x, tick[1].y]),
    );
  }
  return best;
}

function distToArcs(
  local: [number, number],
  arcs: MarkPoint[][] | undefined,
): number | undefined {
  if (!arcs) {
    return undefined;
  }
  let best = Infinity;
  for (const arc of arcs) {
    for (let i = 1; i < arc.length; i += 1) {
      const p = arc[i - 1]!;
      const q = arc[i]!;
      best = Math.min(best, distToSeg(local, [p.x, p.y], [q.x, q.y]));
    }
  }
  return best;
}

function distToHollow(
  local: [number, number],
  marks: HollowMark[] | undefined,
): number | undefined {
  if (!marks?.length) {
    return undefined;
  }
  let best = Infinity;
  for (const mark of marks) {
    const d = Math.abs(Math.hypot(local[0] - mark.x, local[1] - mark.y) - mark.r);
    best = Math.min(best, d);
  }
  return best;
}

function distToFilled(
  local: [number, number],
  marks: HollowMark[] | undefined,
): number | undefined {
  if (!marks?.length) {
    return undefined;
  }
  let best = Infinity;
  for (const mark of marks) {
    best = Math.min(
      best,
      Math.max(0, Math.hypot(local[0] - mark.x, local[1] - mark.y) - mark.r),
    );
  }
  return best;
}

function atLocal(
  state: GeometryState,
  id: string,
  toLocal: (x: number, y: number) => [number, number],
): MarkPoint | undefined {
  const pt = state.points.get(id);
  if (!pt) {
    return undefined;
  }
  const [x, y] = toLocal(pt.x, pt.y);
  return { x, y };
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
