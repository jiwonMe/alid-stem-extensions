/**
 * F(x,y)=0 marching squares. GeoDef 를 모른다.
 * JSXGraph predictor-corrector 는 이식하지 않는다. 긴 쪽 80칸은 계획 잠금.
 */
import type { PathPoint } from "../path.ts";

/** 긴 쪽 칸 수. compile 인자로 열지 말 것. */
export const IMPLICIT_CELLS = 80;

export type ViewBox = {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
};

/**
 * 등고선 F=0 토막. NaN/Inf 칸은 건너뛴다.
 * @param f parseFn2 결과
 * @param box spec.view
 */
export function sampleImplicit(
  f: (x: number, y: number) => number,
  box: ViewBox,
): PathPoint[][] {
  const nx = cellsX(box);
  const ny = cellsY(box);
  const dx = (box.xmax - box.xmin) / nx;
  const dy = (box.ymax - box.ymin) / ny;
  const parts: PathPoint[][] = [];
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const x0 = box.xmin + i * dx;
      const y0 = box.ymin + j * dy;
      const segs = cellSegs(f, x0, y0, dx, dy);
      for (const seg of segs) {
        parts.push(seg);
      }
    }
  }
  return chainSegments(parts);
}

/**
 * 2점 토막을 끝점 공유로 잇는다. 렌더 폴리라인 수를 줄인다.
 * 끝점이 3개 이상인 토막은 그대로 둔다.
 */
export function chainSegments(parts: PathPoint[][]): PathPoint[][] {
  const segs = parts.filter((part) => part.length >= 2);
  const unused = segs.map(() => true);
  const out: PathPoint[][] = [];
  const near = (a: PathPoint, b: PathPoint) =>
    Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;
  for (let i = 0; i < segs.length; i += 1) {
    if (!unused[i]) {
      continue;
    }
    unused[i] = false;
    const run = [...segs[i]!];
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < segs.length; j += 1) {
        if (!unused[j]) {
          continue;
        }
        const other = segs[j]!;
        const head = run[0]!;
        const tail = run[run.length - 1]!;
        if (near(tail, other[0]!)) {
          run.push(...other.slice(1));
        } else if (near(tail, other[other.length - 1]!)) {
          run.push(...other.slice(0, -1).reverse());
        } else if (near(head, other[other.length - 1]!)) {
          run.unshift(...other.slice(0, -1));
        } else if (near(head, other[0]!)) {
          run.unshift(...other.slice(1).reverse());
        } else {
          continue;
        }
        unused[j] = false;
        grew = true;
      }
    }
    out.push(run);
  }
  return out;
}

function cellsX(box: ViewBox): number {
  const wx = box.xmax - box.xmin;
  const wy = box.ymax - box.ymin;
  if (wx >= wy) {
    return IMPLICIT_CELLS;
  }
  return Math.max(8, Math.round((IMPLICIT_CELLS * wx) / wy));
}

function cellsY(box: ViewBox): number {
  const wx = box.xmax - box.xmin;
  const wy = box.ymax - box.ymin;
  if (wy >= wx) {
    return IMPLICIT_CELLS;
  }
  return Math.max(8, Math.round((IMPLICIT_CELLS * wy) / wx));
}

function cellSegs(
  f: (x: number, y: number) => number,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
): PathPoint[][] {
  const sw = f(x0, y0);
  const se = f(x0 + dx, y0);
  const ne = f(x0 + dx, y0 + dy);
  const nw = f(x0, y0 + dy);
  if (![sw, se, ne, nw].every(Number.isFinite)) {
    return [];
  }
  const code =
    (sw > 0 ? 1 : 0) |
    (se > 0 ? 2 : 0) |
    (ne > 0 ? 4 : 0) |
    (nw > 0 ? 8 : 0);
  if (code === 0 || code === 15) {
    return [];
  }
  const bottom = lerp(x0, y0, x0 + dx, y0, sw, se);
  const right = lerp(x0 + dx, y0, x0 + dx, y0 + dy, se, ne);
  const top = lerp(x0, y0 + dy, x0 + dx, y0 + dy, nw, ne);
  const left = lerp(x0, y0, x0, y0 + dy, sw, nw);
  return edges(code, bottom, right, top, left);
}

function lerp(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  v0: number,
  v1: number,
): PathPoint {
  const d = v1 - v0;
  const t = Math.abs(d) < 1e-15 ? 0.5 : -v0 / d;
  const u = Math.min(1, Math.max(0, t));
  return { x: x0 + u * (x1 - x0), y: y0 + u * (y1 - y0) };
}

function edges(
  code: number,
  b: PathPoint,
  r: PathPoint,
  t: PathPoint,
  l: PathPoint,
): PathPoint[][] {
  if (code === 1 || code === 14) return [[l, b]];
  if (code === 2 || code === 13) return [[b, r]];
  if (code === 3 || code === 12) return [[l, r]];
  if (code === 4 || code === 11) return [[r, t]];
  if (code === 6 || code === 9) return [[b, t]];
  if (code === 7 || code === 8) return [[l, t]];
  if (code === 5) return [[l, t], [b, r]];
  if (code === 10) return [[l, b], [t, r]];
  return [];
}
