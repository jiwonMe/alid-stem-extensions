import { describe, expect, it } from "vitest";
import type { ComputedReadView } from "./alid.ts";
import { figureContent, figureProps } from "./content.ts";
import { createEngine } from "./engine.ts";
import { createFigureAspect } from "./figure-aspect.ts";
import { fixtureFigures, figureContent as fixtureContent, referenceSvg } from "./fixtures.ts";
import { creationPresets, figureKinds, stemfigPlugins } from "./kinds.ts";
import { looksLikeStemfig, stemfigToOps } from "./stemfig-import.ts";
import { mmToWorld, STEMFIG_TO_WORLD, worldToMm } from "./units.ts";

const engine = createEngine(stemfigPlugins);
const kinds = figureKinds("test.stem");
const aspects = new Map(kinds.map((kind) => [kind.kind, createFigureAspect(engine, kind)]));
const aspectFor = (kind: string) => aspects.get(kind)!;

function viewOf(canonical: Record<string, Record<string, unknown>>): ComputedReadView & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    getCanonical: (_id, aspect) => { reads.push(aspect); return canonical[aspect] as never; },
    getComputed: () => undefined,
    isAlive: () => true,
  };
}

describe("units", () => {
  it("maps 1 mm to 96/25.4 world px and stemfig px to world px", () => {
    expect(mmToWorld(25.4)).toBeCloseTo(96);
    expect(worldToMm(mmToWorld(17.3))).toBeCloseTo(17.3);
    expect(STEMFIG_TO_WORLD * 4).toBeCloseTo(96 / 25.4);
  });
});

describe("figure aspect", () => {
  it.each(fixtureFigures())("draws $name exactly as stemdraw, placed at its alid box", ({ figure }) => {
    const aspect = aspectFor(figure.kind);
    const props = Object.freeze(figureProps(fixtureContent(figure)));
    const width = mmToWorld(figure.frame.w), height = mmToWorld(figure.frame.h);
    const view = viewOf({ "core.transform": { x: 120, y: -40, rotation: 0.25 }, "core.bounds": { width, height } });
    const derived = aspect.derive!(props, "e1", view)!;
    expect(derived).toMatchObject({ x: 120, y: -40, rotation: 0.25 });
    expect(derived.width).toBeCloseTo(width);
    const { svg } = aspect.renderSvg!(props, derived, "e1");
    expect(svg.startsWith(`<g transform="translate(120 -40) rotate(${(0.25 * 180) / Math.PI} ${width / 2} ${height / 2}) scale(${STEMFIG_TO_WORLD})"`)).toBe(true);
    expect(svg).toContain(`<rect width="${width / STEMFIG_TO_WORLD}" height="${height / STEMFIG_TO_WORLD}" fill="transparent" style="fill:light-dark(transparent, white)"/>`);
    const reference = referenceSvg(figure);
    expect(svg).toContain(reference.slice(reference.indexOf(">") + 1, -"</svg>".length));
  });

  it("reads only its own aspect and the box, and never mutates canonical props", () => {
    const aspect = aspectFor("math.geometry");
    const props = deepFreeze(structuredClone(creationPresets[0]!.props));
    const before = JSON.stringify(props);
    const view = viewOf({ "core.transform": { x: 0, y: 0 }, "core.bounds": { width: 200, height: 150 } });
    aspect.derive!(props, "e1", view);
    expect(JSON.stringify(props)).toBe(before);
    expect(new Set(view.reads)).toEqual(new Set(["core.transform", "core.bounds"]));
    expect(aspect.dependsOnCanonical).toEqual(["test.stem.geometry", "core.transform", "core.bounds"]);
  });

  it("reuses the compile while props and size are unchanged, and recompiles on a resize", () => {
    const aspect = aspectFor("math.geometry");
    const props = Object.freeze(structuredClone(creationPresets[0]!.props));
    const at = (width: number) => viewOf({ "core.transform": { x: 5, y: 5 }, "core.bounds": { width, height: 150 } });
    const first = aspect.derive!(props, "memo", at(200))!;
    const moved = aspect.derive!(props, "memo", viewOf({ "core.transform": { x: 50, y: 9 }, "core.bounds": { width: 200, height: 150 } }))!;
    expect(moved.compiled).toBe(first.compiled);
    expect(aspect.derive!(props, "memo", at(260))!.compiled).not.toBe(first.compiled);
  });

  it("keeps a finite box when the canonical box is missing or invalid", () => {
    const aspect = aspectFor("physics.mechanics");
    const derived = aspect.derive!(Object.freeze(creationPresets[2]!.props), "e", viewOf({ "core.transform": { x: NaN, y: Infinity }, "core.bounds": { width: -1 } }))!;
    expect(derived).toMatchObject({ x: 0, y: 0, rotation: 0 });
    expect(Number.isFinite(derived.width) && derived.width > 0 && Number.isFinite(derived.height)).toBe(true);
  });

  it("draws a broken spec as stemfig's error box and an invalid view as a plain box, without throwing", () => {
    const aspect = aspectFor("math.geometry");
    const view = viewOf({ "core.transform": { x: 0, y: 0 }, "core.bounds": { width: 200, height: 150 } });
    const broken = aspect.derive!(Object.freeze({ ...creationPresets[0]!.props, spec: { objects: [{ id: "s", def: ["segment", "A", "B"] }] } }), "e", view)!;
    expect(aspect.renderSvg!({} as never, broken, "e").svg).toContain("error: UNKNOWN_REF");
    const emptyView = aspect.derive!(Object.freeze({ ...creationPresets[0]!.props, view: { xmin: 1, xmax: 1, ymin: 0, ymax: 1 } }), "e", view)!;
    expect(emptyView.compiled.error).toBeTruthy();
    expect(aspect.renderSvg!({} as never, emptyView, "e").svg).toContain("error: SCHEMA");
  });

  it("offers grid and axes switches whose values are valid stemfig chrome", () => {
    const aspect = aspectFor("math.geometry");
    const controls = aspect.ui!.controls!;
    for (const control of controls) {
      expect(Object.hasOwn(aspect.defaults, (control as { field: string }).field)).toBe(true);
      for (const option of (control as { options: { value: unknown }[] }).options) {
        const props = { ...creationPresets[0]!.props, [(control as { field: string }).field]: option.value };
        expect(engine.compileFigure("math.geometry", figureContent(props as never), { width_mm: 70, height_mm: 50 }).error).toBeUndefined();
      }
    }
  });
});

