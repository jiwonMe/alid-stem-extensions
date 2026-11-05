import { defineConfig } from 'vitest/config';
import { alidAliases } from './alid-checkout.js';
import { stemfigAliases } from './stemfig-aliases.js';

export default defineConfig({
  resolve: { alias: { ...stemfigAliases, ...alidAliases } },
  test: { include: ['vendor/stemfig/*/src/**/*.test.ts', 'src/**/*.test.ts'] },
});
