/**
 * Editing the inside of one figure: drag stemfig handles (points, path points,
 * label positions, object bodies) with live preview and one undo step per drag.
 *
 * Kind-agnostic: hit, apply, anchors and snap come from the stemfig plugin through
 * the engine. Local state only: the edited entity, the gesture and the draft spec
 * live here and in a ScratchOverlay; canonical data is written once, on release
 * (docs/PLAN.md §4 선택과 편집, AGENT.md Playbook B).
 */
import type { DisplayItem } from "@stemfig/display";
import type { FieldPatch, FigureTool, HandleAnchor, HandlePatch, InspectField, ToolGuidance } from "@stemfig/host";
import type {
  CanvasFrameScheduler, CanvasToolSurface, CanvasWorld, EntityId, GizmoHit, MutablePoint, SymbolId, ToolModifiers,
} from "../alid.ts";
import { figureContent, figureProps, type FigureProps } from "../content.ts";
import type { StemEngine } from "../engine.ts";
import { readGeometry, type FigureGeometry, type FigureKind } from "../figure-aspect.ts";
import { worldToMm, WORLD_PX_PER_MM } from "../units.ts";
import { insideBox, pageMmToWorld, worldToPageMm } from "./figure-frame.ts";
import { itemsToHudSvg } from "./hud-items.ts";

const NS = "http://www.w3.org/2000/svg";
const IDLE = "root.select.core.select-suite:idle";
/** Above select-suite's resize (10) and rotate (5) handles. */
const POINT_PRIORITY = 30;
const POINT_HIT_PX = 7;
/** AGENT.md: DRAG_SLOP_SCREEN_PX. */
const SLOP = 3.5;
const ACCENT = "var(--alid-accent,#6d5bd0)";

const blocked = (target: EventTarget | null) => target instanceof Element && !!target.closest("[data-canvas-ui],button,input,textarea,select,[contenteditable]:not([contenteditable=\"false\"])");
const inputOwned = (event: Event) => blocked(event.target) || event.composedPath().some(blocked);

export interface FigureEditorOptions {
  world: CanvasWorld;
  engine: StemEngine;
  kinds: readonly FigureKind[];
  tool: CanvasToolSurface;
  frames?: CanvasFrameScheduler;
  /** Host IME arbiter supplies keydown through canvas.tool-input. */
  externalKeyboard?: boolean;
  /** The extension's namespace; HSM state and commit symbols are derived from it. */
  namespace: string;
  onEditingChanged?(id: EntityId | undefined): void;
}

/** What a toolbar or inspector needs to show while a figure is being edited. */
export interface EditorSnapshot {
  entity: EntityId;
  kind: string;
  tools: readonly FigureTool[];
  tool?: string;
  guidance?: ToolGuidance;
  handle?: string;
  fields: readonly InspectField[];
  error?: string;
}

interface Gesture {
  pointer: number;
  handle: string;
  /** Pointer at press, world px. */
  startX: number; startY: number;
  /** The handle's point anchor at press, page mm (absent for lines/labels: plain deltas). */
  origin?: MutablePoint;
  clientX: number; clientY: number;
  lastX: number; lastY: number;
  moved: boolean;
}

let instance = 0;

export class FigureEditor {
  readonly state: string;
  private readonly owner: string;
  private readonly scratch;
  private readonly abort = new AbortController();
  private readonly off: Array<() => void> = [];
  private readonly gizmoOff: Array<() => void> = [];
  private readonly modifiers: ToolModifiers = { shift: false, alt: false, ctrl: false, meta: false };
  private readonly hit: GizmoHit = { id: "", priority: 0, distanceScreenPx: 0 };
  private readonly world = { x: 0, y: 0 };
  private readonly page = { x: 0, y: 0 };
  private readonly screen = { x: 0, y: 0 };
  private readonly svg: SVGSVGElement;
  private readonly marks: SVGGElement;
  private entity?: EntityId;
  private kind?: FigureKind;
  private box?: FigureGeometry;
  private original?: Readonly<FigureProps>;
  /** The spec being edited: canonical at rest, the preview during a drag. */
  private draft?: FigureProps;
  private anchors: HandleAnchor[] = [];
  private active?: string;
  /** The placement tool, if one is armed. Its unfinished construction lives in `draft` and scratch only. */
  private tool?: string;
  private hover?: { x: number; y: number };
  private ghost: readonly DisplayItem[] = [];
  /** Where the pointer will attach (an object's connection point or a path), page mm; shown as a ring. */
  private snapMark?: { x: number; y: number; kind: "point" | "path" | "feature" };
  private fieldError?: string;
  private readonly listeners = new Set<() => void>();
  private gesture?: Gesture;
  private dirty = false;
  private mutating = false;
  private disposed = false;
  private composing = false;
  private compositionEnded = -Infinity;

