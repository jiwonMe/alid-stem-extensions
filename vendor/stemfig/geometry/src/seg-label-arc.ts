/**
 * 변 라벨 호. 양 끝이 끝점. objects 가 아니다.
 * DisplayList 에 arc·dash 가 없어 샘플하고 토막 낸다.
 * 라벨 폭은 measureLabelMm. 글자 수 추정은 조판과 안 맞는다.
 * 호스트는 이 모듈을 모른다.
 */
import { measureLabelMm } from "@stemfig/display";
import { splitDash } from "@stemfig/plugin-kit";

export type BowPoint = { x: number; y: number };

/** A→B 왼쪽이 틱 법선과 같다. */
export type BowSide = "left" | "right";

/** 현 중점 기본 높이. 4.8 은 라벨에 비해 넓다. */
export const SEG_ARC_SAGITTA_MM = 2.8;
/** 패널·스키마 하한. 0 이면 세 점이 한 직선. */
export const SEG_ARC_SAGITTA_MIN_MM = 0.8;
/** 패널·스키마 상한. figure 프레임을 넘기지 않게. */
export const SEG_ARC_SAGITTA_MAX_MM = 24;
/** 호 샘플. 각 마크 ARC_SEGS 보다 촘촘히. 점선 토막용. */
export const SEG_ARC_SEGS = 24;
/** 점선 켜짐. 1.0 은 성겼다. 문서 mm. */
export const SEG_ARC_DASH_ON_MM = 0.45;
/** 점선 꺼짐. 켜짐보다 짧게. */
export const SEG_ARC_DASH_OFF_MM = 0.3;
/** 변 호 굵기. 기본 선 0.2 보다 얇다. */
export const SEG_ARC_WIDTH_MM = 0.12;
/** 라벨 양옆 여백. 글자가 호에 붙지 않게. */
export const SEG_ARC_GAP_PAD_MM = 0.8;
/** 한글·조판 실패 fallback. measureLabelMm FALLBACK_EM 과 같음. */
export const SEG_ARC_CHAR_EM = 0.58;

const EPS = 1e-9;
const TAU = Math.PI * 2;

/**
 * 라벨이 호를 밀어내는 폭. MathJax 상자 + 여백.
 * @param text 빈 문자열이면 0
 * @param textSize ResolvedStyle.textSize
 */
export function labelGapMm(text: string, textSize: number): number {
  if (text.length === 0) {
    return 0;
  }
  return measureLabelMm(text, textSize).w + SEG_ARC_GAP_PAD_MM * 2;
}

/**
 * 호 꼭짓점에 상자 중심이 오게 하는 baseline.
 * 글자 수×em 은 숫자·수식이 너무 넓다.
 * @param at splitBow 중점. 페이지 mm
 * @returns DisplayItem text x,y
 */
export function arcLabelBaseline(
  at: BowPoint,
  text: string,
  textSize: number,
): { x: number; y: number } {
  const box = measureLabelMm(text, textSize);
  return {
    x: at.x - (box.x + box.w / 2),
    y: at.y - (box.y + box.h / 2),
  };
}

/**
 * 패널·스키마와 같은 거리.
 * @param n 입력이 아니면 기본값
 */
export function clampBowDistance(n: number): number {
  if (!Number.isFinite(n)) {
    return SEG_ARC_SAGITTA_MM;
  }
  return Math.min(
    SEG_ARC_SAGITTA_MAX_MM,
    Math.max(SEG_ARC_SAGITTA_MIN_MM, n),
  );
}

/**
 * A→B 호. left 는 틱과 같은 법선.
 * @param distance 현에서 꼭짓점까지 mm. 없으면 기본
 * @param side 없으면 left
 * @returns A에서 B까지 샘플. A=B 면 undefined
 */
export function segmentBow(
  a: BowPoint,
  b: BowPoint,
  distance: number = SEG_ARC_SAGITTA_MM,
  side: BowSide = "left",
): BowPoint[] | undefined {
  const u = unit(a, b);
  if (!u) {
    return undefined;
  }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const s = clampBowDistance(distance) * (side === "right" ? -1 : 1);
  const apex = {
    x: mid.x + -u.y * s,
    y: mid.y + u.x * s,
  };
  const circ = circle3(a, apex, b);
  if (!circ) {
    return undefined;
  }
  const ta = Math.atan2(a.y - circ.cy, a.x - circ.cx);
  const tq = Math.atan2(apex.y - circ.cy, apex.x - circ.cx);
  const tb = Math.atan2(b.y - circ.cy, b.x - circ.cx);
  const delta = sweepVia(ta, tq, tb);
  const out: BowPoint[] = [];
  for (let i = 0; i <= SEG_ARC_SEGS; i += 1) {
    const t = ta + (delta * i) / SEG_ARC_SEGS;
    out.push({
      x: circ.cx + Math.cos(t) * circ.r,
      y: circ.cy + Math.sin(t) * circ.r,
    });
  }
  return out;
}

