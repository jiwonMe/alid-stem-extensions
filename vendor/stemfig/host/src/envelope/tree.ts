/**
 * Node 포리스트 순회·패치.
 * 소속은 children. parent 키를 쓰지 말 것. 좌표는 페이지 mm.
 */
import type { Document } from "./document.ts";
import { hasLockedSubtree, isNodeLocked, preservesLockedDescendants } from "./lock.ts";
import {
  isFigure,
  isFrameNode,
  type Figure,
  type FrameNode,
  type ParentRef,
  type StemfigNode,
} from "./node.ts";

/**
 * walk 한 칸. path 는 nodes.0.children.1
 * parent 는 파생. JSON 에 쓰지 말 것.
 */
export type Walked = {
  node: StemfigNode;
  parent: ParentRef;
  path: string;
};

/**
 * 트리를 한 번 훑어 만든 조회표.
 * 같은 문서를 여러 번 묻는 쪽(compile)은 이걸 한 번 만들어 돌려 쓴다.
 * 문서를 바꾸면 버린다. 갱신 함수는 없다.
 */
export type NodeIndex = {
  order: Walked[];
  byId: Map<string, Walked>;
  figures: Figure[];
};

/**
 * 선행순. 최상위 parent 는 null.
 * @param doc parse 된 봉투
 * @returns path 가 nodes.0.children.1 형식
 */
export function walk(doc: Document): Walked[] {
  const out: Walked[] = [];
  visit(doc.nodes, null, "nodes", out);
  return out;
}

/**
 * walk 한 번으로 id 조회와 figure 목록을 같이 만든다.
 * id 유일성은 parseDocument 가 보장하므로 뒤에 온 노드가 덮어쓰지 않는다.
 * @param doc parse 된 봉투
 */
export function indexNodes(doc: Document): NodeIndex {
  const order = walk(doc);
  const byId = new Map<string, Walked>();
  const figures: Figure[] = [];
  for (const item of order) {
    byId.set(item.node.id, item);
    if (isFigure(item.node)) {
      figures.push(item.node);
    }
  }
  return { order, byId, figures };
}

/**
 * 트리의 figure 만. 선언 순서.
 * @param doc parse 된 봉투
 * @returns type figure 노드
 */
export function figuresOf(doc: Document): Figure[] {
  return indexNodes(doc).figures;
}

/**
 * id 로 노드를 찾는다.
 * @param doc parse 된 봉투
 * @param id Node.id
 * @returns 없으면 undefined
 */
export function findNode(doc: Document, id: string): StemfigNode | undefined {
  return indexNodes(doc).byId.get(id)?.node;
}

/**
 * 파생 부모. JSON parent 가 아니다.
 * @param doc parse 된 봉투
 * @param id 자식 Node.id
 * @returns 부모 FrameNode.id 또는 null(root). 없으면 null
 */
export function parentOf(doc: Document, id: string): ParentRef {
  return indexNodes(doc).byId.get(id)?.parent ?? null;
}

/**
 * root 에 놓인 시트들. 선언 순서가 곧 그리는 순서라 뒤가 위에 온다.
 * parse 가 최소 하나를 보장한다. 캔버스 크기와 소속 판정이 이걸 본다.
 * @param doc parse 된 봉투
 * @returns nodes[] 의 FrameNode. 중첩 프레임은 빼다
 */
export function rootFrames(doc: Document): FrameNode[] {
  return doc.nodes.filter(isFrameNode);
}

/**
 * 노드와 그 아래 전부를 평행이동한다. 소속·id·spec 은 그대로.
 * 좌표가 절대 페이지 mm 이라 프레임만 옮기면 자식이 뒤에 남는다. 그래서 subtree 다.
 * spec 안의 좌표는 view 라 건드리지 않는다. 그건 플러그인 몫이다.
 * @param dx_mm 페이지 mm
 * @returns 새 노드. 입력은 그대로 둔다
 */
export function offsetNode(
  node: StemfigNode,
  dx_mm: number,
  dy_mm: number,
): StemfigNode {
  const frame = {
    ...node.frame,
    x: node.frame.x + dx_mm,
    y: node.frame.y + dy_mm,
  };
  if (!isFrameNode(node)) {
    return { ...node, frame };
  }
  return {
    ...node,
    frame,
    children: node.children.map((child) => offsetNode(child, dx_mm, dy_mm)),
  };
}

