/**
 * 변 호 점선을 글자 상자 밖으로 자른다.
 * 호 길이 갭은 높이로 지나가는 토막을 못 지운다. 교차만 여기서.
 * compile 만 부른다. HUD 앵커는 전체 호를 유지한다.
 */
import { measureLabelMm } from "@stemfig/display";
import { SEG_ARC_GAP_PAD_MM, type BowPoint } from "./seg-label-arc.ts";

const EPS = 1e-9;

/**
 * 페이지/로컬 mm 축정렬 상자.
 */
export type ClipRect = { x: number; y: number; w: number; h: number };

/**
 * baseline + MathJax 상자 + 여백.
 * 여백은 점선이 잉크에 붙지 않게. 히트 상자와 같은 메트릭.
 * @param baseline arcLabelBaselineAt
 * @param text marks[].label
 * @param sizeMm textSize
 */
export function labelClipRect(
  baseline: BowPoint,
  text: string,
  sizeMm: number,
): ClipRect | undefined {
  if (text.length === 0) {
    return undefined;
  }
  const box = measureLabelMm(text, sizeMm);
  if (box.w <= EPS || box.h <= EPS) {
    return undefined;
  }
  const pad = SEG_ARC_GAP_PAD_MM;
  return {
    x: baseline.x + box.x - pad,
    y: baseline.y + box.y - pad,
    w: box.w + pad * 2,
    h: box.h + pad * 2,
  };
}

/**
 * 상자 안 토막을 뺀 폴리라인.
 * 안 겹치면 입력을 그대로 한 줄.
 * @param pts segmentBow 결과
 * @param rect labelClipRect
 * @returns 점 2개 이상인 토막만
 */
export function clipPolyOutside(
  pts: readonly BowPoint[],
  rect: ClipRect,
): BowPoint[][] {
  if (pts.length < 2 || rect.w <= EPS || rect.h <= EPS) {
    return pts.length >= 2 ? [[...pts]] : [];
  }
  const runs: BowPoint[][] = [];
  let cur: BowPoint[] = [];
  const flush = () => {
    if (cur.length >= 2) {
      runs.push(cur);
    }
    cur = [];
  };
  const push = (a: BowPoint, b: BowPoint) => {
    if (cur.length === 0) {
      cur = [a, b];
      return;
    }
    const last = cur[cur.length - 1]!;
    if (near(last, a)) {
      cur.push(b);
      return;
    }
    flush();
    cur = [a, b];
  };
  for (let i = 1; i < pts.length; i += 1) {
    for (const [a, b] of outsidePieces(pts[i - 1]!, pts[i]!, rect)) {
      push(a, b);
    }
  }
  flush();
  return runs;
}

function outsidePieces(
  p: BowPoint,
  q: BowPoint,
  rect: ClipRect,
): [BowPoint, BowPoint][] {
  const ts = [0, 1];
  for (const t of edgeHits(p, q, rect)) {
    if (t > EPS && t < 1 - EPS) {
      ts.push(t);
    }
  }
  ts.sort((a, b) => a - b);
  const out: [BowPoint, BowPoint][] = [];
  for (let i = 1; i < ts.length; i += 1) {
    const t0 = ts[i - 1]!;
    const t1 = ts[i]!;
    if (t1 - t0 < EPS) {
      continue;
    }
    const mid = lerp(p, q, (t0 + t1) / 2);
    if (inside(mid, rect)) {
      continue;
    }
    out.push([lerp(p, q, t0), lerp(p, q, t1)]);
  }
  return out;
}

function edgeHits(p: BowPoint, q: BowPoint, r: ClipRect): number[] {
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  const hits: number[] = [];
  const a = hitVert(p, q, r.x, r.y, y1);
  const b = hitVert(p, q, x1, r.y, y1);
  const c = hitHorz(p, q, r.y, r.x, x1);
  const d = hitHorz(p, q, y1, r.x, x1);
  if (a !== undefined) {
    hits.push(a);
  }
  if (b !== undefined) {
    hits.push(b);
  }
  if (c !== undefined) {
    hits.push(c);
  }
  if (d !== undefined) {
    hits.push(d);
  }
  return hits;
}

function hitVert(
  p: BowPoint,
  q: BowPoint,
  x: number,
  y0: number,
  y1: number,
): number | undefined {
  const dx = q.x - p.x;
  if (Math.abs(dx) < EPS) {
    return undefined;
  }
  const t = (x - p.x) / dx;
  if (t < -EPS || t > 1 + EPS) {
    return undefined;
  }
  const y = p.y + t * (q.y - p.y);
  if (y < y0 - EPS || y > y1 + EPS) {
    return undefined;
  }
  return Math.min(1, Math.max(0, t));
}

function hitHorz(
  p: BowPoint,
  q: BowPoint,
  y: number,
  x0: number,
  x1: number,
): number | undefined {
  const dy = q.y - p.y;
  if (Math.abs(dy) < EPS) {
    return undefined;
  }
  const t = (y - p.y) / dy;
  if (t < -EPS || t > 1 + EPS) {
    return undefined;
  }
  const x = p.x + t * (q.x - p.x);
  if (x < x0 - EPS || x > x1 + EPS) {
    return undefined;
  }
  return Math.min(1, Math.max(0, t));
}

function inside(p: BowPoint, r: ClipRect): boolean {
  return (
    p.x > r.x + EPS &&
    p.x < r.x + r.w - EPS &&
    p.y > r.y + EPS &&
    p.y < r.y + r.h - EPS
  );
}

function lerp(p: BowPoint, q: BowPoint, t: number): BowPoint {
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

function near(a: BowPoint, b: BowPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
}
