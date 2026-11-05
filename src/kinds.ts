import { mathGeometryPlugin } from "@stemfig/plugin-math-geometry";
import { physicsMechanicsPlugin } from "@stemfig/plugin-physics-mechanics";
import type { StemfigPlugin } from "@stemfig/host";

/** Every stemfig plugin this package ships. The adapter never branches on these names. */
export const stemfigPlugins: readonly StemfigPlugin[] = [
  mathGeometryPlugin as unknown as StemfigPlugin,
  physicsMechanicsPlugin as unknown as StemfigPlugin,
];