/**
 * 노드 한 칸을 통째로 갈아 끼운다. 트리 위치는 그대로.
 * fn 이 돌려준 subtree 안쪽은 다시 부르지 않는다. 자식까지 바꾸려면 fn 이 한다.
 * @param id Node.id. 프레임이어도 된다
 * @param fn 불변 패치
 */
export function mapNode(
  doc: Document,
  id: string,
  fn: (node: StemfigNode) => StemfigNode,
): Document {
  /* 모든 봉투·플러그인 쓰기의 마지막 경계. UI가 검사를 빼먹어도 잠금은 지킨다. */
  if (isNodeLocked(doc, id)) return doc;
  const before = findNode(doc, id);
  if (!before) return doc;
  const after = fn(before);
  if (after === before || !preservesLockedDescendants(before, after)) return doc;
  return { ...doc, nodes: replaceNode(doc.nodes, id, () => after) };
}

/**
 * figure 한 칸만 바꾼다. 없으면 입력 문서.
 * @param id Figure.id
 * @param fn 불변 패치. spec 만 바꿔도 된다
 */
export function mapFigure(
  doc: Document,
  id: string,
  fn: (figure: Figure) => Figure,
): Document {
  return mapNode(doc, id, (node) => isFigure(node) ? fn(node) : node);
}

/**
 * 노드를 dest 아래로 옮긴다. dest null 이면 nodes[] 형제.
 * 소속만 바꾼다. 좌표는 페이지 mm 그대로.
 * 프레임은 재소속하지 않는다. 시트를 끌어 다른 시트에 넣는 UI 가 없다.
 * 시트의 위치 이동은 translateNodes 가 offsetNode 로 한다.
 * @param dest 받을 FrameNode.id 또는 null(root)
 */
export function reparent(
  doc: Document,
  id: string,
  dest: ParentRef,
): Document {
  const found = indexNodes(doc).byId.get(id)?.node;
  if (!found || isNodeLocked(doc, id) || isFrameNode(found) || parentOf(doc, id) === dest) {
    return doc;
  }
  if (dest !== null && (isNodeLocked(doc, dest) || !isFrameNode(findNode(doc, dest) ?? found))) return doc;
  const pulled = pullNode(doc.nodes, id);
  if (!pulled.taken) {
    return doc;
  }
  return { ...doc, nodes: putNode(pulled.list, dest, pulled.taken) };
}

/**
 * 노드를 트리에서 뺀다. 시트면 자식 figure 도 같이 사라진다.
 * 없는 id 는 입력을 그대로. 좌표·다른 형제는 그대로.
 * @param id Node.id
 */
export function removeNode(doc: Document, id: string): Document {
  const found = findNode(doc, id);
  if (!found || isNodeLocked(doc, id) || hasLockedSubtree(found)) return doc;
  /* 빈 문서도 시트 하나는 필요하다. 마지막 시트 삭제로 저장 불가능한 봉투를 만들지 않는다. */
  if (isFrameNode(found) && doc.nodes.includes(found) && rootFrames(doc).length === 1) return doc;
  const pulled = pullNode(doc.nodes, id);
  if (!pulled.taken) {
    return doc;
  }
  return { ...doc, nodes: pulled.list };
}

/**
 * 형제 안에서 맨 앞·맨 뒤. 소속은 유지. 좌표는 페이지 mm 그대로.
 * 이미 그 자리면 입력 문서.
 * @param edge front 는 자식 목록 끝(위에 그림), back 은 0
 */
export function orderNode(
  doc: Document,
  id: string,
  edge: "front" | "back",
): Document {
  const found = indexNodes(doc).byId.get(id);
  if (!found || isNodeLocked(doc, id) || hasLockedSubtree(found.node)) {
    return doc;
  }
  return moveNode(
    doc,
    id,
    found.parent,
    edge === "front" ? Number.POSITIVE_INFINITY : 0,
  );
}

