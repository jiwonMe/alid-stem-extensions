/**
 * root 에 빈 시트를 붙이거나 figure 노드를 트리에 넣는다.
 * kind / spec 은 호출자가 채운다. 여기서 해석하지 않는다.
 * 파싱하지 않는다. 이미 검증된 Document 만 받는다.
 */
import type { Frame } from "@stemfig/display";
import type { Document } from "../envelope/document.ts";
import { isNodeLocked } from "../envelope/lock.ts";
import type { Figure, FrameNode, ParentRef } from "../envelope/node.ts";
import { findNode, reparent, walk } from "../envelope/tree.ts";
import { nextFrameName } from "./frame-name.ts";

/**
 * 다음 빈 시트 id.
 * 첫 장은 frame, 겹치면 frame_2 부터. FIGURE_ID /^[a-z][a-z0-9_]*$/ 와 맞춘다.
 * @param doc parse 된 봉투
 */
export function nextFrameId(doc: Document): string {
  const used = new Set(walk(doc).map((item) => item.node.id));
  if (!used.has("frame")) {
    return "frame";
  }
  let n = 2;
  while (used.has(`frame_${n}`)) {
    n += 1;
  }
  return `frame_${n}`;
}

/**
 * nodes[] 끝에 빈 FrameNode 를 붙인다. children 은 항상 [].
 * 중첩하지 않는다. 시트를 다른 시트 안으로 넣는 UI 가 없다.
 * @param box 페이지 mm. w/h 가 양수가 아니면 입력 문서
 * @returns 새 문서. 입력은 그대로 둔다
 */
export function insertFrame(doc: Document, box: Frame): Document {
  if (!(box.w > 0 && box.h > 0)) {
    return doc;
  }
  const node: FrameNode = {
    id: nextFrameId(doc),
    type: "frame",
    name: nextFrameName(doc),
    frame: { x: box.x, y: box.y, w: box.w, h: box.h },
    children: [],
  };
  return { ...doc, nodes: [...doc.nodes, node] };
}

/**
 * 다음 figure id.
 * 첫 칸은 fig, 겹치면 fig_2 부터. FIGURE_ID /^[a-z][a-z0-9_]*$/ 와 맞춘다.
 * @param doc parse 된 봉투
 */
export function nextFigureId(doc: Document): string {
  const used = new Set(walk(doc).map((item) => item.node.id));
  if (!used.has("fig")) {
    return "fig";
  }
  let n = 2;
  while (used.has(`fig_${n}`)) {
    n += 1;
  }
  return `fig_${n}`;
}

/**
 * figure 를 dest 아래에 붙인다. dest null 이면 root 형제.
 * spec 을 읽지 않는다. plugins 배열은 호출자가 맞춘다.
 * @param dest FrameNode.id 또는 null(root)
 * @returns 새 문서. 상자·id 가 잘못되면 입력 문서
 */
export function insertFigure(
  doc: Document,
  figure: Figure,
  dest: ParentRef,
): Document {
  if (dest !== null && (findNode(doc, dest)?.type !== "frame" || isNodeLocked(doc, dest))) return doc;
  if (!(figure.frame.w > 0 && figure.frame.h > 0)) {
    return doc;
  }
  if (walk(doc).some((item) => item.node.id === figure.id)) {
    return doc;
  }
  const withRoot = { ...doc, nodes: [...doc.nodes, figure] };
  if (dest === null) {
    return withRoot;
  }
  return reparent(withRoot, figure.id, dest);
}
