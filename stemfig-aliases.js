import { fileURLToPath } from 'node:url';

const vendor = name => fileURLToPath(new URL(`vendor/stemfig/${name}/src/index.ts`, import.meta.url));

/** Vendored stemdraw packages keep their original import names; see vendor/stemfig/UPSTREAM.md. */
export const stemfigAliases = {
  '@stemfig/display': vendor('display'),
  '@stemfig/host': vendor('host'),
  '@stemfig/plugin-kit': vendor('plugin-kit'),
  '@stemfig/plugin-math-geometry': vendor('geometry'),
  '@stemfig/plugin-physics-mechanics': vendor('mechanics'),
};
