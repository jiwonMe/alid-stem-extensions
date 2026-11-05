import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Host integration tests run against a local alid checkout ($ALID or ~/Workspace/alid).
 * The kernel is not published to npm, so environments without a checkout skip them.
 */
export const alidRoot = process.env.ALID ?? join(homedir(), 'Workspace', 'alid');
export const hasAlid = existsSync(join(alidRoot, 'packages', 'kernel', 'src', 'index.ts'));

const absent = fileURLToPath(new URL('test/types/alid-absent.js', import.meta.url));
const host = path => hasAlid ? join(alidRoot, path) : absent;

/**
 * Test-only module names for the host pieces the integration test drives. Without a
 * checkout they resolve to an empty module so imports still resolve while the suite skips.
 */
export const alidAliases = {
  '@alid/kernel': host('packages/kernel/src/index.ts'),
  'alid-host:repository-plugins': host('apps/playground/src/repository-plugins.ts'),
  'alid-host:effective-bounds': host('packages/builtins/src/effective-bounds.ts'),
  'alid-host:clipboard': host('packages/extensions/clipboard/src/install.ts'),
  'alid-host:core': host('crates/ecanvas-core/pkg/ecanvas_core.js'),
};
/** The built Wasm core binary (`pnpm build:wasm` in alid). */
export const alidCoreWasm = join(alidRoot, 'crates', 'ecanvas-core', 'pkg', 'ecanvas_core_bg.wasm');