  constructor(private readonly options: FigureEditorOptions) {
    const n = ++instance;
    this.owner = `${options.namespace}:figure-editor:${n}`;
    this.state = `root.select.${options.namespace}:edit`;
    this.scratch = options.world.createScratchOverlay(this.owner);
    const { surface } = options.tool, doc = surface.element.ownerDocument;
    this.svg = doc.createElementNS(NS, "svg") as SVGSVGElement;
    this.svg.dataset.role = "stem-figure-editor";
    this.svg.setAttribute("aria-hidden", "true");
    this.svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;display:none;";
    this.marks = doc.createElementNS(NS, "g") as SVGGElement;
    this.svg.append(this.marks);
    surface.hud.append(this.svg);
    const machine = options.tool.selection.stateMachine;
    this.off.push(machine.mountChildState("root.select", {
      id: `${options.namespace}:edit`,
      onExit: () => this.release(),
      onModifiersChanged: (_context, modifiers) => this.setModifiers(modifiers),
    }));
    for (const child of ["idle", "dragging"]) this.off.push(machine.mountChildState(this.state, { id: child }));
    this.off.push(options.frames?.subscribe(this.render) ?? (() => {}), options.world.subscribe(this.onWorldChanged));
    const signal = this.abort.signal, element = surface.element;
    element.addEventListener("pointerdown", this.down, { capture: true, signal });
    element.addEventListener("pointermove", this.move, { capture: true, signal });
    element.addEventListener("pointerup", this.up, { capture: true, signal });
    element.addEventListener("pointercancel", this.cancelPointer, { capture: true, signal });
    element.addEventListener("lostpointercapture", this.cancelPointer, { capture: true, signal });
    element.addEventListener("dblclick", this.doubleClick, { capture: true, signal });
    if (!options.externalKeyboard) doc.addEventListener("keydown", this.keyDown, { signal });
    doc.addEventListener("keyup", this.keyModifiers, { signal });
    doc.addEventListener("compositionstart", () => { this.composing = true; this.cancelGesture(); }, { signal });
    doc.addEventListener("compositionend", () => { this.composing = false; this.compositionEnded = performance.now(); }, { signal });
    doc.defaultView?.addEventListener("blur", this.exit, { signal });
  }

  get editingEntityId(): EntityId | undefined { return this.entity; }
  get activeHandle(): string | undefined { return this.active; }
  isEditingEntity = (id: EntityId): boolean => this.entity === id;

  /** Figure kind of an entity, if it is one this extension edits. */
  kindOf(id: EntityId): FigureKind | undefined {
    return this.options.kinds.find((kind) => this.options.world.getCanonical(id, kind.aspectId));
  }

  enter(id: EntityId): boolean {
    const { world, tool } = this.options;
    if (this.disposed || !world.isAlive(id) || world.isEntityReadOnly(id)) return false;
    const kind = this.kindOf(id);
    if (!kind) return false;
    if (this.entity === id) return true;
    this.exit();
    this.entity = id; this.kind = kind; this.active = undefined; this.tool = undefined; this.fieldError = undefined;
    this.readCanonical();
    tool.selection.select(id);
    tool.selection.stateMachine.transition(`${this.state}.idle`);
    tool.surface.element.focus({ preventScroll: true });
    this.options.onEditingChanged?.(id);
    tool.host.requestRender();
    return true;
  }

