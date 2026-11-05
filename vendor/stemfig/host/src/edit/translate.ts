/**
 * Node.frame 이동과 소속.
 * figure 는 중심이 올라탄 시트로 다시 붙고, frame 은 자식까지 통째로 움직인다.
 * frame 은 재소속하지 않는다. 시트를 끌어도 다른 figure 를 주워 담지 않는다.
 * spec·kind 를 읽지 않는다. 봉투를 파싱하지 않는다. 이미 검증된 Document 만 받는다.
 */
import type { Document } from "../envelope/document.ts";
import { hasLockedSubtree, isNodeLocked } from "../envelope/lock.ts";
import { isFrameNode, type Figure, type StemfigNode } from "../envelope/node.ts";
import { indexNodes, mapNode, offsetNode, type NodeIndex } from "../envelope/tree.ts";
import { updateFigure } from "./placement.ts";

/**
 * 고른 노드의 frame 을 페이지 mm 만큼 민다.
 * 시트와 그 안의 figure 를 같이 골랐어도 figure 는 한 번만 움직인다.
 * @param ids Node.id. 없는 id 는 건너뛴다. figure 와 frame 을 섞어도 된다
 * @returns 새 문서. 움직일 것이 없으면 입력 문서 그대로
 */
export function translateNodes(
  doc: Document,
  ids: readonly string[],
  dx_mm: number,
  dy_mm: number,
): Document {
  if (!Number.isFinite(dx_mm) || !Number.isFinite(dy_mm) || (dx_mm === 0 && dy_mm === 0)) {
    return doc;
  }
  const index = indexNodes(doc);
  const targets = topmost(index, new Set(ids)).filter((node) =>
    !isNodeLocked(doc, node.id) && !hasLockedSubtree(node),
  );
  if (targets.length === 0) {
    return doc;
  }
  let next = doc;
  for (const node of targets) {
    next = isFrameNode(node)
      ? mapNode(next, node.id, (item) => offsetNode(item, dx_mm, dy_mm))
      : updateFigure(next, node.id, (item) => moveFrame(item, dx_mm, dy_mm));
  }
  return next;
}

/**
 * 조상이 함께 뽑힌 노드는 버린다.
 * 시트가 자식을 데려가므로 자식까지 밀면 델타가 두 번 먹는다.
 */
function topmost(index: NodeIndex, ids: Set<string>): StemfigNode[] {
  const out: StemfigNode[] = [];
  for (const id of ids) {
    const found = index.byId.get(id);
    if (found && !hasPickedAncestor(index, id, ids)) {
      out.push(found.node);
    }
  }
  return out;
}

function hasPickedAncestor(
  index: NodeIndex,
  id: string,
  ids: Set<string>,
): boolean {
  let parent = index.byId.get(id)?.parent ?? null;
  while (parent !== null) {
    if (ids.has(parent)) {
      return true;
    }
    parent = index.byId.get(parent)?.parent ?? null;
  }
  return false;
}

function moveFrame(figure: Figure, dx: number, dy: number): Figure {
  return {
    ...figure,
    frame: {
      ...figure.frame,
      x: figure.frame.x + dx,
      y: figure.frame.y + dy,
    },
  };
}
