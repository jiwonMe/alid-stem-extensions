/**
 * 페이지 mm 델타 → 수학 view 델타. apply 만 쓴다.
 * 페이지 mm → 로컬 mm 은 plugin-kit 의 pageToLocal.
 * 창은 봉투 ctx.view. spec 을 열지 않는다.
 */
import { fitView, type Frame, type View } from "@stemfig/display";
import type { Point } from "../init.ts";

/**
 * 드래그 mm 을 점 def 에 더할 수 있는 수학 단위로 바꾼다.
 * y 는 수학에서 위가 커지므로 부호를 뒤집는다.
 * @param dx_mm frame 로컬 mm. 페이지 이동과 같다
 * @returns 점 def 에 더할 view 단위
 */
export function viewDelta(
  view: View,
  frame: Frame,
  dx_mm: number,
  dy_mm: number,
): Point {
  const { scaleX, scaleY } = fitView(view, frame);
  return { x: dx_mm / scaleX, y: -dy_mm / scaleY };
}
