/**
 * AP:PB = m:n. A,B 순서가 비율 방향. 뒤집지 않는다.
 * 식은 기획 division_replace_midpoint. 호스트는 이 모듈을 모른다.
 */

/** 내분·외분. 스키마 enum 과 같은 문자열만. */
export type DivisionMode = "internal" | "external";

/**
 * 선분 AB 를 m:n 으로 나눈 점.
 * 내분: (nA + mB)/(m+n). 외분: (nA − mB)/(n−m).
 * 외분에서 m===n 이면 무한대. 호출 전에 isInfiniteExternal 로 막을 것.
 * @param a 점 A (비율 시작)
 * @param b 점 B (비율 끝)
 * @param m AP 쪽 비. 양수
 * @param n PB 쪽 비. 양수
 * @param mode 내분 또는 외분
 * @returns view 좌표. NaN 을 여기서 고치지 않는다
 */
export function dividePoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  m: number,
  n: number,
  mode: DivisionMode,
): { x: number; y: number } {
  if (mode === "internal") {
    const den = m + n;
    return coord((n * a.x + m * b.x) / den, (n * a.y + m * b.y) / den);
  }
  const den = n - m;
  return coord((n * a.x - m * b.x) / den, (n * a.y - m * b.y) / den);
}

/**
 * IEEE -0 을 +0 으로. 외분 식에서 0-0 이 -0 이 된다.
 */
function coord(x: number, y: number): { x: number; y: number } {
  return { x: x + 0, y: y + 0 };
}

/**
 * 외분 + 같은 비. 점이 무한대라 SPEC.
 * @returns true 면 init 이 던지고 스키마도 거절한다
 */
export function isInfiniteExternal(
  m: number,
  n: number,
  mode: DivisionMode,
): boolean {
  return mode === "external" && m === n;
}
