/**
 * 수선의 발. 직선 AB 위. 선분 밖도 허용 (둔각 높이).
 * 식은 기획 phase_2_intersect_projection. 호스트는 이 모듈을 모른다.
 */

/**
 * H = A + t(B−A), t = ((P−A)·(B−A)) / |B−A|².
 * @param p 수선을 내리는 점
 * @param a 직선 한 점
 * @param b 직선 다른 점
 * @returns 발. A=B 면 undefined
 */
export function projectPoint(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const den = dx * dx + dy * dy;
  if (den === 0) {
    return undefined;
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / den;
  return { x: a.x + t * dx + 0, y: a.y + t * dy + 0 };
}
