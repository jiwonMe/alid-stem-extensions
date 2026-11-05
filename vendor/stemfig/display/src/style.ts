/**
 * 호스트가 플러그인 CompileCtx 에 넘기는 기본 스타일.
 * 봉투 Node.color 가 있으면 호스트가 stroke/textFill 만 덮는다.
 * spec.style 키는 만들지 말 것.
 */

export type ResolvedStyle = {
  stroke: string;
  width: number;
  textSize: number;
  textFill: string;
};

/**
 * stroke #111. text 1.6mm 는 계획 3.2mm 의 절반.
 * width 는 계획 0.35mm 보다 가늘게. 교과 선은 0.2mm.
 */
export const DEFAULT_STYLE: ResolvedStyle = {
  stroke: "#111111",
  width: 0.2,
  textSize: 1.6,
  textFill: "#111111",
};

/**
 * 시트 배경. renderSvg 와 패널 기본값.
 * 봉투 FrameNode.color 가 있으면 덮는다.
 */
export const DEFAULT_SHEET_FILL = "#ffffff";

/**
 * 루트 캔버스(시트 밖) 속.
 * 예전 cell bgHover 라이트(#f0f0f0). 봉투 Document.color 가 있으면 덮는다.
 * DisplayList 에 넣지 않는다. 에디터 셀 CSS 만.
 */
export const DEFAULT_CANVAS_FILL = "#f0f0f0";
