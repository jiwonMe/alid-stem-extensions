/**
 * 곡선 스트로크 히트. 평탄화 폴리라인까지 로컬 mm.
 * 해상 불가 띠는 채운 영역: 안이면 0, 밖이면 테두리까지. 호스트는 이 모듈을 모른다.
 */
import { fitView, type Frame, type View } from "@stemfig/display";
import { curvePlot } from "../compile-curve.ts";
import type { GeometryState } from "../init.ts";
import { bandContains, bandOutline } from "../math/explicit-envelope.ts";
import type { ExplicitBand } from "../math/explicit.ts";
import type { PathPoint } from "../path.ts";
import { isCurveEdge } from "../schema.ts";

/**
 * @returns 로컬 mm 거리. 곡선이 아니면 undefined
 */
export function curveStrokeDist(
  state: GeometryState,
  obj: GeometryState["spec"]["objects"][number],
  view: View,
  frame: Frame,
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
): number | undefined {
  if (!isCurveEdge(obj.def[0])) {
    return undefined;
  }
  const plot = curvePlot(obj, state.points, view, frame);
  let best = Infinity;
  for (const band of plot.bands) {
    best = Math.min(best, distToBand(local, band, view, frame, toLocal));
  }
  for (const part of plot.parts) {
    best = Math.min(best, distToPolyline(local, part, toLocal));
  }
  return best === Infinity ? undefined : best;
}

/**
 * 안/밖 판정은 수학 좌표(열 봉투), 거리는 로컬 mm(테두리).
 * fitView 역변환으로 포인터를 수학 좌표에 올린다.
 */
function distToBand(
  p: [number, number],
  band: ExplicitBand,
  view: View,
  frame: Frame,
  toLocal: (x: number, y: number) => [number, number],
): number {
  const { fromLocal } = fitView(view, frame);
  const [mx, my] = fromLocal(p[0], p[1]);
  if (bandContains(band, mx, my)) {
    return 0;
  }
  return distToPolyline(p, bandOutline(band), toLocal);
}

function distToPolyline(
  p: [number, number],
  part: PathPoint[],
  toLocal: (x: number, y: number) => [number, number],
): number {
  let best = Infinity;
  for (let i = 1; i < part.length; i += 1) {
    const a = toLocal(part[i - 1]!.x, part[i - 1]!.y);
    const b = toLocal(part[i]!.x, part[i]!.y);
    best = Math.min(best, distToSeg(p, a, b));
  }
  return best;
}

function distToSeg(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return Math.hypot(p[0] - a[0], p[1] - a[1]);
  }
  const t = Math.min(
    1,
    Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2),
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
