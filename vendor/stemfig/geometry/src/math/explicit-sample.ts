/**
 * y=f(x) 적응 표본. GeoDef 를 모른다. px 기준은 explicit-screen 의 RES.
 * 오차는 ViewBox 를 가상 픽셀로 본 현 편차. euclidraw graph-curve-sampler.
 * 중간점을 항상 1/2 로 두면 sin 위상이 맞아 평탄 착시가 난다.
 */
import type { PathPoint } from "../path.ts";
import { RES, type ScreenMap } from "./explicit-screen.ts";

/** 재귀 분할 최대 깊이. euclidraw 20. */
const MAX_DEPTH = 20;

/** 이보다 짧은 화면 현은 더 나누지 않는다. 허용 오차의 절반 아래. */
const MIN_CHORD_PX = RES.tolerancePx / 2.5;

/** 한 초기 구간(1px) 최소 평가. 한쪽 예산 고갈로 반대쪽이 거칠어지는 것을 막는다. */
const MIN_INTERVAL_EVALS = 32;

/** 초기 샘플 수 상한. */
const MAX_SAMPLE_COUNT = 8192;

/** 발산 y 를 밴드 안으로 자를 여유 px. */
const VISIBLE_MARGIN_PX = 16;

/** 방향 0 선분. */
export const DEGENERATE_STEP = 1e-12;

/** 적응 분할 한 점. visible 은 발산 y 를 밴드 안으로 자른 화면 좌표. */
export type CurveSample = {
  math: PathPoint;
  screen: PathPoint;
  visible: PathPoint;
};

/**
 * t 순 표본. null 은 미정·발산 — 호출 측이 끊는다.
 * @param evalAt 유한 점이면 좌표, 아니면 undefined
 * @param initialTs 초기 표본 t. 오름차순, 양 끝 포함. 호출 측이 원점 정렬 격자를 넘긴다
 * @param minParamStep 이보다 좁으면 해상 한계. 0 이면 제한 없음
 * @param maxEvaluations 구간 예산. 전 구간 40000 을 쓰지 않는다
 */
export function sampleCurvePoints(
  evalAt: (t: number) => PathPoint | undefined,
  initialTs: number[],
  screen: ScreenMap,
  minParamStep: number,
  maxEvaluations: number,
): Array<CurveSample | null> {
  if (initialTs.length < 2) {
    return [];
  }
  const band = {
    min: screen.yTopPx - VISIBLE_MARGIN_PX,
    max: screen.yBottomPx + VISIBLE_MARGIN_PX,
  };
  let remain = maxEvaluations;
  let intervalLeft = maxEvaluations;
  const sampleAt = (t: number): CurveSample | null => {
    remain -= 1;
    intervalLeft -= 1;
    const math = evalAt(t);
    if (!math || !Number.isFinite(math.x) || !Number.isFinite(math.y)) {
      return null;
    }
    const mapped = screen.toScreen(math.x, math.y);
    if (!Number.isFinite(mapped.x) || !Number.isFinite(mapped.y)) {
      return null;
    }
    return { math, screen: mapped, visible: clampY(mapped, band) };
  };
  const hasBudget = () => remain > 0 && intervalLeft > 0;
  const out: Array<CurveSample | null> = [];
  const refine = (
    left: CurveSample | null,
    tLeft: number,
    right: CurveSample | null,
    tRight: number,
    depth: number,
  ) => {
    const known = left !== null && right !== null;
    const atLimit = minParamStep > 0 && known && tRight - tLeft <= minParamStep;
    if (depth < MAX_DEPTH && !atLimit && hasBudget() && mayRefine(left, right)) {
      const tSplit = splitParam(tLeft, tRight, depth);
      if (tSplit > tLeft && tSplit < tRight) {
        const middle = sampleAt(tSplit);
        const flat =
          known &&
          middle !== null &&
          chordDev(left.visible, middle.visible, right.visible) <= RES.tolerancePx;
        if (!flat) {
          refine(left, tLeft, middle, tSplit, depth + 1);
          refine(middle, tSplit, right, tRight, depth + 1);
          return;
        }
      }
    }
    out.push(right);
  };
  const ts = initialTs.slice(0, MAX_SAMPLE_COUNT + 1);
  const count = ts.length - 1;
  const per = Math.max(
    8,
    Math.min(MIN_INTERVAL_EVALS, Math.floor(maxEvaluations / count)),
  );
  let tPrev = ts[0]!;
  let prev = sampleAt(tPrev);
  out.push(prev);
  for (let i = 1; i <= count; i += 1) {
    const t = ts[i]!;
    intervalLeft = per;
    const cur = sampleAt(t);
    refine(prev, tPrev, cur, t, 0);
    prev = cur;
    tPrev = t;
  }
  return out;
}

function clampY(p: PathPoint, band: { min: number; max: number }): PathPoint {
  if (p.y >= band.min && p.y <= band.max) {
    return p;
  }
  return { x: p.x, y: Math.min(band.max, Math.max(band.min, p.y)) };
}

const SPLIT_JITTER = [0.0431, -0.0367, 0.0233, -0.0291];

function splitParam(tLeft: number, tRight: number, depth: number): number {
  return tLeft + (tRight - tLeft) * (0.5 + SPLIT_JITTER[depth % SPLIT_JITTER.length]!);
}

function mayRefine(left: CurveSample | null, right: CurveSample | null): boolean {
  if (!left && !right) {
    return false;
  }
  if (!left || !right) {
    return true;
  }
  const chord = Math.hypot(
    right.visible.x - left.visible.x,
    right.visible.y - left.visible.y,
  );
  return !Number.isFinite(chord) || chord > MIN_CHORD_PX;
}

function chordDev(start: PathPoint, middle: PathPoint, end: PathPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);
  const dev =
    chord < DEGENERATE_STEP
      ? Math.hypot(middle.x - start.x, middle.y - start.y)
      : Math.abs((middle.x - start.x) * dy - (middle.y - start.y) * dx) / chord;
  return Number.isFinite(dev) ? dev : Number.POSITIVE_INFINITY;
}
