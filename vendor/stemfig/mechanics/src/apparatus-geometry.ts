/**
 * 용수철·도르래·받침대의 정적 기하를 장면 y-up 좌표로 계산한다.
 * 선의 두께·페이지 배율·렌더러를 모르며 길이 보존이나 물리 평형을 풀지 않는다.
 * 생성한 점은 init의 캐시에만 두고 원본 JSON에는 복제하지 않는다.
 */
import { stemfigError } from "@stemfig/host";
import type { Pulley, Rope, Support, Vec } from "./schema.ts";

/* 원 한 바퀴를 96분할하면 현의 최대 오차가 반지름의 약 0.054%다.
 * 용수철은 권당 24분할해 작은 코일의 곡률과 편집 비용을 함께 제한한다. */
const CIRCLE_STEPS = 96;
const COIL_STEPS = 24;
const TAU = Math.PI * 2;
/* 접점의 부동소수점 오차만 허용한다. 도르래 내부의 끝점은 작도 오류다. */
const TANGENT_EPSILON = 1e-10;

/**
 * @param support 꼭짓점·폭·높이·회전이 검증된 삼각 받침대
 * @returns 꼭짓점, 밑변 왼쪽, 밑변 오른쪽 순서의 새 좌표. 입력은 변경하지 않는다.
 */
export function supportCorners(support: Support): Vec[] {
  const angle = support.angle * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  return ([[0, 0], [-support.width / 2, -support.height], [support.width / 2, -support.height]] as Vec[])
    .map(([x, y]) => [support.point[0] + x * c - y * s, support.point[1] + x * s + y * c]);
}

/**
 * @param a 시작 연결점 @param b 끝 연결점 @param width 코일 전체 폭 @param coils 검증된 2..40의 정수
 * @returns 직선 단자와 타원형 코일을 잇는 점들. 압축해도 폭과 권수는 유지한다.
 * @throws 두 점이 같거나 계산 범위를 벗어나면 SPEC. 자연 길이·탄성계수는 계산하지 않는다.
 */
export function springPoints(a: Vec, b: Vec, width: number, coils: number): Vec[] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(length > 0) || !Number.isFinite(length)) {
    throw stemfigError("SPEC", "spring.endpoints", "spring endpoints must have a finite positive separation");
  }
  const ux = (b[0] - a[0]) / length, uy = (b[1] - a[1]) / length;
  /* 양 끝 10%는 연결 단자다. 축방향 진폭은 코일 피치의 0.3배로,
   * 교재의 타원형 권선을 보여 주면서 압축 때도 단자 밖으로 튀어나가지 않는다. */
  const lead = length * 0.1, body = length * 0.8, pitch = body / coils;
  const at = (along: number, across: number): Vec => [a[0] + ux * along - uy * across, a[1] + uy * along + ux * across];
  const points: Vec[] = [[...a], at(lead, 0)];
  for (let step = 1; step <= coils * COIL_STEPS; step += 1) {
    const t = step / (coils * COIL_STEPS);
    const phase = TAU * coils * t - Math.PI / 2;
    points.push(at(lead + body * t + pitch * 0.3 * (Math.sin(phase) + 1), width / 2 * Math.cos(phase)));
  }
  points.push([...b]);
  assertFinite(points, "spring");
  return points;
}

/**
 * @param pulley 중심과 반지름이 검증된 도르래
 * @returns 한 바퀴를 닫은 장면 좌표. stretch 투영에서도 타원으로 바르게 그릴 수 있다.
 */
export function pulleyCircle(pulley: Pulley): Vec[] {
  return Array.from({ length: CIRCLE_STEPS + 1 }, (_, step) => circlePoint(pulley, TAU * step / CIRCLE_STEPS));
}

/**
 * 실은 A→접점→원호→접점→B로 잇는다. 감는 방향은 장면 y-up 기준이다.
 * @param a 시작 연결점 @param b 끝 연결점 @param wrap 원호 진행 방향 @param pulley 경유 도르래. 없으면 직선이다.
 * @returns 양 끝이 원본 연결점인 연속 경로. 접선과 원호가 같은 방향으로 만난다.
 * @throws 끝점이 도르래 안쪽이거나 경로가 퇴화하거나 계산 범위를 벗어나면 SPEC
 */
export function ropePoints(a: Vec, b: Vec, wrap: Rope["wrap"], pulley?: Pulley): Vec[] {
  if (!pulley) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(length > 0) || !Number.isFinite(length)) throw stemfigError("SPEC", "rope.endpoints", "rope must have a finite positive length");
    return [[...a], [...b]];
  }
  const direction = wrap === "ccw" ? 1 : -1;
  const start = tangentAngle(a, pulley, direction, true);
  const end = tangentAngle(b, pulley, direction, false);
  const wrapped = ((direction * (end - start)) % TAU + TAU) % TAU;
  /* 같은 접선 위의 두 끝점은 접점 하나에서 만난다. 음수 잔차를 modulo하면
   * 거의 2π가 되어 실이 바퀴를 한 번 더 감으므로 양쪽 경계의 잔차를 0으로 모은다. */
  const sweep = Math.min(wrapped, TAU - wrapped) < TANGENT_EPSILON ? 0 : wrapped;
  const count = Math.max(1, Math.ceil(sweep / TAU * CIRCLE_STEPS));
  const points: Vec[] = [[...a]];
  for (let step = 0; step <= count; step += 1) points.push(circlePoint(pulley, start + direction * sweep * step / count));
  points.push([...b]);
  assertFinite(points, "rope");
  if (!points.some(point => Math.hypot(point[0] - a[0], point[1] - a[1]) > 0)) {
    throw stemfigError("SPEC", "rope.endpoints", "rope must have a positive length");
  }
  return points;
}

function tangentAngle(point: Vec, pulley: Pulley, direction: number, entering: boolean): number {
  const dx = point[0] - pulley.center[0], dy = point[1] - pulley.center[1];
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < pulley.radius * (1 - TANGENT_EPSILON)) {
    throw stemfigError("SPEC", "rope.pulley", "rope endpoints must lie outside the pulley rim");
  }
  const angle = Math.atan2(dy, dx);
  const offset = Math.acos(Math.min(1, pulley.radius / distance));
  /* 진입 접선은 원호 진행 방향과 같은 속도, 이탈 접선은 그 반대 쪽 후보를 쓴다. */
  return angle + (entering ? direction : -direction) * offset;
}

function circlePoint(pulley: Pulley, angle: number): Vec {
  return [pulley.center[0] + pulley.radius * Math.cos(angle), pulley.center[1] + pulley.radius * Math.sin(angle)];
}

function assertFinite(points: Vec[], kind: string): void {
  if (!points.every(point => point.every(Number.isFinite))) throw stemfigError("SPEC", `${kind}.geometry`, "geometry exceeds finite coordinates");
}
