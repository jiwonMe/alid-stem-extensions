/**
 * 평행·수선·이등분 방향.
 * 좌표만 안다. spec·DisplayList 는 모른다.
 * 퇴화는 undefined. init 이 throw 로 잠그지 않게 여기서만 끊는다.
 */

/** intersect.ts 와 같은 퇴화 문턱. */
const EPS = 1e-10;

export type Point = { x: number; y: number };

/** 이등분 안/밖. 패널 mode 와 같은 문자열. */
export type BisectorMode = "internal" | "external";

/**
 * AB 방향. 평행선 두 번째 점은 P+이 벡터.
 * @returns A=B 이면 undefined
 */
export function parallelDir(a: Point, b: Point): Point | undefined {
  const x = b.x - a.x;
  const y = b.y - a.y;
  if (x * x + y * y < EPS * EPS) {
    return undefined;
  }
  return { x, y };
}

/**
 * AB 를 90° 돌려 수직 방향. P+이 벡터가 수선.
 * @returns A=B 이면 undefined
 */
export function perpDir(a: Point, b: Point): Point | undefined {
  const dir = parallelDir(a, b);
  if (!dir) {
    return undefined;
  }
  return { x: -dir.y, y: dir.x };
}

/**
 * 각 AVB 이등분 방향. V 에서 나간다.
 * internal 은 단위합, external 은 단위차.
 * @returns A=V 또는 B=V 이면 undefined
 */
export function bisectorDir(
  a: Point,
  v: Point,
  b: Point,
  mode: BisectorMode,
): Point | undefined {
  const ua = unitFrom(v, a);
  const ub = unitFrom(v, b);
  if (!ua || !ub) {
    return undefined;
  }
  const x = mode === "internal" ? ua.x + ub.x : ua.x - ub.x;
  const y = mode === "internal" ? ua.y + ub.y : ua.y - ub.y;
  if (x * x + y * y < EPS * EPS) {
    return undefined;
  }
  return { x, y };
}

function unitFrom(origin: Point, tip: Point): Point | undefined {
  const x = tip.x - origin.x;
  const y = tip.y - origin.y;
  const len = Math.hypot(x, y);
  if (len < EPS) {
    return undefined;
  }
  return { x: x / len, y: y / len };
}
