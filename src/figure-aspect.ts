/**
 * A stemfig figure kind as an alid canvas object. Kind-agnostic: the plugin and
 * its creation defaults are passed in.
 *
 * derive() reads canonical props + core.transform/core.bounds and compiles the
 * figure; nothing it produces is written back (Gate 1). renderSvg() is the single
 * vector path for screen and publication (Gate 5). Selection is the figure box,
 * which is also its clip frame (as in stemdraw); while the inside is being edited
 * the box is not transformable, so the editor's handles own the pointer.
 */
import type { AspectSpec, ComputedReadView, EntityId, SelectionContribution, UiControl } from "./alid.ts";
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

export function createFigureAspect(engine: StemEngine, figure: FigureKind, isEditing: (id: EntityId) => boolean = () => false): AspectSpec<FigureProps, FigureDerived> {
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

  const derivedOf = (id: EntityId, view: ComputedReadView) => view.getComputed<FigureDerived>(id, `computed.${figure.aspectId}`);
  const selection: SelectionContribution = {
    getBounds(id, view, out) {
      const d = derivedOf(id, view);
      if (!d) return false;
      out.x = d.x; out.y = d.y; out.width = d.width; out.height = d.height; out.rotation = d.rotation;
      return true;
    },
    /** The box is the figure's paint geometry: it clips everything the figure draws. */
    hitTest(id, view, x, y) {
      const d = derivedOf(id, view);
      if (!d) return Infinity;
      const [lx, ly] = toLocal(d, x, y);
      return Math.hypot(Math.max(-lx, 0, lx - d.width), Math.max(-ly, 0, ly - d.height));
    },
    intersectsRect(id, view, minX, minY, maxX, maxY) {
      const d = derivedOf(id, view);
      return !!d && rotatedBoxIntersectsRect(d, minX, minY, maxX, maxY);
    },
    canTransform: (id) => !isEditing(id),
  };

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
    selection,
    renderSvg(_props, derived) {
      if (!derived) return { svg: "" };
      const { x, y, width, height, rotation } = derived;
      const font = derived.compiled.fontFamily ? ` font-family="${derived.compiled.fontFamily}"` : "";
      // stemfig uses fixed ink colours. A light backing in dark mode keeps even
      // explicitly coloured drawings legible; the default SVG remains transparent.
      return {
        svg: `<g transform="translate(${x} ${y}) rotate(${(rotation * 180) / Math.PI} ${width / 2} ${height / 2}) scale(${STEMFIG_TO_WORLD})"${font}><rect width="${width / STEMFIG_TO_WORLD}" height="${height / STEMFIG_TO_WORLD}" fill="transparent" style="fill:light-dark(transparent, white)"/>${derived.compiled.body}</g>`,
      };
    },
    ui: { controls: viewControls },
  };
}

/** World point → box-local world px (unrotated, origin at the box's top-left). */
export function toLocal(d: FigureGeometry, x: number, y: number): [number, number] {
  const cx = d.x + d.width / 2, cy = d.y + d.height / 2;
  const cos = Math.cos(-d.rotation), sin = Math.sin(-d.rotation);
  const dx = x - cx, dy = y - cy;
  return [dx * cos - dy * sin + d.width / 2, dx * sin + dy * cos + d.height / 2];
}

/** Separating-axis test of a rotated box against an axis-aligned rectangle. */
export function rotatedBoxIntersectsRect(d: FigureGeometry, minX: number, minY: number, maxX: number, maxY: number): boolean {
  const cx = d.x + d.width / 2, cy = d.y + d.height / 2, cos = Math.cos(d.rotation), sin = Math.sin(d.rotation);
  const hw = d.width / 2, hh = d.height / 2;
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [cx + u! * cos - v! * sin, cy + u! * sin + v! * cos] as const);
  const rect = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]] as const;
  for (const [ax, ay] of [[1, 0], [0, 1], [cos, sin], [-sin, cos]] as const) {
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const [x, y] of corners) { const p = x * ax + y * ay; aMin = Math.min(aMin, p); aMax = Math.max(aMax, p); }
    for (const [x, y] of rect) { const p = x * ax + y * ay; bMin = Math.min(bMin, p); bMax = Math.max(bMax, p); }
    if (aMax < bMin || bMax < aMin) return false;
  }
  return true;
}
