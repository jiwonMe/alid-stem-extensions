// @vitest-environment jsdom
/**
 * Runs the BUILT bundle (dist/plugin.js) inside a real alid kernel from a local
 * checkout ($ALID or ~/Workspace/alid): repository installer validation, package
 * runtime, CanvasWorld, computed graph, SVG publication and the clipboard paste path.
 * Skipped when no checkout is present (the kernel is not published to npm).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

declare const __HAS_ALID__: boolean; // vitest.config.js, from alid-checkout.js
const suite = __HAS_ALID__ ? describe : describe.skip;
/* jsdom gives import.meta.url an http scheme; vitest runs from the package root. */
const file = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

async function load() {
  const kernel = await import("@alid/kernel");
  const repo = await import("alid-host:repository-plugins");
  const bounds = await import("alid-host:effective-bounds");
  const clipboardSuite = await import("alid-host:clipboard");
  const plugin = (await import("../dist/plugin.js")).default;
  const manifest = JSON.parse(file("alid.extension.json"));
  const source = file("dist/plugin.js");
  return { kernel, repo, bounds, clipboardSuite, plugin, manifest, source };
}

/** A headless host: the same services the playground provides, minus DOM surfaces. */
async function startHost(options: { clipboard?: boolean } = {}) {
  const { kernel, repo, bounds, clipboardSuite, plugin, manifest } = await load();
  const commit = vi.fn();
  const world = new kernel.CanvasWorld({ commitCanonicalBatch: commit, updateSpatialBounds() {} });
  world.registerCanonical({ id: "core.transform", defaults: { x: 0, y: 0, rotation: 0 } });
  world.registerCanonical({ id: "core.bounds", defaults: { width: 300 } });
  bounds.registerEffectiveBoundsBridge(world);
  const services = new kernel.ServiceRegistry(), commands = new kernel.CommandRegistry(world), compiler = new kernel.SceneVectorCompiler();
  const errors: unknown[] = [];
  const registry = new kernel.ExtensionRuntimeRegistry({ world, services, commands, compiler }, { onError: (error: unknown) => errors.push(error) });
  let groups = 0;
  const run = (caller: string, ops: unknown[]) => { groups++; world.applyCanonicalTransaction(caller, ops, "local:user"); };
  services.provide("canvas.creation", {
    create(request: { caller: string; aspects: Record<string, Record<string, unknown>>; width: number; height?: number }) {
      const id = `ent_${groups}`;
      run(request.caller, [
        { id, aspect: "core.transform", patch: { x: 100, y: 50 } },
        { id, aspect: "core.bounds", patch: { width: request.width, height: request.height } },
        ...Object.entries(request.aspects).map(([aspect, patch]) => ({ id, aspect, patch })),
      ]);
      return id;
    },
  });
  let insertion: { ids: readonly string[] } | undefined;
  services.provide("canvas.clipboard-host", {
    getInsertionPoint: () => ({ x: 500, y: 400 }),
    getSelectedIds: () => [],
    insertSnapshot(caller: string, snapshot: Record<string, Record<string, Record<string, unknown>>>, selectAfter: readonly string[]) {
      run(caller, Object.entries(snapshot).flatMap(([id, aspects]) => Object.entries(aspects).map(([aspect, patch]) => ({ id, aspect, patch }))));
      insertion = { ids: selectAfter };
    },
    deleteEntities() {},
    beginExclusiveCommand() {},
  });
  const packages = [];
  if (options.clipboard) packages.push({ spec: { ...clipboardSuite.createClipboardSuite(), version: "0.1.0", provides: { services: ["canvas.clipboard"] } } });
  repo.validatePluginSpec(plugin, manifest);
  packages.push({ spec: plugin, manifest: repo.pluginRuntimeManifest(manifest, repo.visualAspectIdsOf(plugin), true) });
  registry.registerPackages(packages);
  return { kernel, world, services, commands, compiler, registry, commit, errors, plugin, manifest, groups: () => groups, insertion: () => insertion };
}

