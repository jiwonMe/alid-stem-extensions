/**
 * 정규화 세그먼트 해석식. GeoDef 를 모른다.
 * 평탄화 24분할은 이 파일 잠금. compile 인자로 열지 말 것.
 */
import type { PathPoint } from "../path.ts";

/** 세그먼트당 샘플 수. 양 끝 포함. */
export const BEZIER_SAMPLES = 24;

/** 절대 M L C Q A Z. H/V/S/T·상대는 svg-path 가 여기서 없앤다. */
export type BezierSeg =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Q"; x1: number; y1: number; x: number; y: number }
  | { op: "A"; rx: number; ry: number; rot: number; large: boolean; sweep: boolean; x: number; y: number }
  | { op: "Z" };

/**
 * 세그먼트 위 u∈[0,1]. M 은 끝점. Z 는 start 로 직선.
 * @param from 직전 현재점
 * @param start 서브패스 시작. Z 만
 */
export function segAt(
  from: PathPoint,
  start: PathPoint,
  seg: BezierSeg,
  u: number,
): PathPoint {
  if (seg.op === "M") {
    return { x: seg.x, y: seg.y };
  }
  if (seg.op === "Z") {
    return lerp(from, start, u);
  }
  if (seg.op === "L") {
    return lerp(from, { x: seg.x, y: seg.y }, u);
  }
  if (seg.op === "C") {
    return cubicAt(from, seg, u);
  }
  if (seg.op === "Q") {
    return quadAt(from, seg, u);
  }
  return arcAt(from, seg, u);
}

/**
 * 1차 도함수. 정규화하지 않는다. M 은 0.
 */
export function segD1(
  from: PathPoint,
  start: PathPoint,
  seg: BezierSeg,
  u: number,
): PathPoint {
  if (seg.op === "M") {
    return { x: 0, y: 0 };
  }
  if (seg.op === "Z") {
    return { x: start.x - from.x, y: start.y - from.y };
  }
  if (seg.op === "L") {
    return { x: seg.x - from.x, y: seg.y - from.y };
  }
  if (seg.op === "C") {
    return cubicD1(from, seg, u);
  }
  if (seg.op === "Q") {
    return quadD1(from, seg, u);
  }
  return arcD1(from, seg, u);
}

/**
 * 2차 도함수. 직선·M 은 0. 곡률 후속.
 */
export function segD2(
  from: PathPoint,
  seg: BezierSeg,
  u: number,
): PathPoint {
  if (seg.op === "C") {
    return cubicD2(from, seg, u);
  }
  if (seg.op === "Q") {
    const p0 = from;
    const p1 = { x: seg.x1, y: seg.y1 };
    const p2 = { x: seg.x, y: seg.y };
    return {
      x: 2 * (p2.x - 2 * p1.x + p0.x),
      y: 2 * (p2.y - 2 * p1.y + p0.y),
    };
  }
  return { x: 0, y: 0 };
}

/**
 * from → 끝. M 은 점 하나. 양 끝 포함.
 */
export function segFlatten(
  from: PathPoint,
  start: PathPoint,
  seg: BezierSeg,
): PathPoint[] {
  if (seg.op === "M") {
    return [{ x: seg.x, y: seg.y }];
  }
  const n = BEZIER_SAMPLES;
  const out: PathPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(segAt(from, start, seg, i / (n - 1)));
  }
  return out;
}

/**
 * 세그먼트 끝점. Z 는 start.
 */
export function segEnd(start: PathPoint, seg: BezierSeg): PathPoint {
  if (seg.op === "Z") {
    return start;
  }
  return { x: seg.x, y: seg.y };
}

