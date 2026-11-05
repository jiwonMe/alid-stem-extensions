import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Re-copy the stemdraw packages this extension vendors, from a clean commit.
 *
 *   node scripts/sync-stemfig.mjs [path-to-stemdraw]   (default ~/Workspace/stemdraw or $STEMDRAW)
 *
 * The copy is never edited by hand (docs/PLAN.md D3). After syncing run `pnpm golden`
 * and `pnpm test`, and review the diff of vendor/stemfig and test/golden.
 */
export const PACKAGES = [
  ['display', 'display', ['src']],
  ['host', 'host', ['src']],
  ['plugin-kit', 'plugin-kit', ['src']],
  ['plugin-math-geometry', 'geometry', ['src', 'fixtures']],
  ['plugin-physics-mechanics', 'mechanics', ['src', 'fixtures']],
];

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(process.argv[2] ?? process.env.STEMDRAW ?? join(homedir(), 'Workspace', 'stemdraw'));
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();

const dirty = git('status', '--porcelain', '--', ...PACKAGES.map(([name]) => `packages/${name}`));
if (dirty) throw new Error(`stemdraw has uncommitted changes in vendored packages; commit them first:\n${dirty}`);
const commit = git('rev-parse', 'HEAD');

const vendor = join(root, 'vendor', 'stemfig');
for (const [name, target, dirs] of PACKAGES) {
  rmSync(join(vendor, target), { recursive: true, force: true });
  for (const dir of dirs) {
    const from = join(source, 'packages', name, dir);
    if (!existsSync(from)) throw new Error(`Missing ${from}`);
    cpSync(from, join(vendor, target, dir), { recursive: true, filter: path => !path.includes('node_modules') });
  }
}

writeFileSync(join(vendor, 'UPSTREAM.md'), `# vendor/stemfig

stemdraw(STEMFIG) 패키지의 사본입니다. 직접 고치지 않습니다. 변경은 stemdraw에 먼저 반영한 뒤 \`pnpm sync:stemfig\`로 다시 가져옵니다.

- 원본: \`jiwonMe/stemdraw\` (로컬 \`~/Workspace/stemdraw\`)
- 커밋: \`${commit}\`

| 사본 | 원본 |
| --- | --- |
${PACKAGES.map(([name, target, dirs]) => `| \`${target}/\` | \`packages/${name}/{${dirs.join(',')}}\` |`).join('\n')}

import 이름(\`@stemfig/*\`)은 원본 그대로이며 \`stemfig-aliases.js\`가 사본으로 연결합니다. 외부 의존은 \`zod\`·\`mathjax-full\`이며 버전은 원본과 맞춥니다.
`);
console.log(`Synced stemdraw ${commit.slice(0, 7)} into vendor/stemfig. Next: pnpm golden && pnpm test`);
