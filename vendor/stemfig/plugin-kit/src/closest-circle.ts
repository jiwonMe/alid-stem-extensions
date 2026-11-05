/**
 * 원 둘레 위 最近点.
 * 교과·호스트를 모른다. 단위는 호출 측 (보통 프레임 로컬 mm).
 * 선분 발은 closest-path. 원은 여기만.
 */
import { SNAP_PATH_MM, type PathSnap } from "./closest-path.ts";

/**
 * 원 한 칸. 중심 c, 반지름 r.
 * r 가 0 이면 둘레가 없다.
 */
export type PathCircle = {
  id: string;
  c: [number, number];
  r: number;
};

/**
 * 반경 안 가장 가까운 둘레 발.
 * @param p 질의 점
 * @param rings 원. r<=0 은 건너뛴다
 * @param maxD 반경. 기본 SNAP_PATH_MM
 * @returns 발과 t(atan2). 없으면 null
 */
export function closestOnCircle(
  p: [number, number],
  rings: readonly PathCircle[],
  maxD: number = SNAP_PATH_MM,
): PathSnap | null {
  let best: PathSnap | null = null;
  for (const ring of rings) {
    const at = footOnCircle(p, ring);
    if (!at || at.d > maxD) {
      continue;
    }
    if (!best || at.d < best.d) {
      best = { id: ring.id, x: at.x, y: at.y, d: at.d, t: at.t };
    }
  }
  return best;
}

/**
 * 둘레 위 발과 t. on_path 점이 이 t 만 고친다.
 * t 는 atan2, (-π, π].
 * @returns r<=0 이면 undefined
 */
export function paramOnCircle(
  p: [number, number],
  ring: PathCircle,
): { x: number; y: number; t: number; d: number } | undefined {
  return footOnCircle(p, ring);
}

function footOnCircle(
  p: [number, number],
  ring: PathCircle,
): { x: number; y: number; t: number; d: number } | undefined {
  if (!(ring.r > 0)) {
    return undefined;
  }
  const dx = p[0] - ring.c[0];
  const dy = p[1] - ring.c[1];
  const d = Math.hypot(dx, dy);
  if (d === 0) {
    return {
      x: ring.c[0] + ring.r,
      y: ring.c[1],
      t: 0,
      d: ring.r,
    };
  }
  const x = ring.c[0] + (ring.r * dx) / d;
  const y = ring.c[1] + (ring.r * dy) / d;
  return { x, y, t: Math.atan2(dy, dx), d: Math.abs(d - ring.r) };
}
