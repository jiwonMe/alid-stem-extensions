/**
 * Coordinates for editing one figure: alid world px ⇄ the figure's page mm.
 * The stemfig figure frame is the entity box at the origin, so page mm are
 * box-local, unrotated, and scaled by WORLD_PX_PER_MM.
 */
import type { MutablePoint } from "../alid.ts";
import type { FigureGeometry } from "../figure-aspect.ts";
import { WORLD_PX_PER_MM } from "../units.ts";

export function worldToPageMm(box: FigureGeometry, x: number, y: number, out: MutablePoint): void {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const cos = Math.cos(box.rotation), sin = Math.sin(box.rotation);
  const dx = x - cx, dy = y - cy;
  out.x = (dx * cos + dy * sin + box.width / 2) / WORLD_PX_PER_MM;
  out.y = (-dx * sin + dy * cos + box.height / 2) / WORLD_PX_PER_MM;
}

export function pageMmToWorld(box: FigureGeometry, xMm: number, yMm: number, out: MutablePoint): void {
  const lx = xMm * WORLD_PX_PER_MM - box.width / 2, ly = yMm * WORLD_PX_PER_MM - box.height / 2;
  const cos = Math.cos(box.rotation), sin = Math.sin(box.rotation);
  out.x = box.x + box.width / 2 + lx * cos - ly * sin;
  out.y = box.y + box.height / 2 + lx * sin + ly * cos;
}

/** Whether a world point lies inside the rotated box. */
export function insideBox(box: FigureGeometry, x: number, y: number, scratch: MutablePoint): boolean {
  worldToPageMm(box, x, y, scratch);
  return scratch.x >= 0 && scratch.y >= 0 && scratch.x * WORLD_PX_PER_MM <= box.width && scratch.y * WORLD_PX_PER_MM <= box.height;
}
