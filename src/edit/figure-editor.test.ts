// @vitest-environment jsdom
/**
 * Inner-handle editing against the real alid kernel primitives (CanvasWorld,
 * ToolStateMachine, GizmoRegistry), set up like vector-path's node-editor test.
 * Skipped without a local alid checkout.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as kernel from "@alid/kernel";
import type { MutablePoint } from "../alid.ts";
import { createEngine } from "../engine.ts";
import { createFigureAspect } from "../figure-aspect.ts";
import { figureKinds, stemfigPlugins } from "../kinds.ts";
import { mmToWorld, WORLD_PX_PER_MM } from "../units.ts";
import { FigureEditor } from "./figure-editor.ts";

declare const __HAS_ALID__: boolean;
const suite = __HAS_ALID__ ? describe : describe.skip;

const engine = createEngine(stemfigPlugins);
const kinds = figureKinds("test.stem");
const GEOMETRY = "test.stem.geometry", MECHANICS = "test.stem.mechanics";
const cleanups: Array<() => void> = [];
afterEach(() => { for (const off of cleanups.splice(0).reverse()) off(); vi.restoreAllMocks(); document.body.replaceChildren(); });

const triangle = {
  schema: 1, view: { xmin: -0.5, xmax: 4.5, ymin: -0.5, ymax: 3.5 }, grid: null, axes: null, color: "", handles: null,
  spec: { objects: [
    { id: "A", def: ["point", 0, 0], label: "A" }, { id: "B", def: ["point", 4, 0], label: "B" }, { id: "C", def: ["point", 1.2, 3], label: "C" },
    { id: "c", def: ["segment", "A", "B"] }, { id: "a", def: ["segment", "B", "C"] }, { id: "b", def: ["segment", "C", "A"] },
    { id: "M", def: ["division", "A", "B", 1, 1, "internal"], label: "M" },
  ] },
};
/** Page mm of a view point for this figure: 12.5 mm per unit, 3.75 mm left inset. */
const pageOf = (x: number, y: number) => ({ x: 3.75 + (x + 0.5) * 12.5, y: (3.5 - y) * 12.5 });

