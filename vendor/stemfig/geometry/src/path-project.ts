/**
 * Path 투영·샘플. atT/clampT 는 path.ts.
 * view 는 plotOf/polylinesOf 의 box 로만 들어온다.
 * Path kind → 샘플러 분기는 여기 plotOf 한 곳. compile·히트·스냅은 이걸 통해서만 샘플한다.
 */
import { segFlatten } from "./math/bezier.ts";
import { evalExpr } from "./math/expr.ts";
import { plotPolylines, sampleExplicit, type ExplicitPlot } from "./math/explicit.ts";
import { sampleImplicit } from "./math/implicit.ts";
import {
  atT,
  clampT,
  cursorAt,
  type Path,
  type PathPoint,
  type ProjectHit,
  type ViewBox,
} from "./path.ts";

/**
 * 최근접 발. explicit 은 독립축 투영 (along=x 면 t=x, along=y 면 t=y).
 */
export function project(path: Path, x: number, y: number): ProjectHit {
  if (path.kind === "line") {
    return projectLine(path, x, y);
  }
  if (path.kind === "circle") {
    const t = Math.atan2(y - path.c.y, x - path.c.x);
    return { t, at: atT(path, t)! };
  }
  if (path.kind === "explicit") {
    const t = clampT(path, path.along === "y" ? y : x);
    const at = atT(path, t) ?? (path.along === "y" ? { x: 0, y: t } : { x: t, y: 0 });
    return { t, at };
  }
  if (path.kind === "bezier") {
    return projectBezier(path, x, y);
  }
  if (path.kind === "sampled") {
    return projectParts(path.parts, x, y, (u) => u);
  }
  const parts = polylinesOf(path, {
    xmin: x - 8,
    xmax: x + 8,
    ymin: y - 8,
    ymax: y + 8,
  });
  return projectParts(parts, x, y, () => 0);
}

/**
 * 그리기·히트용 plot. explicit 만 bands 를 가질 수 있고 나머지는 parts 뿐이다.
 * implicit 은 box 에서 샘플. 캐시는 compile-curve 가 이 위에 얹는다.
 * @param widthPx 있으면 frame.w * MM_TO_PX. 없으면 explicit 이 FALLBACK_WIDTH_PX 를 쓴다
 */
export function plotOf(path: Path, box: ViewBox, widthPx?: number): ExplicitPlot {
  if (path.kind === "explicit") {
    const along = path.along === "y" ? "y" : "x";
    const t0 = path.x0 ?? (along === "y" ? box.ymin : box.xmin);
    const t1 = path.x1 ?? (along === "y" ? box.ymax : box.xmax);
    const f = (t: number) =>
      along === "y" ? evalExpr(path.f, 0, t) : evalExpr(path.f, t, 0);
    return sampleExplicit(f, t0, t1, box, widthPx, along);
  }
  return { parts: partsOf(path, box), bands: [] };
}

/**
 * 그리기·히트용 폴리라인. explicit 밴드는 테두리만 — fill 은 compileCurve.
 * @param widthPx 있으면 frame.w * MM_TO_PX
 */
export function polylinesOf(
  path: Path,
  box: ViewBox,
  widthPx?: number,
): PathPoint[][] {
  return plotPolylines(plotOf(path, box, widthPx));
}

/** explicit 을 제외한 kind 의 폴리라인. */
function partsOf(path: Exclude<Path, { kind: "explicit" }>, box: ViewBox): PathPoint[][] {
  if (path.kind === "line") {
    return lineParts(path, box);
  }
  if (path.kind === "circle") {
    return circleParts(path);
  }
  if (path.kind === "implicit") {
    const clipped = {
      xmin: path.x0 ?? box.xmin,
      xmax: path.x1 ?? box.xmax,
      ymin: box.ymin,
      ymax: box.ymax,
    };
    return sampleImplicit((x, y) => evalExpr(path.F, x, y), clipped);
  }
  if (path.kind === "bezier") {
    return flattenBezier(path);
  }
  return path.parts;
}

function projectLine(
  path: Extract<Path, { kind: "line" }>,
  x: number,
  y: number,
): ProjectHit {
  const dx = path.b.x - path.a.x;
  const dy = path.b.y - path.a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 < 1e-15 ? 0 : ((x - path.a.x) * dx + (y - path.a.y) * dy) / len2;
  t = clampT(path, t);
  return { t, at: atT(path, t)! };
}

