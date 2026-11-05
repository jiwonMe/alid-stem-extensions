/**
 * 시작점·끝점·발사각으로 정하는 이차 곡선.
 * 저장된 것은 각도와 두 점뿐이다. 속도와 중력으로 시간을 적분하지 않는다.
 * 장면 y-up. 페이지 표본 개수는 호출 측 배율로 정한다.
 */
import type { Vec } from "./schema.ts";

/** 해석된 곡선. 표본은 그릴 때 배율에 맞춰 다시 만든다. */
export type Flight = {
  a: Vec;
  b: Vec;
  /** 진행 방향. 오른쪽이 +1. */
  s: number;
  /** 수평 거리. 0 이면 곡선이 아니다. */
  D: number;
  /** tan(발사각). */
  T: number;
  /** 이차항. 0 이하면 끝점보다 낮은 발사다. */
  k: number;
  angle: number;
};

const EPS = 1e-9;

/**
 * 끝점을 지나는 곡선을 만든다.
 * @param a 시작 장면 좌표
 * @param b 끝 장면 좌표
 * @param angle 진행 방향의 수평에서 잰 앙각. 도
 * @returns 수평 거리가 없거나 발사가 끝점보다 낮으면 undefined. 입력을 바꾸지 않는다
 */
export function solveFlight(a: Vec, b: Vec, angle: number): Flight | undefined {
  const dx = b[0] - a[0];
  if (!(Math.abs(dx) > EPS) || !Number.isFinite(angle)) return undefined;
  const s = Math.sign(dx);
  const D = Math.abs(dx);
  const T = Math.tan(angle * Math.PI / 180);
  const h = b[1] - a[1];
  const k = (T * D - h) / (D * D);
  if (!(k > EPS) || !Number.isFinite(k)) return undefined;
  return { a: [...a], b: [...b], s, D, T, k, angle };
}

/**
 * @param flight 해석된 곡선
 * @param u 시작에서 진행 방향으로 잰 수평 거리. 0..D
 * @returns 장면 좌표
 */
export function pointOnFlight(flight: Flight, u: number): Vec {
  const clamped = Math.min(flight.D, Math.max(0, u));
  return [flight.a[0] + flight.s * clamped, flight.a[1] + flight.T * clamped - flight.k * clamped * clamped];
}

/**
 * @param flight 해석된 곡선
 * @param u 수평 거리
 * @returns 정규화하지 않은 장면 접선. 왼쪽 발사도 x 성분이 진행 방향이다
 */
export function tangentOnFlight(flight: Flight, u: number): Vec {
  return [flight.s, flight.T - 2 * flight.k * u];
}

/**
 * 구간 안의 최고점. 꼭짓점이 밖이면 undefined 이고 호출 측은 더 높은 끝을 쓴다.
 * @param flight 해석된 곡선
 * @returns 수평 거리. 없거나 끝이면 undefined
 */
export function apexDistance(flight: Flight): number | undefined {
  const u = flight.T / (2 * flight.k);
  return u > EPS && u < flight.D - EPS ? u : undefined;
}

/**
 * 최고점 높이로 발사각의 탄젠트를 되돌린다.
 * @param flight 현재 곡선. D 와 끝 높이 차만 쓴다
 * @param height 시작점 기준 최고점 높이. 장면 단위
 * @returns 새 탄젠트. 끝점보다 낮으면 undefined
 */
export function tangentFromApex(flight: Flight, height: number): number | undefined {
  const h = flight.b[1] - flight.a[1];
  if (!(height > Math.max(0, h) + EPS)) return undefined;
  const value = 2 * (height + Math.sqrt(height * (height - h))) / flight.D;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * 페이지에서 현 오차가 0.01mm 를 넘지 않는 표본 수.
 * @param flight 해석된 곡선
 * @param mmPerUnit 장면 1단위가 차지하는 페이지 mm. stretch 면 큰 축
 * @returns 32..2048
 */
export function flightSteps(flight: Flight, mmPerUnit: number): number {
  const scale = Math.max(mmPerUnit, EPS);
  const sag = 0.01 / scale;
  const step = Math.sqrt((8 * sag) / flight.k);
  const count = Math.ceil(flight.D / Math.max(step, EPS));
  return Math.min(2048, Math.max(32, count));
}

/**
 * @param flight 해석된 곡선
 * @param steps flightSteps 결과
 * @returns 시작과 끝을 포함한 장면 표본
 */
export function sampleFlight(flight: Flight, steps: number): Vec[] {
  const count = Math.max(1, steps);
  return Array.from({ length: count + 1 }, (_, index) => pointOnFlight(flight, flight.D * index / count));
}

/**
 * 연결에 쓸 가장 높은 점. 내부 꼭짓점이 없으면 더 높은 끝이다.
 * @param flight 해석된 곡선
 * @returns 장면 좌표. 각도를 바꿔도 사라지지 않는다
 */
export function apexPoint(flight: Flight): Vec {
  const u = apexDistance(flight);
  if (u !== undefined) return pointOnFlight(flight, u);
  return flight.a[1] >= flight.b[1] ? [...flight.a] : [...flight.b];
}

/**
 * 호 길이 비율의 수평 거리. 표본 폴리라인으로 잰다.
 * @param samples 장면 표본
 * @param fraction 0..1
 * @returns 그 위치와 다음 표본을 잇는 접선 방향
 */
export function alongSamples(samples: readonly Vec[], fraction: number): { at: Vec; dir: Vec } | undefined {
  if (samples.length < 2) return undefined;
  const lengths: number[] = [0];
  for (let index = 1; index < samples.length; index += 1) {
    const a = samples[index - 1]!;
    const b = samples[index]!;
    lengths.push(lengths[index - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths.at(-1)!;
  if (!(total > EPS)) return undefined;
  const target = Math.min(1, Math.max(0, fraction)) * total;
  let index = 1;
  while (index < lengths.length - 1 && lengths[index]! < target) index += 1;
  const a = samples[index - 1]!;
  const b = samples[index]!;
  const span = lengths[index]! - lengths[index - 1]!;
  const t = span > EPS ? (target - lengths[index - 1]!) / span : 0;
  return {
    at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    dir: [b[0] - a[0], b[1] - a[1]],
  };
}