function fixture(options: { zoom?: number; rotation?: number; at?: { x: number; y: number } } = {}) {
  const zoom = options.zoom ?? 1, at = options.at ?? { x: 100, y: 50 };
  const commit = vi.fn(), history = { begin: vi.fn(), commit: vi.fn(), abort: vi.fn() }, requestRender = vi.fn();
  const world = new kernel.CanvasWorld({ commitCanonicalBatch: commit, updateSpatialBounds() {} });
  world.registerCanonical({ id: "core.transform", defaults: { x: 0, y: 0, rotation: 0 } });
  world.registerCanonical({ id: "core.bounds", defaults: { width: 1, height: 1 } });
  let editor: FigureEditor | undefined;
  for (const kind of kinds) {
    const aspect = createFigureAspect(engine, kind, (id) => editor?.isEditingEntity(id) ?? false);
    world.registerCanonical({ id: aspect.id, defaults: aspect.defaults });
  }
  world.applyCanonicalTransaction("test:seed", [
    { id: "fig", aspect: "core.transform", patch: { x: at.x, y: at.y, rotation: options.rotation ?? 0 } },
    { id: "fig", aspect: "core.bounds", patch: { width: mmToWorld(70), height: mmToWorld(50) } },
    { id: "fig", aspect: GEOMETRY, patch: triangle },
  ]);
  commit.mockClear();
  const stateMachine = new kernel.ToolStateMachine({});
  stateMachine.mountChildState("root", { id: "select" }); stateMachine.mountChildState("root.select", { id: "core.select-suite:idle" });
  stateMachine.mountChildState("root", { id: "other" }); stateMachine.transition("root.select.core.select-suite:idle");
  const surface = document.createElement("div"), hud = document.createElement("div"); surface.tabIndex = 0; document.body.append(surface, hud);
  const captured = new Set<number>();
  surface.setPointerCapture = (id) => { captured.add(id); }; surface.hasPointerCapture = (id) => captured.has(id); surface.releasePointerCapture = (id) => { captured.delete(id); };
  const painters = new Set<() => void>(), gizmos = new kernel.GizmoRegistry();
  let selection = ["fig"];
  const host = {
    history, requestRender, getZoom: () => zoom, isSelectionEnabled: () => true,
    screenToWorld(x: number, y: number, out: MutablePoint) { out.x = x / zoom; out.y = y / zoom; },
    worldToScreen(x: number, y: number, out: MutablePoint) { out.x = x * zoom; out.y = y * zoom; },
  };
  editor = new FigureEditor({
    world, engine, kinds, namespace: "test.stem",
    tool: { surface: { element: surface, hud }, selection: { stateMachine, gizmos, getSelection: () => selection, select(id) { selection = id ? [id] : []; } }, host },
    frames: { subscribe(painter) { painters.add(painter); return () => { painters.delete(painter); }; } },
  });
  cleanups.push(() => stateMachine.dispose(), () => editor!.dispose());
  const pointer = (type: string, x: number, y: number, init: MouseEventInit = {}, id = 1) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...init });
    Object.defineProperty(event, "pointerId", { value: id }); surface.dispatchEvent(event); return event;
  };
  const paint = () => { for (const painter of painters) painter(); };
  /** Screen position of a page-mm point of this figure (unrotated fixture). */
  const screenOf = (mm: { x: number; y: number }) => ({ x: (at.x + mm.x * WORLD_PX_PER_MM) * zoom, y: (at.y + mm.y * WORLD_PX_PER_MM) * zoom });
  /** Select-suite dispatches gizmo presses first; emulate that for a handle press. */
  const press = (x: number, y: number, init: MouseEventInit = {}) => {
    const hit = { id: "", priority: 0, distanceScreenPx: 0 };
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...init });
    Object.defineProperty(event, "pointerId", { value: 1 });
    if (gizmos.hitTest(x, y, host.worldToScreen, hit) && gizmos.getHandle(hit.id)!.onPointerDown!(event as PointerEvent)) return true;
    surface.dispatchEvent(event); return false;
  };
  const drag = (from: { x: number; y: number }, to: { x: number; y: number }, init: MouseEventInit = {}) => {
    press(from.x, from.y, init); pointer("pointermove", to.x, to.y, init); paint(); pointer("pointerup", to.x, to.y, init);
  };
  type Spec = typeof triangle.spec;
  const spec = (preview = false): Spec => ((preview ? world.getPreviewView() : world).getCanonical("fig", GEOMETRY) as { spec: Spec }).spec;
  const point = (preview: boolean, id: string) => spec(preview).objects.find((o: { id: string }) => o.id === id)!.def as [string, number, number];
  return { world, editor, commit, history, stateMachine, gizmos, surface, hud, captured, pointer, paint, screenOf, press, drag, spec, point, setSelection: (ids: string[]) => { selection = ids; } };
}

