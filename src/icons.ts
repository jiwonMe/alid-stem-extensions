/**
 * Tool icons as 20×20 path data, stroked with currentColor by the host (1.5 px,
 * round caps), matching alid's own icon set. Hosts without contributed-icon support
 * fall back to their default action icon.
 */
import type { WorkbenchIcon } from "./alid.ts";

const dot = (x: number, y: number, r = 1.3) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

export const icons = {
  /** A triangle with its three vertices marked. */
  geometry: { paths: ["M3.5 16 10 4l6.5 12z", dot(3.5, 16), dot(10, 4), dot(16.5, 16)] },
  /** Axes and a parabola. */
  graph: { paths: ["M2.5 14h15M5 2.5v15", "M7 3Q11.5 19 16 3"] },
  /** A block on hatched ground, pushed by a force arrow. */
  mechanics: { paths: ["M2 15.5h16", "M4.5 18l1.5-2.5M9.5 18l1.5-2.5M14.5 18l1.5-2.5", "M3.5 15.5V9h6v6.5", "M9.5 12.25h7.5M14.5 9.75l2.5 2.5-2.5 2.5"] },
  /** Dashed frame with a draggable point: edit the inside of a figure. */
  edit: { paths: ["M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4", "M6.5 13.5 10 7l3.5 6.5", dot(10, 7, 2)] },
} satisfies Record<string, WorkbenchIcon>;
