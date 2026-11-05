/**
 * 수학 view 를 frame 에 맞춘다.
 * 기본은 contain (양 축 동일). view.stretch 만 축마다 스케일.
 * 호스트가 교과를 아는 것이 아니다. 직사각형 매핑만 한다.
 */
import type { Frame } from "./types.ts";

/** 수학 좌표계. y는 위가 커진다. xmax>xmin, ymax>ymin 은 호출 전 검증. */
export type View = {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  /**
   * true 면 가로·세로를 각각 frame 에 채운다.
   * 없으면 contain. 원은 원이 아니다.
   */
  stretch?: boolean;
};

export type FitView = {
  /** 수학 단위 1 의 가로 mm. contain 이면 scaleY 와 같다. */
  scaleX: number;
  /** 수학 단위 1 의 세로 mm. contain 이면 scaleX 와 같다. */
  scaleY: number;
  /**
   * 예전 한 값. contain 에선 scaleX. stretch 에선 더 작은 쪽.
   * 새 코드는 scaleX/scaleY 를 쓴다.
   */
  scale: number;
  /** 수학 (x,y) → frame 로컬 mm. y는 아래. */
  toLocal: (x: number, y: number) => [number, number];
  /** frame 로컬 mm → 수학 (x,y). hit/apply 가 쓴다. */
  fromLocal: (x: number, y: number) => [number, number];
};

/**
 * stretch 가 아니면 양 축에 같은 스케일. 여백은 가운데.
 * @returns 로컬 원점은 frame 왼쪽 위
 */
export function fitView(view: View, frame: Frame): FitView {
  const vw = view.xmax - view.xmin;
  const vh = view.ymax - view.ymin;
  const stretch = view.stretch === true;
  const scaleX = stretch ? frame.w / vw : Math.min(frame.w / vw, frame.h / vh);
  const scaleY = stretch ? frame.h / vh : scaleX;
  const ox = stretch ? 0 : (frame.w - vw * scaleX) / 2;
  const oy = stretch ? 0 : (frame.h - vh * scaleY) / 2;

  return {
    scaleX,
    scaleY,
    scale: Math.min(scaleX, scaleY),
    toLocal: (x, y) => [
      ox + (x - view.xmin) * scaleX,
      oy + (view.ymax - y) * scaleY,
    ],
    fromLocal: (x, y) => [
      view.xmin + (x - ox) / scaleX,
      view.ymax - (y - oy) / scaleY,
    ],
  };
}

/**
 * 수학 (x,y) → 페이지 mm.
 * chrome 과 plugin-kit projectView 가 같이 쓴다. fitView 를 다시 짜지 말 것.
 * @param mapLocal 로컬 mm → 페이지. 기본은 frame 오프셋. 호스트 mmToPage 와 같음
 */
export function toPage(
  view: View,
  frame: Frame,
  mapLocal: (x: number, y: number) => [number, number] = (x, y) => [
    frame.x + x,
    frame.y + y,
  ],
): (x: number, y: number) => [number, number] {
  const fit = fitView(view, frame);
  return (x, y) => mapLocal(...fit.toLocal(x, y));
}