describe("creation presets", () => {
  it.each(creationPresets)("$name draws without an error box", (preset) => {
    const compiled = engine.compileFigure(preset.kind, figureContent(preset.props), { width_mm: preset.size_mm.w, height_mm: preset.size_mm.h });
    expect(compiled.error).toBeUndefined();
    expect(compiled.body).not.toContain("error:");
    expect(compiled.body.length).toBeGreaterThan(200);
    expect(JSON.stringify(preset.props)).not.toContain("draft");
  });
});

describe("stemfig/v1 import", () => {
  const triangle = JSON.stringify({
    schema: "stemfig/v1", plugins: ["math.geometry@1", "chem.cubes@1"],
    nodes: [{ id: "page", type: "frame", frame: { x: 0, y: 0, w: 200, h: 100 }, children: [
      { id: "left", type: "figure", kind: "math.geometry", frame: { x: 10, y: 10, w: 40, h: 30 }, view: { xmin: 0, xmax: 4, ymin: 0, ymax: 3 },
        spec: { objects: [{ id: "A", def: ["point", 1, 1] }], draft: { tool: "segment", from: "A" } }, interaction: { handles: ["A"], invariants: [] } },
      { id: "right", type: "figure", kind: "math.geometry", frame: { x: 110, y: 50, w: 40, h: 30 }, view: { xmin: 0, xmax: 4, ymin: 0, ymax: 3 }, grid: {}, spec: { objects: [] } },
      { id: "cubes", type: "figure", kind: "chem.cubes", frame: { x: 0, y: 0, w: 10, h: 10 }, view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, spec: {} },
    ] }],
  });

  it("recognises stemfig JSON only", () => {
    expect(looksLikeStemfig(triangle)).toBe(true);
    expect(looksLikeStemfig("# 제목\n본문")).toBe(false);
    expect(looksLikeStemfig('{"schema":"other"}')).toBe(false);
  });

  it("creates one entity per supported figure, keeps relative layout, centres on the target and drops drafts", () => {
    let n = 0;
    const { ops, ids, skipped } = stemfigToOps(triangle, kinds, { x: 1000, y: 500 }, () => `id${n++}`);
    expect(ids).toEqual(["id0", "id1"]);
    expect(skipped).toEqual(["cubes (chem.cubes)"]);
    const transform = (id: string) => ops.find((op) => op.id === id && op.aspect === "core.transform")!.patch as { x: number; y: number };
    expect(transform("id1").x - transform("id0").x).toBeCloseTo(mmToWorld(100));
    expect(transform("id1").y - transform("id0").y).toBeCloseTo(mmToWorld(40));
    expect(transform("id0").x + mmToWorld(140) / 2).toBeCloseTo(1000);
    const props = ops.find((op) => op.id === "id0" && op.aspect === "test.stem.geometry")!.patch!;
    expect(props).toMatchObject({ schema: 1, handles: ["A"], grid: null, axes: null, color: "" });
    expect(props.spec).toEqual({ objects: [{ id: "A", def: ["point", 1, 1] }] });
    expect(ops.find((op) => op.id === "id1" && op.aspect === "test.stem.geometry")!.patch!.grid).toEqual({});
  });

  it("rejects an invalid envelope instead of guessing", () => {
    expect(() => stemfigToOps('{"schema":"stemfig/v1","plugins":[],"nodes":[]}', kinds, { x: 0, y: 0 }, () => "x")).toThrow();
  });
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}