/**
 * 소속·순서를 한 번에 바꾼다. 좌표는 페이지 mm 그대로.
 * index 는 dest 자식에서 뺀 뒤의 자리. tree-view move intent 와 같다.
 * 프레임은 root(nodes[]) 순서만. 다른 시트 아래로 넣지 않는다.
 * @param dest 받을 FrameNode.id 또는 null(root)
 * @param index 0..length. 범위를 넘으면 끝에 붙인다
 */
export function moveNode(
  doc: Document,
  id: string,
  dest: ParentRef,
  index: number,
): Document {
  const found = indexNodes(doc).byId.get(id)?.node;
  if (!found || isNodeLocked(doc, id) || hasLockedSubtree(found)) {
    return doc;
  }
  if (isFrameNode(found) && dest !== null) {
    return doc;
  }
  if (dest !== null) {
    const box = indexNodes(doc).byId.get(dest)?.node;
    if (!box || !isFrameNode(box) || isNodeLocked(doc, dest)) {
      return doc;
    }
  }
  const pulled = pullNode(doc.nodes, id);
  if (!pulled.taken) {
    return doc;
  }
  const next = insertChild(pulled.list, dest, pulled.taken, index);
  if (sameForest(doc.nodes, next)) {
    return doc;
  }
  return { ...doc, nodes: next };
}

function clampIndex(index: number, max: number): number {
  if (index < 0) {
    return 0;
  }
  return index > max ? max : index;
}

/** id 와 children 순서만. 좌표가 같아도 소속이 바뀌면 false. */
function sameForest(left: StemfigNode[], right: StemfigNode[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((node, i) => {
    const other = right[i];
    if (!other || node.id !== other.id) {
      return false;
    }
    if (isFrameNode(node) && isFrameNode(other)) {
      return sameForest(node.children, other.children);
    }
    return !isFrameNode(node) && !isFrameNode(other);
  });
}

function visit(
  nodes: StemfigNode[],
  parent: ParentRef,
  prefix: string,
  out: Walked[],
): void {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const path = `${prefix}.${i}`;
    out.push({ node, parent, path });
    if (isFrameNode(node)) {
      visit(node.children, node.id, `${path}.children`, out);
    }
  }
}

function replaceNode(
  nodes: StemfigNode[],
  id: string,
  fn: (node: StemfigNode) => StemfigNode,
): StemfigNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return fn(node);
    }
    if (isFrameNode(node)) {
      return { ...node, children: replaceNode(node.children, id, fn) };
    }
    return node;
  });
}

function pullNode(
  nodes: StemfigNode[],
  id: string,
): { list: StemfigNode[]; taken: StemfigNode | undefined } {
  let taken: StemfigNode | undefined;
  const list: StemfigNode[] = [];
  for (const node of nodes) {
    if (node.id === id) {
      taken = node;
      continue;
    }
    if (isFrameNode(node)) {
      const inner = pullNode(node.children, id);
      if (inner.taken) {
        taken = inner.taken;
      }
      list.push({ ...node, children: inner.list });
    } else {
      list.push(node);
    }
  }
  return { list, taken };
}

function putNode(
  nodes: StemfigNode[],
  dest: ParentRef,
  child: StemfigNode,
): StemfigNode[] {
  return insertChild(nodes, dest, child, Number.POSITIVE_INFINITY);
}

/**
 * dest 자식 목록의 index 자리에 넣는다.
 * dest 가 없으면 입력을 그대로. 호스트가 dest 를 이미 검사한다.
 */
function insertChild(
  nodes: StemfigNode[],
  dest: ParentRef,
  child: StemfigNode,
  index: number,
): StemfigNode[] {
  if (dest === null) {
    const at = clampIndex(index, nodes.length);
    return [...nodes.slice(0, at), child, ...nodes.slice(at)];
  }
  return nodes.map((node) => {
    if (node.id === dest && isFrameNode(node)) {
      const at = clampIndex(index, node.children.length);
      return {
        ...node,
        children: [
          ...node.children.slice(0, at),
          child,
          ...node.children.slice(at),
        ],
      };
    }
    if (isFrameNode(node)) {
      return {
        ...node,
        children: insertChild(node.children, dest, child, index),
      };
    }
    return node;
  });
}