suite("inside the alid kernel", () => {
  it("passes the repository installer's manifest, hash and contract checks", async () => {
    const { repo, plugin, manifest, source } = await load();
    expect(() => repo.validateRepositoryManifest(manifest)).not.toThrow();
    expect(await repo.hashSource(source)).toBe(manifest.sha256);
    expect(() => repo.validatePluginSpec(plugin, manifest)).not.toThrow();
    expect(repo.visualAspectIdsOf(plugin)).toEqual(manifest.aspectIds);
  });

  it("installs and activates without writing the document", async () => {
    const { registry, commit, world, errors, manifest } = await startHost();
    expect(errors).toEqual([]);
    expect(registry.getSnapshot().find((item: { id: string }) => item.id === manifest.id)?.state).toBe("active");
    expect(commit).not.toHaveBeenCalled();
    expect(world.listEntityIds()).toEqual([]);
  });

  it("creates each preset as one undo group with only content aspects, and publishes it as SVG", async () => {
    const { commands, world, compiler, commit, groups, manifest } = await startHost();
    for (const name of ["add-geometry", "add-graph", "add-mechanics"]) await commands.execute(`${manifest.id}:${name}`);
    expect(groups()).toBe(3);
    expect(world.listEntityIds()).toHaveLength(3);
    for (const id of world.listEntityIds()) {
      const own = manifest.aspectIds.filter((aspect: string) => world.getCanonical(id, aspect));
      expect(own).toHaveLength(1);
      expect(world.getCanonical(id, own[0]).spec).not.toHaveProperty("draft");
    }
    const commits = commit.mock.calls.length;
    const svg = compiler.compileToPureSvg(world);
    expect(commit.mock.calls.length).toBe(commits); // reading and publishing never write
    expect(compiler.inspectRenderErrors()).toEqual([]);
    expect(world.getComputedErrors()).toEqual([]);
    expect(svg.match(/data-entity-id=/g)).toHaveLength(3);
    expect(svg).not.toContain("error:");
    expect(svg).toContain("<path d=");  // TeX labels are baked into paths
  });

  it("derives a figure box equal to its canonical box and keeps it out of the canonical record", async () => {
    const { commands, world, manifest } = await startHost();
    const id = await commands.execute(`${manifest.id}:add-geometry`);
    const layout = world.getComputed(id, "computed.layoutBounds");
    const bounds = world.getCanonical(id, "core.bounds");
    expect(layout).toMatchObject({ x: 100, y: 50, width: bounds.width, height: bounds.height });
    const snapshot = JSON.stringify(world.exportCanonicalSnapshot());
    expect(snapshot).not.toContain("compiled");
    expect(snapshot).not.toContain("<path");
  });

  it("pastes stemfig/v1 JSON through core.clipboard as figures, in one undo group", async () => {
    const { services, world, groups, insertion, manifest } = await startHost({ clipboard: true });
    const fixture = file("vendor/stemfig/mechanics/fixtures/apparatus.stemfig.json");
    const clipboard = services.get("canvas.clipboard");
    const data = { getData: (type: string) => (type === "text/plain" ? fixture : ""), files: [], types: ["text/plain"] };
    expect(clipboard.canHandle(data)).toBe(true);
    const ids = await clipboard.paste(data);
    expect(ids).toHaveLength(3);
    expect(groups()).toBe(1);
    expect(insertion()?.ids).toEqual(ids);
    for (const id of ids) expect(world.getCanonical(id, `${manifest.id}.mechanics`)).toBeTruthy();
  });

  it("leaves plain text to other paste handlers", async () => {
    const { services } = await startHost({ clipboard: true });
    const data = { getData: () => "그냥 메모", files: [], types: ["text/plain"] };
    expect(services.get("canvas.clipboard").canHandle(data)).toBe(false);
  });

  it("keeps document data when the extension is disabled, and shows it read-only", async () => {
    const { commands, world, registry, manifest, commit } = await startHost();
    const id = await commands.execute(`${manifest.id}:add-mechanics`);
    const before = JSON.stringify(world.exportCanonicalSnapshot());
    const writes = commit.mock.calls.length;
    await registry.setEnabled(manifest.id, false);
    expect(JSON.stringify(world.exportCanonicalSnapshot())).toBe(before);
    expect(world.isEntityReadOnly(id)).toBe(true);
    expect(commit.mock.calls.length).toBe(writes);
    expect(commands.get(`${manifest.id}:add-mechanics`)).toBeUndefined();
  });
});
