/** 잠금이 UI 우회 호출과 저장·복구 후에도 문서를 보호하는지 확인한다. */
import { describe, expect, it } from "vitest";
import { parseDocument } from "./document.ts";
import { isNodeLocked, setNodeLocked } from "./lock.ts";
import { findNode, mapFigure, mapNode, moveNode, orderNode, removeNode, reparent } from "./tree.ts";
import { translateNodes } from "../edit/translate.ts";
import { setNodeFrame } from "../edit/node-frame.ts";
import { setNodeView } from "../edit/node-view.ts";
import { setNodeColor } from "../edit/node-color.ts";
import { setNodeAxes, setNodeGrid } from "../edit/node-chrome.ts";
import { renameNode } from "../edit/frame-name.ts";
import { insertFigure } from "../edit/insert.ts";

const figure = {
  id: "fig", type: "figure" as const, kind: "demo.alpha",
  frame: { x: 10, y: 10, w: 20, h: 20 },
  view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, spec: { opaque: true },
};
const doc = parseDocument({ schema: "stemfig/v1", plugins: ["demo.alpha@1"], nodes: [
  { id: "sheet", type: "frame", frame: { x: 0, y: 0, w: 100, h: 100 }, children: [figure] },
  { id: "other", type: "frame", frame: { x: 120, y: 0, w: 100, h: 100 }, children: [] },
] });

describe("persistent inherited locks", () => {
  it("persists flags while deriving descendant locks after round-trip", () => {
    const locked = parseDocument(JSON.parse(JSON.stringify(setNodeLocked(doc, "sheet", true))));
    expect(isNodeLocked(locked, "sheet")).toBe(true);
    expect(isNodeLocked(locked, "fig")).toBe(true);
    expect(findNode(locked, "fig")?.locked).toBeUndefined();
    expect(isNodeLocked(locked, "missing")).toBe(false);
  });

  it("blocks every common envelope mutation of inherited locked nodes", () => {
    const locked = setNodeLocked(doc, "sheet", true);
    const operations = [
      () => renameNode(locked, "fig", "changed"),
      () => setNodeFrame(locked, "fig", { x: 0, y: 0, w: 30, h: 30 }),
      () => setNodeView(locked, "fig", { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }),
      () => setNodeColor(locked, "fig", "#abc"),
      () => setNodeGrid(locked, "fig", {}),
      () => setNodeAxes(locked, "fig", {}),
      () => mapFigure(locked, "fig", (node) => ({ ...node, spec: {} })),
      () => mapNode(locked, "fig", (node) => ({ ...node, name: "changed" })),
      () => translateNodes(locked, ["fig"], 3, 4),
      () => translateNodes(locked, ["sheet"], 3, 4),
      () => moveNode(locked, "fig", "other", 0),
      () => moveNode(locked, "sheet", null, 1),
      () => orderNode(locked, "sheet", "front"),
      () => reparent(locked, "fig", null),
      () => removeNode(locked, "fig"),
      () => removeNode(locked, "sheet"),
    ];
    for (const operation of operations) expect(operation()).toBe(locked);
  });

  it("protects a locked child from ancestor subtree moves and deletions", () => {
    const locked = setNodeLocked(doc, "fig", true);
    expect(translateNodes(locked, ["sheet"], 3, 4)).toBe(locked);
    expect(moveNode(locked, "sheet", null, 1)).toBe(locked);
    expect(removeNode(locked, "sheet")).toBe(locked);
    expect(mapNode(locked, "sheet", (node) => node.type === "frame" ? { ...node, children: [] } : node)).toBe(locked);
    expect(mapNode(locked, "sheet", (node) => node.type === "frame" ? {
      ...node, children: node.children.map((child) => ({ ...child, frame: { ...child.frame, x: 20 } })),
    } : node)).toBe(locked);
    /* 상위 시트 표시 이름은 잠긴 자손의 내용을 바꾸지 않으므로 허용한다. */
    expect(findNode(renameNode(locked, "sheet", "Renamed"), "sheet")?.name).toBe("Renamed");
  });

  it("keeps no-op maps from creating history entries", () => {
    expect(mapNode(doc, "missing", (node) => node)).toBe(doc);
    expect(mapNode(doc, "sheet", (node) => node)).toBe(doc);
    expect(mapFigure(doc, "sheet", (node) => node)).toBe(doc);
    expect(mapFigure(doc, "fig", (node) => node)).toBe(doc);
  });

  it("rejects insertion and reparent into a locked destination", () => {
    const locked = setNodeLocked(doc, "other", true);
    expect(reparent(locked, "fig", "other")).toBe(locked);
    expect(moveNode(locked, "fig", "other", 0)).toBe(locked);
    expect(insertFigure(locked, { ...figure, id: "new_figure" }, "other")).toBe(locked);
  });

  it("allows explicit unlock without granting a child an override over its parent", () => {
    const locked = setNodeLocked(setNodeLocked(doc, "sheet", true), "fig", true);
    const childUnlocked = setNodeLocked(locked, "fig", false);
    expect(isNodeLocked(childUnlocked, "fig")).toBe(true);
    const unlocked = setNodeLocked(childUnlocked, "sheet", false);
    expect(isNodeLocked(unlocked, "fig")).toBe(false);
    expect(findNode(translateNodes(unlocked, ["fig"], 1, 0), "fig")?.frame.x).toBe(11);
    expect(setNodeLocked(unlocked, "missing", false)).toBe(unlocked);
    expect(setNodeLocked(unlocked, "fig", false)).toBe(unlocked);
  });
});
