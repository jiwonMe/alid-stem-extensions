import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { alidAliases, alidCoreWasm, hasAlid } from './alid-checkout.js';
import { stemfigAliases } from './stemfig-aliases.js';

export default defineConfig({
  resolve: { alias: { ...stemfigAliases, ...alidAliases } },
  define: { __HAS_ALID__: JSON.stringify(hasAlid), __ALID_CORE_WASM__: JSON.stringify(hasAlid && existsSync(alidCoreWasm) ? alidCoreWasm : '') },
  test: { include: ['vendor/stemfig/*/src/**/*.test.ts', 'src/**/*.test.ts'] },
});
