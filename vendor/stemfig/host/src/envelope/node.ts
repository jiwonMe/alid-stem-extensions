/**
 * 캔버스 객체. 호스트가 아는 공통 뼈대.
 * kind / spec 은 figure 만. DisplayList Frame(상자) 과 다른 층이다.
 * 소속은 JSON parent 가 아니라 트리 children 이다.
 */
import type { Axes, Frame, Grid, View } from "@stemfig/display";

/**
 * 캔버스 위 객체. type 은 서브타입이 채운다.
 */
export type Node = {
  id: string;
  frame: Frame;
  /**
   * 사람이 읽는 라벨. 없으면 id 를 보여 준다.
   * id 는 트리 키라 바꾸지 말 것.
   */
  name?: string;
  /**
   * #rrggbb. 시트는 속, figure 는 잉크.
   * 없으면 시트 흰 장·기본 stroke.
   */
  color?: string;
  /** 편집 잠금. 자손도 잠기며, 이 값의 해제만 별도 호스트 API가 허용한다. */
  locked?: boolean;
};

/**
 * 흰 시트·상자. clip 의 주체. children 이 소속이다.
 * root 에 여럿 둘 수 있다. 예약된 id 는 없다.
 */
export type FrameNode = Node & {
  type: "frame";
  children: StemfigNode[];
};

/**
 * 플러그인 figure. children 금지.
 * view 는 SVG viewBox. grid/axes 는 창 장식. spec 은 사용자 좌표.
 */
export type Figure = Node & {
  type: "figure";
  kind: string;
  view: View;
  grid?: Grid;
  axes?: Axes;
  spec: unknown;
  interaction?: {
    handles: string[];
    invariants: string[];
  };
};

/** 포리스트에 올 수 있는 노드. */
export type StemfigNode = FrameNode | Figure;

/**
 * 부모 FrameNode.id. null 은 root (nodes[] 형제).
 */
export type ParentRef = string | null;

/**
 * type: "figure" 만 figure.
 * @param node 캔버스 노드
 */
export function isFigure(node: StemfigNode): node is Figure {
  return node.type === "figure";
}

/**
 * type: "frame" 만 프레임.
 * @param node 캔버스 노드
 */
export function isFrameNode(node: StemfigNode): node is FrameNode {
  return node.type === "frame";
}