  readonly exit = (): void => {
    if (this.entity) this.options.tool.selection.stateMachine.transition(IDLE);
  };

  /** Escape cancels the drag, then the construction in progress, then the tool, then editing. */
  cancel(): boolean {
    if (!this.entity) return false;
    if (this.gesture) this.cancelGesture();
    else if (this.hasDraft()) this.discardDraft();
    else if (this.tool) this.setTool(undefined);
    else this.exit();
    return true;
  }

  // ── public editing API (toolbar, inspector, commands) ──────────────────

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private changed(): void { for (const listener of this.listeners) listener(); }

  snapshot(): EditorSnapshot | undefined {
    if (!this.entity || !this.kind || !this.draft) return undefined;
    const session = this.session(this.draft);
    return {
      entity: this.entity, kind: this.kind.kind,
      tools: session?.tools() ?? [],
      ...(this.tool ? { tool: this.tool, guidance: session?.guidance(this.tool) } : {}),
      ...(this.active ? { handle: this.active } : {}),
      fields: session?.fields(this.active) ?? [],
      ...(this.fieldError ? { error: this.fieldError } : {}),
    };
  }

  /** Arms a placement tool (or none). Switching drops any unfinished construction. */
  setTool(tool: string | undefined): boolean {
    if (!this.entity) return false;
    if (tool && !this.session(this.draft!)?.tools().some((item) => item.id === tool && !("separator" in item))) return false;
    if (this.hasDraft()) this.discardDraft();
    this.tool = tool; this.ghost = []; this.active = undefined; this.snapMark = undefined;
    this.changed(); this.options.tool.host.requestRender();
    return true;
  }

  /** Completes a construction that needs an explicit end (a track's points). */
  finishTool(): boolean {
    if (!this.entity || !this.tool || !this.draft) return false;
    const result = this.session(this.draft)?.finish(this.tool);
    if (!result?.content) return false;
    this.afterPlace(result.content, result.handle);
    return true;
  }

  /** Writes one inspector value through the plugin; one undo step. Returns the rejection reason, if any. */
  setField(key: string, value: number | string | boolean): string | undefined {
    if (!this.entity || !this.draft || this.gesture) return "편집 중인 그림이 없습니다.";
    const session = this.session(this.original!);
    const patch: FieldPatch = { id: this.active ?? "", key, value };
    const reason = session?.validateField(patch);
    if (reason) { this.fieldError = reason; this.changed(); return reason; }
    this.fieldError = undefined;
    const next = session?.applyField(patch);
    if (next) this.commitProps(figureProps({ ...next, spec: next.spec }), "set-field");
    this.changed();
    return undefined;
  }

