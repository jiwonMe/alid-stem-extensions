import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import plugin from '../dist/plugin.js';
import { MAX_BUNDLE_BYTES } from '../vite.config.js';

const manifest = JSON.parse(await readFile(new URL('../alid.extension.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../extension.json', import.meta.url), 'utf8'));
const golden = JSON.parse(await readFile(new URL('./golden/fixtures.json', import.meta.url), 'utf8'));
const bytes = await readFile(new URL('../dist/plugin.js', import.meta.url));

test('the committed install manifest identifies and hashes the built module', () => {
  assert.equal(manifest.apiVersion, 2);
  assert.equal(manifest.id, plugin.id);
  for (const key of ['version', 'engine', 'dependencies', 'optionalDependencies', 'conflicts', 'provides']) assert.deepEqual(manifest[key], plugin[key], `Reviewed ${key} must match the runtime package.`);
  assert.equal(manifest.version, config.version);
  assert.deepEqual(manifest.provides.aspects, manifest.aspectIds);
  assert.deepEqual(manifest.aspectIds, plugin.aspects.map(item => item.id));
  assert.equal(manifest.entry, 'dist/plugin.js');
  assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex'));
});

test('the bundle fits the installer limit and imports only host-shared modules', () => {
  assert.ok(bytes.length <= MAX_BUNDLE_BYTES, `${bytes.length} > ${MAX_BUNDLE_BYTES}`);
  const source = bytes.toString('utf8');
  assert.doesNotMatch(source, /^import\s|[;\n]import\s*[{*\w]/m, 'P0 bundle has no runtime imports');
  assert.doesNotMatch(source, /i\.upmath\.me/, 'labels never fetch from the network');
});

test('installing and activating do not write document data; disposal disables the API', () => {
  const { api, dispose } = plugin.activate({ services: { get: () => { throw new Error('P0 reads no services'); } }, commands: { register: () => { throw new Error('P0 registers no commands'); } } });
  assert.deepEqual([...api.kinds].sort(), ['math.geometry', 'physics.mechanics']);
  dispose();
  assert.throws(() => api.renderFigureSvg(golden[0].kind, golden[0].content, golden[0].size), /비활성화/);
});

test('the built bundle draws every stemdraw fixture byte-identically (glyph pack + minify are invisible)', () => {
  const { api, dispose } = plugin.activate({});
  try {
    assert.ok(golden.length >= 9);
    for (const item of golden) assert.equal(api.renderFigureSvg(item.kind, item.content, item.size), item.svg, item.name);
  } finally { dispose(); }
});
