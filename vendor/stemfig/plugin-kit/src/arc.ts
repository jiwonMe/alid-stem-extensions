/**
 * 호·직각·이등분 라벨의 좌표.
 * 단위는 호출 측과 같다. 교과 상수(반지름·간격)는 플러그인이 넘긴다.
 * DisplayList 에 arc 가 없어 표본 점으로만 돌려준다.
 */
export type ArcPoint = { x: number; y: number };

const EPS = 1e-9;

/**
 * 시작각에서 끝각까지 짧은 방향의 부호 있는 라디안.
 * @param from 시작각
 * @param to 끝각
 * @returns (-π, π]. 같은 방향이면 0
 */
export function shorterSweep(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * 중심·반지름·호 각으로 표본을 만든다. 양 끝을 포함한다.
 * @param center 호 중심
 * @param radius 호출 측 단위의 반지름
 * @param start 시작 라디안
 * @param delta 부호 있는 호 각. 0 이면 한 점
 * @param steps 구간 수. 점은 steps+1 개
 * @returns 새 점 배열. 입력을 바꾸지 않는다
 */
export function sampleArcPoints(
  center: ArcPoint,
  radius: number,
  start: number,
  delta: number,
  steps: number,
): ArcPoint[] {
  const count = Math.max(1, Math.round(steps));
  const points: ArcPoint[] = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = start + (delta * index) / count;
    points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  }
  return points;
}

/**
 * 꼭짓점에서 두 변 방향으로 한 변이 inset 인 직각 표시.
 * 실제 각이 90°가 아니어도 두 방향의 평행사변형을 만든다.
 * @returns 변 A 위, 바깥 꼭짓점, 변 B 위. 길이가 0이면 undefined
 */
export function rightCorner(
  v: ArcPoint,
  a: ArcPoint,
  b: ArcPoint,
  inset: number,
): [ArcPoint, ArcPoint, ArcPoint] | undefined {
  const ua = unit(v, a);
  const ub = unit(v, b);
  if (!ua || !ub) return undefined;
  const p1 = { x: v.x + ua.x * inset, y: v.y + ua.y * inset };
  const p2 = { x: p1.x + ub.x * inset, y: p1.y + ub.y * inset };
  const p3 = { x: v.x + ub.x * inset, y: v.y + ub.y * inset };
  return [p1, p2, p3];
}

/**
 * 짧은 각의 이등분선 위, 중심에서 distance 만큼 떨어진 점.
 * @param distance 호출 측 단위. 호 반지름에 글자 여백을 더한 값
 * @returns 퇴화한 각이면 undefined
 */
export function bisectorAt(
  v: ArcPoint,
  a: ArcPoint,
  b: ArcPoint,
  distance: number,
): ArcPoint | undefined {
  if (!unit(v, a) || !unit(v, b)) return undefined;
  const start = Math.atan2(a.y - v.y, a.x - v.x);
  const delta = shorterSweep(start, Math.atan2(b.y - v.y, b.x - v.x));
  if (Math.abs(delta) < EPS) return undefined;
  const mid = start + delta / 2;
  return { x: v.x + Math.cos(mid) * distance, y: v.y + Math.sin(mid) * distance };
}

function unit(from: ArcPoint, to: ArcPoint): ArcPoint | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return undefined;
  return { x: dx / len, y: dy / len };
}
