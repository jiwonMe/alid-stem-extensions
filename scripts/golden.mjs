import { createServer } from 'vite';
import { stemfigAliases } from '../stemfig-aliases.js';

// Loads the TypeScript golden writer with the same @stemfig aliases the tests use.
const server = await createServer({ configFile: false, logLevel: 'error', resolve: { alias: stemfigAliases }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  await server.ssrLoadModule('/scripts/write-golden.ts');
} finally {
  await server.close();
}
