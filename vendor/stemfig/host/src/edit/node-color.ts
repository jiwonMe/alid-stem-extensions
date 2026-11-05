/**
 * Node.color.
 * frame 상자·spec 은 그대로. 빈 칸은 필드를 지워 기본색.
 */
import type { Document } from "../envelope/document.ts";
import { parseNodeColor } from "../envelope/color.ts";
import { findNode, mapNode } from "../envelope/tree.ts";

/**
 * 시트 속 또는 figure 잉크.
 * 공백뿐이면 color 를 지운다. 형식이 아니면 입력 문서.
 * 값이 같으면 같은 참조.
 * @param color #rgb / #rrggbb / 빈 문자열
 */
export function setNodeColor(doc: Document, id: string, color: string): Document {
  const node = findNode(doc, id);
  if (!node) {
    return doc;
  }
  const trimmed = color.trim();
  if (trimmed.length === 0) {
    if (node.color === undefined) {
      return doc;
    }
    return mapNode(doc, id, (item) => {
      const { color: _drop, ...rest } = item;
      return rest;
    });
  }
  const next = parseNodeColor(trimmed);
  if (next === undefined || next === node.color) {
    return doc;
  }
  return mapNode(doc, id, (item) => ({ ...item, color: next }));
}
