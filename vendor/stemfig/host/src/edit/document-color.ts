/**
 * Document.color.
 * 시트·figure 색이 아니다. 루트 캔버스(시트 밖) 속만.
 * 빈 칸은 필드를 지워 DEFAULT_CANVAS_FILL.
 */
import type { Document } from "../envelope/document.ts";
import { parseNodeColor } from "../envelope/color.ts";

/**
 * 루트 캔버스 속.
 * 공백뿐이면 color 를 지운다. 형식이 아니면 입력 문서.
 * 값이 같으면 같은 참조.
 * @param color #rgb / #rrggbb / 빈 문자열
 */
export function setDocumentColor(doc: Document, color: string): Document {
  const trimmed = color.trim();
  if (trimmed.length === 0) {
    if (doc.color === undefined) {
      return doc;
    }
    const { color: _drop, ...rest } = doc;
    return rest;
  }
  const next = parseNodeColor(trimmed);
  if (next === undefined || next === doc.color) {
    return doc;
  }
  return { ...doc, color: next };
}
