/**
 * alid world units are CSS px (96 per inch); stemfig draws in mm and serialises SVG at
 * 4 px per mm. One alid world px is 25.4/96 mm (docs/PLAN.md D5).
 */
export const WORLD_PX_PER_MM = 96 / 25.4;
/** stemfig `MM_TO_PX`: the unit of the SVG its renderSvg writes. */
export const STEMFIG_PX_PER_MM = 4;
/** Scale from stemfig SVG px to alid world px. */
export const STEMFIG_TO_WORLD = WORLD_PX_PER_MM / STEMFIG_PX_PER_MM;

/** Rounded to 1e-9 mm so a stemfig frame survives mm → world → mm exactly. */
export const worldToMm = (px: number): number => Math.round((px / WORLD_PX_PER_MM) * 1e9) / 1e9;
export const mmToWorld = (mm: number): number => mm * WORLD_PX_PER_MM;
