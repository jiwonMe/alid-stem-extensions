/**
 * 수학 view → 페이지 mm 투영.
 * 모든 kind 가 compile 첫 줄에서 쓰던 fitView + mmToPage 조합이다.
 * 호스트를 import 하지 않는다. ctx 는 구조로만 받는다.
 */
import { fitView, toPage, type FitView, type Frame, type View } from "@stemfig/display";

/**
 * CompileCtx / AnchorsCtx 가 구조적으로 만족한다.
 * 호스트 타입을 직접 참조하면 plugin-kit 이 host 에 묶이므로 필드만 적는다.
 */
export type ProjectionCtx = {
  frame: Frame;
  mmToPage: (x: number, y: number) => [number, number];
};

/** fitView 결과에 페이지 좌표 한 단계를 더 얹은 것. */
export type PageProjection = FitView & {
  /** 수학 (x,y) → 페이지 mm. compile 과 anchors 가 이걸로 점을 찍는다. */
  toPage: (x: number, y: number) => [number, number];
};

/**
 * view → frame 매핑 + frame 오프셋을 한 번에 만든다.
 * stretch 없으면 contain.
 * @param ctx figure 상자와 호스트가 준 mmToPage
 * @param view 봉투 figure.view. min < max 는 호스트가 이미 막았다
 */
export function projectView(ctx: ProjectionCtx, view: View): PageProjection {
  const fit = fitView(view, ctx.frame);
  return {
    ...fit,
    /* display toPage + 호스트 mmToPage. chrome 과 같은 식. */
    toPage: toPage(view, ctx.frame, ctx.mmToPage),
  };
}

/**
 * 페이지 mm → frame 로컬 mm. hit 이 포인터를 로컬로 내릴 때 쓴다.
 * @returns [lx, ly] frame 왼쪽 위 원점, y 아래
 */
export function pageToLocal(
  frame: Frame,
  x_mm: number,
  y_mm: number,
): [number, number] {
  return [x_mm - frame.x, y_mm - frame.y];
}
