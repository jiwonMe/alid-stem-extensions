/**
 * stemfig/v1 봉투의 단일 파싱 경계 검증.
 * 트리·식별자·공통 필드만 검사하며 opaque spec의 의미는 검증하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { parseDocument } from "./document.ts";
import { StemfigValidationError } from "./errors.ts";

/** 프레임 id 는 예약어가 아니다. 아무 문자열이나 쓴다. */
const SHEET = "sheet";

const figure = {
  id: "a",
  type: "figure",
  kind: "demo.alpha",
  frame: { x: 5, y: 5, w: 20, h: 10 },
  view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
  spec: {},
};

function envelope(nodes: unknown[]) {
  return { schema: "stemfig/v1", plugins: ["demo.alpha@1"], nodes };
}

function sheetWith(
  children: unknown[],
  extra: Record<string, unknown> = {},
) {
  return {
    id: SHEET,
    type: "frame",
    frame: { x: 0, y: 0, w: 80, h: 60 },
    children,
    ...extra,
  };
}

/** 첫 실패의 path. 트리 경로가 nodes.0.children.1 형식인지 본다. */
function failPath(input: unknown): string {
  try {
    parseDocument(input);
  } catch (error) {
    if (error instanceof StemfigValidationError) {
      return error.errors[0]?.path ?? "";
    }
  }
  return "";
}