suite("figure inner editing", () => {
  it("enters a local HSM state with point gizmos above resize handles, writing nothing", () => {
    const f = fixture();
    expect(f.editor.enter("fig")).toBe(true);
    f.paint();
    expect(f.stateMachine.stateId).toBe("root.select.test.stem:edit.idle");
    const handles = [...f.hud.querySelectorAll<SVGCircleElement>("[data-stem-handle]")].map((el) => el.dataset.stemHandle);
    expect(handles).toEqual(expect.arrayContaining(["A", "B", "C"]));
    const hit = { id: "", priority: 0, distanceScreenPx: 0 };
    const a = f.screenOf(pageOf(0, 0));
    expect(f.gizmos.hitTest(a.x, a.y, (x: number, y: number, out: MutablePoint) => { out.x = x; out.y = y; }, hit)).toBe(true);
    expect(hit.priority).toBeGreaterThan(10);
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.history.begin).not.toHaveBeenCalled();
  });

  it("previews a drag in scratch only, then commits one undo group with only the spec", () => {
    const f = fixture();
    f.editor.enter("fig");
    const from = f.screenOf(pageOf(0, 0)), to = f.screenOf(pageOf(1, 1));
    expect(f.press(from.x, from.y)).toBe(true);
    f.pointer("pointermove", to.x, to.y); f.paint();
    expect(f.stateMachine.stateId).toBe("root.select.test.stem:edit.dragging");
    expect(f.point(true, "A")[1]).toBeCloseTo(1, 1);   // preview moved
    expect(f.point(false, "A")).toEqual(["point", 0, 0]); // canonical untouched
    expect(f.commit).not.toHaveBeenCalled();
    f.pointer("pointerup", to.x, to.y);
    expect(f.history.begin).toHaveBeenCalledTimes(1);
    expect(f.history.commit).toHaveBeenCalledTimes(1);
    expect(f.commit).toHaveBeenCalledTimes(1);
    const [x, y] = f.point(false, "A").slice(1) as number[];
    expect(x).toBeCloseTo(1, 1); expect(y).toBeCloseTo(1, 1);
    // Derived point M follows through init; only the free point was written.
    expect(f.spec(false).objects.find((o: { id: string }) => o.id === "M")!.def).toEqual(["division", "A", "B", 1, 1, "internal"]);
    expect(f.world.getCanonical("fig", "core.transform")).toMatchObject({ x: 100, y: 50 });
    expect(f.stateMachine.stateId).toBe("root.select.test.stem:edit.idle");
  });

  it("snaps a dragged point onto another point, and Alt disables snapping", () => {
    const f = fixture({ zoom: 2 });
    f.editor.enter("fig");
    const c = pageOf(1.2, 3), near = { x: c.x + 0.4, y: c.y + 0.3 };
    f.drag(f.screenOf(pageOf(0, 0)), f.screenOf(near));
    expect(f.point(false, "A").slice(1)).toEqual([expect.closeTo(1.2, 5), expect.closeTo(3, 5)]);
    f.drag(f.screenOf(pageOf(4, 0)), f.screenOf(near), { altKey: true });
    const b = f.point(false, "B").slice(1) as number[];
    expect(Math.abs(b[0]! - 1.2) + Math.abs(b[1]! - 3)).toBeGreaterThan(0.01);
  });

  it("works on a rotated figure: handles follow the rotation", () => {
    const f = fixture({ rotation: Math.PI / 2, at: { x: 0, y: 0 } });
    f.editor.enter("fig");
    // Rotate the page point of A about the box centre to find it on screen.
    const w = mmToWorld(70), h = mmToWorld(50), p = pageOf(0, 0);
    const lx = p.x * WORLD_PX_PER_MM - w / 2, ly = p.y * WORLD_PX_PER_MM - h / 2;
    const a = { x: w / 2 - ly, y: h / 2 + lx };
    const step = 12.5 * WORLD_PX_PER_MM; // one view unit
    f.drag(a, { x: a.x, y: a.y + step }); // screen down = page +x after a quarter turn
    const [x, y] = f.point(false, "A").slice(1) as number[];
    expect(x).toBeCloseTo(1, 1); expect(y).toBeCloseTo(0, 1);
  });

  it("Escape during a drag discards the preview and keeps editing; a second Escape exits", () => {
    const f = fixture();
    f.editor.enter("fig");
    const from = f.screenOf(pageOf(0, 0)), to = f.screenOf(pageOf(2, 2));
    f.press(from.x, from.y); f.pointer("pointermove", to.x, to.y); f.paint();
    expect(f.point(true, "A")[1]).not.toBe(0);
    f.surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(f.point(true, "A")).toEqual(["point", 0, 0]);
    expect(f.captured.size).toBe(0);
    expect(f.editor.editingEntityId).toBe("fig");
    f.surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(f.editor.editingEntityId).toBeUndefined();
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.hud.querySelectorAll("[data-stem-handle]")).toHaveLength(0);
  });

  it("ignores keys while an IME is composing", () => {
    const f = fixture();
    f.editor.enter("fig");
    f.surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true, cancelable: true }));
    f.surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", keyCode: 229, bubbles: true, cancelable: true }));
    expect(f.editor.editingEntityId).toBe("fig");
  });

  it("a derived point shows like stemdraw, but dragging it changes nothing", () => {
    const f = fixture();
    f.editor.enter("fig");
    const m = f.screenOf(pageOf(2, 0)), to = f.screenOf(pageOf(2, 2));
    f.drag(m, to);
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.spec(false)).toEqual(triangle.spec);
  });

  it("a click without movement commits nothing", () => {
    const f = fixture();
    f.editor.enter("fig");
    const a = f.screenOf(pageOf(0, 0));
    f.press(a.x, a.y); f.pointer("pointerup", a.x + 1, a.y);
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.editor.activeHandle).toBe("A");
  });

  it("a press outside the figure exits editing; losing the selection exits on the next frame", () => {
    const f = fixture();
    f.editor.enter("fig");
    f.pointer("pointerdown", 5, 5);
    expect(f.editor.editingEntityId).toBeUndefined();
    f.editor.enter("fig"); f.setSelection([]); f.paint();
    expect(f.editor.editingEntityId).toBeUndefined();
  });

  it("an external change (undo, remote edit) during a drag rebases on the new canonical spec", () => {
    const f = fixture();
    f.editor.enter("fig");
    const from = f.screenOf(pageOf(0, 0)), to = f.screenOf(pageOf(2, 2));
    f.press(from.x, from.y); f.pointer("pointermove", to.x, to.y); f.paint();
    const moved = structuredClone(triangle.spec); moved.objects[2]!.def = ["point", 2, 2];
    f.world.applyCanonicalTransaction("test:remote", [{ id: "fig", aspect: GEOMETRY, patch: { spec: moved } }], "remote:peer");
    f.pointer("pointerup", to.x, to.y);
    expect(f.point(false, "A")).toEqual(["point", 0, 0]);
    expect(f.point(false, "C")).toEqual(["point", 2, 2]);
    expect(f.history.begin).not.toHaveBeenCalled();
  });

  it("refuses read-only and foreign entities", () => {
    const f = fixture();
    f.world.registerCanonical({ id: "other.thing", defaults: {} });
    f.world.applyCanonicalTransaction("test:other", [{ id: "x", aspect: "other.thing", patch: {} }]);
    expect(f.editor.enter("x")).toBe(false);
    const off = f.world.registerReadOnlyGuard((id: string) => id === "fig");
    expect(f.editor.enter("fig")).toBe(false);
    off();
  });

  it("drags a mechanics object: a block slides along its track", () => {
    const f = fixture();
    const props = {
      schema: 1, view: { xmin: 0, xmax: 20, ymin: -1, ymax: 9 }, grid: null, axes: null, color: "", handles: null,
      spec: { objects: [
        { id: "floor", type: "track", points: [[1, 1], [19, 1]], rounding: 0 },
        { id: "box", type: "block", width: 3, height: 2, pose: { mode: "track", track: "floor", t: 0.4, offset: 0 } },
      ] },
    };
    f.world.applyCanonicalTransaction("test:mech", [
      { id: "mech", aspect: "core.transform", patch: { x: 0, y: 0 } },
      { id: "mech", aspect: "core.bounds", patch: { width: mmToWorld(100), height: mmToWorld(50) } },
      { id: "mech", aspect: MECHANICS, patch: props },
    ]);
    f.setSelection(["mech"]);
    expect(f.editor.enter("mech")).toBe(true);
    // 100×50 mm, view 20×10 → 5 mm per unit. Block centre (t=0.4 → x=8.2, y=2).
    const at = (x: number, y: number) => ({ x: x * 5 * WORLD_PX_PER_MM, y: (9 - y) * 5 * WORLD_PX_PER_MM });
    const from = at(8.2, 2), to = at(12.2, 2);
    f.press(from.x, from.y); f.pointer("pointermove", to.x, to.y); f.paint(); f.pointer("pointerup", to.x, to.y);
    const box = (f.world.getCanonical("mech", MECHANICS) as { spec: typeof props.spec }).spec.objects[1] as unknown as { pose: { t: number } };
    expect(box.pose.t).toBeGreaterThan(0.55);
    expect(f.history.commit).toHaveBeenCalledTimes(1);
  });
});