  /** Deletes the chosen handle and everything that depends on it; one undo step. */
  removeActive(): boolean {
    if (!this.entity || !this.active || this.gesture || this.hasDraft()) return false;
    const next = this.session(this.original!)?.remove([this.active]);
    if (!next) return false;
    this.active = undefined;
    this.commitProps(figureProps(next), "delete");
    return true;
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.entity || this.options.tool.host.isSelectionEnabled?.() === false || inputOwned(event) || this.imeLocked(event) || event.getModifierState("AltGraph")) return false;
    this.setModifiers(event);
    if (event.key === "Escape") { this.cancel(); return true; }
    if (event.key === "Enter") {
      if (this.gesture) this.cancelGesture();
      else if (this.tool && this.hasDraft()) this.finishTool();
      else this.exit();
      return true;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.removeActive();
      return true;
    }
    // Plain letter keys pick stemfig's tools while editing; V returns to select-and-drag.
    if (!event.ctrlKey && !event.metaKey && !event.altKey && /^[a-z]$/i.test(event.key) && !this.gesture) {
      const key = event.key.toUpperCase();
      if (key === "V") { this.setTool(undefined); return true; }
      const tool = this.session(this.draft!)?.tools().find((item) => !("separator" in item) && item.shortcut?.toUpperCase() === key);
      if (tool) { this.setTool(tool.id); return true; }
    }
    return false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.exit();
    this.disposed = true;
    this.abort.abort();
    for (let i = this.off.length - 1; i >= 0; i--) this.off[i]!();
    this.scratch.dispose();
    this.svg.remove();
  }

  // ── state ──────────────────────────────────────────────────────────────

  private session(props: Readonly<FigureProps>) {
    return this.options.engine.editFigure(this.kind!.kind, figureContent(props), { width_mm: worldToMm(this.box!.width), height_mm: worldToMm(this.box!.height) });
  }

  private readCanonical(): void {
    const { world } = this.options, id = this.entity!;
    this.original = world.getCanonical<FigureProps>(id, this.kind!.aspectId)!;
    this.box = readGeometry({ getCanonical: (e, a) => world.getCanonical(e, a), getComputed: () => undefined, isAlive: () => true }, id, this.kind!.defaultSize);
    this.draft = { ...this.original };
    this.scratch.clear();
    this.refreshAnchors();
    this.changed();
  }

  private hasDraft(): boolean {
    const spec = this.draft?.spec as { draft?: unknown } | undefined;
    return !!spec && spec.draft !== undefined;
  }

  private discardDraft(): void {
    this.scratch.clear();
    if (this.entity) this.readCanonical();
    this.ghost = [];
    this.options.tool.host.requestRender();
  }

  private refreshAnchors(): void {
    this.anchors = this.draft ? this.session(this.draft)?.anchors() ?? [] : [];
    if (this.active && !this.anchors.some((anchor) => anchor.id === this.active)) this.active = undefined;
    this.rebuildGizmos();
  }

  private release(): void {
    this.endCapture();
    this.scratch.clear();
    for (const off of this.gizmoOff.splice(0)) off();
    this.marks.replaceChildren();
    this.entity = undefined; this.kind = undefined; this.box = undefined; this.original = undefined; this.draft = undefined;
    this.anchors = []; this.active = undefined; this.tool = undefined; this.ghost = []; this.hover = undefined; this.fieldError = undefined; this.snapMark = undefined;
    this.options.onEditingChanged?.(undefined);
    this.changed();
    this.options.tool.host.requestRender();
  }

  /** Point handles become gizmos so they win over select-suite's resize handles. */
  private rebuildGizmos(): void {
    for (const off of this.gizmoOff.splice(0)) off();
    const gizmos = this.options.tool.selection.gizmos;
    for (const anchor of this.anchors) {
      if (anchor.kind !== "point") continue;
      const id = `${this.owner}:${anchor.id}`;
      this.gizmoOff.push(gizmos.register({
        id, priority: POINT_PRIORITY, shape: "circle", radiusScreenPx: POINT_HIT_PX,
        getWorldPosition: (out) => this.anchorWorld(anchor.id, out),
        onPointerDown: (event) => this.begin(anchor.id, event),
      }));
    }
  }

  private anchorWorld(handle: string, out: MutablePoint): boolean {
    if (!this.box) return false;
    const anchor = this.anchors.find((item) => item.id === handle);
    if (!anchor || anchor.kind !== "point") return false;
    pageMmToWorld(this.box, anchor.x_mm, anchor.y_mm, out);
    return true;
  }

  private snapRing(toScreen: (xMm: number, yMm: number) => [number, number]): string {
    if (!this.snapMark || !(this.gesture?.moved || (this.tool && !this.gesture))) return "";
    const [x, y] = toScreen(this.snapMark.x, this.snapMark.y);
    return snapRingSvg(x, y, this.snapMark.kind);
  }

  private pxPerMm(): number { return this.options.tool.host.getZoom() * WORLD_PX_PER_MM; }

  // ── input ──────────────────────────────────────────────────────────────

  private setModifiers(modifiers: Readonly<ToolModifiers> | MouseEvent | KeyboardEvent): void {
    if ("shiftKey" in modifiers) { this.modifiers.shift = modifiers.shiftKey; this.modifiers.alt = modifiers.altKey; this.modifiers.ctrl = modifiers.ctrlKey; this.modifiers.meta = modifiers.metaKey; }
    else Object.assign(this.modifiers, modifiers);
    if (this.gesture) this.dirty = true;
    this.options.tool.host.requestRender();
  }

  private readonly keyDown = (event: KeyboardEvent) => { if (!event.defaultPrevented && this.handleKeyDown(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
  private readonly keyModifiers = (event: KeyboardEvent) => { if (this.entity && !this.imeLocked(event) && !event.getModifierState("AltGraph")) this.setModifiers(event); };
  private imeLocked(event?: KeyboardEvent): boolean {
    return this.composing || !!event && (event.isComposing || event.keyCode === 229 || event.key === "Process") || performance.now() - this.compositionEnded < 16;
  }
  private stop(event: Event): void { event.preventDefault(); event.stopImmediatePropagation(); }

  /** Starts a drag on a stemfig handle. Returns false if the handle cannot be dragged. */
  private begin(handle: string, event: PointerEvent): boolean {
    if (!this.entity || this.gesture || event.button !== 0 || !this.box) return false;
    if (this.tool) {
      this.options.tool.host.screenToWorld(event.clientX, event.clientY, this.world);
      worldToPageMm(this.box, this.world.x, this.world.y, this.page);
      this.place(this.page.x, this.page.y, event);
      this.stop(event);
      return true;
    }
    this.options.tool.host.screenToWorld(event.clientX, event.clientY, this.world);
    const anchor = this.anchors.find((item) => item.id === handle && item.kind === "point");
    this.gesture = {
      pointer: event.pointerId, handle,
      startX: this.world.x, startY: this.world.y,
      ...(anchor && anchor.kind === "point" ? { origin: { x: anchor.x_mm, y: anchor.y_mm } } : {}),
      clientX: event.clientX, clientY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false,
    };
    this.active = handle;
    this.fieldError = undefined;
    this.changed();
    this.setModifiers(event);
    this.options.tool.surface.element.setPointerCapture?.(event.pointerId);
    this.options.tool.host.requestRender();
    this.stop(event);
    return true;
  }

  private readonly down = (event: PointerEvent) => {
    const { host, selection } = this.options.tool;
    if (!this.entity || this.gesture || event.button !== 0 || event.defaultPrevented || inputOwned(event) || this.imeLocked() || host.isPanGesture?.(event) || host.isSelectionEnabled?.() === false || !this.box) return;
    if (selection.gizmos.hitTest(event.clientX, event.clientY, host.worldToScreen, this.hit) && this.hit.id.startsWith(`${this.owner}:`)) {
      if (this.begin(this.hit.id.slice(this.owner.length + 1), event)) return;
    }
    host.screenToWorld(event.clientX, event.clientY, this.world);
    if (!insideBox(this.box, this.world.x, this.world.y, this.page)) {
      if (this.tool) { this.stop(event); return; } // a tool click outside never leaves editing
      this.exit(); return;
    }
    if (this.tool) { this.place(this.page.x, this.page.y, event); this.stop(event); return; }
    const handle = this.draft && this.session(this.draft)?.hit(this.page.x, this.page.y);
    if (handle) { this.begin(handle, event); return; }
    // Empty paper inside the figure: clear the handle choice but stay in editing.
    this.active = undefined;
    this.changed();
    host.requestRender();
    this.stop(event);
  };

  private readonly move = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture && this.tool && this.entity) {
      this.hover = { x: event.clientX, y: event.clientY };
      this.modifiers.shift = event.shiftKey; this.modifiers.alt = event.altKey;
      this.dirty = true;
      this.options.tool.host.requestRender();
      return;
    }
    if (!gesture || gesture.pointer !== event.pointerId) return;
    gesture.lastX = event.clientX; gesture.lastY = event.clientY;
    this.modifiers.shift = event.shiftKey; this.modifiers.alt = event.altKey;
    gesture.moved ||= Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) >= SLOP;
    this.dirty = true;
    this.options.tool.host.requestRender();
    this.stop(event);
  };

  /** Applies the latest pointer to the draft; called from the host frame, never per event. */
  private applyGesture(): void {
    const gesture = this.gesture;
    if (!gesture || !this.dirty || !gesture.moved || !this.box || !this.draft) return;
    this.dirty = false;
    const { host } = this.options.tool;
    host.screenToWorld(gesture.lastX, gesture.lastY, this.world);
    worldToPageMm(this.box, this.world.x, this.world.y, this.page);
    const pointerX = this.page.x, pointerY = this.page.y;
    worldToPageMm(this.box, gesture.startX, gesture.startY, this.page);
    const deltaX = pointerX - this.page.x, deltaY = pointerY - this.page.y;
    // stemdraw edits from the canonical spec each move; restart from the press-time spec.
    const base = this.original!;
    const session = this.session(base);
    if (!session) return;
    let patch: HandlePatch;
    if (gesture.origin) {
      const intended = { x: gesture.origin.x + deltaX, y: gesture.origin.y + deltaY };
      const snapped = this.modifiers.alt ? null : session.snap(intended.x, intended.y, gesture.handle, this.pxPerMm());
      const target = snapped ? { x: snapped.x_mm, y: snapped.y_mm } : intended;
      this.snapMark = snapped ? { x: snapped.x_mm, y: snapped.y_mm, kind: snapped.kind } : undefined;
      patch = {
        id: gesture.handle, dx_mm: target.x - gesture.origin.x, dy_mm: target.y - gesture.origin.y,
        pointer: { x_mm: target.x, y_mm: target.y, unsnap: this.modifiers.alt, px_per_mm: this.pxPerMm(), constrain: this.modifiers.shift },
        constrain: this.modifiers.shift,
      };
    } else {
      patch = { id: gesture.handle, dx_mm: deltaX, dy_mm: deltaY, constrain: this.modifiers.shift };
    }
    const spec = session.apply(patch);
    this.draft = spec === undefined ? { ...base } : { ...base, spec: spec as Record<string, unknown> };
    if (spec === undefined) this.scratch.clear();
    else this.scratch.set(this.entity!, this.kind!.aspectId, { spec: this.draft.spec });
    this.anchors = this.session(this.draft)?.anchors() ?? this.anchors;
    this.options.tool.selection.stateMachine.transition(`${this.state}.dragging`);
  }

  private readonly up = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    this.move(event);
    this.applyGesture();
    const changed = gesture.moved && this.draft && this.draft.spec !== this.original?.spec;
    this.endCapture();
    if (changed) this.commit(); else { this.scratch.clear(); if (this.entity) this.readCanonical(); }
    if (this.entity) this.options.tool.selection.stateMachine.transition(`${this.state}.idle`);
    this.options.tool.host.requestRender();
    this.stop(event);
  };

  private commit(): void {
    if (this.draft) this.commitProps(this.draft, "drag-handle");
  }

  /** One canonical write in one undo group. Only fields that changed are patched; drafts never are. */
  private commitProps(props: FigureProps, action: "drag-handle" | "place" | "set-field" | "delete"): void {
    const { world, tool } = this.options;
    if (!this.entity || !this.kind || !this.original) return;
    const patch: Record<string, unknown> = {};
    for (const key of ["spec", "handles"] as const) if (JSON.stringify(props[key]) !== JSON.stringify(this.original[key])) patch[key] = props[key];
    if ((patch.spec as { draft?: unknown } | undefined)?.draft !== undefined) throw new Error("An unfinished construction cannot be committed.");
    this.scratch.clear();
    if (!Object.keys(patch).length) { this.readCanonical(); return; }
    this.mutating = true;
    tool.host.history.begin();
    try {
      world.applyCanonicalTransaction(`${this.options.namespace}:${action}` as SymbolId, [{ id: this.entity, aspect: this.kind.aspectId, patch }], "local:user");
      tool.host.history.commit();
    } catch (error) {
      tool.host.history.abort();
      tool.host.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.mutating = false;
      if (this.entity) this.readCanonical();
    }
  }

  private modifiersFor(event: MouseEvent) {
    return { unsnap: event.altKey, constrain: event.shiftKey, px_per_mm: this.pxPerMm() };
  }

  /** One tool click. Intermediate steps stay in scratch; a finished construction commits once. */
  private place(xMm: number, yMm: number, event: MouseEvent): void {
    if (!this.tool || !this.draft) return;
    const result = this.session(this.draft)?.place(this.tool, xMm, yMm, this.modifiersFor(event));
    if (!result?.content) { if (result?.handle) { this.active = result.handle; this.changed(); } return; }
    this.afterPlace(result.content, result.handle);
  }

  private afterPlace(content: ReturnType<typeof figureContent>, handle: string | null): void {
    const next = figureProps(content, { keepDraft: true });
    this.active = handle ?? undefined;
    this.ghost = [];
    if ((next.spec as { draft?: unknown }).draft !== undefined) {
      this.draft = next;
      this.scratch.set(this.entity!, this.kind!.aspectId, { spec: next.spec, handles: next.handles });
      this.refreshAnchors();
      this.changed();
    } else {
      this.commitProps(next, "place");
    }
    this.options.tool.host.requestRender();
  }

  /** Tool ghost under the pointer, from stemfig preview(); painted in the gizmo plane only. */
  private updateGhost(): void {
    if (!this.tool || !this.hover || !this.box || !this.draft || !this.dirty) return;
    this.dirty = false;
    this.options.tool.host.screenToWorld(this.hover.x, this.hover.y, this.world);
    worldToPageMm(this.box, this.world.x, this.world.y, this.page);
    const session = this.session(this.draft);
    this.ghost = session?.preview(this.tool, this.page.x, this.page.y, { unsnap: this.modifiers.alt, constrain: this.modifiers.shift, px_per_mm: this.pxPerMm() }) ?? [];
    const snapped = this.modifiers.alt ? null : session?.snap(this.page.x, this.page.y, undefined, this.pxPerMm());
    this.snapMark = snapped ? { x: snapped.x_mm, y: snapped.y_mm, kind: snapped.kind } : undefined;
  }

  private endCapture(): void {
    const pointer = this.gesture?.pointer, element = this.options.tool.surface.element;
    this.gesture = undefined; this.dirty = false; this.snapMark = undefined;
    if (pointer !== undefined && element.hasPointerCapture?.(pointer)) element.releasePointerCapture(pointer);
  }

  private cancelGesture(): void {
    if (!this.gesture) return;
    this.endCapture();
    this.scratch.clear();
    if (this.entity) { this.readCanonical(); this.options.tool.selection.stateMachine.transition(`${this.state}.idle`); }
    this.options.tool.host.requestRender();
  }

  private readonly cancelPointer = (event: PointerEvent) => { if (this.gesture?.pointer === event.pointerId) this.cancelGesture(); };

  /** Double-click on a selected figure enters editing; inside editing it is ignored. */
  private readonly doubleClick = (event: MouseEvent) => {
    const { host, selection } = this.options.tool;
    if (this.entity || event.button !== 0 || event.defaultPrevented || inputOwned(event) || this.imeLocked() || event.ctrlKey || event.metaKey || event.altKey || host.isSelectionEnabled?.() === false) return;
    if (selection.stateMachine.stateId !== IDLE) return;
    const selected = selection.getSelection();
    if (selected.length !== 1) return;
    const kind = this.kindOf(selected[0]!);
    if (!kind) return;
    host.screenToWorld(event.clientX, event.clientY, this.world);
    const box = readGeometry({ getCanonical: (e, a) => this.options.world.getCanonical(e, a), getComputed: () => undefined, isAlive: () => true }, selected[0]!, kind.defaultSize);
    if (!insideBox(box, this.world.x, this.world.y, this.page)) return;
    if (this.enter(selected[0]!)) this.stop(event);
  };

  private readonly onWorldChanged = () => {
    if (this.mutating || !this.entity || !this.kind) return;
    const { world } = this.options;
    if (!world.isAlive(this.entity) || world.isEntityReadOnly(this.entity) || !world.getCanonical(this.entity, this.kind.aspectId)) { this.exit(); return; }
    const changed = this.original !== world.getCanonical(this.entity, this.kind.aspectId)
      || this.box?.width !== world.getCanonical<{ width?: number }>(this.entity, "core.bounds")?.width
      || this.box?.height !== world.getCanonical<{ height?: number }>(this.entity, "core.bounds")?.height
      || this.box?.x !== world.getCanonical<{ x?: number }>(this.entity, "core.transform")?.x
      || this.box?.y !== world.getCanonical<{ y?: number }>(this.entity, "core.transform")?.y;
    // A remote or undo change rebases the edit on the new canonical spec.
    if (changed) { this.cancelGesture(); this.readCanonical(); this.options.tool.host.requestRender(); }
  };

  // ── paint (gizmo plane, host frame) ────────────────────────────────────

  readonly render = (): void => {
    const { tool, world } = this.options;
    if (!this.entity || !this.box) { this.svg.style.display = "none"; return; }
    if (!tool.selection.getSelection().includes(this.entity) || world.isEntityReadOnly(this.entity)) { this.exit(); this.svg.style.display = "none"; return; }
    this.applyGesture();
    this.updateGhost();
    this.svg.style.display = "";
    const rect = tool.surface.hud.getBoundingClientRect();
    const toScreen = (xMm: number, yMm: number): [number, number] => {
      pageMmToWorld(this.box!, xMm, yMm, this.world);
      tool.host.worldToScreen(this.world.x, this.world.y, this.screen);
      return [this.screen.x - rect.left, this.screen.y - rect.top];
    };
    let outline = "", guides = "", points = "";
    const corners = [[0, 0], [worldToMm(this.box.width), 0], [worldToMm(this.box.width), worldToMm(this.box.height)], [0, worldToMm(this.box.height)]] as const;
    outline = `M${corners.map(([x, y]) => toScreen(x, y).join(",")).join("L")}Z`;
    for (const anchor of this.anchors) {
      const active = anchor.id === this.active;
      switch (anchor.kind) {
        case "point": {
          const [x, y] = toScreen(anchor.x_mm, anchor.y_mm);
          points += `<circle cx="${x}" cy="${y}" r="${active ? 5 : 4}" fill="${active ? ACCENT : "#fff"}" stroke="${ACCENT}" stroke-width="1.5" data-stem-handle="${escapeAttr(anchor.id)}"/>`;
          break;
        }
        case "line": {
          if (!active) break;
          const [x1, y1] = toScreen(anchor.x1_mm, anchor.y1_mm), [x2, y2] = toScreen(anchor.x2_mm, anchor.y2_mm);
          guides += `M${x1},${y1}L${x2},${y2}`;
          break;
        }
        case "polyline": {
          if (!active || !anchor.points.length) break;
          guides += `M${anchor.points.map(([x, y]) => toScreen(x, y).join(",")).join("L")}`;
          break;
        }
        case "circle": case "ellipse": {
          if (!active) break;
          const [cx, cy] = toScreen(anchor.cx_mm, anchor.cy_mm);
          const rx = (anchor.kind === "circle" ? anchor.r_mm : anchor.rx_mm) * this.pxPerMm(), ry = (anchor.kind === "circle" ? anchor.r_mm : anchor.ry_mm) * this.pxPerMm();
          guides += `M${cx - rx},${cy}a${rx},${ry} 0 1 0 ${rx * 2},0a${rx},${ry} 0 1 0 ${-rx * 2},0`;
          break;
        }
        case "text": break;
      }
    }
    this.marks.innerHTML =
      `<path d="${outline}" fill="none" stroke="${ACCENT}" stroke-width="1" stroke-dasharray="4 3"/>` +
      `<path d="${guides}" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-opacity=".45" stroke-linecap="round" stroke-linejoin="round"/>` +
      itemsToHudSvg(this.ghost, toScreen, this.pxPerMm()) +
      points +
      this.snapRing(toScreen);
  };
}

function snapRingSvg(x: number, y: number, kind: string): string {
  // A connection point is a ring; a path foot is a small diamond. Neither is published.
  return kind === "path"
    ? `<path data-stem-snap="${kind}" d="M${x},${y - 6}L${x + 6},${y}L${x},${y + 6}L${x - 6},${y}Z" fill="none" stroke="${ACCENT}" stroke-width="2"/>`
    : `<circle data-stem-snap="${kind}" cx="${x}" cy="${y}" r="8" fill="none" stroke="${ACCENT}" stroke-width="2"/>`;
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
