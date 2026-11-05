import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Host integration tests run against a local alid checkout ($ALID or ~/Workspace/alid).
 * The kernel is not published to npm, so environments without a checkout skip them.
 */
export const alidRoot = process.env.ALID ?? join(homedir(), 'Workspace', 'alid');
export const hasAlid = existsSync(join(alidRoot, 'packages', 'kernel', 'src', 'index.ts'));

/** Test-only module names for the host pieces the integration test drives. */
export const alidAliases = hasAlid ? {
  '@alid/kernel': join(alidRoot, 'packages/kernel/src/index.ts'),
  'alid-host:repository-plugins': join(alidRoot, 'apps/playground/src/repository-plugins.ts'),
  'alid-host:effective-bounds': join(alidRoot, 'packages/builtins/src/effective-bounds.ts'),
  'alid-host:clipboard': join(alidRoot, 'packages/extensions/clipboard/src/install.ts'),
} : {};
