/**
 * Figure.view 절대값.
 * frame 은 그대로. spec 을 열지 않는다. 시트에는 창이 없다.
 */
import type { View } from "@stemfig/display";
import type { Document } from "../envelope/document.ts";
import { isFigure } from "../envelope/node.ts";
import { findNode, mapNode } from "../envelope/tree.ts";

/**
 * 고른 figure 의 수학 창만 바꾼다.
 * min < max 가 아니면 입력 문서. 시트·없는 id·같은 값도 입력.
 * @param view 사용자 좌표. y 는 위가 커진다
 * @returns 새 문서
 */
export function setNodeView(doc: Document, id: string, view: View): Document {
  const node = findNode(doc, id);
  if (!node || !isFigure(node)) {
    return doc;
  }
  if (!(view.xmin < view.xmax && view.ymin < view.ymax)) {
    return doc;
  }
  const prev = node.view;
  if (
    prev.xmin === view.xmin &&
    prev.xmax === view.xmax &&
    prev.ymin === view.ymin &&
    prev.ymax === view.ymax &&
    (prev.stretch === true) === (view.stretch === true)
  ) {
    return doc;
  }
  return mapNode(doc, id, (item) =>
    isFigure(item) ? { ...item, view } : item,
  );
}

/**
 * seed 가 창을 안 주면 frame mm 를 1:1 로 쓴다. y-up.
 * @param frame 새 figure.frame. x,y 는 안 쓴다
 */
export function defaultFigureView(frame: { w: number; h: number }): View {
  return { xmin: 0, xmax: frame.w, ymin: 0, ymax: frame.h };
}
