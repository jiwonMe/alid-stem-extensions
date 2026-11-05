// @vitest-environment jsdom
/**
 * P4: mechanics editing through the real editor and kernel primitives, on stemdraw's
 * own fixtures: attachment along a track, endpoint connect/detach (Alt), rope routing
 * over a pulley, projectile placement and following references after a drag.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as kernel from "@alid/kernel";
import { fitView, type View } from "@stemfig/display";
import type { MutablePoint } from "../alid.ts";
import { figureContent, figureProps, type FigureProps } from "../content.ts";
import { createEngine } from "../engine.ts";
import { figureKinds, stemfigPlugins } from "../kinds.ts";
import { fixtureFigures } from "../fixtures.ts";
import { mmToWorld, WORLD_PX_PER_MM } from "../units.ts";
import { FigureEditor } from "./figure-editor.ts";

declare const __HAS_ALID__: boolean;
const suite = __HAS_ALID__ ? describe : describe.skip;

const engine = createEngine(stemfigPlugins);
const kinds = figureKinds("test.stem");
const MECHANICS = "test.stem.mechanics";
const cleanups: Array<() => void> = [];
afterEach(() => { for (const off of cleanups.splice(0).reverse()) off(); vi.restoreAllMocks(); document.body.replaceChildren(); });

type Obj = { id: string; type: string; [key: string]: unknown };

function figure(name: string) {
  const found = fixtureFigures().find((item) => item.name === name);
  if (!found) throw new Error(`fixture ${name}`);
  return found.figure;
}

/** One mechanics figure as an entity at the world origin, an editor on it, and input helpers in view units. */
function scene(props: FigureProps, size: { w: number; h: number }) {
  const commit = vi.fn(), history = { begin: vi.fn(), commit: vi.fn(), abort: vi.fn() };
  const world = new kernel.CanvasWorld({ commitCanonicalBatch: commit, updateSpatialBounds() {} });
  world.registerCanonical({ id: "core.transform", defaults: { x: 0, y: 0, rotation: 0 } });
  world.registerCanonical({ id: "core.bounds", defaults: { width: 1, height: 1 } });
  for (const kind of kinds) world.registerCanonical({ id: kind.aspectId, defaults: kind.defaults });
  world.applyCanonicalTransaction("test:seed", [
    { id: "m", aspect: "core.transform", patch: { x: 0, y: 0 } },
    { id: "m", aspect: "core.bounds", patch: { width: mmToWorld(size.w), height: mmToWorld(size.h) } },
    { id: "m", aspect: MECHANICS, patch: props },
  ]);
  commit.mockClear();
  const stateMachine = new kernel.ToolStateMachine({});
  stateMachine.mountChildState("root", { id: "select" }); stateMachine.mountChildState("root.select", { id: "core.select-suite:idle" });
  stateMachine.transition("root.select.core.select-suite:idle");
  const surface = document.createElement("div"), hud = document.createElement("div"); document.body.append(surface, hud);
  surface.setPointerCapture = () => {}; surface.hasPointerCapture = () => false; surface.releasePointerCapture = () => {};
  const painters = new Set<() => void>(), gizmos = new kernel.GizmoRegistry();
  const identity = (x: number, y: number, out: MutablePoint) => { out.x = x; out.y = y; };
  const host = { history, requestRender() {}, getZoom: () => 1, isSelectionEnabled: () => true, screenToWorld: identity, worldToScreen: identity };
  const editor = new FigureEditor({
    world, engine, kinds, namespace: "test.stem",
    tool: { surface: { element: surface, hud }, selection: { stateMachine, gizmos, getSelection: () => ["m"], select() {} }, host },
    frames: { subscribe(paint) { painters.add(paint); return () => { painters.delete(paint); }; } },
  });
  cleanups.push(() => stateMachine.dispose(), () => editor.dispose());
  expect(editor.enter("m")).toBe(true);
  const fit = fitView(props.view as View, { x: 0, y: 0, w: size.w, h: size.h });
  /** Screen (= world) px of a scene point. */
  const at = (x: number, y: number) => { const [lx, ly] = fit.toLocal(x, y); return { x: lx * WORLD_PX_PER_MM, y: ly * WORLD_PX_PER_MM }; };
  const pointer = (type: string, p: { x: number; y: number }, init: MouseEventInit = {}) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, button: 0, ...init });
    Object.defineProperty(event, "pointerId", { value: 1 }); surface.dispatchEvent(event);
  };
  /** Presses like select-suite: our gizmos first, then the surface. */
  const press = (p: { x: number; y: number }, init: MouseEventInit = {}) => {
    const hit = { id: "", priority: 0, distanceScreenPx: 0 };
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, button: 0, ...init });
    Object.defineProperty(event, "pointerId", { value: 1 });
    if (gizmos.hitTest(p.x, p.y, identity, hit) && gizmos.getHandle(hit.id)!.onPointerDown!(event as PointerEvent)) return;
    surface.dispatchEvent(event);
  };
  const paint = () => { for (const painter of painters) painter(); };
  const drag = (from: { x: number; y: number }, to: { x: number; y: number }, init: MouseEventInit = {}) => {
    press(from, init); pointer("pointermove", { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, init); paint();
    pointer("pointermove", to, init); paint(); pointer("pointerup", to, init);
  };
  const click = (p: { x: number; y: number }, init: MouseEventInit = {}) => { press(p, init); pointer("pointerup", p, init); };
  const objects = (): Obj[] => (world.getCanonical("m", MECHANICS) as { spec: { objects: Obj[] } }).spec.objects;
  const obj = (id: string) => objects().find((o) => o.id === id)!;
  const anchorOf = (id: string) => { const svg = hud.querySelector(`[data-stem-handle="${id}"]`); return svg ? { x: Number(svg.getAttribute("cx")), y: Number(svg.getAttribute("cy")) } : undefined; };
  const svgOf = () => engine.renderFigureSvg("physics.mechanics", figureContent(world.getCanonical("m", MECHANICS) as FigureProps), { width_mm: size.w, height_mm: size.h });
  return { world, editor, history, commit, hud, at, drag, click, press, pointer, paint, objects, obj, anchorOf, svgOf };
}

