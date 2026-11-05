/**
 * 지면 채움과 받침대 바닥 해칭.
 * depth 와 해칭 간격은 페이지 mm 라 장면을 확대해도 띠 두께가 유지된다.
 * 채움은 표면선보다 먼저 쌓인다. 물리적인 땅의 두께를 계산하지 않는다.
 */
import type { DisplayItem, ResolvedStyle } from "@stemfig/display";
import type { CompileCtx } from "@stemfig/host";
import { GROUND_FILL } from "./print-style.ts";
import type { GroundFill, Vec } from "./schema.ts";

const HATCH_STEP_MM = 1.2;
const HATCH_DEPTH_MM = 1.1;

/**
 * 표면 폴리라인을 한쪽으로 닫은 띠.
 * @param points 페이지 mm 표면. 순서대로
 * @param ground 채움 종류·방향·두께
 * @returns 다각형과, hatch 면 사선. 점이 두 개 미만이면 빈 배열
 */
export function groundBand(points: readonly Vec[], ground: GroundFill, style: ResolvedStyle): DisplayItem[] {
  if (points.length < 2) return [];
  const shift = sideShift(ground.side, ground.depth);
  const base = points.map((point): Vec => [point[0] + shift[0], point[1] + shift[1]]);
  const polygon: DisplayItem = {
    op: "polygon", points: [...points, ...[...base].reverse()],
    fill: ground.style === "shade" ? GROUND_FILL : "none", stroke: "none", width: 0,
  };
  if (ground.style === "shade") return [polygon];
  const hatches = points.slice(1).flatMap((point, index) => segmentHatches(points[index]!, point, shift, style));
  return [polygon, ...hatches];
}

/**
 * 받침대 밑변 해칭. 삼각형 바깥을 향한다.
 * @param points 페이지 mm 꼭짓점·왼쪽·오른쪽
 * @param ctx 상속 선 색
 * @returns 사선. 밑변 길이가 0이면 빈 배열
 */
export function baseHatches(points: Vec[], ctx: CompileCtx): DisplayItem[] {
  const [apex, a, b] = points as [Vec, Vec, Vec];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!length) return [];
  const tangent: Vec = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  let normal: Vec = [-tangent[1], tangent[0]];
  const middle: Vec = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if ((middle[0] - apex[0]) * normal[0] + (middle[1] - apex[1]) * normal[1] < 0) normal = [-normal[0], -normal[1]];
  return hatchRun(a, b, normal, tangent, ctx.style);
}

function segmentHatches(a: Vec, b: Vec, shift: Vec, style: ResolvedStyle): DisplayItem[] {
  const length = Math.hypot(shift[0], shift[1]);
  if (!length) return [];
  const normal: Vec = [shift[0] / length, shift[1] / length];
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent: Vec = span ? [(b[0] - a[0]) / span, (b[1] - a[1]) / span] : [1, 0];
  return hatchRun(a, b, normal, tangent, style);
}

function hatchRun(a: Vec, b: Vec, normal: Vec, tangent: Vec, style: ResolvedStyle): DisplayItem[] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const count = Math.max(1, Math.floor(length / HATCH_STEP_MM));
  return Array.from({ length: count }, (_, index): DisplayItem => {
    const t = (index + 0.5) / count;
    const start: Vec = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    return { op: "polyline", points: [start, [
      start[0] + normal[0] * HATCH_DEPTH_MM + tangent[0] * HATCH_STEP_MM / 2,
      start[1] + normal[1] * HATCH_DEPTH_MM + tangent[1] * HATCH_STEP_MM / 2,
    ]], stroke: style.stroke, width: style.width };
  });
}

function sideShift(side: GroundFill["side"], depth: number): Vec {
  if (side === "above") return [0, -depth];
  if (side === "left") return [-depth, 0];
  if (side === "right") return [depth, 0];
  return [0, depth];
}