/**
 * 호를 가르고 라벨 자리를 준다.
 * around 가 있으면 그 점 최근접. 없으면 호 중점.
 * @param pts segmentBow 결과
 * @param gapMm 0 이면 오른쪽 없음. 호보다 길면 가르지 않는다
 * @param around 라벨 상자 중심. 페이지/로컬 mm
 * @returns left/right 샘플과 가른 점. 점이 모자라면 undefined
 */
export function splitBow(
  pts: readonly BowPoint[],
  gapMm: number,
  around?: BowPoint,
): { left: BowPoint[]; right: BowPoint[]; at: BowPoint } | undefined {
  if (pts.length < 2) {
    return undefined;
  }
  const lens = prefixLen(pts);
  const total = lens[lens.length - 1]!;
  const mid = around ? nearestLen(pts, lens, around) : total / 2;
  const at = alongPath(pts, lens, mid);
  if (gapMm <= EPS) {
    return { left: [...pts], right: [], at };
  }
  const half = Math.min(gapMm / 2, total * 0.4);
  const left = cutPrefix(pts, lens, mid - half);
  const right = cutSuffix(pts, lens, mid + half);
  if (left.length < 2 || right.length < 2) {
    return { left: [...pts], right: [], at };
  }
  return { left, right, at };
}

/**
 * 한 폴리라인을 점선 토막으로.
 * @param pts 연속 샘플
 * @returns 켜짐 구간마다 2점 이상
 */
export function dashPoly(pts: readonly BowPoint[]): BowPoint[][] {
  /* 호 점선 간격은 이 파일의 상수다. 자르는 위상은 plugin-kit 이 공유한다. */
  return splitDash(pts.map((point) => [point.x, point.y]), SEG_ARC_DASH_ON_MM, SEG_ARC_DASH_OFF_MM)
    .map((part) => part.map(([x, y]) => ({ x, y })));
}

function sweepVia(from: number, via: number, to: number): number {
  const ccw = posDelta(from, to);
  const viaCcw = posDelta(from, via);
  if (viaCcw <= ccw + EPS) {
    return ccw;
  }
  return ccw - TAU;
}

function posDelta(from: number, to: number): number {
  let d = to - from;
  while (d <= 0) {
    d += TAU;
  }
  while (d > TAU) {
    d -= TAU;
  }
  return d;
}

function circle3(
  a: BowPoint,
  b: BowPoint,
  c: BowPoint,
): { cx: number; cy: number; r: number } | undefined {
  const d =
    2 *
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) {
    return undefined;
  }
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) };
}

function unit(from: BowPoint, to: BowPoint): BowPoint | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) {
    return undefined;
  }
  return { x: dx / len, y: dy / len };
}

function prefixLen(pts: readonly BowPoint[]): number[] {
  const lens = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i - 1]!;
    const q = pts[i]!;
    lens.push(lens[i - 1]! + Math.hypot(q.x - p.x, q.y - p.y));
  }
  return lens;
}

function cutPrefix(
  pts: readonly BowPoint[],
  lens: readonly number[],
  at: number,
): BowPoint[] {
  const out: BowPoint[] = [pts[0]!];
  for (let i = 1; i < pts.length; i += 1) {
    if (lens[i]! <= at + EPS) {
      out.push(pts[i]!);
      continue;
    }
    out.push(along(pts[i - 1]!, pts[i]!, at - lens[i - 1]!));
    break;
  }
  return out;
}

function cutSuffix(
  pts: readonly BowPoint[],
  lens: readonly number[],
  at: number,
): BowPoint[] {
  const out: BowPoint[] = [];
  for (let i = 1; i < pts.length; i += 1) {
    if (lens[i]! + EPS < at) {
      continue;
    }
    if (out.length === 0) {
      out.push(along(pts[i - 1]!, pts[i]!, at - lens[i - 1]!));
    }
    out.push(pts[i]!);
  }
  return out;
}

/**
 * 폴리라인 위 최근접 호의 길이.
 */
function nearestLen(
  pts: readonly BowPoint[],
  lens: readonly number[],
  p: BowPoint,
): number {
  let bestS = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 < EPS
        ? 0
        : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const qx = a.x + t * dx;
    const qy = a.y + t * dy;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < bestD) {
      bestD = d;
      bestS = lens[i - 1]! + t * Math.hypot(dx, dy);
    }
  }
  return bestS;
}

function alongPath(
  pts: readonly BowPoint[],
  lens: readonly number[],
  at: number,
): BowPoint {
  if (at <= EPS) {
    return pts[0]!;
  }
  const total = lens[lens.length - 1]!;
  if (at >= total) {
    return pts[pts.length - 1]!;
  }
  for (let i = 1; i < pts.length; i += 1) {
    if (lens[i]! + EPS < at) {
      continue;
    }
    return along(pts[i - 1]!, pts[i]!, at - lens[i - 1]!);
  }
  return pts[pts.length - 1]!;
}

function along(a: BowPoint, b: BowPoint, d: number): BowPoint {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < EPS) {
    return { x: a.x, y: a.y };
  }
  const t = Math.min(1, Math.max(0, d / len));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
