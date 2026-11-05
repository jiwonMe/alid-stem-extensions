/**
 * The vendored stemfig pipeline behind one function. It knows no figure kind:
 * plugins are passed in, and each figure runs through stemfig's own
 * parseDocument → compileDocument → renderSvg so output matches stemdraw exactly.
 * Labels always use offline MathJax; this extension never fetches upmath.
 */
import { renderSvg, type Axes, type DisplayItem, type Grid, type View } from "@stemfig/display";
import {
  applyFigure, cancelPlacement, compileDocument, finishPlacement, hitFigure, indexNodes, listAnchors, listFields, parseDocument,
  patchField, placeFigure, previewFigure, Registry, removeHandles, SCHEMA_ID, snapFigure, toolGuidance, validateField,
  type Document, type FieldPatch, type FigureTool, type HandleAnchor, type HandlePatch, type InspectField, type SnapHit,
  type StemfigPlugin, type ToolGuidance,
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
    const guard = <T>(fallback: T, run: () => T): T => { try { return run(); } catch { return fallback; } };
    /** The figure content after an edit, or undefined when stemfig rejected it or nothing changed. */
    const contentOf = (next: Document): FigureContent | undefined => {
      if (next === doc) return undefined;
      const figure = indexNodes(next).figures[0];
      if (!figure) return undefined;
      return { ...content, spec: figure.spec, ...(figure.interaction ? { handles: figure.interaction.handles } : {}) };
    };
    return {
      tools: (): readonly FigureTool[] => plugin.tools ?? [],
      anchors: (): HandleAnchor[] => guard([], () => listAnchors(doc, FIGURE_ID, registry)),
      hit: (x_mm: number, y_mm: number): string | null => guard(null, () => hitFigure(doc, FIGURE_ID, x_mm, y_mm, registry)),
      snap: (x_mm: number, y_mm: number, exclude: string | undefined, px_per_mm: number): SnapHit | null =>
        guard(null, () => snapFigure(doc, FIGURE_ID, x_mm, y_mm, registry, exclude, false, px_per_mm)),
      /** The new spec, or undefined when the plugin rejected or did not change it. */
      apply: (patch: HandlePatch): unknown => contentOf(applyFigure(doc, FIGURE_ID, patch, registry))?.spec,
      place: (tool: string, x_mm: number, y_mm: number, modifiers: { unsnap: boolean; constrain: boolean; px_per_mm: number }) => {
        const result = placeFigure(doc, FIGURE_ID, tool, x_mm, y_mm, registry, modifiers.unsnap, modifiers.px_per_mm, modifiers.constrain);
        return { content: contentOf(result.doc), handle: result.handleId };
      },
      preview: (tool: string, x_mm: number, y_mm: number, modifiers: { unsnap: boolean; constrain: boolean; px_per_mm: number }) =>
        previewFigure(doc, FIGURE_ID, tool, x_mm, y_mm, registry, modifiers.unsnap, modifiers.px_per_mm, modifiers.constrain),
      guidance: (tool: string): ToolGuidance | undefined => toolGuidance(doc, FIGURE_ID, tool, registry),
      cancel: (): FigureContent | undefined => contentOf(cancelPlacement(doc, FIGURE_ID, registry)),
      finish: (tool: string) => { const result = finishPlacement(doc, FIGURE_ID, tool, registry); return { content: contentOf(result.doc), handle: result.handleId }; },
      fields: (focus: string | undefined): readonly InspectField[] => listFields(doc, FIGURE_ID, focus, registry),
      validateField: (patch: FieldPatch): string | undefined => validateField(doc, FIGURE_ID, patch, registry),
      applyField: (patch: FieldPatch): FigureContent | undefined => contentOf(patchField(doc, FIGURE_ID, patch, registry)),
      remove: (ids: readonly string[]): FigureContent | undefined => contentOf(removeHandles(doc, FIGURE_ID, ids, registry)),
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