function projectBezier(
  path: Extract<Path, { kind: "bezier" }>,
  x: number,
  y: number,
): ProjectHit {
  let best: ProjectHit | undefined;
  let bestD = Infinity;
  for (let i = 0; i < path.segs.length; i += 1) {
    const cur = cursorAt(path.segs, i);
    const seg = path.segs[i]!;
    if (!cur || seg.op === "M") {
      continue;
    }
    const pts = segFlatten(cur.from, cur.start, seg);
    for (let k = 1; k < pts.length; k += 1) {
      const a = pts[k - 1]!;
      const b = pts[k]!;
      const foot = footOn(a, b, x, y);
      const d = Math.hypot(foot.x - x, foot.y - y);
      if (d < bestD) {
        bestD = d;
        const u0 = (k - 1) / (pts.length - 1);
        const u1 = k / (pts.length - 1);
        best = { t: i + u0 + foot.t * (u1 - u0), at: foot };
      }
    }
  }
  return best ?? { t: 0, at: { x, y } };
}

function projectParts(
  parts: PathPoint[][],
  x: number,
  y: number,
  tOf: (u: number) => number,
): ProjectHit {
  let best: ProjectHit | undefined;
  let bestD = Infinity;
  let acc = 0;
  let total = 0;
  for (const part of parts) {
    for (let i = 1; i < part.length; i += 1) {
      total += Math.hypot(part[i]!.x - part[i - 1]!.x, part[i]!.y - part[i - 1]!.y);
    }
  }
  for (const part of parts) {
    for (let i = 1; i < part.length; i += 1) {
      const a = part[i - 1]!;
      const b = part[i]!;
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      const foot = footOn(a, b, x, y);
      const d = Math.hypot(foot.x - x, foot.y - y);
      if (d < bestD) {
        bestD = d;
        const u = total < 1e-15 ? 0 : (acc + foot.t * span) / total;
        best = { t: tOf(u), at: foot };
      }
      acc += span;
    }
  }
  return best ?? { t: 0, at: { x, y } };
}

function footOn(
  a: PathPoint,
  b: PathPoint,
  x: number,
  y: number,
): PathPoint & { t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-15) {
    return { x: a.x, y: a.y, t: 0 };
  }
  const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy, t };
}

function lineParts(path: Extract<Path, { kind: "line" }>, box: ViewBox): PathPoint[][] {
  if (path.bound) {
    return [[path.a, path.b]];
  }
  const clipped = clipLine(path.a, path.b, box);
  return clipped ? [clipped] : [];
}

function circleParts(path: Extract<Path, { kind: "circle" }>): PathPoint[][] {
  const r = Math.hypot(path.through.x - path.c.x, path.through.y - path.c.y);
  const n = 64;
  const ring: PathPoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (2 * Math.PI * i) / n;
    ring.push({ x: path.c.x + r * Math.cos(a), y: path.c.y + r * Math.sin(a) });
  }
  return [ring];
}

function flattenBezier(path: Extract<Path, { kind: "bezier" }>): PathPoint[][] {
  const parts: PathPoint[][] = [];
  let run: PathPoint[] = [];
  let from: PathPoint | undefined;
  let start: PathPoint | undefined;
  const flush = () => {
    if (run.length >= 2) {
      parts.push(run);
    }
    run = [];
  };
  for (const seg of path.segs) {
    if (seg.op === "M") {
      flush();
      from = { x: seg.x, y: seg.y };
      start = from;
      run = [from];
      continue;
    }
    if (!from || !start) {
      continue;
    }
    const pts = segFlatten(from, start, seg);
    run.push(...pts.slice(1));
    from = pts[pts.length - 1] ?? from;
    if (seg.op === "Z") {
      start = from;
      flush();
    }
  }
  flush();
  return parts;
}

function clipLine(
  a: PathPoint,
  b: PathPoint,
  box: ViewBox,
): PathPoint[] | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return undefined;
  }
  const ts: number[] = [];
  const push = (t: number, x: number, y: number) => {
    if (
      x >= box.xmin - 1e-9 &&
      x <= box.xmax + 1e-9 &&
      y >= box.ymin - 1e-9 &&
      y <= box.ymax + 1e-9
    ) {
      ts.push(t);
    }
  };
  if (dx !== 0) {
    push((box.xmin - a.x) / dx, box.xmin, a.y + ((box.xmin - a.x) / dx) * dy);
    push((box.xmax - a.x) / dx, box.xmax, a.y + ((box.xmax - a.x) / dx) * dy);
  }
  if (dy !== 0) {
    push((box.ymin - a.y) / dy, a.x + ((box.ymin - a.y) / dy) * dx, box.ymin);
    push((box.ymax - a.y) / dy, a.x + ((box.ymax - a.y) / dy) * dx, box.ymax);
  }
  ts.sort((p, q) => p - q);
  if (ts.length < 2) {
    return undefined;
  }
  const t0 = ts[0]!;
  const t1 = ts[ts.length - 1]!;
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy },
    { x: a.x + t1 * dx, y: a.y + t1 * dy },
  ];
}
