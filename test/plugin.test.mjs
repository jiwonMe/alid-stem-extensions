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

/** A minimal host: records commands and creation requests, provides no clipboard. */
function activate() {
  const commands = new Map(), created = [];
  const context = {
    world: {},
    services: { get: name => name === 'canvas.creation' ? { create: request => { created.push(request); return `ent_${created.length}`; } } : undefined },
    commands: { register: spec => { commands.set(spec.id, spec); return () => commands.delete(spec.id); } },
  };
  const { api, dispose } = plugin.activate(context);
  return { api, dispose, commands, created };
}

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

test('the bundle fits the installer limit and imports nothing at runtime', () => {
  assert.ok(bytes.length <= MAX_BUNDLE_BYTES, `${bytes.length} > ${MAX_BUNDLE_BYTES}`);
  const source = bytes.toString('utf8');
  assert.doesNotMatch(source, /^import\s|[;\n]import\s*[{*\w]/m);
  assert.doesNotMatch(source, /i\.upmath\.me/, 'labels never fetch from the network');
});

test('activation registers commands only; creation happens on an explicit command and disposal unregisters', () => {
  const { api, dispose, commands, created } = activate();
  assert.deepEqual([...commands.keys()].sort(), [...manifest.capabilities.commands].sort());
  assert.equal(created.length, 0);
  for (const control of plugin.ui.controls) {
    assert.ok(commands.has(control.commandSymbol));
    assert.deepEqual(Object.keys(control.icon).sort(), ['paths'], 'tools draw their own path icon');
    if (control.placement === 'tool-shelf') assert.equal(control.requiresSelection, false);
    else { assert.equal(control.placement, 'selection-bar'); assert.equal(control.requiresSelection, true); }
  }
  for (const control of plugin.ui.controls.filter(item => item.placement === 'tool-shelf')) commands.get(control.commandSymbol).run();
  assert.equal(created.length, 3);
  assert.equal(commands.get(`${plugin.id}:edit-figure`).run(), false, 'no selection tool, nothing to edit');
  for (const request of created) {
    assert.deepEqual(Object.keys(request.aspects).length, 1);
    assert.ok(manifest.aspectIds.includes(Object.keys(request.aspects)[0]));
    assert.ok(!('core.transform' in request.aspects) && !('core.bounds' in request.aspects));
    assert.ok(request.width > 0 && request.height > 0);
  }
  dispose(); dispose();
  assert.equal(commands.size, 0);
  assert.throws(() => api.create('add-geometry'), /비활성화/);
});

test('every aspect has pure-JSON defaults and declarative controls bound to its own fields', () => {
  for (const aspect of plugin.aspects) {
    assert.deepEqual(JSON.parse(JSON.stringify(aspect.defaults)), aspect.defaults);
    for (const control of aspect.ui.controls) assert.ok(Object.hasOwn(aspect.defaults, control.field));
    assert.equal(typeof aspect.derive, 'function');
    assert.equal(typeof aspect.renderSvg, 'function');
  }
});

test('the built bundle draws every stemdraw fixture byte-identically (glyph pack + minify are invisible)', () => {
  const { api, dispose } = activate();
  try {
    assert.ok(golden.length >= 9);
    for (const item of golden) assert.equal(api.renderFigureSvg(item.kind, item.content, item.size), item.svg, item.name);
  } finally { dispose(); }
});
