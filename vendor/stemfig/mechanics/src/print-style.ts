/**
 * 역학 교재 그림의 인쇄 치수.
 * 배율은 호스트 기본 선폭 0.2mm 에 곱한다. 장면 확대와 분리된 페이지 mm 다.
 * 600dpi PNG 가 기준이며 SVG 글리프 파이프라인은 바꾸지 않는다.
 */
import type { ResolvedStyle } from "@stemfig/display";

/** 역할별 선폭 배율. weight 가 있으면 역할을 덮는다. */
export const ROLE_SCALE = {
  surface: 1.5,
  body: 1.25,
  trajectory: 1,
  arrow: 1.25,
  guide: 0.75,
} as const;

/** 먹 15%. 지면 띠. */
export const GROUND_FILL = "#d9d9d9";
/** 먹 35%. 공과 건물. */
export const BODY_FILL = "#a6a6a6";
/** 받침대. 기존 기구 그림과 같은 값이다. */
export const SUPPORT_FILL = "#eeeeee";

/** 화살촉 길이·반폭. stealth 홈 비율은 축과 같다. */
export const ARROW_LEN_MM = 2;
export const ARROW_HALF_MM = 0.7;
/** 점선·점점선. 점점선은 둥근 선 끝과 만나 점이 된다. */
export const DASH_ON_MM = 1.2;
export const DASH_OFF_MM = 0.8;
export const DOT_ON_MM = 0.05;
export const DOT_OFF_MM = 0.55;
/** 각도 호와 직각 한 변. 라벨은 호 밖이다. */
export const ANGLE_RADIUS_MM = 3;
export const RIGHT_SIDE_MM = 1.5;
export const ANGLE_LABEL_PAD_MM = 0.6;
/** 치수 보조선이 기준점에서 띄는 간격과 치수선 너머 연장. */
export const DIM_GAP_MM = 0.6;
export const DIM_EXT_MM = 0.8;
/** 새 발사 화살의 기본 길이. */
export const LAUNCH_LEN_MM = 6;
/** 읽기 어려운 선보다 가늘지 않다. */
export const MIN_WIDTH_MM = 0.15;

export type PrintRole = keyof typeof ROLE_SCALE;
export type LineWeight = "thin" | "normal" | "bold";

/**
 * @param style 호스트가 넘긴 기본 선
 * @param role 객체의 인쇄 역할
 * @param weight 저자가 덮어쓴 굵기. 없으면 역할 배율
 * @returns 페이지 mm. 최소 0.15
 */
export function inkWidth(style: ResolvedStyle, role: PrintRole, weight?: LineWeight): number {
  const scale = weight === "thin" ? 0.75 : weight === "bold" ? 1.5 : weight === "normal" ? 1 : ROLE_SCALE[role];
  return Math.max(MIN_WIDTH_MM, style.width * scale);
}
