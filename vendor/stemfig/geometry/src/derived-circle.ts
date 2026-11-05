/**
 * 외심·내심·반지름.
 * 점 GeoDef 를 만들지 않는다. pathGeom·feature 만 쓴다.
 * 공선은 undefined. 호스트는 이 식을 모른다.
 */

/** intersect.ts 와 같은 퇴화 문턱. */
const EPS = 1e-10;

export type Point = { x: number; y: number };

/** 중심 + 원주 한 점. 원은 through 까지가 반지름. */
export type CircleGeom = { c: Point; through: Point };

/**
 * 세 점 외접원. through 는 A.
 * @returns 공선이면 undefined
 */
export function circumcircleOf(
  a: Point,
  b: Point,
  c: Point,
): CircleGeom | undefined {
  const d =
    2 *
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) {
    return undefined;
  }
  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;
  const ux =
    (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d;
  const uy =
    (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
  return { c: { x: ux, y: uy }, through: a };
}

/**
 * 세 점 내접원. through 는 BC 접점(발).
 * @returns 공선·퇴화이면 undefined
 */
export function incircleOf(
  a: Point,
  b: Point,
  c: Point,
): CircleGeom | undefined {
  const sideA = Math.hypot(b.x - c.x, b.y - c.y);
  const sideB = Math.hypot(a.x - c.x, a.y - c.y);
  const sideC = Math.hypot(a.x - b.x, a.y - b.y);
  const peri = sideA + sideB + sideC;
  if (peri < EPS) {
    return undefined;
  }
  const area2 = Math.abs(
    a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y),
  );
  if (area2 < EPS) {
    return undefined;
  }
  const ix = (sideA * a.x + sideB * b.x + sideC * c.x) / peri;
  const iy = (sideA * a.y + sideB * b.y + sideC * c.y) / peri;
  const center = { x: ix, y: iy };
  const through = footOnSeg(center, b, c);
  if (!through) {
    return undefined;
  }
  return { c: center, through };
}

function footOnSeg(p: Point, a: Point, b: Point): Point | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS * EPS) {
    return undefined;
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}
