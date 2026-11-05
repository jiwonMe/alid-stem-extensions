/**
 * 해석적 Path. 샘플은 polylinesOf 파생물.
 * 선·원은 PathGeom 과 같다. 접선은 tangentAt. 곡률은 후속.
 * 호스트는 이 모듈을 모른다.
 */
import type { PathGeom } from "./intersect.ts";
import type { BezierSeg } from "./math/bezier.ts";
import { segAt, segD1, segEnd } from "./math/bezier.ts";
import { diff } from "./math/diff.ts";
import { evalExpr, type Expr } from "./math/expr.ts";

export type PathPoint = { x: number; y: number };

/** 선·원 + 식 곡선 + SVG 경로 + 데이터 폴리라인. */
export type Path =
  | PathGeom
  | { kind: "explicit"; f: Expr; x0?: number; x1?: number; along?: "x" | "y" }
  | { kind: "implicit"; F: Expr; x0?: number; x1?: number }
  | { kind: "bezier"; segs: BezierSeg[] }
  | { kind: "sampled"; parts: PathPoint[][] };

export type ViewBox = {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
};

/** x 구간. 끝점은 포함. explicit 체제 분류·띠가 쓴다. */
export type XSpan = { x0: number; x1: number };

export type ProjectHit = { t: number; at: PathPoint };

/**
 * 경로 위 점. implicit 은 undefined.
 * @param t kind 별 매개변수. clampT 를 먼저 쓰는 쪽
 */
export function atT(path: Path, t: number): PathPoint | undefined {
  if (path.kind === "line") {
    return {
      x: path.a.x + t * (path.b.x - path.a.x),
      y: path.a.y + t * (path.b.y - path.a.y),
    };
  }
  if (path.kind === "circle") {
    const r = Math.hypot(path.through.x - path.c.x, path.through.y - path.c.y);
    return { x: path.c.x + r * Math.cos(t), y: path.c.y + r * Math.sin(t) };
  }
  if (path.kind === "explicit") {
    const alongY = path.along === "y";
    const v = alongY ? evalExpr(path.f, 0, t) : evalExpr(path.f, t, 0);
    return Number.isFinite(v) ? (alongY ? { x: v, y: t } : { x: t, y: v }) : undefined;
  }
  if (path.kind === "implicit") {
    return undefined;
  }
  if (path.kind === "bezier") {
    return bezierAt(path.segs, t);
  }
  return sampledAt(path.parts, t);
}

/**
 * kind 별 t 범위. circle 은 자르지 않는다. bezier 는 u=1 을 다음 세그먼트로.
 */
export function clampT(path: Path, t: number): number {
  if (path.kind === "line" && path.bound) {
    return Math.min(1, Math.max(0, t));
  }
  if (path.kind === "explicit") {
    const lo = path.x0;
    const hi = path.x1;
    if (lo === undefined || hi === undefined) {
      return t;
    }
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    return Math.min(b, Math.max(a, t));
  }
  if (path.kind === "sampled") {
    return Math.min(1, Math.max(0, t));
  }
  if (path.kind === "bezier") {
    return clampBezier(path.segs, t);
  }
  return t;
}

/**
 * 단위 접선. implicit 은 점 없이 못 낸다.
 * @returns 퇴화·implicit 이면 undefined
 */
export function tangentAt(path: Path, t: number): PathPoint | undefined {
  if (path.kind === "line") {
    return unit(path.b.x - path.a.x, path.b.y - path.a.y);
  }
  if (path.kind === "circle") {
    return unit(-Math.sin(t), Math.cos(t));
  }
  if (path.kind === "explicit") {
    const alongY = path.along === "y";
    const d = evalExpr(diff(path.f, alongY ? "y" : "x"), alongY ? 0 : t, alongY ? t : 0);
    return Number.isFinite(d) ? (alongY ? unit(d, 1) : unit(1, d)) : undefined;
  }
  if (path.kind === "bezier") {
    return bezierTan(path.segs, t);
  }
  if (path.kind === "sampled") {
    const a = sampledAt(path.parts, Math.max(0, t - 0.01));
    const b = sampledAt(path.parts, Math.min(1, t + 0.01));
    return a && b ? unit(b.x - a.x, b.y - a.y) : undefined;
  }
  return undefined;
}

/** path.test 계약 이름. */
export const tangentDir = tangentAt;

export { project, polylinesOf } from "./path-project.ts";

function unit(x: number, y: number): PathPoint | undefined {
  const n = Math.hypot(x, y);
  return n < 1e-12 ? undefined : { x: x / n, y: y / n };
}

function bezierAt(segs: BezierSeg[], t: number): PathPoint | undefined {
  const walk = bezierWalk(segs, t);
  return walk
    ? segAt(walk.from, walk.start, walk.seg, walk.u)
    : undefined;
}

function bezierTan(segs: BezierSeg[], t: number): PathPoint | undefined {
  const walk = bezierWalk(segs, t);
  if (!walk) {
    return undefined;
  }
  const d = segD1(walk.from, walk.start, walk.seg, walk.u);
  return unit(d.x, d.y);
}

function bezierWalk(
  segs: BezierSeg[],
  t: number,
): { from: PathPoint; start: PathPoint; seg: BezierSeg; u: number } | undefined {
  if (segs.length === 0) {
    return undefined;
  }
  const idx = Math.min(segs.length - 1, Math.max(0, Math.floor(t)));
  const u = t - idx;
  const cur = cursorAt(segs, idx);
  const seg = segs[idx];
  if (!cur || !seg) {
    return undefined;
  }
  return { from: cur.from, start: cur.start, seg, u };
}

/**
 * i 번째 세그먼트 직전 현재점·서브패스 시작.
 */
export function cursorAt(
  segs: BezierSeg[],
  index: number,
): { from: PathPoint; start: PathPoint } | undefined {
  let from: PathPoint | undefined;
  let start: PathPoint | undefined;
  for (let i = 0; i < index; i += 1) {
    const seg = segs[i]!;
    if (seg.op === "M") {
      from = { x: seg.x, y: seg.y };
      start = from;
      continue;
    }
    if (!from || !start) {
      continue;
    }
    from = segEnd(start, seg);
    if (seg.op === "Z") {
      start = from;
    }
  }
  if (!from) {
    const first = segs[0];
    if (first && first.op === "M") {
      from = { x: first.x, y: first.y };
      start = from;
    }
  }
  return from && start ? { from, start } : undefined;
}

function clampBezier(segs: BezierSeg[], t: number): number {
  if (segs.length === 0) {
    return 0;
  }
  if (t < 0) {
    return 0;
  }
  const last = segs.length - 1;
  if (t >= last + 1) {
    return last + 1;
  }
  const idx = Math.floor(t);
  const u = t - idx;
  if (u >= 1 && idx < last) {
    return idx + 1;
  }
  return t;
}

function sampledAt(parts: PathPoint[][], t: number): PathPoint | undefined {
  const pts = parts.flat();
  if (pts.length === 0) {
    return undefined;
  }
  if (pts.length === 1) {
    return pts[0];
  }
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    lens.push(lens[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lens[lens.length - 1]!;
  if (total < 1e-15) {
    return pts[0];
  }
  const target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < pts.length; i += 1) {
    if (lens[i]! >= target) {
      const span = lens[i]! - lens[i - 1]!;
      const u = span < 1e-15 ? 0 : (target - lens[i - 1]!) / span;
      const a = pts[i - 1]!;
      const b = pts[i]!;
      return { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) };
    }
  }
  return pts[pts.length - 1];
}
