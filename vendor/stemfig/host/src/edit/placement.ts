/**
 * figure 가 어느 시트에 올라탔는가.
 * 소속을 JSON parent 키로 쓰지 않는다. 트리 위치만 바꾼다.
 * kind / spec 을 읽지 않는다. 최상위 프레임 한 겹만 본다.
 */
import type { Frame } from "@stemfig/display";
import type { Document } from "../envelope/document.ts";
import { isNodeLocked } from "../envelope/lock.ts";
import { isFigure, type Figure, type Node, type ParentRef } from "../envelope/node.ts";
import {
  indexNodes,
  mapFigure,
  reparent,
  rootFrames,
} from "../envelope/tree.ts";

/**
 * 점이 올라탄 최상위 프레임. 어디에도 안 걸리면 root.
 * 겹친 프레임은 나중 것이 이긴다. nodes[] 순서가 곧 그리는 순서라 뒤가 위다.
 * 경계선 위는 안쪽으로 친다.
 * @param doc parse 된 봉투. 최상위 프레임만 본다
 * @param x_mm 페이지 mm
 * @param y_mm 페이지 mm
 * @returns 프레임 id 또는 null(root)
 */
export function containerAt(
  doc: Document,
  x_mm: number,
  y_mm: number,
): ParentRef {
  /* lib 이 ES2022 라 findLast 가 없다. 뒤에서부터 훑어 위에 있는 것을 먼저 만난다. */
  const frames = rootFrames(doc);
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const node = frames[i];
    if (node && inFrame(node.frame, x_mm, y_mm)) {
      return node.id;
    }
  }
  return null;
}

function inFrame(box: Frame, x_mm: number, y_mm: number): boolean {
  return (
    x_mm >= box.x &&
    y_mm >= box.y &&
    x_mm <= box.x + box.w &&
    y_mm <= box.y + box.h
  );
}

/**
 * Node.frame 중심. 경계 판정은 이 점만.
 */
export function frameCenter(node: Node): { x: number; y: number } {
  return {
    x: node.frame.x + node.frame.w / 2,
    y: node.frame.y + node.frame.h / 2,
  };
}

/**
 * figure 를 바꾸고 새 중심이 올라탄 프레임으로 다시 붙인다.
 * 호출자가 패치 뒤에 트리에서 figure 를 다시 찾을 필요가 없다.
 * @param id Figure.id. 없거나 frame 노드면 입력 문서
 * @param fn 불변 패치. frame 을 바꾸면 소속도 여기서 따라간다
 * @returns 새 문서. 좌표는 그대로 페이지 mm
 */
export function updateFigure(
  doc: Document,
  id: string,
  fn: (figure: Figure) => Figure,
): Document {
  const found = indexNodes(doc).byId.get(id)?.node;
  if (!found || !isFigure(found) || isNodeLocked(doc, id)) {
    return doc;
  }
  const next = fn(found);
  const patched = mapFigure(doc, id, () => next);
  const at = frameCenter(next);
  return reparent(patched, id, containerAt(patched, at.x, at.y));
}
