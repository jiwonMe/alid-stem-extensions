/**
 * 봉투 잠금 조회와 명시적 토글.
 * spec과 UI를 모르며 트리 잠금은 조상에서 자손으로만 전파한다.
 * 일반 mapNode의 잠금 검사를 우회할 수 있는 쓰기는 이 모듈의 토글뿐이다.
 */
import type { Document } from "./document.ts";
import type { StemfigNode } from "./node.ts";

/**
 * 노드 자신 또는 조상의 잠금 여부를 찾는다.
 * @param doc 검증된 봉투
 * @param id 조회할 노드 id
 * @returns 없는 노드는 false, 잠긴 조상 아래는 자체 값과 무관하게 true
 */
export function isNodeLocked(doc: Document, id: string): boolean {
  function visit(nodes: readonly StemfigNode[], inherited: boolean): boolean | undefined {
    for (const node of nodes) {
      const locked = inherited || node.locked === true;
      if (node.id === id) return locked;
      if (node.type === "frame") {
        const found = visit(node.children, locked);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }
  return visit(doc.nodes, false) ?? false;
}

/**
 * 통째로 이동·삭제하는 하위 트리에 잠긴 자손이 있는지 검사한다.
 * @param node 이동이나 삭제의 루트
 * @returns 자신 또는 자손에 명시적 잠금이 있으면 true
 */
export function hasLockedSubtree(node: StemfigNode): boolean {
  return node.locked === true || (node.type === "frame" && node.children.some(hasLockedSubtree));
}

/**
 * 상위 노드를 통째로 바꾸는 콜백이 잠긴 자손을 우회 변경했는지 검사한다.
 * 불변 편집이 전제라 잠긴 하위 트리는 같은 참조·같은 부모로 남아야 한다.
 * @param before 교체 전 하위 트리
 * @param after 교체 후보 하위 트리
 * @returns 잠긴 하위 트리가 삭제·이동·변경되면 false
 */
export function preservesLockedDescendants(before: StemfigNode, after: StemfigNode): boolean {
  const next = new Map<string, { node: StemfigNode; parent: string | null }>();
  function index(node: StemfigNode, parent: string | null): void {
    next.set(node.id, { node, parent });
    if (node.type === "frame") node.children.forEach((child) => index(child, node.id));
  }
  function unchanged(node: StemfigNode, parent: string | null): boolean {
    if (node.locked) {
      const found = next.get(node.id);
      return found?.node === node && found.parent === parent;
    }
    return node.type !== "frame" || node.children.every((child) => unchanged(child, node.id));
  }
  index(after, null);
  return unchanged(before, null);
}

/**
 * 명시적 잠금만 바꾼다. 잠긴 상태에서도 해제는 가능하다.
 * 부모가 잠겨 있으면 자식 자체 잠금을 해제해도 편집은 계속 차단된다.
 * @param doc 검증된 봉투
 * @param id 잠글 노드 id
 * @param locked true는 잠금, false는 자체 잠금 필드를 제거
 * @returns 없거나 변화가 없으면 입력 문서, 이외에는 새 문서
 */
export function setNodeLocked(doc: Document, id: string, locked: boolean): Document {
  function visit(nodes: StemfigNode[]): StemfigNode[] {
    const next = nodes.map((node) => {
      if (node.id === id) {
        if ((node.locked === true) === locked) return node;
        if (locked) return { ...node, locked: true };
        const { locked: _drop, ...rest } = node;
        return rest;
      }
      if (node.type !== "frame") return node;
      const children = visit(node.children);
      return children === node.children ? node : { ...node, children };
    });
    return next.every((node, index) => node === nodes[index]) ? nodes : next;
  }
  const nodes = visit(doc.nodes);
  return nodes === doc.nodes ? doc : { ...doc, nodes };
}
