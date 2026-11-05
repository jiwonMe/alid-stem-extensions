/**
 * y=f(x) 두 체제 샘플의 조립. GeoDef 를 모른다.
 * 뷰 → ScreenMap(explicit-screen) → 체제 분류(explicit-region) → 띠 봉투(explicit-envelope)
 * → 곡선만 적응 분할(explicit-sample) → 폴리라인(explicit-branch).
 * 여기서는 순서와 예산만 정한다. px 상수는 RES, 판정 규칙은 각 모듈.
 */
import type { PathPoint, ViewBox, XSpan } from "../path.ts";
import type { ExplicitAlong } from "./equation.ts";
import { buildExplicitBranches } from "./explicit-branch.ts";
import { bandOutline, envelopeOf, type ExplicitBand } from "./explicit-envelope.ts";
import { classifyRegions } from "./explicit-region.ts";
import { sampleCurvePoints } from "./explicit-sample.ts";
import { RES, alignedEdges, screenMap, type ScreenMap } from "./explicit-screen.ts";

export type { ExplicitAlong } from "./equation.ts";
export type { BandColumn, ExplicitBand } from "./explicit-envelope.ts";

/**
 * 프레임 없을 때 시트 폭. 70mm * MM_TO_PX.
 * compile 은 frame.w * MM_TO_PX 를 넘긴다.
 */
export const FALLBACK_WIDTH_PX = 280;

/** 이 화면 폭(px) 안에서 y 박스를 위→아래로 관통하는 선분은 점근선이라 끊는다. */
const ASYMPTOTE_SPAN_PX = 1;

/** 시트 px 당 평가 예산. spacingPx 격자 + 깊이 5 분할이 들어가는 크기. */
const EVALS_PER_PX = 32;

/**
 * 곡선 토막과 해상 불가 띠.
 * 낙서와 막대를 섞지 않는다. 띠 모양은 explicit-envelope 의 열 봉투.
 */
export type ExplicitPlot = {
  parts: PathPoint[][];
  bands: ExplicitBand[];
};

/** 뷰로 잘라 낸 domain 과 그 화면 매핑. 여기서부터 모든 단계가 같은 값을 쓴다. */
type Stage = { lo: number; hi: number; screen: ScreenMap };

/**
 * 구간을 나눈 뒤 각 체제만 그린다.
 * @param y 독립 변수 → 종속 값. along=x 면 y(x), along=y 면 x(y)
 * @param x0 독립 구간 왼쪽
 * @param x1 오른쪽. x0===x1 이면 빈 plot
 * @param box 클립·오차. 없으면 독립 구간 × [-1,1] (along=y 면 축이 바뀜)
 * @param widthPx frame.w * MM_TO_PX. 없으면 FALLBACK_WIDTH_PX
 * @param along 독립 축. y 면 박스를 뒤집고 같은 샘플러를 쓴 뒤 좌표를 되돌린다
 */
export function sampleExplicit(
  y: (x: number) => number,
  x0: number,
  x1: number,
  box?: ViewBox,
  widthPx?: number,
  along: ExplicitAlong = "x",
): ExplicitPlot {
  const clip = box ?? defaultClip(x0, x1, along);
  const work = along === "y" ? swapBox(clip) : clip;
  const px = indepPx(clip, widthPx ?? FALLBACK_WIDTH_PX, along);
  const plot = sampleAlongX(y, x0, x1, work, px);
  return along === "y" ? swapPlot(plot) : plot;
}

/**
 * 독립축이 x 인 경우만. along=y 는 호출 측이 박스를 뒤집고 여기서 나온 plot 을 되돌린다.
 */
function sampleAlongX(
  y: (x: number) => number,
  x0: number,
  x1: number,
  box: ViewBox,
  widthPx: number,
): ExplicitPlot {
  const stage = stageOf(x0, x1, box, widthPx);
  if (!stage) {
    return { parts: [], bands: [] };
  }
  const { curves, bands } = regimes(y, stage);
  const budget = Math.max(200, Math.floor(EVALS_PER_PX * widthPx));
  const parts: PathPoint[][] = [];
  for (const span of curves) {
    parts.push(...sampleSpan(y, span, stage, budget));
  }
  return { parts, bands };
}

/**
 * domain ∩ 뷰 x 범위와 ScreenMap. 뷰 밖 domain 은 호스트 clip 이 어차피 지우므로
 * 스캔 예산을 보이는 폭에만 쓴다.
 * @returns 보이는 폭이 없거나 화면 매핑이 안 되면 undefined
 */
function defaultClip(t0: number, t1: number, along: ExplicitAlong): ViewBox {
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  return along === "y"
    ? { xmin: -1, xmax: 1, ymin: lo, ymax: hi }
    : { xmin: lo, xmax: hi, ymin: -1, ymax: 1 };
}

