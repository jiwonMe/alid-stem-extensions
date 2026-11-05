import { defineConfig } from 'vitest/config';
import { stemfigAliases } from './stemfig-aliases.js';

export default defineConfig({
  resolve: { alias: stemfigAliases },
  test: { include: ['vendor/stemfig/*/src/**/*.test.ts', 'src/**/*.test.ts'] },
});
