/**
 * Figure.grid / Figure.axes 절대값.
 * frame·view·spec 은 그대로. 시트에는 창 장식이 없다.
 */
import type { Axes, Grid } from "@stemfig/display";
import { axesSchema, gridSchema } from "../envelope/chrome.ts";
import type { Document } from "../envelope/document.ts";
import { isFigure } from "../envelope/node.ts";
import { findNode, mapNode } from "../envelope/tree.ts";

/**
 * 격자. undefined 는 키를 지워 끈다.
 * 시트가 아니거나 스키마가 아니면 입력 문서.
 * @param grid 파싱된 격자. 빈 객체는 기본값으로 켠다
 */
export function setNodeGrid(
  doc: Document,
  id: string,
  grid: Grid | undefined,
): Document {
  return setChrome(doc, id, "grid", grid, gridSchema);
}

/**
 * 축·눈금. undefined 는 키를 지워 끈다.
 * @param axes 파싱된 축. 빈 객체는 원점(또는 가장자리) 축
 */
export function setNodeAxes(
  doc: Document,
  id: string,
  axes: Axes | undefined,
): Document {
  return setChrome(doc, id, "axes", axes, axesSchema);
}

function setChrome<T extends Grid | Axes>(
  doc: Document,
  id: string,
  key: "grid" | "axes",
  value: T | undefined,
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
): Document {
  const node = findNode(doc, id);
  if (!node || !isFigure(node)) {
    return doc;
  }
  if (value === undefined) {
    if (node[key] === undefined) {
      return doc;
    }
    return mapNode(doc, id, (item) => {
      if (!isFigure(item)) {
        return item;
      }
      const { [key]: _drop, ...rest } = item;
      return rest;
    });
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return doc;
  }
  const next = parsed.data;
  if (JSON.stringify(node[key] ?? null) === JSON.stringify(next)) {
    return doc;
  }
  return mapNode(doc, id, (item) =>
    isFigure(item) ? { ...item, [key]: next } : item,
  );
}
