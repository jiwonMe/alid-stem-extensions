/**
 * Node.frame 절대값.
 * 자식은 스케일하지 않는다. spec 은 그대로. HUD 리사이즈가 아니다.
 */
import type { Frame } from "@stemfig/display";
import type { Document } from "../envelope/document.ts";
import { findNode, mapNode } from "../envelope/tree.ts";

/** 면이 0 이면 fitView 가 깨진다. */
const MIN_MM = 0.1;

/**
 * 고른 노드의 박스만 바꾼다. 시트 자식 좌표는 페이지 mm 그대로.
 * @param frame 페이지 mm. w/h 가 MIN_MM 미만이면 입력 문서
 * @returns 새 문서. 없는 id · 같은 값이면 입력
 */
export function setNodeFrame(
  doc: Document,
  id: string,
  frame: Frame,
): Document {
  const node = findNode(doc, id);
  if (!node) {
    return doc;
  }
  if (!(frame.w >= MIN_MM && frame.h >= MIN_MM)) {
    return doc;
  }
  if (
    node.frame.x === frame.x &&
    node.frame.y === frame.y &&
    node.frame.w === frame.w &&
    node.frame.h === frame.h
  ) {
    return doc;
  }
  return mapNode(doc, id, (item) => ({ ...item, frame }));
}