/**
 * 독립축 시트 px. along=y 면 프레임 세로가 독립이라 가로×(boxH/boxW).
 * frameBox 는 프레임 네 귀라 이 비율이 곧 frame.h * MM_TO_PX 다.
 */
function indepPx(clip: ViewBox, widthPx: number, along: ExplicitAlong): number {
  if (along !== "y") {
    return widthPx;
  }
  const boxW = clip.xmax - clip.xmin;
  const boxH = clip.ymax - clip.ymin;
  return boxW > 0 ? widthPx * (boxH / boxW) : widthPx;
}

function swapBox(box: ViewBox): ViewBox {
  return { xmin: box.ymin, xmax: box.ymax, ymin: box.xmin, ymax: box.xmax };
}

function swapPt(p: PathPoint): PathPoint {
  return { x: p.y, y: p.x };
}

/**
 * 샘플러는 항상 y=f(x). along=y 결과는 좌표를 뒤집어 세계에 올린다.
 * 띠 열은 독립축 순서를 유지하고 along 만 y 로 표시 — 히트·외곽선이 축을 안다.
 */
function swapPlot(plot: ExplicitPlot): ExplicitPlot {
  return {
    parts: plot.parts.map((part) => part.map(swapPt)),
    bands: plot.bands.map((band) => ({ ...band, along: "y" as const })),
  };
}

function stageOf(
  x0: number,
  x1: number,
  clip: ViewBox,
  widthPx: number,
): Stage | undefined {
  if (x0 === x1) {
    return undefined;
  }
  const lo = Math.max(Math.min(x0, x1), clip.xmin);
  const hi = Math.min(Math.max(x0, x1), clip.xmax);
  if (!(hi > lo)) {
    return undefined;
  }
  const screen = screenMap(clip, widthPx);
  return screen ? { lo, hi, screen } : undefined;
}

/**
 * 체제 분류 + 띠 봉투. 봉투를 못 만든 덩어리(박스 밖, 고립 극)는 비우지 않고 곡선으로 되돌린다.
 * 그래야 tan(1/x) 극처럼 분류는 "덩어리" 였지만 보이는 진폭이 없는 곳에 구멍이 나지 않는다.
 * @returns curves 는 x 오름차순
 */
function regimes(
  y: (x: number) => number,
  stage: Stage,
): { curves: XSpan[]; bands: ExplicitBand[] } {
  const { curves, packed } = classifyRegions(y, stage.lo, stage.hi, stage.screen);
  const bands: ExplicitBand[] = [];
  for (const span of packed) {
    const env = envelopeOf(y, span, stage.screen);
    if (env) {
      bands.push(env);
    } else {
      curves.push(span);
    }
  }
  curves.sort((a, b) => a.x0 - b.x0);
  return { curves, bands };
}

/**
 * 곡선 구간 하나를 적응 분할해 폴리라인으로. 예산은 보이는 폭 대비 구간 폭 비례.
 * 초기 표본은 분류와 같은 원점 정렬 격자(RES.spacingPx) — 팬·작은 줌에 정점이 같은 자리에 남는다.
 */
function sampleSpan(
  y: (x: number) => number,
  span: XSpan,
  stage: Stage,
  budget: number,
): PathPoint[][] {
  const w = span.x1 - span.x0;
  if (!(w > 0)) {
    return [];
  }
  const { screen } = stage;
  const share = w / (stage.hi - stage.lo);
  const maxEvals = Math.max(48, Math.floor(budget * share));
  const minStep = RES.minResolvePx / screen.pxPerUnitX;
  const evalAt = (x: number) => {
    const v = y(x);
    return Number.isFinite(v) ? { x, y: v } : undefined;
  };
  const samples = sampleCurvePoints(
    evalAt,
    alignedEdges(span.x0, span.x1, screen, RES.spacingPx),
    screen,
    minStep,
    maxEvals,
  );
  /* 가지는 뷰 y 로만 자른다. x 는 보이는 domain 그대로 — 구간 끝의 교점을 지우지 않는다. */
  const branchBox: ViewBox = {
    xmin: stage.lo,
    xmax: stage.hi,
    ymin: screen.box.ymin,
    ymax: screen.box.ymax,
  };
  return buildExplicitBranches(samples, branchBox, ASYMPTOTE_SPAN_PX);
}

/**
 * plot → 폴리라인 목록. 띠는 외곽선 하나로 편다.
 * 히트·스냅·교점처럼 "선" 만 아는 소비자가 쓴다. compile 은 띠를 polygon 으로 따로 채운다.
 */
export function plotPolylines(plot: ExplicitPlot): PathPoint[][] {
  return [...plot.parts, ...plot.bands.map(bandOutline)];
}