describe("parseDocument", () => {
  it("accepts a frame holding one figure", () => {
    const doc = parseDocument(envelope([sheetWith([figure])]));
    expect(doc.schema).toBe("stemfig/v1");
    expect(doc.nodes).toHaveLength(1);
  });

  it("accepts a figure that left its frame as a root sibling", () => {
    const doc = parseDocument(
      envelope([sheetWith([]), { ...figure, frame: { x: -40, y: 90, w: 20, h: 10 } }]),
    );
    expect(doc.nodes.map((node) => node.id)).toEqual([SHEET, "a"]);
  });

  it("accepts an optional latex engine", () => {
    const doc = parseDocument({
      ...envelope([sheetWith([figure])]),
      latex: "upmath",
    });
    expect(doc.latex).toBe("upmath");
  });

  it("rejects a latex engine that is not mathjax or upmath", () => {
    expect(() =>
      parseDocument({ ...envelope([sheetWith([figure])]), latex: "katex" }),
    ).toThrow(StemfigValidationError);
  });

  it("rejects a different schema id", () => {
    expect(() => parseDocument({ schema: "stemfig/v2" })).toThrow(
      StemfigValidationError,
    );
  });

  it("rejects the old page plus figures envelope", () => {
    expect(() =>
      parseDocument({
        schema: "stemfig/v1",
        plugins: ["demo.alpha@1"],
        page: { width_mm: 80, height_mm: 60 },
        figures: [figure],
      }),
    ).toThrow(StemfigValidationError);
  });

  it("requires at least one top-level frame", () => {
    expect(() => parseDocument(envelope([figure]))).toThrow(
      /at least one top-level frame/,
    );
  });

  it("accepts an optional frame name", () => {
    const doc = parseDocument(
      envelope([sheetWith([figure], { name: "Cover" })]),
    );
    const sheet = doc.nodes[0];
    expect(sheet?.type === "frame" ? sheet.name : undefined).toBe("Cover");
  });

  it("rejects an empty frame name", () => {
    expect(() =>
      parseDocument(envelope([sheetWith([figure], { name: "" })])),
    ).toThrow(StemfigValidationError);
  });

  it("accepts and expands optional node colors", () => {
    const doc = parseDocument(
      envelope([
        sheetWith([{ ...figure, color: "#0A0" }], { color: "#ffeecc" }),
      ]),
    );
    const sheet = doc.nodes[0];
    expect(sheet?.type === "frame" ? sheet.color : undefined).toBe("#ffeecc");
    const child =
      sheet?.type === "frame" ? sheet.children[0] : undefined;
    expect(child?.type === "figure" ? child.color : undefined).toBe("#00aa00");
  });

  it("accepts and expands an optional canvas color", () => {
    const painted = parseDocument({
      ...envelope([sheetWith([figure])]),
      color: "#ABC",
    });
    expect(painted.color).toBe("#aabbcc");
  });

  it("rejects a canvas color that is not hex", () => {
    expect(() =>
      parseDocument({ ...envelope([sheetWith([figure])]), color: "red" }),
    ).toThrow(StemfigValidationError);
  });

  it("rejects a node color that is not hex", () => {
    expect(() =>
      parseDocument(envelope([sheetWith([figure], { color: "red" })])),
    ).toThrow(StemfigValidationError);
  });

  it("accepts optional figure grid and axes", () => {
    const doc = parseDocument(
      envelope([
        sheetWith([
          {
            ...figure,
            grid: { stepX: 2, minor: true, stroke: "#abc" },
            axes: { x: { label: "x" }, ticks: { labels: false } },
          },
        ]),
      ]),
    );
    const child =
      doc.nodes[0]?.type === "frame" ? doc.nodes[0].children[0] : undefined;
    expect(child?.type === "figure" ? child.grid : null).toEqual({
      stepX: 2,
      minor: true,
      stroke: "#aabbcc",
    });
    expect(child?.type === "figure" ? child.axes : null).toEqual({
      x: { label: "x" },
      ticks: { labels: false },
    });
  });

  it("rejects a non-positive grid step", () => {
    expect(() =>
      parseDocument(envelope([sheetWith([{ ...figure, grid: { stepX: 0 } }])])),
    ).toThrow(StemfigValidationError);
  });

  it("accepts an optional figure name", () => {
    const doc = parseDocument(
      envelope([sheetWith([{ ...figure, name: "Triangle" }])]),
    );
    const child = doc.nodes[0] && doc.nodes[0].type === "frame"
      ? doc.nodes[0].children[0]
      : undefined;
    expect(child?.type === "figure" ? child.name : undefined).toBe("Triangle");
  });

  it("accepts more than one top-level frame", () => {
    const doc = parseDocument(
      envelope([
        sheetWith([figure]),
        {
          id: "sheet_b",
          type: "frame",
          frame: { x: 100, y: 0, w: 80, h: 60 },
          children: [],
        },
      ]),
    );
    expect(doc.nodes.map((node) => node.id)).toEqual([SHEET, "sheet_b"]);
  });

  it("accepts a blank sheet for a new document", () => {
    expect(parseDocument(envelope([sheetWith([])])).nodes).toHaveLength(1);
  });

  it("reserves no id for frames", () => {
    const doc = parseDocument(
      envelope([sheetWith([{ ...figure, id: "page" }])]),
    );
    expect(doc.nodes).toHaveLength(1);
  });

  it("reports a duplicate id with its tree path", () => {
    expect(failPath(envelope([sheetWith([figure, figure])]))).toBe(
      "nodes.0.children.1.id",
    );
  });

  it("catches a duplicate id across a frame and root", () => {
    expect(failPath(envelope([sheetWith([figure]), figure]))).toBe("nodes.1.id");
  });

  it("rejects children on a figure", () => {
    expect(() =>
      parseDocument(envelope([sheetWith([{ ...figure, children: [] }])])),
    ).toThrow(StemfigValidationError);
  });

  it("rejects a kind without a dot and a bad plugin ref", () => {
    expect(() =>
      parseDocument(envelope([sheetWith([{ ...figure, kind: "geometry" }])])),
    ).toThrow(StemfigValidationError);
    expect(() =>
      parseDocument({
        schema: "stemfig/v1",
        plugins: ["demo.alpha"],
        nodes: [sheetWith([figure])],
      }),
    ).toThrow(StemfigValidationError);
  });

  it("rejects a figure without a view window", () => {
    const { view: _view, ...bare } = figure;
    expect(failPath(envelope([sheetWith([bare])]))).toBe("nodes.0.children.0.view");
  });

  it("rejects a frame with zero or negative size", () => {
    expect(() =>
      parseDocument(
        envelope([sheetWith([{ ...figure, frame: { x: 0, y: 0, w: 0, h: 10 } }])]),
      ),
    ).toThrow(StemfigValidationError);
  });

  it("keeps a figure that sits outside its frame", () => {
    const doc = parseDocument(
      envelope([sheetWith([{ ...figure, frame: { x: 900, y: 900, w: 5, h: 5 } }])]),
    );
    expect(doc.nodes).toHaveLength(1);
  });

  it("keeps interaction and leaves spec untouched", () => {
    const doc = parseDocument(
      envelope([
        sheetWith([
          {
            ...figure,
            spec: { anything: [1, 2, 3] },
            interaction: { handles: ["A"], invariants: ["M"] },
          },
        ]),
      ]),
    );
    const sheet = doc.nodes[0];
    const child = sheet?.type === "frame" ? sheet.children[0] : undefined;
    expect(child?.type === "figure" ? child.spec : null).toEqual({
      anything: [1, 2, 3],
    });
    expect(child?.type === "figure" ? child.interaction?.handles : null).toEqual([
      "A",
    ]);
  });
});
