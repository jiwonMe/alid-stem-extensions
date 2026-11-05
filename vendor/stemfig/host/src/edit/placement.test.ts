import { describe, expect, it } from "vitest";
import { parseDocument, type Document } from "../envelope/document.ts";
import { isFrameNode, type Figure } from "../envelope/node.ts";
import { figuresOf, findNode, parentOf, rootFrames } from "../envelope/tree.ts";
import { containerAt, frameCenter, updateFigure } from "./placement.ts";

/** 시트 A는 0..80, 시트 B는 100..180. 사이 20mm 는 어느 프레임도 아니다. */
const SHEET_A = "sheet_a";
const SHEET_B = "sheet_b";

const figure = (x: number, y: number, id = "a"): Figure => ({
  id,
  type: "figure",
  kind: "demo.alpha",
  frame: { x, y, w: 20, h: 10 },
  view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
  spec: {},
});

function envelope(children: Figure[], roots: Figure[] = []) {
  return parseDocument({
    schema: "stemfig/v1",
    plugins: ["demo.alpha@1"],
    nodes: [
      {
        id: SHEET_A,
        type: "frame",
        frame: { x: 0, y: 0, w: 80, h: 60 },
        children,
      },
      ...roots,
    ],
  });
}

/** 시트 두 장. 왼쪽에만 figure 가 있다. */
function twoSheets() {
  return parseDocument({
    schema: "stemfig/v1",
    plugins: ["demo.alpha@1"],
    nodes: [
      {
        id: SHEET_A,
        type: "frame",
        frame: { x: 0, y: 0, w: 80, h: 60 },
        children: [figure(5, 5)],
      },
      {
        id: SHEET_B,
        type: "frame",
        frame: { x: 100, y: 0, w: 80, h: 60 },
        children: [],
      },
    ],
  });
}

function frameOf(doc: Document, id: string) {
  return figuresOf(doc).find((item) => item.id === id)?.frame;
}

function childCount(doc: Document, id: string) {
  const node = findNode(doc, id);
  return node && isFrameNode(node) ? node.children.length : -1;
}

describe("placement", () => {
  it("derives the frame vs root from the tree, not a parent key", () => {
    const onSheet = envelope([figure(5, 5)]);
    const onRoot = envelope([figure(5, 5, "keep")], [figure(-20, 5)]);
    expect(parentOf(onSheet, "a")).toBe(SHEET_A);
    expect(parentOf(onRoot, "a")).toBeNull();
  });

  it("puts a center inside a frame into that frame, else root", () => {
    const doc = envelope([figure(5, 5)]);
    expect(containerAt(doc, 40, 30)).toBe(SHEET_A);
    expect(containerAt(doc, -1, 30)).toBeNull();
    expect(containerAt(doc, 80, 60)).toBe(SHEET_A);
  });

  it("picks the frame under the point when there are two", () => {
    const doc = twoSheets();
    expect(containerAt(doc, 40, 30)).toBe(SHEET_A);
    expect(containerAt(doc, 140, 30)).toBe(SHEET_B);
    /* 두 시트 사이 빈틈은 캔버스이지 시트가 아니다. */
    expect(containerAt(doc, 90, 30)).toBeNull();
  });

  it("lists the root frames in declaration order", () => {
    expect(rootFrames(twoSheets()).map((node) => node.id)).toEqual([
      SHEET_A,
      SHEET_B,
    ]);
  });

  it("moves a figure from one sheet to the other by its center", () => {
    const doc = twoSheets();
    const moved = updateFigure(doc, "a", (item) => ({
      ...item,
      frame: { ...item.frame, x: 105, y: 5 },
    }));
    expect(parentOf(moved, "a")).toBe(SHEET_B);
    expect(childCount(moved, SHEET_A)).toBe(0);
    expect(childCount(moved, SHEET_B)).toBe(1);
    /* 좌표는 절대 페이지 mm 이라 소속이 바뀌어도 그대로다. */
    expect(frameOf(moved, "a")).toEqual({ x: 105, y: 5, w: 20, h: 10 });
  });

  it("uses the frame center for the boundary", () => {
    expect(frameCenter(figure(5, 5))).toEqual({ x: 15, y: 10 });
  });

  it("patches the frame and rebinds the parent in one call", () => {
    const doc = envelope([figure(5, 5)]);
    const off = updateFigure(doc, "a", (item) => ({
      ...item,
      frame: { ...item.frame, x: -40, y: 90 },
    }));
    expect(parentOf(off, "a")).toBeNull();
    expect(childCount(off, SHEET_A)).toBe(0);
    expect(frameOf(off, "a")).toEqual({ x: -40, y: 90, w: 20, h: 10 });

    const back = updateFigure(off, "a", (item) => ({
      ...item,
      frame: { ...item.frame, x: 5, y: 5 },
    }));
    expect(parentOf(back, "a")).toBe(SHEET_A);
    expect(childCount(back, SHEET_A)).toBe(1);
  });

  it("keeps a spec-only patch on its frame", () => {
    const doc = envelope([figure(5, 5)]);
    const next = updateFigure(doc, "a", (item) => ({
      ...item,
      spec: { n: 2 },
    }));
    expect(parentOf(next, "a")).toBe(SHEET_A);
    expect(figuresOf(next)[0]?.spec).toEqual({ n: 2 });
  });

  it("returns the same document for an unknown id or a frame", () => {
    const doc = envelope([figure(5, 5)]);
    expect(updateFigure(doc, "nope", (item) => item)).toBe(doc);
    expect(updateFigure(doc, SHEET_A, (item) => item)).toBe(doc);
  });
});
