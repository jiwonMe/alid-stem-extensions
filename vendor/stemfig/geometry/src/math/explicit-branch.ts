/**
 * 적응 표본 → 폴리라인. GeoDef 를 모른다.
 * 박스 경계 교점까지 잇고, 고립 점근선만 끊는다. euclidraw graph-curve-branches.
 */
import type { PathPoint, ViewBox } from "../path.ts";
import { DEGENERATE_STEP, type CurveSample } from "./explicit-sample.ts";

/**
 * null 에서 끊고, 점근선 수직 연결은 버린다.
 * @param asymptoteSpanPx 이 화면 폭 안에서 y 박스를 관통하면 끊음. 0 이면 검사 안 함
 */
export function buildExplicitBranches(
  samples: ReadonlyArray<CurveSample | null>,
  box: ViewBox,
  asymptoteSpanPx: number,
): PathPoint[][] {
  const parts: PathPoint[][] = [];
  let run: PathPoint[] | undefined;
  let prev: CurveSample | null = null;
  for (const sample of samples) {
    if (!sample || !prev) {
      run = undefined;
      prev = sample;
      continue;
    }
    const dx = sample.math.x - prev.math.x;
    const dy = sample.math.y - prev.math.y;
    if (Math.abs(dx) < DEGENERATE_STEP && Math.abs(dy) < DEGENERATE_STEP) {
      prev = sample;
      continue;
    }
    if (isAsymptote(prev, sample, box, asymptoteSpanPx)) {
      run = undefined;
      prev = sample;
      continue;
    }
    const piece = clipSeg(prev.math, sample.math, box);
    if (!piece) {
      run = undefined;
      prev = sample;
      continue;
    }
    if (run && piece.t0 <= 0) {
      run.push(piece.end);
    } else {
      run = [piece.start, piece.end];
      parts.push(run);
    }
    if (piece.t1 < 1) {
      run = undefined;
    }
    prev = sample;
  }
  return parts;
}

function isAsymptote(
  start: CurveSample,
  end: CurveSample,
  box: ViewBox,
  spanPx: number,
): boolean {
  if (spanPx <= 0) {
    return false;
  }
  const startOut = start.math.y > box.ymax || start.math.y < box.ymin;
  const endOut = end.math.y > box.ymax || end.math.y < box.ymin;
  const through =
    (start.math.y > box.ymax && end.math.y < box.ymin) ||
    (start.math.y < box.ymin && end.math.y > box.ymax);
  if (!through || !startOut || !endOut) {
    return false;
  }
  return Math.abs(end.screen.x - start.screen.x) <= spanPx;
}

function clipSeg(a: PathPoint, b: PathPoint, box: ViewBox) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < DEGENERATE_STEP && Math.abs(dy) < DEGENERATE_STEP) {
    return undefined;
  }
  let t0 = 0;
  let t1 = 1;
  const edge = (p: number, q: number) => {
    if (Math.abs(p) < DEGENERATE_STEP) {
      return q >= 0;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) {
        return false;
      }
      if (t > t0) {
        t0 = t;
      }
    } else {
      if (t < t0) {
        return false;
      }
      if (t < t1) {
        t1 = t;
      }
    }
    return true;
  };
  if (!edge(-dx, a.x - box.xmin) || !edge(dx, box.xmax - a.x)) {
    return undefined;
  }
  if (!edge(-dy, a.y - box.ymin) || !edge(dy, box.ymax - a.y)) {
    return undefined;
  }
  return {
    t0,
    t1,
    start: { x: a.x + t0 * dx, y: a.y + t0 * dy },
    end: { x: a.x + t1 * dx, y: a.y + t1 * dy },
  };
}
