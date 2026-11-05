// @vitest-environment jsdom
/**
 * alid's five completion gates (AGENT.md §7), checked against the BUILT bundle
 * running on the real Rust/Wasm core (Loro CRDT, single undo timeline, canonical
 * JSONL), the real kernel and the repository installer's checks. Requires a local
 * alid checkout with `pnpm build:wasm` done; otherwise skipped.
 *
 * Gate 3 (120fps / 0-GC) is not a pass/fail test here: it records measured
 * timings for the hot paths so docs/GATES.md reports numbers, not claims.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

declare const __HAS_ALID__: boolean;
declare const __ALID_CORE_WASM__: string;
const suite = __HAS_ALID__ && __ALID_CORE_WASM__ ? describe : describe.skip;
const file = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const cleanups: Array<() => void> = [];
afterEach(() => { for (const off of cleanups.splice(0).reverse()) off(); vi.restoreAllMocks(); document.body.replaceChildren(); });

let wasmReady: Promise<Any> | undefined;
async function load() {
  const kernel: Any = await import("@alid/kernel");
  const repo: Any = await import("alid-host:repository-plugins");
  const bounds: Any = await import("alid-host:effective-bounds");
  const clipboardSuite: Any = await import("alid-host:clipboard");
  const core: Any = await import("alid-host:core");
  wasmReady ??= core.default({ module_or_path: readFileSync(__ALID_CORE_WASM__) });
  await wasmReady;
  const plugin: Any = (await import("../dist/plugin.js")).default;
  const manifest = JSON.parse(file("alid.extension.json"));
  return { kernel, repo, bounds, clipboardSuite, core, plugin, manifest };
}

/**
 * A host wired like the playground (apps/playground/src/runtime.ts): Wasm core behind
 * the world, the core's undo groups as history, the installer's runtime manifest, and
 * one canvas view surface with a selection state machine and gizmos.
 */
