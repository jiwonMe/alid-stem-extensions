/**
 * 각·변 마크 좌표. 단위는 호출 측과 같다 (페이지 mm 또는 프레임 로컬 mm).
 * 제약·init 이 아니다. 호스트는 이 모듈을 모른다.
 */

import { bisectorAt, rightCorner, sampleArcPoints } from "@stemfig/plugin-kit";

export type MarkPoint = { x: number; y: number };

/** 직각 □ 한 변. 예전 2.4 의 절반. 줌 무관. */
export const MARK_INSET_MM = 1.2;
/** 등각 첫 호 반지름. 예전 3.2 의 절반. */
export const ARC_R_MM = 1.6;
/** 겹호 간격. 예전 0.9 의 절반. */
export const ARC_GAP_MM = 0.45;
/** DisplayList 에 arc 가 없어 샘플한다. */
export const ARC_SEGS = 16;
/** 변 틱 길이. 각 마크가 아니다. */
export const TICK_LEN_MM = 1.6;
/** 변 틱 간격. 각 마크가 아니다. */
export const TICK_GAP_MM = 0.8;
/** 변 위 빈 원 반지름. 각 마크가 아니다. */
export const HOLLOW_R_MM = 0.7;
/** 등각 빈 원. 예전 0.7 의 절반. */
export const ANGLE_HOLLOW_R_MM = 0.35;
/** 등각 채운 점. 예전 0.25 의 절반. */
export const DOT_R_MM = 0.125;
/** 각 마크 선. 교과 선 0.2 의 절반. 변 호·틱은 쓰지 말 것. */
export const ANGLE_MARK_WIDTH_MM = 0.1;
/** 첫 호 밖 라벨. 예전 1.2 의 절반. */
export const ANGLE_LABEL_PAD_MM = 0.6;
/** 호 위 빈 원 사이 각. euclidraw tick span 0.18 근처. */
export const CIRCLE_SPAN_RAD = 0.22;
/** 채운 점 사이 각. 각도는 그대로. 반지름이 절반이면 간격도 절반. */
export const DOT_SPAN_RAD = 0.3;

const EPS = 1e-9;

/**
 * 패널·스키마와 같은 1–3.
 * @param n 입력. 정수가 아니어도 자른다
 */
export function clampTicks(n: number): number {
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(3, Math.max(1, Math.round(n)));
}

/**
 * V에서 VA·VB 방향 □. 실제 각이 90°가 아니어도 그린다.
 * @returns P1,P2,P3. A=V 또는 B=V 면 undefined
 */
export function rightSquare(
  v: MarkPoint,
  a: MarkPoint,
  b: MarkPoint,
): [MarkPoint, MarkPoint, MarkPoint] | undefined {
  /* 한 변 길이는 이 교과 상수다. 좌표 계산은 plugin-kit 이 공유한다. */
  return rightCorner(v, a, b, MARK_INSET_MM);
}

/**
 * 작은 쪽 각의 동심 호. ticks 개.
 * @returns 호마다 샘플 점. 퇴화면 빈 배열이 아니라 undefined
 */
export function equalArcs(
  v: MarkPoint,
  a: MarkPoint,
  b: MarkPoint,
  ticks: number,
): MarkPoint[][] | undefined {
  const start = Math.atan2(a.y - v.y, a.x - v.x);
  const end = Math.atan2(b.y - v.y, b.x - v.x);
  if (!unit(v, a) || !unit(v, b)) {
    return undefined;
  }
  const delta = smallerDelta(start, end);
  if (Math.abs(delta) < EPS) {
    return undefined;
  }
  const count = clampTicks(ticks);
  const out: MarkPoint[][] = [];
  for (let i = 0; i < count; i += 1) {
    const r = ARC_R_MM + i * ARC_GAP_MM;
    out.push(sampleArc(v, r, start, delta));
  }
  return out;
}

/** 원 마크 한 칸. fill 여부는 compile. 단위는 호출 측. */
export type HollowMark = { x: number; y: number; r: number };

/**
 * 호 경로 위 빈 원 하나. count 는 받지 않는다. 패널도 1 고정.
 * compile 이 호 polyline 을 따로 붙인다.
 * @returns 중심+반지름. 퇴화면 undefined
 */
export function equalCircles(
  v: MarkPoint,
  a: MarkPoint,
  b: MarkPoint,
): HollowMark[] | undefined {
  return hollowOnSweep(v, a, b, 1, ANGLE_HOLLOW_R_MM, CIRCLE_SPAN_RAD);
}

/**
 * 호 없이 이등분선 근처 채운 점 1–2개. ticks 3 은 2로 자른다.
 */
