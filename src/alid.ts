/**
 * The slice of alid's public extension contract this package uses, declared
 * structurally so the bundle needs no SDK import (see docs/api.md). Shapes follow
 * @alid/kernel: porcelain-and-trust.ts, kernel-data.ts, workbench-types.ts,
 * entity-creation.ts, extension-manifest.ts. The integration test checks them
 * against the real kernel.
 */
export type EntityId = string;
export type SymbolId = `${string}:${string}`;

export interface ComputedReadView {
  getCanonical<T extends Record<string, unknown>>(id: EntityId, aspect: string): Readonly<T> | undefined;
  getComputed<T>(id: EntityId, aspect: string): Readonly<T> | undefined;
  isAlive(id: EntityId): boolean;
}

export interface CanonicalPatchOp {
  id: EntityId;
  aspect: string;
  patch: Record<string, unknown> | null;
}

export interface ScratchOverlay {
  set(id: EntityId, aspect: string, patch: Record<string, unknown>): void;
  clear(): void;
  dispose(): void;
}

export interface CanvasWorld {
  getCanonical<T extends Record<string, unknown>>(id: EntityId, aspect: string): Readonly<T> | undefined;
  applyCanonicalTransaction(caller: SymbolId, ops: readonly CanonicalPatchOp[], origin?: string): void;
  createScratchOverlay(owner: string): ScratchOverlay;
  getPreviewView(): ComputedReadView;
  subscribe(listener: () => void): () => void;
  isAlive(id: EntityId): boolean;
  isEntityReadOnly(id: EntityId): boolean;
}

export interface MutablePoint { x: number; y: number }
export interface ToolModifiers { shift: boolean; alt: boolean; ctrl: boolean; meta: boolean }

export interface ToolStateMachine {
  readonly stateId: string;
  mountChildState(parentId: string, spec: { id: string; onExit?(context: unknown): void; onModifiersChanged?(context: unknown, modifiers: Readonly<ToolModifiers>): void }): () => void;
  transition(id: string): void;
}

export interface GizmoHit { id: string; priority: number; distanceScreenPx: number }
export interface GizmoRegistry {
  register(handle: {
    id: string; priority: number; shape: "circle" | "rect"; radiusScreenPx?: number;
    getWorldPosition(out: MutablePoint): boolean; onPointerDown?(event: PointerEvent): boolean;
  }): () => void;
  hitTest(clientX: number, clientY: number, worldToScreen: (x: number, y: number, out: MutablePoint) => void, out: GizmoHit): boolean;
}

/** canvas.active-tool-surface (kernel tool-input.ts): the active view's input and projection. */
export interface CanvasToolSurface {
  surface: { element: HTMLElement; hud: HTMLElement };
  selection: { readonly stateMachine: ToolStateMachine; readonly gizmos: GizmoRegistry; getSelection(): readonly EntityId[]; select(id: EntityId | null): void };
  host: {
    screenToWorld(x: number, y: number, out: MutablePoint): void;
    worldToScreen(x: number, y: number, out: MutablePoint): void;
    getZoom(): number;
    requestRender(): void;
    readonly history: WorkbenchHistory;
    isPanGesture?(event: PointerEvent): boolean;
    isSelectionEnabled?(): boolean;
    onError?(error: Error): void;
  };
}
export interface CanvasToolSurfaceProvider { get(): CanvasToolSurface | undefined; subscribe(listener: () => void): () => void }
export interface CanvasFrameScheduler { subscribe(paint: () => void): () => void }
export interface CanvasToolInputRegistry { register(owner: string, handler: { handleKeyDown(event: KeyboardEvent): boolean }): () => void }

/** Contributed icon: a host icon name or 20×20 SVG path data drawn with currentColor. */
export type WorkbenchIcon = string | { paths: string[]; fill?: boolean };

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type UiControl =
  | { id: string; kind: "slider" | "number"; field: string; label: string; placement: "inspector"; min?: number; max?: number; step?: number }
  | { id: string; kind: "text" | "color" | "toggle"; field: string; label: string; placement: "inspector" }
  | { id: string; kind: "segmented"; field: string; label: string; placement: "inspector"; options: { label: string; value: JsonValue }[] }
  | { id: string; kind: "action"; label: string; placement: "tool-shelf" | "selection-bar"; commandSymbol: SymbolId; icon?: WorkbenchIcon; requiresSelection?: boolean };

export interface WorkbenchPanelContext {
  readonly world: CanvasWorld;
  getSelectedIds(): readonly EntityId[];
  onSelectionChange(callback: (selected: readonly EntityId[]) => void): () => void;
  onWorldMutated(callback: () => void): () => void;
  executeCommand(symbol: SymbolId, args?: JsonValue): Promise<unknown>;
}

export interface WorkbenchPanelSpec {
  panelId: `${string}.${string}`;
  title: string;
  icon?: string;
  defaultZone: "left" | "right" | "bottom";
  inspectorFor?: string;
  isolation?: "shadow" | "container";
  mount?(host: HTMLElement, context: WorkbenchPanelContext): void | (() => void);
}

export interface SelectionContribution {
  getBounds(id: EntityId, view: ComputedReadView, out: { x: number; y: number; width: number; height: number; rotation?: number }): boolean;
  hitTest(id: EntityId, view: ComputedReadView, x: number, y: number, zoom: number): number;
  intersectsRect(id: EntityId, view: ComputedReadView, minX: number, minY: number, maxX: number, maxY: number): boolean;
  canTransform?(id: EntityId, view: ComputedReadView): boolean;
}

export interface AspectSpec<TProps extends Record<string, unknown>, TDerived> {
  id: string;
  selection?: SelectionContribution;
  label?: string;
  summary?: string;
  defaults: TProps;
  dependsOnCanonical?: string[];
  dependsOnComputed?: string[];
  derive?(props: Readonly<TProps>, id: EntityId, view: ComputedReadView): TDerived | undefined;
  renderSvg?(props: Readonly<TProps>, derived: TDerived | undefined, id: EntityId): { svg: string };
  ui?: { controls?: UiControl[]; panels?: WorkbenchPanelSpec[] };
}

export interface CommandSpec {
  id: SymbolId;
  title: string;
  summary: string;
  keys?: string[];
  shortcutScope?: "canvas" | "global";
  shortcutSelectionAspect?: string;
  run(params?: JsonValue): unknown;
}

export interface WorkbenchHistory { begin(): void; commit(): void; abort(): void }

export interface EntityCreationRequest {
  caller: SymbolId;
  aspects: Record<string, Record<string, unknown>>;
  width: number;
  height?: number;
  x?: number;
  y?: number;
}

export interface ServiceLookup { get<T>(id: string): T | undefined }

export interface ActivationContext {
  readonly world: CanvasWorld;
  readonly services: ServiceLookup;
  readonly commands: { register(spec: CommandSpec): () => void };
}

/** core.clipboard's paste contract (packages/extensions/clipboard/src/types.ts). */
export interface ClipboardService {
  registerPasteHandler(handler: {
    id: string;
    priority: number;
    canHandle(ctx: { clipboardData: Pick<DataTransfer, "getData"> }): boolean;
    buildOps(ctx: { targetPoint: { x: number; y: number }; clipboardData: Pick<DataTransfer, "getData"> }): CanonicalPatchOp[];
  }): () => void;
}
