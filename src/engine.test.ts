/**
 * The adapter engine must draw exactly what stemdraw draws for the same figure.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createEngine } from "./engine.ts";
import { figureContent, fixtureFigures, figureSize, referenceSvg } from "./fixtures.ts";
import { stemfigPlugins } from "./kinds.ts";

const engine = createEngine(stemfigPlugins);
const figures = fixtureFigures();

describe("createEngine", () => {
  it("covers every vendored fixture figure", () => {
    expect(figures.length).toBeGreaterThanOrEqual(9);
  });

  it.each(figures)("renders $name like stemdraw", ({ figure }) => {
    expect(engine.renderFigureSvg(figure.kind, figureContent(figure), figureSize(figure))).toBe(referenceSvg(figure));
  });

  it("matches the committed golden file used to check the built bundle", () => {
    const golden = JSON.parse(readFileSync(new URL("../test/golden/fixtures.json", import.meta.url), "utf8")) as { name: string; svg: string }[];
    expect(golden.map((item) => item.name)).toEqual(figures.map((item) => item.name));
    for (const [index, { figure }] of figures.entries()) expect(golden[index]!.svg, golden[index]!.name).toBe(referenceSvg(figure));
  });

  it("draws an engine error as a box instead of throwing", () => {
    const svg = engine.renderFigureSvg("math.geometry", { view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, spec: { objects: [{ id: "s", def: ["segment", "A", "B"] }] } }, { width_mm: 40, height_mm: 30 });
    expect(svg).toContain("<polygon");
    expect(svg).toContain("<text");
  });

  it("refuses an unregistered kind", () => {
    expect(() => engine.renderFigureSvg("chem.molecule", { view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, spec: {} }, { width_mm: 10, height_mm: 10 })).toThrow(/No stemfig plugin/);
  });
});