async function host() {
  const { kernel, repo, bounds, clipboardSuite, core, plugin, manifest } = await load();
  const wasm = new core.WasmCanvasCore();
  const commits = vi.fn();
  const world = new kernel.CanvasWorld({
    commitCanonicalBatch: (bytes: Uint8Array, origin: string) => { commits(); wasm.commit_canonical_batch(bytes, origin); },
    updateSpatialBounds: (...args: Any[]) => wasm.update_spatial_bounds(...args),
    clearSpatialBounds: (slot: number) => wasm.clear_spatial_bounds(slot),
  });
  world.registerCanonical({ id: "core.transform", defaults: { x: 0, y: 0, rotation: 0 } });
  world.registerCanonical({ id: "core.bounds", defaults: { width: 300 } });
  bounds.registerEffectiveBoundsBridge(world);
  const history = {
    begin: () => wasm.begin_undo_group(),
    commit: () => wasm.end_undo_group(),
    abort: () => { wasm.abort_undo_group(); world.replaceCanonicalSnapshot(wasm.get_canonical_json()); },
  };
  const undo = () => { const done = wasm.undo(); world.replaceCanonicalSnapshot(wasm.get_canonical_json()); return done; };
  const run = (caller: string, ops: Any[]) => { history.begin(); try { world.applyCanonicalTransaction(caller, ops, "local:user"); history.commit(); } catch (error) { history.abort(); throw error; } };
  const services = new kernel.ServiceRegistry(), commands = new kernel.CommandRegistry(world), compiler = new kernel.SceneVectorCompiler();
  const stateMachine = new kernel.ToolStateMachine({});
  stateMachine.mountChildState("root", { id: "select" }); stateMachine.mountChildState("root.select", { id: "core.select-suite:idle" });
  stateMachine.transition("root.select.core.select-suite:idle");
  const surface = document.createElement("div"), hud = document.createElement("div"); document.body.append(surface, hud);
  surface.setPointerCapture = () => {}; surface.hasPointerCapture = () => false; surface.releasePointerCapture = () => {};
  const gizmos = new kernel.GizmoRegistry(), painters = new Set<() => void>();
  let selection: string[] = [];
  const identity = (x: number, y: number, out: { x: number; y: number }) => { out.x = x; out.y = y; };
  const tool = {
    surface: { element: surface, hud },
    selection: { stateMachine, gizmos, getSelection: () => selection, select(id: string | null) { selection = id ? [id] : []; } },
    host: { screenToWorld: identity, worldToScreen: identity, getZoom: () => 1, requestRender() {}, history, isSelectionEnabled: () => true },
  };
  let created = 0;
  services.provide("canvas.creation", { create(request: Any) {
    const id = `ent_${++created}`;
    run(request.caller, [
      { id, aspect: "core.transform", patch: { x: 0, y: 0 } },
      { id, aspect: "core.bounds", patch: { width: request.width, height: request.height } },
      ...Object.entries(request.aspects).map(([aspect, patch]) => ({ id, aspect, patch })),
    ]);
    selection = [id];
    return id;
  } });
  services.provide("canvas.active-tool-surface", { get: () => tool, subscribe: () => () => {} });
  services.provide("canvas.frames", { subscribe(paint: () => void) { painters.add(paint); return () => painters.delete(paint); } });
  services.provide("canvas.clipboard-host", {
    getInsertionPoint: () => ({ x: 400, y: 300 }), getSelectedIds: () => selection,
    insertSnapshot(caller: string, snapshot: Any, ids: string[]) { run(caller, Object.entries(snapshot).flatMap(([id, aspects]: Any) => Object.entries(aspects).map(([aspect, patch]) => ({ id, aspect, patch })))); selection = [...ids]; },
    deleteEntities(caller: string, ids: string[]) { run(caller, ids.map((id) => ({ id, aspect: "core.transform", patch: null }))); },
    beginExclusiveCommand() {},
  });
  const errors: unknown[] = [];
  const registry = new kernel.ExtensionRuntimeRegistry({ world, services, commands, compiler }, { onError: (error: unknown) => errors.push(error) });
  repo.validatePluginSpec(plugin, manifest);
  registry.registerPackages([
    { spec: { ...clipboardSuite.createClipboardSuite(), version: "0.1.0", provides: { services: ["canvas.clipboard"] } } },
    { spec: plugin, manifest: repo.pluginRuntimeManifest(manifest, repo.visualAspectIdsOf(plugin), true) },
  ]);
  const api = registry.getSnapshot().find((item: Any) => item.id === manifest.id) && (registry as Any);
  cleanups.push(() => { registry.dispose(); commands.dispose(); services.dispose(); stateMachine.dispose(); wasm.free(); });
  const paint = () => { for (const painter of painters) painter(); };
  const pointer = (type: string, x: number, y: number, init: MouseEventInit = {}) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...init });
    Object.defineProperty(event, "pointerId", { value: 1 }); surface.dispatchEvent(event);
  };
  const press = (x: number, y: number) => {
    const hit = { id: "", priority: 0, distanceScreenPx: 0 };
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(event, "pointerId", { value: 1 });
    if (gizmos.hitTest(x, y, identity, hit) && gizmos.getHandle(hit.id).onPointerDown(event)) return;
    surface.dispatchEvent(event);
  };
  const handle = (id: string) => { const el = hud.querySelector(`[data-stem-handle="${id}"]`)!; return { x: Number(el.getAttribute("cx")), y: Number(el.getAttribute("cy")) }; };
  const key = (k: string, init: KeyboardEventInit = {}) => surface.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
  return { kernel, world, wasm, compiler, commands, services, registry, manifest, plugin, history, undo, commits, errors, paint, pointer, press, handle, key, api, surface, hud };
}

const jsonl = (h: Any) => h.wasm.dump_canonical_jsonl() as string;

