/**
 * 역학 장면의 경로·물체 기하. 좌표는 봉투 view의 y-up 단위다.
 * 물리량·렌더러·페이지 크기를 모르며 schema의 원본 값에서만 좌표를 계산한다.
 * 경로 접선은 물체의 자세만 정한다. 운동이나 힘의 평형은 계산하지 않는다.
 */
import { stemfigError } from "@stemfig/host";
import type { Block, Track, Vec } from "./schema.ts";
import type { ResolvedPose } from "./init.ts";

/* 2차 곡선의 현 오차가 모서리 trim 거리의 약 1/1000보다 작도록 24분할한다. */
const CORNER_STEPS = 24;
/* spec의 각도는 도다. 삼각함수 경계에서만 라디안으로 바꾼다. */
const DEG_TO_RAD = Math.PI / 180;

/**
 * 경로 모서리를 인접 선분 안쪽의 2차 곡선으로 둥글린다.
 * 각 끝의 trim은 선분 절반 이하여야 이웃 모서리가 교차하지 않는다.
 * @param track 원본 꼭짓점과 장면 단위의 rounding 거리
 * @returns 연속 중복점이 없는 경로. 입력 배열은 바꾸지 않는다
 * @throws 전체 길이가 0이거나 계산 가능한 범위를 벗어나면 SPEC
 */
export function sampleTrack(track: Track): Vec[] {
  const points: Vec[] = [];
  for (const point of track.points) append(points, point);
  segmentsOf(points);
  if (track.rounding === 0 || points.length < 3) return points;
  const output: Vec[] = [[...points[0]!]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const before = points[index - 1]!;
    const vertex = points[index]!;
    const after = points[index + 1]!;
    const left = distance(before, vertex);
    const right = distance(vertex, after);
    const trim = Math.min(track.rounding, left / 2, right / 2);
    const entry = mix(vertex, before, trim / left);
    const exit = mix(vertex, after, trim / right);
    append(output, entry);
    /* 제어점을 원래 꼭짓점에 두어 수평 구간의 높이를 넘어서는 overshoot를 막는다. */
    for (let step = 1; step <= CORNER_STEPS; step += 1) {
      const t = step / CORNER_STEPS;
      append(output, mix(mix(entry, vertex, t), mix(vertex, exit, t), t));
    }
  }
  append(output, points[points.length - 1]!);
  return output;
}

/**
 * 샘플 경로의 누적 길이를 기준으로 위치와 접선 자세를 구한다.
 * @param points sampleTrack의 출력. 길이 0인 중복 선분은 무시한다
 * @param t 전체 호 길이 비율. 유한한 값은 0..1로 제한한다
 * @returns 바닥 부착점과 y-up 반시계 방향의 도 단위 각도
 * @throws 경로 전체 길이가 0이거나 t가 유한하지 않으면 SPEC
 */
export function pointOnTrack(points: Vec[], t: number): ResolvedPose {
  if (!Number.isFinite(t)) throw stemfigError("SPEC", "track.t", "track position must be finite");
  const { segments, total } = segmentsOf(points);
  const target = Math.min(1, Math.max(0, t)) * total;
  const segment = segments.find((item) => target <= item.start + item.length) ?? segments[segments.length - 1]!;
  return {
    point: mix(segment.a, segment.b, Math.min(1, Math.max(0, (target - segment.start) / segment.length))),
    angle: Math.atan2(segment.b[1] - segment.a[1], segment.b[0] - segment.a[0]) / DEG_TO_RAD,
  };
}

/**
 * 커서와 경로의 가장 가까운 지점을 호 길이 비율로 돌려준다.
 * @param points sampleTrack의 출력
 * @param point 장면 좌표의 커서 위치
 * @returns 경로 위 좌표, 저장할 t, 장면 단위의 거리. 동률이면 먼저 만난 선분
 * @throws 전체 경로 길이가 0이면 SPEC
 */
export function nearestOnTrack(points: Vec[], point: Vec): { point: Vec; t: number; distance: number } {
  const { segments, total } = segmentsOf(points);
  let nearest = { point: [...segments[0]!.a] as Vec, t: 0, distance: Infinity };
  for (const segment of segments) {
    const dx = segment.b[0] - segment.a[0];
    const dy = segment.b[1] - segment.a[1];
    /* 길이 제곱 대신 단위 접선을 써서 큰 장면에서도 중간 계산이 넘치지 않게 한다. */
    const along = Math.min(1, Math.max(0,
      ((point[0] - segment.a[0]) * (dx / segment.length)
        + (point[1] - segment.a[1]) * (dy / segment.length)) / segment.length));
    const projected = mix(segment.a, segment.b, along);
    const away = distance(projected, point);
    if (away < nearest.distance) {
      nearest = { point: projected, t: (segment.start + segment.length * along) / total, distance: away };
    }
  }
  return nearest;
}

/**
 * 바닥 중앙을 기준으로 회전한 블록 외곽을 만든다.
 * @param block 원본 폭·높이. 단위는 장면 좌표다
 * @param pose init에서 해석한 바닥 중앙과 도 단위의 각도
 * @returns 바닥 왼쪽, 바닥 오른쪽, 위 오른쪽, 위 왼쪽 순서의 네 점
 */
export function blockCorners(block: Block, pose: ResolvedPose): Vec[] {
  const c = Math.cos(pose.angle * DEG_TO_RAD);
  const s = Math.sin(pose.angle * DEG_TO_RAD);
  const local: Vec[] = [[-block.width / 2, 0], [block.width / 2, 0],
    [block.width / 2, block.height], [-block.width / 2, block.height]];
  return local.map(([x, y]) => [pose.point[0] + x * c - y * s, pose.point[1] + x * s + y * c]);
}

type Segment = { a: Vec; b: Vec; length: number; start: number };

function segmentsOf(points: Vec[]): { segments: Segment[]; total: number } {
  const segments: Segment[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = distance(a, b);
    if (length === 0) continue;
    segments.push({ a, b, length, start: total });
    total += length;
  }
  if (!(total > 0) || !Number.isFinite(total)) {
    throw stemfigError("SPEC", "track.points", "track must have a finite positive length");
  }
  return { segments, total };
}

function append(points: Vec[], point: Vec): void {
  const last = points[points.length - 1];
  if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push([...point]);
}

function mix(a: Vec, b: Vec, t: number): Vec {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
