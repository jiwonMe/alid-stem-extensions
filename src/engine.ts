/**
 * The vendored stemfig pipeline behind one function. It knows no figure kind:
 * plugins come from `kinds`, and each figure runs through stemfig's own
 * parseDocument → compileDocument → renderSvg so output matches stemdraw exactly.
 * Labels always use offline MathJax; this extension never fetches upmath.
 */
import { renderSvg, type Axes, type Grid, type View } from "@stemfig/display";
import { compileDocument, parseDocument, Registry, SCHEMA_ID, type StemfigPlugin } from "@stemfig/host";

/** The canonical figure content shared by every kind. Position and size belong to alid. */
export type FigureContent = {
  view: View;
  grid?: Grid;
  axes?: Axes;
  color?: string;
  handles?: string[];
  spec: unknown;
};

export type FigureSize = { width_mm: number; height_mm: number };

const PAGE_ID = "page";
const FIGURE_ID = "figure";

export function createEngine(plugins: readonly StemfigPlugin[]) {
  const registry = new Registry();
  for (const plugin of plugins) registry.register(plugin);
  const byKind = new Map(plugins.map((plugin) => [plugin.kind, plugin]));

  /**
   * One figure as a complete SVG document in stemfig CSS px (1 mm = 4 px), origin top-left.
   * Engine failures draw stemfig's error box instead of throwing; an invalid envelope throws.
   */
  function renderFigureSvg(kind: string, content: FigureContent, size: FigureSize): string {
    const plugin = byKind.get(kind);
    if (!plugin) throw new Error(`No stemfig plugin is registered for ${kind}.`);
    const frame = { x: 0, y: 0, w: size.width_mm, h: size.height_mm };
    const doc = parseDocument({
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
    const list = compileDocument(doc, registry);
    return renderSvg({ ...list, frames: [] });
  }

  return { renderFigureSvg, kinds: [...byKind.keys()] };
}