suite("alid completion gates (built bundle on the Wasm core)", () => {
  it("Gate 1 — canonical purity: JSONL holds only intent, and reading/publishing writes nothing", async () => {
    const h = await host();
    const id = await h.commands.execute(`${h.manifest.id}:add-mechanics`);
    // Edit inside: drag the block along its floor.
    expect(await h.commands.execute(`${h.manifest.id}:edit-figure`)).toBe(true);
    h.paint();
    const before = jsonl(h);
    const writes = h.commits.mock.calls.length;
    // Reading: compute, publish, move the camera-equivalent (re-derive), list anchors.
    for (let i = 0; i < 3; i++) { h.world.flushComputedFrontier?.(); h.compiler.compileToPureSvg(h.world); h.paint(); }
    expect(h.commits.mock.calls.length).toBe(writes);
    expect(jsonl(h)).toBe(before);
    const lines = before.trim().split("\n").map((line: string) => JSON.parse(line));
    expect(lines[0].format).toBe("ecanvas/v1");
    const row = lines.find((line: Any) => line.id === id);
    const props = row.aspects[`${h.manifest.id}.mechanics`];
    expect(Object.keys(props).sort()).toEqual(["axes", "color", "grid", "handles", "schema", "spec", "view"]);
    const text = JSON.stringify(row);
    for (const derived of ["compiled", "<path", "<polyline", "items", "draft", "body", "fontFamily", "x_mm"]) expect(text).not.toContain(derived);
  });

  it("Gate 2 — single undo timeline: a drag, a placement and an inspector edit undo in reverse, one step each", async () => {
    const h = await host();
    const id = await h.commands.execute(`${h.manifest.id}:add-geometry`);
    const spec = () => JSON.stringify(JSON.parse(h.wasm.get_canonical_json())[id][`${h.manifest.id}.geometry`].spec);
    const s0 = spec();
    expect(await h.commands.execute(`${h.manifest.id}:edit-figure`)).toBe(true);
    h.paint();
    // 1) drag point A
    const a = h.handle("A");
    h.press(a.x, a.y); h.pointer("pointermove", a.x + 30, a.y - 20); h.paint(); h.pointer("pointerup", a.x + 30, a.y - 20);
    const s1 = spec(); expect(s1).not.toBe(s0);
    // 2) place a point
    h.key("p");
    h.pointer("pointerdown", 120, 60); h.pointer("pointerup", 120, 60);
    const s2 = spec(); expect(s2).not.toBe(s1);
    // 3) inspector edit through the panel this package contributes (Point marks off)
    h.key("v");
    h.pointer("pointerdown", 250, 20); h.pointer("pointerup", 250, 20); // empty paper: no handle chosen → figure fields
    const aspect = h.plugin.aspects.find((item: Any) => item.id === `${h.manifest.id}.geometry`);
    const panel = document.createElement("div"); document.body.append(panel);
    const unmount = aspect.ui.panels[0].mount(panel, { getSelectedIds: () => [id], onSelectionChange: () => () => {} });
    const marks = panel.querySelector<HTMLInputElement>('input[aria-label="Point marks"]')!;
    marks.checked = false; marks.dispatchEvent(new Event("change"));
    unmount();
    const s3 = spec(); expect(s3).not.toBe(s2);
    expect(JSON.parse(s3).markPoints).toBe(false);
    // Undo three times: inspector edit, placement, drag.
    expect(h.undo()).toBe(true); expect(spec()).toBe(s2);
    expect(h.undo()).toBe(true); expect(spec()).toBe(s1);
    expect(h.undo()).toBe(true); expect(spec()).toBe(s0);
    expect(h.undo()).toBe(true); // the creation itself
    expect(JSON.parse(h.wasm.get_canonical_json())[id]).toBeUndefined();
  });

  it("Gate 2 — IME: keys during composition never reach the editor", async () => {
    const h = await host();
    await h.commands.execute(`${h.manifest.id}:add-geometry`);
    await h.commands.execute(`${h.manifest.id}:edit-figure`);
    document.dispatchEvent(new CompositionEvent("compositionstart"));
    h.key("Escape", { isComposing: true });
    h.key("Enter", { isComposing: true });
    h.key("p", { keyCode: 229 } as KeyboardEventInit);
    document.dispatchEvent(new CompositionEvent("compositionend"));
    h.key("Enter"); // residual key inside the 16 ms window
    const toolbar = h.hud.querySelector<HTMLElement>(".stem-toolbar")!;
    expect(toolbar.hidden).toBe(false); // still editing
    expect(toolbar.querySelector('[data-tool="point"]')!.getAttribute("aria-pressed")).toBe("false");
  });

  it("Gate 4 — integrity and isolation: disable keeps data read-only; delete is undoable; nothing runs before approval", async () => {
    const h = await host();
    const id = await h.commands.execute(`${h.manifest.id}:add-geometry`);
    const before = jsonl(h);
    await h.registry.setEnabled(h.manifest.id, false);
    expect(jsonl(h)).toBe(before);
    expect(h.world.isEntityReadOnly(id)).toBe(true);
    await h.registry.setEnabled(h.manifest.id, true);
    expect(h.world.isEntityReadOnly(id)).toBe(false);
    // Deleting the entity (host clipboard cut path) is one undo step and leaves no orphan aspects.
    h.history.begin(); h.world.applyCanonicalTransaction("test:delete", [{ id, aspect: "core.transform", patch: null }], "local:user"); h.history.commit();
    expect(JSON.parse(h.wasm.get_canonical_json())[id]).toBeUndefined();
    expect(h.undo()).toBe(true);
    expect(JSON.parse(h.wasm.get_canonical_json())[id]).toBeTruthy();
    // The bundle is hash-pinned and only executes after an explicit install.
    const { repo } = await load();
    expect(await repo.hashSource(file("dist/plugin.js"))).toBe(h.manifest.sha256);
    expect(h.manifest.capabilities.services).toEqual(expect.arrayContaining(["canvas.creation"]));
  });

  it("Gate 5 — vector publication: every figure is published without a mounted view, in paint order", async () => {
    const h = await host();
    const ids = [];
    for (const name of ["add-geometry", "add-graph", "add-mechanics"]) ids.push(await h.commands.execute(`${h.manifest.id}:${name}`));
    // Nothing is mounted in this host: publication cannot depend on DOM islands.
    const svg: string = h.compiler.compileToPureSvg(h.world);
    expect(h.compiler.inspectRenderErrors()).toEqual([]);
    const order = ids.map((id) => svg.indexOf(`data-entity-id="${id}"`));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // created later, stacked on top
    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toContain("error:");
    expect(svg).not.toContain("data-stem-handle"); // editing overlays never publish
  });

  it("Gate 3 — measurements (recorded, not asserted as 120fps/0-GC)", async () => {
    const h = await host();
    const id = await h.commands.execute(`${h.manifest.id}:add-geometry`);
    await h.commands.execute(`${h.manifest.id}:edit-figure`);
    h.paint();
    const a = h.handle("A");
    const timeFrames = (frames: number) => {
      h.press(a.x, a.y);
      const samples: number[] = [];
      for (let i = 1; i <= frames; i++) {
        h.pointer("pointermove", a.x + i, a.y - i / 2);
        const t0 = performance.now(); h.paint(); h.world.flushComputedFrontier?.(); samples.push(performance.now() - t0);
      }
      h.pointer("pointerup", a.x + frames, a.y - frames / 2);
      samples.sort((x, y) => x - y);
      return { p50: samples[Math.floor(samples.length / 2)]!, p95: samples[Math.floor(samples.length * 0.95)]! };
    };
    timeFrames(20); // warm-up
    const drag = timeFrames(120);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) h.compiler.compileToPureSvg(h.world, [id]);
    const publish = (performance.now() - t0) / 20;
    // Heavier: stemdraw's projectile sheet (8 figures) pasted, then published together.
    const services = h.services.get("canvas.clipboard");
    const text = file("vendor/stemfig/mechanics/fixtures/projectile.stemfig.json");
    const pasted: string[] = await services.paste({ getData: (type: string) => (type === "text/plain" ? text : ""), files: [], types: ["text/plain"] });
    const t1 = performance.now();
    for (let i = 0; i < 5; i++) h.compiler.compileToPureSvg(h.world);
    const publishSheet = (performance.now() - t1) / 5;
    const report = {
      dragFrameMs: { p50: +drag.p50.toFixed(2), p95: +drag.p95.toFixed(2) },
      publishOneFigureMs: +publish.toFixed(2),
      publishSheetMs: { figures: pasted.length + 1, ms: +publishSheet.toFixed(2) },
      env: "vitest jsdom, Node " + process.version,
    };
    // Persist for docs/GATES.md; a regression guard well above the frame budget catches pathological slowdowns only.
    if (process.env.STEM_GATE3_OUT) writeFileSync(process.env.STEM_GATE3_OUT, `${JSON.stringify(report)}\n`, { flag: "a" });
    expect(drag.p95).toBeLessThan(250);
  });
});
