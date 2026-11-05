import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { mathjaxGlyphPack } from './scripts/mathjax-glyph-pack.mjs';
import { stemfigAliases } from './stemfig-aliases.js';

export const sharedImports = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', '@alid/react', '@alid/kernel'];
const shared = new Set(sharedImports);
/** alid's repository installer rejects larger entry files (MAX_SOURCE_BYTES). */
export const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;

/** The approved Blob entry can import only exact modules supplied by the host import map. */
function checkPluginImports() {
  return {
    name: 'alid:check-plugin-imports',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') throw new Error('Inline assets and CSS into the plugin; separate output files cannot be loaded from its Blob URL.');
        for (const id of [...output.imports, ...output.dynamicImports]) if (!shared.has(id)) throw new Error(`Unsupported runtime import: ${id}. Bundle dependencies or use an exact host shared import.`);
        const bytes = Buffer.byteLength(output.code);
        if (bytes > MAX_BUNDLE_BYTES) throw new Error(`Bundle is ${bytes} bytes; alid installs at most ${MAX_BUNDLE_BYTES}.`);
      }
    },
  };
}

export default defineConfig({
  plugins: [mathjaxGlyphPack(), checkPluginImports()],
  resolve: { alias: stemfigAliases },
  build: {
    target: 'es2022',
    minify: true,
    sourcemap: false,
    lib: { entry: fileURLToPath(new URL('src/index.ts', import.meta.url)), formats: ['es'], fileName: () => 'plugin.js' },
    // One ESM file plus exact shared host imports; Blob URLs cannot resolve ./chunks.
    rolldownOptions: { external: id => shared.has(id), output: { codeSplitting: false, minify: true } },
  },
});