function fromFixture(name: string) {
  const f = figure(name);
  return scene(figureProps({ view: f.view, spec: f.spec, ...(f.grid ? { grid: f.grid } : {}), ...(f.axes ? { axes: f.axes } : {}) }), { w: f.frame.w, h: f.frame.h });
}

suite("mechanics editing (P4)", () => {
  it("a block on a track slides along it, and the force anchored to it follows", () => {
    const s = fromFixture("apparatus.stemfig.json#mechanics_support");
    expect(s.obj("mass")).toMatchObject({ pose: { mode: "track", track: "beam", t: 0.5 } });
    s.paint();
    const before = s.svgOf();
    s.drag(s.at(4.35, 5.15), s.at(6.35, 5.15)); // inside the block, clear of its label
    const pose = s.obj("mass").pose as { mode: string; t: number };
    expect(pose.mode).toBe("track");
    expect(pose.t).toBeGreaterThan(0.6);
    expect(s.history.commit).toHaveBeenCalledTimes(1);
    expect(s.svgOf()).not.toBe(before);
  });

  it("an endpoint dropped on a block attaches to it and then follows the block; Alt detaches", () => {
    const s = fromFixture("apparatus.stemfig.json#mechanics_spring");
    // Spring end b is anchored to mass:top. Detach it with Alt to a free point.
    s.paint();
    const end = s.anchorOf("spring:b")!;
    s.drag(end, s.at(8, 4), { altKey: true });
    expect(s.obj("spring").b).toMatchObject({ mode: "free" });
    // Drag it back near the mass top (5, 3.4): it re-attaches.
    s.paint();
    s.drag(s.anchorOf("spring:b")!, s.at(5.05, 3.45));
    expect(s.obj("spring").b).toMatchObject({ mode: "anchor", object: "mass", anchor: "top" });
    // Moving the mass carries the spring end and the weight force with it.
    s.paint();
    s.drag(s.at(4.25, 2.35), s.at(5.25, 2.35)); // inside the block, clear of its label
    expect((s.obj("mass").pose as { point: number[] }).point[0]).toBeCloseTo(6, 1);
    expect(s.obj("spring").b).toMatchObject({ mode: "anchor", object: "mass" });
    expect(s.obj("weight").from).toMatchObject({ mode: "anchor", object: "mass" });
    expect(s.history.commit).toHaveBeenCalledTimes(3);
  });

  it("shows where a dragged endpoint will attach, and nothing with Alt", () => {
    const s = fromFixture("apparatus.stemfig.json#mechanics_spring");
    s.paint();
    const end = s.anchorOf("spring:b")!, target = s.at(5.05, 3.45);
    s.press(end); s.pointer("pointermove", s.at(8, 5)); s.paint();
    expect(s.hud.querySelector("[data-stem-snap]")).toBeNull(); // nothing to attach to out there
    s.pointer("pointermove", target); s.paint();
    expect(s.hud.querySelector("[data-stem-snap]")).toBeTruthy();
    s.pointer("pointermove", target, { altKey: true }); s.paint();
    expect(s.hud.querySelector("[data-stem-snap]")).toBeNull();
    s.pointer("pointerup", target, { altKey: true });
  });

  it("a rope placed from a block over a pulley to another block routes around the pulley", () => {
    const f = figure("apparatus.stemfig.json#mechanics_pulley");
    const spec = f.spec as { objects: Obj[] };
    const s = scene(figureProps({ view: f.view, spec: { objects: spec.objects.filter((o) => o.id !== "rope") } }), { w: f.frame.w, h: f.frame.h });
    expect(s.editor.setTool("rope")).toBe(true);
    s.click(s.at(3.8, 5.7));  // A's right side
    s.click(s.at(7, 5.7));    // pulley rim (top)
    expect(s.commit).not.toHaveBeenCalled();
    s.click(s.at(7.6, 2.5));  // B's top
    const rope = s.objects().find((o) => o.type === "rope")!;
    expect(rope).toMatchObject({ pulley: "pulley", a: { mode: "anchor", object: "A" }, b: { mode: "anchor", object: "B" } });
    expect(s.history.commit).toHaveBeenCalledTimes(1);
    expect(s.svgOf()).not.toContain("error:");
  });

  it("places a projectile with three clicks and draws it", () => {
    const s = scene(figureProps({ view: { xmin: 0, xmax: 10, ymin: 0, ymax: 8 }, spec: { objects: [] } }), { w: 78, h: 64 });
    expect(s.editor.setTool("trajectory")).toBe(true);
    s.click(s.at(1, 4), { altKey: true });
    s.click(s.at(3, 5), { altKey: true });
    s.click(s.at(8, 1), { altKey: true });
    const trajectory = s.objects().find((o) => o.type === "trajectory");
    expect(trajectory).toBeTruthy();
    expect(s.history.commit).toHaveBeenCalledTimes(1);
    expect(s.svgOf()).toContain("<polyline");
  });

  it("dragging a track vertex re-tilts the block attached to it", () => {
    const s = fromFixture("track.stemfig.json#mechanics_track");
    const before = s.obj("C").pose;
    s.paint();
    s.drag(s.anchorOf("track:point:5")!, s.at(21, 5));
    expect(s.obj("C").pose).toEqual(before); // still the same t on the same track
    const track = s.obj("track").points as number[][];
    expect(track[5]![1]).toBeCloseTo(5, 0);
    expect(s.history.commit).toHaveBeenCalledTimes(1);
  });

  it("stemdraw's mechanics fixtures reproduce exactly when pasted and stay editable", () => {
    for (const { name, figure: f } of fixtureFigures().filter((item) => item.figure.kind === "physics.mechanics")) {
      const content = { view: f.view, spec: f.spec, ...(f.grid ? { grid: f.grid } : {}), ...(f.axes ? { axes: f.axes } : {}) };
      const props = figureProps(content);
      expect(JSON.stringify(props.spec), name).toBe(JSON.stringify(f.spec));
      const edit = engine.editFigure("physics.mechanics", content, { width_mm: f.frame.w, height_mm: f.frame.h });
      expect(edit, name).toBeTruthy();
      expect(edit!.anchors().length, name).toBeGreaterThan(0);
      expect(edit!.tools().length, name).toBeGreaterThan(10);
    }
  });
});

