/**
 * Vendored stemdraw fixtures and stemdraw's reference rendering of each figure.
 * Test and golden-file support only; not part of the bundle.
 */
import { readFileSync, readdirSync } from "node:fs";
import { renderSvg } from "@stemfig/display";
import { compileDocument, isFigure, parseDocument, Registry, walk, type Figure } from "@stemfig/host";
import type { FigureContent, FigureSize } from "./engine.ts";
import { stemfigPlugins } from "./kinds.ts";

const fixtureFiles = ["geometry", "mechanics"].flatMap((kind) => {
  const dir = new URL(`../vendor/stemfig/${kind}/fixtures/`, import.meta.url);
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort().map((name) => new URL(name, dir));
});

export function fixtureFigures(): { name: string; figure: Figure }[] {
  return fixtureFiles.flatMap((url) => {
    const doc = parseDocument(JSON.parse(readFileSync(url, "utf8")));
    const figures: Figure[] = [];
    for (const { node } of walk(doc)) if (isFigure(node)) figures.push(node);
    return figures.map((figure) => ({ name: `${url.pathname.split("/").at(-1)}#${figure.id}`, figure }));
  });
}

export function figureContent(figure: Figure): FigureContent {
  return {
    view: figure.view,
    ...(figure.grid ? { grid: figure.grid } : {}),
    ...(figure.axes ? { axes: figure.axes } : {}),
    ...(figure.color ? { color: figure.color } : {}),
    ...(figure.interaction ? { handles: figure.interaction.handles } : {}),
    spec: figure.spec,
  };
}

export const figureSize = (figure: Figure): FigureSize => ({ width_mm: figure.frame.w, height_mm: figure.frame.h });

/** stemdraw's own pipeline: the figure alone, at the origin, with offline MathJax. */
export function referenceSvg(figure: Figure): string {
  const registry = new Registry();
  for (const plugin of stemfigPlugins) registry.register(plugin);
  const frame = { x: 0, y: 0, w: figure.frame.w, h: figure.frame.h };
  const doc = parseDocument({
    schema: "stemfig/v1",
    plugins: stemfigPlugins.map((plugin) => `${plugin.kind}@${plugin.version}`),
    latex: "mathjax",
    nodes: [{ id: "page", type: "frame", frame, children: [{ ...figure, id: "figure", frame }] }],
  });
  return renderSvg({ ...compileDocument(doc, registry), frames: [] });
}
