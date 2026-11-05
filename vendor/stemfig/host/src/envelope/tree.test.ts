/**
 * 봉투 트리 조회·이동·삭제의 불변성 검증.
 * 소속은 children에서만 파생하고 좌표나 교과 spec을 재해석하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { parseDocument } from "./document.ts";
import {
  figuresOf,
  findNode,
  indexNodes,
  mapFigure,
  parentOf,
  moveNode,
  orderNode,
  removeNode,
  reparent,
  rootFrames,
  walk,
} from "./tree.ts";

/** 프레임 id 는 예약어가 아니다. 트리 위치만 의미가 있다. */
const SHEET = "sheet";

const input = {
  schema: "stemfig/v1",
  plugins: ["demo.alpha@1"],
  nodes: [
    {
      id: SHEET,
      type: "frame",
      frame: { x: 0, y: 0, w: 80, h: 60 },
      children: [
        {
          id: "a",
          type: "figure",
          kind: "demo.alpha",
          frame: { x: 5, y: 5, w: 20, h: 10 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: { n: 1 },
        },
      ],
    },
  ],
};

describe("tree", () => {
  it("walks the frame then children with derived parents", () => {
    const doc = parseDocument(input);
    const paths = walk(doc).map((item) => [item.node.id, item.parent, item.path]);
    expect(paths).toEqual([
      [SHEET, null, "nodes.0"],
      ["a", SHEET, "nodes.0.children.0"],
    ]);
  });

  it("lists figures and finds nodes", () => {
    const doc = parseDocument(input);
    expect(figuresOf(doc).map((figure) => figure.id)).toEqual(["a"]);
    expect(findNode(doc, "a")?.type).toBe("figure");
    expect(parentOf(doc, "a")).toBe(SHEET);
  });

  it("lists only the top-level frames", () => {
    const doc = parseDocument(input);
    expect(rootFrames(doc).map((node) => node.id)).toEqual([SHEET]);
  });

  it("answers id, parent and figure order from one index", () => {
    const index = indexNodes(parseDocument(input));
    expect(index.figures.map((figure) => figure.id)).toEqual(["a"]);
    expect(index.byId.get("a")?.parent).toBe(SHEET);
    expect(index.byId.get("a")?.path).toBe("nodes.0.children.0");
    expect(index.byId.get(SHEET)?.parent).toBeNull();
    expect(index.byId.get("nope")).toBeUndefined();
  });

  it("patches a figure spec without moving it", () => {
    const doc = parseDocument(input);
    const next = mapFigure(doc, "a", (figure) => ({
      ...figure,
      spec: { n: 2 },
    }));
    expect(parentOf(next, "a")).toBe(SHEET);
    expect(figuresOf(next)[0]?.spec).toEqual({ n: 2 });
  });

  it("moves a figure to root then back onto the frame", () => {
    const doc = parseDocument(input);
    const off = reparent(doc, "a", null);
    expect(parentOf(off, "a")).toBeNull();
    expect(off.nodes.map((node) => node.id)).toEqual([SHEET, "a"]);
    const back = reparent(off, "a", SHEET);
    expect(parentOf(back, "a")).toBe(SHEET);
    expect(back.nodes.map((node) => node.id)).toEqual([SHEET]);
  });

  it("never moves a frame", () => {
    const doc = parseDocument(input);
    expect(reparent(doc, SHEET, null)).toBe(doc);
  });

  it("reorders siblings and lifts a figure to root", () => {
    const doc = parseDocument({
      schema: "stemfig/v1",
      plugins: ["demo.alpha@1"],
      nodes: [
        {
          id: SHEET,
          type: "frame",
          frame: { x: 0, y: 0, w: 80, h: 60 },
          children: [
            {
              id: "a",
              type: "figure",
              kind: "demo.alpha",
              frame: { x: 1, y: 1, w: 10, h: 10 },
              view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
              spec: {},
            },
            {
              id: "b",
              type: "figure",
              kind: "demo.alpha",
              frame: { x: 2, y: 2, w: 10, h: 10 },
              view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
              spec: {},
            },
          ],
        },
        {
          id: "other",
          type: "frame",
          frame: { x: 90, y: 0, w: 20, h: 20 },
          children: [],
        },
      ],
    });
    const swapped = moveNode(doc, "a", SHEET, 1);
    expect(findNode(swapped, SHEET) && findNode(swapped, SHEET)!.type).toBe(
      "frame",
    );
    const sheet = findNode(swapped, SHEET);
    expect(sheet && sheet.type === "frame" ? sheet.children.map((n) => n.id) : []).toEqual([
      "b",
      "a",
    ]);
    const lifted = moveNode(swapped, "b", null, 1);
    expect(parentOf(lifted, "b")).toBeNull();
    expect(lifted.nodes.map((node) => node.id)).toEqual([SHEET, "b", "other"]);
    expect(moveNode(doc, SHEET, "other", 0)).toBe(doc);
    expect(moveNode(doc, "a", SHEET, 0)).toBe(doc);
    const stacked = moveNode(doc, "other", null, 0);
    expect(stacked.nodes.map((node) => node.id)).toEqual(["other", SHEET]);
  });

  it("removes a figure and leaves the sheet", () => {
    const doc = parseDocument(input);
    const next = removeNode(doc, "a");
    expect(findNode(next, "a")).toBeUndefined();
    expect(findNode(next, SHEET)?.type).toBe("frame");
    expect(removeNode(doc, "missing")).toBe(doc);
  });

  it("keeps the last sheet so the document remains saveable", () => {
    const doc = parseDocument(input);
    expect(removeNode(doc, SHEET)).toBe(doc);
  });

  it("sends a figure to the back of its sheet", () => {
    const doc = parseDocument({
      schema: "stemfig/v1",
      plugins: ["demo.alpha@1"],
      nodes: [
        {
          id: SHEET,
          type: "frame",
          frame: { x: 0, y: 0, w: 80, h: 60 },
          children: [
            {
              id: "a",
              type: "figure",
              kind: "demo.alpha",
              frame: { x: 1, y: 1, w: 10, h: 10 },
              view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
              spec: {},
            },
            {
              id: "b",
              type: "figure",
              kind: "demo.alpha",
              frame: { x: 2, y: 2, w: 10, h: 10 },
              view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
              spec: {},
            },
          ],
        },
      ],
    });
    const back = orderNode(doc, "b", "back");
    const sheet = findNode(back, SHEET);
    expect(sheet && sheet.type === "frame" ? sheet.children.map((n) => n.id) : []).toEqual([
      "b",
      "a",
    ]);
    expect(orderNode(doc, "a", "back")).toBe(doc);
  });
});
