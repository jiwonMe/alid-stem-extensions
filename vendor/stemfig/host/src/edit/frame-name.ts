/**
 * 표시 이름.
 * id 는 트리 키라 바꾸지 않는다. name 만 고친다.
 * kind / spec 을 모른다. 파싱하지 않는다.
 */
import type { Document } from "../envelope/document.ts";
import type { FrameNode, StemfigNode } from "../envelope/node.ts";
import { findNode, mapNode, rootFrames } from "../envelope/tree.ts";

/** Zod document.ts 와 같은 상한. 여기서 잘라 파서가 다시 안 깨지게. */
const NAME_MAX = 80;

/**
 * 화면에 그릴 문자열. name 이 없으면 id.
 * 시트와 figure 가 같다. 레이어 패널이 둘 다 이 함수를 본다.
 */
export function nodeTitle(node: StemfigNode): string {
  return node.name ?? node.id;
}

/**
 * 시트 라벨. nodeTitle 과 같다. 캔버스 오버레이가 FrameNode 만 넘긴다.
 */
export function frameTitle(node: FrameNode): string {
  return nodeTitle(node);
}

/**
 * 새 시트에 붙일 기본 이름. id(frame / frame_2) 와 따로 센다.
 * 이미 "Frame" 이 있으면 Frame 2 부터.
 * @param doc parse 된 봉투
 */
export function nextFrameName(doc: Document): string {
  const used = new Set(
    rootFrames(doc)
      .map((node) => node.name)
      .filter((name): name is string => name !== undefined),
  );
  if (!used.has("Frame")) {
    return "Frame";
  }
  let n = 2;
  while (used.has(`Frame ${n}`)) {
    n += 1;
  }
  return `Frame ${n}`;
}

/**
 * 시트·figure 의 name 만 바꾼다. 없으면 입력 문서.
 * 공백뿐이면 name 을 지워 id 가 다시 보이게 한다.
 * 값이 같으면 같은 참조를 돌려 undo 칸을 만들지 않는다.
 * @param name 잘린 뒤 80자. trim 한다
 */
export function renameNode(doc: Document, id: string, name: string): Document {
  const node = findNode(doc, id);
  if (!node) {
    return doc;
  }
  const next = name.trim().slice(0, NAME_MAX);
  const current = node.name ?? "";
  if (next === current) {
    return doc;
  }
  return mapNode(doc, id, (item) => {
    if (next === "") {
      const { name: _drop, ...rest } = item;
      return rest;
    }
    return { ...item, name: next };
  });
}

/**
 * renameNode 별칭. 캔버스 시트 라벨이 이 이름을 쓴다.
 */
export function renameFrame(doc: Document, id: string, name: string): Document {
  return renameNode(doc, id, name);
}
