/**
 * @stemfig/display public API.
 * 문서·kind·플러그인을 모른다. 그리기 계약과 SVG 만 export 한다.
 * clip/ 좌표 자르기, svg/ 문자열. latex 는 라벨 HUD 가 같은 글리프를 쓴다.
 */
export type { DisplayItem, DisplayList, DisplaySheet, Frame } from "./types.ts";
export type { ResolvedStyle } from "./style.ts";
export { DEFAULT_CANVAS_FILL, DEFAULT_SHEET_FILL, DEFAULT_STYLE } from "./style.ts";
export type { FitView, View } from "./fit-view.ts";
export type { ViewZoomAxis } from "./nudge-view.ts";
export { fitView, toPage } from "./fit-view.ts";
export type { Axes, Axis, Grid, Ticks } from "./chrome.ts";
export {
  AXES_DEFAULT,
  GRID_DEFAULT,
  axisOn,
  axisPos,
  axesOn,
  gridOn,
  ticksOn,
} from "./chrome.ts";
export { compileChrome } from "./compile-chrome.ts";
export { stealthHead, stealthNotch } from "./chrome-arrow.ts";
export type { StealthMetrics } from "./chrome-arrow.ts";
export { nudgeViewPan, nudgeViewZoomAt, resizeView } from "./nudge-view.ts";
export { clipItems } from "./clip/clip.ts";
export {
  frameContains,
  framesOverlap,
  intersectFrames,
} from "./clip/clip-frame.ts";
export { renderSvg } from "./svg/render-svg.ts";
export {
  latexGroup,
  latexToSvg,
  shouldTypeset,
  texSource,
} from "./svg/latex.ts";
export type { LatexEngine } from "./svg/latex-engine.ts";
export {
  latexEngine,
  latexEngineFromDoc,
  setLatexEngine,
} from "./svg/latex-engine.ts";
export { hydrateUpmath, latexFormulasOf } from "./svg/hydrate-latex.ts";
export { UPMATH_HOST, upmathSvgUrl } from "./svg/upmath.ts";
export { measureLabelMm } from "./svg/measure-label.ts";
export { latexPaths } from "./svg/latex-paths.ts";
export type { LatexPath, SvgMatrix } from "./svg/latex-paths.ts";
export { MM_TO_PX, mmToPx } from "./units.ts";
