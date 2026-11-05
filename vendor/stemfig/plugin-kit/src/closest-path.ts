/**
 * 1D 경로 위 最近点.
 * 선분·폴리라인·plot 샘플을 같은 함수로 붙인다.
 * 교과·호스트를 모른다. 거리는 호출 측 단위 (보통 프레임 로컬 mm).
 * 반경 진실은 SNAP_PATH_PX. mm 는 줌으로 환산한 값이다.
 */
import { MM_TO_PX } from "@stemfig/display";

/**
 * 경로 한 칸. a–b.
 * unbound 면 무한 직선 (작도 line). Path/plot 은 보통 선분.
 */
export type PathSeg = {
  id: string;
  a: [number, number];
  b: [number, number];
  unbound?: boolean;
};

/**
 * 자석 반경. 캔버스 CSS px. 줌과 무관.
 * 예전 2.2mm 가 zoom 1 (1mm=4px) 에서 8.8px.
 * plot 폴리라인 / Path 도 이 값. 플러그인마다 다시 쓰지 말 것.
 */
export const SNAP_PATH_PX = 8.8;

/**
 * 꼭짓점·중점 자석. 경로보다 넓다.
 * 라벨 오프셋 1.2mm 와 선분 위 근처를 점이 이기게.
 * 숫자는 SNAP_PATH_PX 의 2.5배. 8.8 * 2.5 = 22.
 */
export const SNAP_VERTEX_PX = 22;

function pxPerMm(px_per_mm?: number): number {
  return px_per_mm && px_per_mm > 0 ? px_per_mm : MM_TO_PX;
}

/**
 * 화면 px 반경 → 프레임 로컬 mm.
 * 좌표는 mm 로 두고 반경만 화면 두께로 맞춘다.
 * @param px_per_mm 캔버스 CSS px / 페이지 mm. 없거나 0 이하면 zoom 1
 * @returns 로컬 mm. SNAP_PATH_PX / px_per_mm
 */
export function snapRadiusMm(px_per_mm?: number): number {
  return SNAP_PATH_PX / pxPerMm(px_per_mm);
}

/**
 * 꼭짓점 자석 반경. 경로보다 넓어 중점이 선분에 지지 않게.
 * @param px_per_mm 캔버스 CSS px / 페이지 mm. 없거나 0 이하면 zoom 1
 */
export function snapVertexRadiusMm(px_per_mm?: number): number {
  return SNAP_VERTEX_PX / pxPerMm(px_per_mm);
}

/**
 * zoom 1 기본 mm. closestOnPath 기본 인자용.
 * 호출 측은 snapRadiusMm(px_per_mm) 을 쓸 것.
 */
export const SNAP_PATH_MM = snapRadiusMm();

export type PathSnap = {
  id: string;
  x: number;
  y: number;
  d: number;
  /** a→b. 선분은 [0,1]. unbound 는 밖도. */
  t: number;
};

/**
 * 반경 안 가장 가까운 발.
 * @param p 질의 점
 * @param segs 경로 조각. 빈 배열이면 null
 * @param maxD 반경. 기본 SNAP_PATH_MM
 * @returns 발 좌표와 거리. 없으면 null
 */
export function closestOnPath(
  p: [number, number],
  segs: readonly PathSeg[],
  maxD: number = SNAP_PATH_MM,
): PathSnap | null {
  let best: PathSnap | null = null;
  for (const seg of segs) {
    const at = footOnSeg(p, seg);
    if (at.d > maxD) {
      continue;
    }
    if (!best || at.d < best.d) {
      best = { id: seg.id, x: at.x, y: at.y, d: at.d, t: at.t };
    }
  }
  return best;
}

/**
 * 한 조각 위 발과 t. on_path 점이 이 t 만 고친다.
 */
export function paramOnSeg(
  p: [number, number],
  seg: PathSeg,
): { x: number; y: number; t: number; d: number } {
  return footOnSeg(p, seg);
}

function footOnSeg(
  p: [number, number],
  seg: PathSeg,
): { x: number; y: number; t: number; d: number } {
  const [ax, ay] = seg.a;
  const [bx, by] = seg.b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return { x: ax, y: ay, t: 0, d: hypot(p, ax, ay) };
  }
  let t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2;
  if (!seg.unbound) {
    t = Math.min(1, Math.max(0, t));
  }
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { x, y, t, d: hypot(p, x, y) };
}

function hypot(p: [number, number], x: number, y: number): number {
  return Math.hypot(p[0] - x, p[1] - y);
}
