/**
 * stemfig DisplayItems (page mm) → SVG markup in gizmo-plane screen px. Used only
 * for tool previews (ghosts), which never enter the document or its publication.
 */
import type { DisplayItem } from "@stemfig/display";

export type ToScreen = (xMm: number, yMm: number) => [number, number];

const ACCENT = "var(--alid-accent,#6d5bd0)";
const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (value: number) => (Math.round(value * 100) / 100).toString();

/** Ghosts use the accent colour at a fixed screen weight, so they read as "not yet placed". */
export function itemsToHudSvg(items: readonly DisplayItem[], toScreen: ToScreen, pxPerMm: number): string {
  let out = "";
  const visit = (item: DisplayItem) => {
    switch (item.op) {
      case "polyline": case "polygon": {
        const pts = item.points.map(([x, y]) => toScreen(x, y).map(fmt).join(",")).join(" ");
        const closed = item.op === "polygon" || item.close;
        out += `<${closed ? "polygon" : "polyline"} points="${pts}" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
        break;
      }
      case "circle": case "ellipse": {
        const [cx, cy] = toScreen(item.cx, item.cy);
        const rx = (item.op === "circle" ? item.r : item.rx) * pxPerMm, ry = (item.op === "circle" ? item.r : item.ry) * pxPerMm;
        const filled = item.fill && item.fill !== "none" && Math.max(rx, ry) < 6;
        out += `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(Math.max(rx, filled ? 2.5 : 0))}" ry="${fmt(Math.max(ry, filled ? 2.5 : 0))}" fill="${filled ? ACCENT : "none"}" stroke="${ACCENT}" stroke-width="1.5"${filled ? "" : ' stroke-dasharray="4 3"'}/>`;
        break;
      }
      case "text": {
        const [x, y] = toScreen(item.x, item.y);
        out += `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(Math.max(10, item.size * pxPerMm))}" fill="${ACCENT}" font-family="system-ui,sans-serif">${esc(item.text.replace(/^\$+|\$+$/g, ""))}</text>`;
        break;
      }
      case "group": for (const child of item.items) visit(child); break;
      case "glyphs": break;
    }
  };
  for (const item of items) visit(item);
  return out;
}
