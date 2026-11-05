import { describe, expect, it } from "vitest";
import { parseDocument } from "../envelope/document.ts";
import { isFigure, isFrameNode } from "../envelope/node.ts";
import { findNode } from "../envelope/tree.ts";
import { insertFrame } from "./insert.ts";
import { frameTitle, nextFrameName, nodeTitle, renameNode } from "./frame-name.ts";

const doc = parseDocument({
  schema: "stemfig/v1",
  plugins: ["demo.alpha@1"],
  nodes: [
    {
      id: "sheet",
      type: "frame",
      frame: { x: 0, y: 0, w: 80, h: 60 },
      children: [
        {
          id: "a",
          type: "figure",
          kind: "demo.alpha",
          frame: { x: 5, y: 5, w: 20, h: 10 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: {},
        },
      ],
    },
  ],
});

describe("frameTitle", () => {
  it("falls back to id when name is missing", () => {
    const node = findNode(doc, "sheet");
    expect(node && isFrameNode(node) ? frameTitle(node) : "").toBe("sheet");
  });

  it("prefers name", () => {
    const named = renameNode(doc, "sheet", "Cover");
    const node = findNode(named, "sheet");
    expect(node && isFrameNode(node) ? frameTitle(node) : "").toBe("Cover");
  });
});

describe("renameNode", () => {
  it("writes a trimmed name on a frame", () => {
    const next = renameNode(doc, "sheet", "  Cover  ");
    expect(findNode(next, "sheet")).toMatchObject({ name: "Cover" });
    expect(findNode(next, "a")).toEqual(findNode(doc, "a"));
  });

  it("writes a figure name without changing id", () => {
    const next = renameNode(doc, "a", "  Triangle  ");
    const node = findNode(next, "a");
    expect(node && isFigure(node) ? nodeTitle(node) : "").toBe("Triangle");
    expect(node?.id).toBe("a");
    expect(() =>
      parseDocument(JSON.parse(JSON.stringify(next)) as unknown),
    ).not.toThrow();
  });

  it("returns the same document when nothing changes", () => {
    expect(renameNode(doc, "sheet", "   ")).toBe(doc);
    const named = renameNode(doc, "sheet", "Cover");
    expect(renameNode(named, "sheet", "Cover")).toBe(named);
  });

  it("drops name so the id shows again", () => {
    const named = renameNode(doc, "a", "Triangle");
    const cleared = renameNode(named, "a", "  ");
    const node = findNode(cleared, "a");
    expect(node && "name" in node ? node.name : undefined).toBeUndefined();
    expect(node && isFigure(node) ? nodeTitle(node) : "").toBe("a");
  });

  it("caps at 80 characters so parseDocument still accepts it", () => {
    const next = renameNode(doc, "sheet", "x".repeat(90));
    const node = findNode(next, "sheet");
    expect(node && isFrameNode(node) ? node.name?.length : 0).toBe(80);
    expect(() =>
      parseDocument(JSON.parse(JSON.stringify(next)) as unknown),
    ).not.toThrow();
  });
});

describe("nextFrameName", () => {
  it("starts at Frame and skips taken names", () => {
    expect(nextFrameName(doc)).toBe("Frame");
    const once = insertFrame(doc, { x: 0, y: 0, w: 10, h: 10 });
    expect(nextFrameName(once)).toBe("Frame 2");
  });
});
