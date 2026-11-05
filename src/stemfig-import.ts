/**
 * stemfig/v1 JSON → alid entities. Every figure of a supported kind becomes one
 * entity at its page position (frame mm), offset so the group is centred on `target`.
 * Sheets (frame nodes) carry no drawing of their own and are not imported.
 */
import { isFigure, parseDocument, walk, type Figure } from "@stemfig/host";
import type { CanonicalPatchOp } from "./alid.ts";
import { figureProps } from "./content.ts";
import type { FigureKind } from "./figure-aspect.ts";
import { mmToWorld } from "./units.ts";

/** Quick structural check before full parsing; lets other paste handlers keep plain text. */
export function looksLikeStemfig(text: string): boolean {
  return /^\s*\{[\s\S]*"schema"\s*:\s*"stemfig\/v1"/.test(text);
}

export type ImportResult = { ops: CanonicalPatchOp[]; ids: string[]; skipped: string[] };

export function stemfigToOps(text: string, kinds: readonly FigureKind[], target: { x: number; y: number }, newId: () => string): ImportResult {
  const doc = parseDocument(JSON.parse(text));
  const byKind = new Map(kinds.map((kind) => [kind.kind, kind]));
  const figures: Figure[] = [], skipped: string[] = [];
  for (const { node } of walk(doc)) {
    if (!isFigure(node)) continue;
    if (byKind.has(node.kind)) figures.push(node); else skipped.push(`${node.id} (${node.kind})`);
  }
  if (!figures.length) return { ops: [], ids: [], skipped };
  const minX = Math.min(...figures.map((f) => f.frame.x)), minY = Math.min(...figures.map((f) => f.frame.y));
  const maxX = Math.max(...figures.map((f) => f.frame.x + f.frame.w)), maxY = Math.max(...figures.map((f) => f.frame.y + f.frame.h));
  const originX = target.x - mmToWorld(maxX - minX) / 2, originY = target.y - mmToWorld(maxY - minY) / 2;
  const ops: CanonicalPatchOp[] = [], ids: string[] = [];
  for (const figure of figures) {
    const kind = byKind.get(figure.kind)!, id = newId();
    ids.push(id);
    ops.push(
      { id, aspect: "core.transform", patch: { x: originX + mmToWorld(figure.frame.x - minX), y: originY + mmToWorld(figure.frame.y - minY) } },
      { id, aspect: "core.bounds", patch: { width: mmToWorld(figure.frame.w), height: mmToWorld(figure.frame.h) } },
      { id, aspect: kind.aspectId, patch: figureProps({
        view: figure.view,
        ...(figure.grid ? { grid: figure.grid } : {}),
        ...(figure.axes ? { axes: figure.axes } : {}),
        ...(figure.color ? { color: figure.color } : {}),
        ...(figure.interaction ? { handles: figure.interaction.handles } : {}),
        spec: figure.spec,
      }) },
    );
  }
  return { ops, ids, skipped };
}
