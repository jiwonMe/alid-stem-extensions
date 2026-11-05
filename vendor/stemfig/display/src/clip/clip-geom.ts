/**
 * 축정렬 상자와의 교차만. DisplayItem 계약·교과를 모른다.
 * SVG clip 이 아니라 좌표를 자른다. Grida 가 clipPath 를 버리기 때문.
 */
import type { Frame } from "../types.ts";

const EPS = 1e-9;

/** clipSeg 가 남기는 선분. 단위 mm. */
export type Seg = [[number, number], [number, number]];

/**
 * Liang-Barsky. 상자와 안 겹치면 null.
 * @param clip 페이지 또는 figure 상자. mm
 */
export function clipSeg(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  clip: Frame,
): Seg | null {
  const xmin = clip.x;
  const xmax = clip.x + clip.w;
  const ymin = clip.y;
  const ymax = clip.y + clip.h;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const cut = (p: number, q: number): boolean => {
    if (Math.abs(p) < EPS) {
      return q >= -EPS;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) {
        return false;
      }
      if (t > t0) {
        t0 = t;
      }
    } else {
      if (t < t0) {
        return false;
      }
      if (t < t1) {
        t1 = t;
      }
    }
    return true;
  };
  if (!cut(-dx, x0 - xmin) || !cut(dx, xmax - x0)) {
    return null;
  }
  if (!cut(-dy, y0 - ymin) || !cut(dy, ymax - y0)) {
    return null;
  }
  return [
    [x0 + t0 * dx, y0 + t0 * dy],
    [x0 + t1 * dx, y0 + t1 * dy],
  ];
}

/**
 * 점이 상자 안(경계 포함)인지.
 */
export function pointIn(clip: Frame, x: number, y: number): boolean {
  return (
    x >= clip.x - EPS &&
    y >= clip.y - EPS &&
    x <= clip.x + clip.w + EPS &&
    y <= clip.y + clip.h + EPS
  );
}

/**
 * 두 점이 같은 끝인지. polyline run 을 잇기 위함.
 */
export function samePt(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

/**
 * Sutherland–Hodgman. 결과는 시계/반시계를 유지한다.
 * 3점 미만이면 빈 배열.
 */
export function clipPolygonPts(
  points: [number, number][],
  clip: Frame,
): [number, number][] {
  const right = clip.x + clip.w;
  const bottom = clip.y + clip.h;
  let next = points;
  next = against(next, (x) => x >= clip.x, (a, b) => hitX(a, b, clip.x));
  next = against(next, (x) => x <= right, (a, b) => hitX(a, b, right));
  next = against(next, (_x, y) => y >= clip.y, (a, b) => hitY(a, b, clip.y));
  next = against(next, (_x, y) => y <= bottom, (a, b) => hitY(a, b, bottom));
  return next.length >= 3 ? next : [];
}

/**
 * 원이 상자에 완전히 들어가면 keep, 완전히 나가면 drop, 걸치면 sample.
 */
export function circleFit(
  cx: number,
  cy: number,
  r: number,
  clip: Frame,
): "in" | "out" | "hit" {
  return ringFit(cx, cy, r, r, clip);
}

/**
 * 축정렬 타원 AABB. 회전 없는 DisplayItem.ellipse 만.
 * @param rx 가로 반지름. mm
 * @param ry 세로 반지름. mm
 * @returns in 유지, out 삭제, hit 샘플
 */
export function ringFit(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  clip: Frame,
): "in" | "out" | "hit" {
  const left = cx - rx;
  const right = cx + rx;
  const top = cy - ry;
  const bottom = cy + ry;
  if (
    left >= clip.x &&
    top >= clip.y &&
    right <= clip.x + clip.w &&
    bottom <= clip.y + clip.h
  ) {
    return "in";
  }
  if (
    right < clip.x ||
    bottom < clip.y ||
    left > clip.x + clip.w ||
    top > clip.y + clip.h
  ) {
    return "out";
  }
  return "hit";
}

/**
 * 원·타원 둘레 분할. 64 는 1/4 원도 각이 안 보이게.
 * DisplayList 폭발 전에 멈춘 값. clip hit 만 호출한다.
 */
export const RING_SEGMENTS = 64;

/**
 * 닫히지 않은 둘레 점. 호출측이 close 하거나 다각형으로 잇는다.
 * @param rx 가로 반지름. mm
 * @param ry 세로 반지름. mm
 */
export function sampleRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < RING_SEGMENTS; i += 1) {
    const t = (i / RING_SEGMENTS) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return pts;
}

function against(
  pts: [number, number][],
  inside: (x: number, y: number) => boolean,
  hit: (a: [number, number], b: [number, number]) => [number, number],
): [number, number][] {
  if (pts.length === 0) {
    return [];
  }
  const out: [number, number][] = [];
  let prev = pts[pts.length - 1]!;
  for (const cur of pts) {
    const pin = inside(prev[0], prev[1]);
    const cin = inside(cur[0], cur[1]);
    if (cin) {
      if (!pin) {
        out.push(hit(prev, cur));
      }
      out.push(cur);
    } else if (pin) {
      out.push(hit(prev, cur));
    }
    prev = cur;
  }
  return out;
}

function hitX(
  a: [number, number],
  b: [number, number],
  x: number,
): [number, number] {
  const t = (x - a[0]) / (b[0] - a[0] || EPS);
  return [x, a[1] + t * (b[1] - a[1])];
}

function hitY(
  a: [number, number],
  b: [number, number],
  y: number,
): [number, number] {
  const t = (y - a[1]) / (b[1] - a[1] || EPS);
  return [a[0] + t * (b[0] - a[0]), y];
}
