/**
 * A stemfig figure kind as an alid canvas object. Kind-agnostic: the plugin and
 * its creation defaults are passed in.
 *
 * derive() reads canonical props + core.transform/core.bounds and compiles the
 * figure; nothing it produces is written back (Gate 1). renderSvg() is the single
 * vector path for screen and publication (Gate 5). Selection uses alid's default
 * box, which is also the figure's clip frame; P2 adds a contribution for editing.
 */
import type { AspectSpec, ComputedReadView, EntityId, UiControl } from "./alid.ts";
import { figureContent, type FigureProps } from "./content.ts";
import type { CompiledFigure, StemEngine } from "./engine.ts";
import { STEMFIG_TO_WORLD, worldToMm } from "./units.ts";

export type FigureGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type FigureDerived = FigureGeometry & {
  compiled: CompiledFigure;
};

const finite = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const positive = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
/** Per-entity compile cache bound; deleted entities fall out when it is exceeded. */
const MEMO_LIMIT = 512;

export function readGeometry(view: ComputedReadView, id: EntityId, fallback: { width: number; height: number }): FigureGeometry {
  const transform = view.getCanonical<Record<string, unknown>>(id, "core.transform") ?? {};
  const bounds = view.getCanonical<Record<string, unknown>>(id, "core.bounds") ?? {};
  return {
    x: finite(transform.x, 0),
    y: finite(transform.y, 0),
    width: positive(bounds.width, fallback.width),
    height: positive(bounds.height, fallback.height),
    rotation: finite(transform.rotation, 0),
  };
}

export interface FigureKind {
  /** stemfig plugin kind, e.g. "math.geometry". */
  kind: string;
  aspectId: string;
  label: string;
  summary: string;
  defaults: FigureProps;
  /** World px used when the canonical box is missing or invalid. */
  defaultSize: { width: number; height: number };
}

export function createFigureAspect(engine: StemEngine, figure: FigureKind): AspectSpec<FigureProps, FigureDerived> {
  // The kernel re-evaluates every computed aspect on each frontier; reuse the last
  // compile per entity while its frozen props and box are unchanged.
  const memo = new Map<EntityId, { props: unknown; width: number; height: number; compiled: CompiledFigure }>();

  function derive(props: Readonly<FigureProps>, id: EntityId, view: ComputedReadView): FigureDerived {
    const geometry = readGeometry(view, id, figure.defaultSize);
    const last = memo.get(id);
    if (last && last.props === props && last.width === geometry.width && last.height === geometry.height) return { ...geometry, compiled: last.compiled };
    const compiled = engine.compileFigure(figure.kind, figureContent(props), { width_mm: worldToMm(geometry.width), height_mm: worldToMm(geometry.height) });
    if (memo.size >= MEMO_LIMIT) memo.clear();
    memo.set(id, { props, width: geometry.width, height: geometry.height, compiled });
    return { ...geometry, compiled };
  }

  const viewControls: UiControl[] = [
    { id: `${figure.aspectId}.grid`, kind: "segmented", field: "grid", label: "격자", placement: "inspector", options: [{ label: "끔", value: null }, { label: "켬", value: {} }] },
    { id: `${figure.aspectId}.axes`, kind: "segmented", field: "axes", label: "축", placement: "inspector", options: [{ label: "끔", value: null }, { label: "켬", value: { x: { label: "x" }, y: { label: "y" } } }] },
  ];

  return {
    id: figure.aspectId,
    label: figure.label,
    summary: figure.summary,
    defaults: figure.defaults,
    dependsOnCanonical: [figure.aspectId, "core.transform", "core.bounds"],
    dependsOnComputed: [],
    derive,
    renderSvg(_props, derived) {
      if (!derived) return { svg: "" };
      const { x, y, width, height, rotation } = derived;
      const font = derived.compiled.fontFamily ? ` font-family="${derived.compiled.fontFamily}"` : "";
      return {
        svg: `<g transform="translate(${x} ${y}) rotate(${(rotation * 180) / Math.PI} ${width / 2} ${height / 2}) scale(${STEMFIG_TO_WORLD})"${font}>${derived.compiled.body}</g>`,
      };
    },
    ui: { controls: viewControls },
  };
}
