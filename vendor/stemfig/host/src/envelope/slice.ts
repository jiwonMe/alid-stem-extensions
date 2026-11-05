/**
 * 선택 id 가 덮는 시트·figure.
 * 내보내는 쪽(SVG)이 쓴다. kind / DisplayList 를 모른다.
 */
import type { Frame } from "@stemfig/display";
import type { Document } from "./document.ts";
import { isFigure, isFrameNode } from "./node.ts";
import { findNode } from "./tree.ts";

/** 고른 봉투와 그 아래 figure. crop 은 고른 상자 union. */
export type EnvelopeSlice = {
  figureIds: string[];
  sheetIds: string[];
  crop: Frame | null;
};

/**
 * 시트면 자식 figure 를 포함한다. 조상이 이미 선택된 figure 는 한 번만.
 * 없는 id 는 건너뛴다. spec 은 열지 않는다.
 * @param ids 레이어·캔버스 선택
 * @returns figure·시트 id 와 고른 상자 union. 없으면 crop null
 */
export function sliceEnvelope(
  doc: Document,
  ids: readonly string[],
): EnvelopeSlice {
  const figureIds: string[] = [];
  const sheetIds: string[] = [];
  const boxes: Frame[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const node = findNode(doc, id);
    if (!node || seen.has(id)) {
      continue;
    }
    seen.add(id);
    boxes.push(node.frame);
    if (isFrameNode(node)) {
      sheetIds.push(id);
      for (const child of node.children) {
        if (isFigure(child) && !seen.has(child.id)) {
          seen.add(child.id);
          figureIds.push(child.id);
        }
      }
      continue;
    }
    if (isFigure(node)) {
      figureIds.push(id);
    }
  }
  return { figureIds, sheetIds, crop: unionFrames(boxes) };
}

/**
 * 축정렬 상자 union. 비면 null.
 */
export function unionFrames(frames: readonly Frame[]): Frame | null {
  if (frames.length === 0) {
    return null;
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const frame of frames) {
    x0 = Math.min(x0, frame.x);
    y0 = Math.min(y0, frame.y);
    x1 = Math.max(x1, frame.x + frame.w);
    y1 = Math.max(y1, frame.y + frame.h);
  }
  if (x1 <= x0 || y1 <= y0) {
    return null;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