export function equalDots(
  v: MarkPoint,
  a: MarkPoint,
  b: MarkPoint,
  ticks: number,
): HollowMark[] | undefined {
  const n = Math.min(2, clampTicks(ticks));
  return hollowOnSweep(v, a, b, n, DOT_R_MM, DOT_SPAN_RAD);
}

/**
 * 선분 중점 수직 틱.
 * @returns 틱마다 두 점. A=B 면 undefined
 */
export function segmentTicks(
  a: MarkPoint,
  b: MarkPoint,
  ticks: number,
): [MarkPoint, MarkPoint][] | undefined {
  const along = segmentAlong(a, b);
  const centers = segmentCenters(a, b, ticks);
  if (!along || !centers) {
    return undefined;
  }
  const h = TICK_LEN_MM / 2;
  return centers.map((c) => [
    { x: c.x + along.px * h, y: c.y + along.py * h },
    { x: c.x - along.px * h, y: c.y - along.py * h },
  ]);
}

/**
 * 중점 빈 원 하나. count 는 받지 않는다. 패널도 1 고정.
 * @returns 중심+반지름. A=B 면 undefined
 */
export function segmentCircles(
  a: MarkPoint,
  b: MarkPoint,
): HollowMark[] | undefined {
  return segmentCenters(a, b, 1)?.map((c) => ({
    x: c.x,
    y: c.y,
    r: HOLLOW_R_MM,
  }));
}

/**
 * 등각 라벨 자리. 이등분선 위 첫 호 밖.
 */
export function angleLabelAt(
  v: MarkPoint,
  a: MarkPoint,
  b: MarkPoint,
): MarkPoint | undefined {
  return bisectorAt(v, a, b, ARC_R_MM + ANGLE_LABEL_PAD_MM);
}

/**
 * 선분 단위 접선·법선. A=B 면 undefined.
 */
function segmentAlong(
  a: MarkPoint,
  b: MarkPoint,
): { ux: number; uy: number; px: number; py: number } | undefined {
  const u = unit(a, b);
  if (!u) {
    return undefined;
  }
  return { ux: u.x, uy: u.y, px: -u.y, py: u.x };
}

/**
 * 틱·원 공통 중심. 중점에서 TICK_GAP_MM 간격.
 */
function segmentCenters(
  a: MarkPoint,
  b: MarkPoint,
  ticks: number,
): MarkPoint[] | undefined {
  const along = segmentAlong(a, b);
  if (!along) {
    return undefined;
  }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const count = clampTicks(ticks);
  const span = (count - 1) * TICK_GAP_MM;
  const out: MarkPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const o = -span / 2 + i * TICK_GAP_MM;
    out.push({ x: mid.x + along.ux * o, y: mid.y + along.uy * o });
  }
  return out;
}

function unit(from: MarkPoint, to: MarkPoint): MarkPoint | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) {
    return undefined;
  }
  return { x: dx / len, y: dy / len };
}

function smallerDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) {
    d -= Math.PI * 2;
  }
  while (d < -Math.PI) {
    d += Math.PI * 2;
  }
  return d;
}

function hollowOnSweep(
  v: MarkPoint,
  a: MarkPoint,
  b: MarkPoint,
  count: number,
  r: number,
  spanRad: number,
): HollowMark[] | undefined {
  const sweep = angleSweep(v, a, b);
  if (!sweep) {
    return undefined;
  }
  const mid = sweep.start + sweep.delta / 2;
  const span = Math.min(spanRad, Math.abs(sweep.delta) * 0.85);
  const out: HollowMark[] = [];
  for (let i = 0; i < count; i += 1) {
    const o = count === 1 ? 0 : -span / 2 + i * (span / (count - 1));
    const t = mid + o;
    out.push({
      x: v.x + Math.cos(t) * ARC_R_MM,
      y: v.y + Math.sin(t) * ARC_R_MM,
      r,
    });
  }
  return out;
}

function angleSweep(
  v: MarkPoint,
  a: MarkPoint,
  b: MarkPoint,
): { start: number; delta: number } | undefined {
  if (!unit(v, a) || !unit(v, b)) {
    return undefined;
  }
  const start = Math.atan2(a.y - v.y, a.x - v.x);
  const delta = smallerDelta(start, Math.atan2(b.y - v.y, b.x - v.x));
  if (Math.abs(delta) < EPS) {
    return undefined;
  }
  return { start, delta };
}

function sampleArc(
  v: MarkPoint,
  r: number,
  start: number,
  delta: number,
): MarkPoint[] {
  return sampleArcPoints(v, r, start, delta, ARC_SEGS);
}