function lerp(a: PathPoint, b: PathPoint, u: number): PathPoint {
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function cubicAt(
  p0: PathPoint,
  seg: Extract<BezierSeg, { op: "C" }>,
  u: number,
): PathPoint {
  const p1 = { x: seg.x1, y: seg.y1 };
  const p2 = { x: seg.x2, y: seg.y2 };
  const p3 = { x: seg.x, y: seg.y };
  const t = 1 - u;
  return {
    x: t * t * t * p0.x + 3 * t * t * u * p1.x + 3 * t * u * u * p2.x + u * u * u * p3.x,
    y: t * t * t * p0.y + 3 * t * t * u * p1.y + 3 * t * u * u * p2.y + u * u * u * p3.y,
  };
}

function cubicD1(
  p0: PathPoint,
  seg: Extract<BezierSeg, { op: "C" }>,
  u: number,
): PathPoint {
  const p1 = { x: seg.x1, y: seg.y1 };
  const p2 = { x: seg.x2, y: seg.y2 };
  const p3 = { x: seg.x, y: seg.y };
  const t = 1 - u;
  return {
    x: 3 * t * t * (p1.x - p0.x) + 6 * t * u * (p2.x - p1.x) + 3 * u * u * (p3.x - p2.x),
    y: 3 * t * t * (p1.y - p0.y) + 6 * t * u * (p2.y - p1.y) + 3 * u * u * (p3.y - p2.y),
  };
}

function cubicD2(
  p0: PathPoint,
  seg: Extract<BezierSeg, { op: "C" }>,
  u: number,
): PathPoint {
  const p1 = { x: seg.x1, y: seg.y1 };
  const p2 = { x: seg.x2, y: seg.y2 };
  const p3 = { x: seg.x, y: seg.y };
  const t = 1 - u;
  return {
    x: 6 * t * (p2.x - 2 * p1.x + p0.x) + 6 * u * (p3.x - 2 * p2.x + p1.x),
    y: 6 * t * (p2.y - 2 * p1.y + p0.y) + 6 * u * (p3.y - 2 * p2.y + p1.y),
  };
}

function quadAt(
  p0: PathPoint,
  seg: Extract<BezierSeg, { op: "Q" }>,
  u: number,
): PathPoint {
  const p1 = { x: seg.x1, y: seg.y1 };
  const p2 = { x: seg.x, y: seg.y };
  const t = 1 - u;
  return {
    x: t * t * p0.x + 2 * t * u * p1.x + u * u * p2.x,
    y: t * t * p0.y + 2 * t * u * p1.y + u * u * p2.y,
  };
}

function quadD1(
  p0: PathPoint,
  seg: Extract<BezierSeg, { op: "Q" }>,
  u: number,
): PathPoint {
  const p1 = { x: seg.x1, y: seg.y1 };
  const p2 = { x: seg.x, y: seg.y };
  const t = 1 - u;
  return {
    x: 2 * t * (p1.x - p0.x) + 2 * u * (p2.x - p1.x),
    y: 2 * t * (p1.y - p0.y) + 2 * u * (p2.y - p1.y),
  };
}

type ArcFrame = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  phi: number;
  a1: number;
  da: number;
};

function arcAt(
  from: PathPoint,
  seg: Extract<BezierSeg, { op: "A" }>,
  u: number,
): PathPoint {
  const arc = arcFrame(from, seg);
  if (!arc) {
    return lerp(from, { x: seg.x, y: seg.y }, u);
  }
  return ellipsePt(arc, arc.a1 + u * arc.da);
}

function arcD1(
  from: PathPoint,
  seg: Extract<BezierSeg, { op: "A" }>,
  u: number,
): PathPoint {
  const arc = arcFrame(from, seg);
  if (!arc) {
    return { x: seg.x - from.x, y: seg.y - from.y };
  }
  const a = arc.a1 + u * arc.da;
  const cos = Math.cos(arc.phi);
  const sin = Math.sin(arc.phi);
  const dx = -arc.rx * Math.sin(a);
  const dy = arc.ry * Math.cos(a);
  return {
    x: (dx * cos - dy * sin) * arc.da,
    y: (dx * sin + dy * cos) * arc.da,
  };
}

/**
 * SVG endpoint → center. rx=0 이면 undefined (직선).
 */
export function arcFrame(
  from: PathPoint,
  seg: Extract<BezierSeg, { op: "A" }>,
): ArcFrame | undefined {
  let rx = Math.abs(seg.rx);
  let ry = Math.abs(seg.ry);
  if (rx < 1e-12 || ry < 1e-12) {
    return undefined;
  }
  const phi = (seg.rot * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - seg.x) / 2;
  const dy = (from.y - seg.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s;
    ry *= s;
    lam = 1;
  }
  const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1)
    / (rx * rx * y1 * y1 + ry * ry * x1 * x1));
  const sign = seg.large === seg.sweep ? -1 : 1;
  const cx1 = sign * Math.sqrt(sq) * ((rx * y1) / ry);
  const cy1 = sign * Math.sqrt(sq) * ((-ry * x1) / rx);
  const cx = cos * cx1 - sin * cy1 + (from.x + seg.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + seg.y) / 2;
  const a1 = Math.atan2((y1 - cy1) / ry, (x1 - cx1) / rx);
  const a2 = Math.atan2((-y1 - cy1) / ry, (-x1 - cx1) / rx);
  let da = a2 - a1;
  if (!seg.sweep && da > 0) {
    da -= 2 * Math.PI;
  }
  if (seg.sweep && da < 0) {
    da += 2 * Math.PI;
  }
  return { cx, cy, rx, ry, phi, a1, da };
}

function ellipsePt(arc: ArcFrame, a: number): PathPoint {
  const cos = Math.cos(arc.phi);
  const sin = Math.sin(arc.phi);
  const x = arc.rx * Math.cos(a);
  const y = arc.ry * Math.sin(a);
  return {
    x: arc.cx + x * cos - y * sin,
    y: arc.cy + x * sin + y * cos,
  };
}
