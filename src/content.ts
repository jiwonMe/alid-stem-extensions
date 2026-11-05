/**
 * Canonical figure content (docs/PLAN.md §3). One alid entity is one stemfig figure;
 * position and size live in alid's core.transform/core.bounds.
 *
 * Every field is user intent. `spec.draft` (an unfinished construction) never belongs
 * here: it is local tool state and stripped on import.
 */
import type { Axes, Grid, View } from "@stemfig/display";
import type { FigureContent } from "./engine.ts";

export const CONTENT_SCHEMA = 1;

/** Stored props. Kept flat so declarative inspector controls can bind to top-level fields. */
export type FigureProps = {
  schema: number;
  view: View;
  /** null: no grid. Canonical defaults need a value whose type the kernel can check. */
  grid: Grid | null;
  axes: Axes | null;
  /** #rrggbb ink, or "" for the stemfig default. */
  color: string;
  /** stemfig interaction.handles; null means every free handle. */
  handles: string[] | null;
  spec: Record<string, unknown>;
};

export function figureProps(content: FigureContent): FigureProps {
  return {
    schema: CONTENT_SCHEMA,
    view: { ...content.view },
    grid: content.grid ? structuredClone(content.grid) : null,
    axes: content.axes ? structuredClone(content.axes) : null,
    color: content.color ?? "",
    handles: content.handles ? [...content.handles] : null,
    spec: withoutDraft(content.spec),
  };
}

export function figureContent(props: Readonly<FigureProps>): FigureContent {
  return {
    view: props.view,
    ...(props.grid ? { grid: props.grid } : {}),
    ...(props.axes ? { axes: props.axes } : {}),
    ...(props.color ? { color: props.color } : {}),
    ...(props.handles ? { handles: props.handles } : {}),
    spec: props.spec,
  };
}

/** Drop an in-progress construction; it is never canonical. */
export function withoutDraft(spec: unknown): Record<string, unknown> {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return {};
  const { draft: _draft, ...rest } = spec as Record<string, unknown>;
  return structuredClone(rest);
}
