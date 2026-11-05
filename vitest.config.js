import { defineConfig } from 'vitest/config';
import { alidAliases, hasAlid } from './alid-checkout.js';
import { stemfigAliases } from './stemfig-aliases.js';

export default defineConfig({
  resolve: { alias: { ...stemfigAliases, ...alidAliases } },
  define: { __HAS_ALID__: JSON.stringify(hasAlid) },
  test: { include: ['vendor/stemfig/*/src/**/*.test.ts', 'src/**/*.test.ts'] },
});
