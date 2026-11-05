import { describe, expect, it } from "vitest";
import { parseDocument } from "./document.ts";
import { StemfigValidationError, type StemfigError } from "./errors.ts";

/** 봉투 실패 목록. 통과하면 빈 배열. */
function errorsOf(input: unknown): StemfigError[] {
  try {
    parseDocument(input);
    return [];
  } catch (error) {
    if (error instanceof StemfigValidationError) {
      return error.errors;
    }
    throw error;
  }
}

const sheet = { id: "page", type: "frame", frame: { x: 0, y: 0, w: 80, h: 60 }, children: [] };

describe("parseDocument errors", () => {
  it("names the expected pattern where zod only says Invalid", () => {
    const [error] = errorsOf({ schema: "stemfig/v1", plugins: ["math"], nodes: [sheet] });
    expect(error).toMatchObject({ code: "SCHEMA", path: "plugins.0", message: '"math" does not match the required pattern' });
    expect(error?.expected).toMatch(/^string \/\^/);
  });

  it("shows the shape of a missing required field", () => {
    const figure = { id: "f", type: "figure", kind: "demo.alpha", frame: { x: 0, y: 0, w: 1, h: 1 }, spec: {} };
    const [error] = errorsOf({ schema: "stemfig/v1", plugins: [], nodes: [{ ...sheet, children: [figure] }] });
    expect(error).toMatchObject({ path: "nodes.0.children.0.view", message: "Required" });
    expect(error?.expected).toBe("{ xmin: number; xmax: number; ymin: number; ymax: number; stretch?: boolean }");
  });

  it("reports an unknown envelope key at its own path with the allowed keys", () => {
    const [error] = errorsOf({ schema: "stemfig/v1", plugins: [], nodes: [{ ...sheet, nmae: "x" }] });
    expect(error).toEqual({
      code: "SCHEMA",
      path: "nodes.0.nmae",
      message: 'unknown key "nmae" (did you mean "name"?); allowed: id, type, name, color, locked, frame, children',
    });
  });

  it("keeps the joined message format of StemfigValidationError", () => {
    expect(() => parseDocument({ schema: "stemfig/v1", plugins: [], nodes: [] })).toThrow(
      "nodes: document.nodes must have at least one top-level frame",
    );
  });
});
