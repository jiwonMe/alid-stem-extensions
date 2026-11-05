/**
 * The vendored stemfig pipeline behind one function. It knows no figure kind:
 * plugins are passed in, and each figure runs through stemfig's own
 * parseDocument → compileDocument → renderSvg so output matches stemdraw exactly.
 * Labels always use offline MathJax; this extension never fetches upmath.
 */
import { renderSvg, type Axes, type DisplayItem, type Grid, type View } from "@stemfig/display";
import {
  applyFigure, compileDocument, hitFigure, indexNodes, listAnchors, parseDocument, Registry, SCHEMA_ID, snapFigure,
  type Document, type HandleAnchor, type HandlePatch, type SnapHit, type StemfigPlugin,
} from "@stemfig/host";

/** The figure content shared by every kind. Position and size belong to the host canvas. */
export type FigureContent = {
  view: View;
  grid?: Grid;
  axes?: Axes;
  color?: string;
  handles?: string[];
  spec: unknown;
};

export type FigureSize = { width_mm: number; height_mm: number };

/** One compiled figure. `items` are page mm with the figure at the origin. */
export type CompiledFigure = {
  items: DisplayItem[];
  /** Inner SVG markup in stemfig px (1 mm = 4 px), without the outer `<svg>`. */
  body: string;
  /** Root attributes stemfig puts on `<svg>` that the body relies on. */
  fontFamily: string;
  /** Set when the envelope itself was invalid; the body is then a plain error box. */
  error?: string;
};

const PAGE_ID = "page";
const FIGURE_ID = "figure";
const SVG_ROOT = /^<svg [^>]*?font-family="([^"]*)">([\s\S]*)<\/svg>$/;

export function createEngine(plugins: readonly StemfigPlugin[]) {
  const registry = new Registry();
  for (const plugin of plugins) registry.register(plugin);
  const byKind = new Map(plugins.map((plugin) => [plugin.kind, plugin]));

  function pluginFor(kind: string): StemfigPlugin {
    const plugin = byKind.get(kind);
    if (!plugin) throw new Error(`No stemfig plugin is registered for ${kind}.`);
    return plugin;
  }

  /**
   * Engine and spec failures draw stemfig's error box, as in stemdraw. An invalid
   * envelope (for example an empty view) cannot reach the engine and draws a plain box.
   */
  function compileFigure(kind: string, content: FigureContent, size: FigureSize): CompiledFigure {
    const plugin = pluginFor(kind);
    const frame = { x: 0, y: 0, w: size.width_mm, h: size.height_mm };
    let doc: Document;
    try {
      doc = figureDocument(plugin, kind, content, frame);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { items: [], body: envelopeErrorBox(frame.w, frame.h), fontFamily: "", error: message };
    }
    const list = compileDocument(doc, registry);
    const svg = renderSvg({ ...list, frames: [] });
    const match = SVG_ROOT.exec(svg);
    if (!match) throw new Error("stemfig renderSvg returned an unexpected document shape.");
    return { items: list.items, body: match[2]!, fontFamily: match[1]! };
  }

  /**
   * Handle editing on one figure, through stemfig's own host functions so behaviour
   * (locks, rejected edits, snapping) matches stemdraw. Coordinates are page mm with
   * the figure at the origin. A broken figure has no handles and rejects edits.
   */
  function editFigure(kind: string, content: FigureContent, size: FigureSize) {
    const plugin = pluginFor(kind);
    const frame = { x: 0, y: 0, w: size.width_mm, h: size.height_mm };
    let doc: Document;
    try { doc = figureDocument(plugin, kind, content, frame); } catch { return undefined; }
    return {
      anchors: (): HandleAnchor[] => { try { return listAnchors(doc, FIGURE_ID, registry); } catch { return []; } },
      hit: (x_mm: number, y_mm: number): string | null => { try { return hitFigure(doc, FIGURE_ID, x_mm, y_mm, registry); } catch { return null; } },
      snap: (x_mm: number, y_mm: number, exclude: string, px_per_mm: number): SnapHit | null => {
        try { return snapFigure(doc, FIGURE_ID, x_mm, y_mm, registry, exclude, false, px_per_mm); } catch { return null; }
      },
      /** The new spec, or undefined when the plugin rejected or did not change it. */
      apply: (patch: HandlePatch): unknown => {
        const next = applyFigure(doc, FIGURE_ID, patch, registry);
        if (next === doc) return undefined;
        const figure = indexNodes(next).figures[0];
        return figure?.spec;
      },
    };
  }

  /** One figure as a complete SVG document in stemfig px, origin top-left. */
  function renderFigureSvg(kind: string, content: FigureContent, size: FigureSize): string {
    const { body, fontFamily } = compileFigure(kind, content, size);
    const w = size.width_mm * 4, h = size.height_mm * 4;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${fontFamily}">${body}</svg>`;
  }

  return { compileFigure, editFigure, renderFigureSvg, pluginFor, kinds: [...byKind.keys()] };
}

export type StemEngine = ReturnType<typeof createEngine>;

/** A one-figure stemfig/v1 document with the figure at the page origin. Throws on an invalid envelope. */
function figureDocument(plugin: StemfigPlugin, kind: string, content: FigureContent, frame: { x: number; y: number; w: number; h: number }): Document {
  return parseDocument({
    schema: SCHEMA_ID,
    plugins: [`${plugin.kind}@${plugin.version}`],
    latex: "mathjax",
    nodes: [{
      id: PAGE_ID,
      type: "frame",
      frame,
      children: [{
        id: FIGURE_ID,
        type: "figure",
        kind,
        frame,
        view: content.view,
        ...(content.grid ? { grid: content.grid } : {}),
        ...(content.axes ? { axes: content.axes } : {}),
        ...(content.color ? { color: content.color } : {}),
        ...(content.handles ? { interaction: { handles: content.handles, invariants: [] } } : {}),
        spec: content.spec,
      }],
    }],
  });
}

function envelopeErrorBox(wMm: number, hMm: number): string {
  const w = wMm * 4, h = hMm * 4;
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="#f4f4f4" stroke="#111111" stroke-width="0.8"/>` +
    `<text x="8" y="24" font-size="6.4" fill="#111111" font-family="system-ui, sans-serif">error: SCHEMA</text>`;
}
