import metadata from "../extension.json";
import type {
  ActivationContext, CanvasFrameScheduler, CanvasToolInputRegistry, CanvasToolSurface, CanvasToolSurfaceProvider,
  ClipboardService, CommandSpec, EntityCreationRequest, SymbolId, UiControl,
} from "./alid.ts";
import { FigureEditor } from "./edit/figure-editor.ts";
import { mountFigureInspector } from "./edit/inspector.ts";
import { FigureToolbar } from "./edit/toolbar.ts";
import { createEngine } from "./engine.ts";
import { createFigureAspect } from "./figure-aspect.ts";
import { icons } from "./icons.ts";
import { creationPresets, figureKinds, stemfigPlugins } from "./kinds.ts";
import { createPackageManifest } from "./manifest.js";
import { looksLikeStemfig, stemfigToOps } from "./stemfig-import.ts";
import { mmToWorld } from "./units.ts";

/**
 * jiwonme.stem: stemfig figures as alid canvas objects (docs/PLAN.md).
 * Static figures, creation tools, stemfig/v1 import, and dragging a figure's
 * inner handles. Installing or activating never writes document data; only
 * explicit commands, pastes and drags do.
 */
export const engine = createEngine(stemfigPlugins);
const kinds = figureKinds(metadata.id);
const aspectOf = new Map(kinds.map((kind) => [kind.kind, kind.aspectId]));
const command = (name: string) => `${metadata.id}:${name}` as SymbolId;
const PASTE_PRIORITY = 60; // ahead of the markdown card's plain-text handler (40)
const EDIT = command("edit-figure");

/** The editor of the current activation; aspects consult it to lock the box while editing. */
let editor: FigureEditor | undefined;
const aspects = kinds.map((kind) => {
  const aspect = createFigureAspect(engine, kind, (id) => editor?.isEditingEntity(id) ?? false);
  return {
    ...aspect,
    ui: {
      ...aspect.ui,
      panels: [{
        panelId: `${kind.aspectId}.inspector` as `${string}.${string}`,
        title: `${kind.label} 속성`,
        defaultZone: "right" as const,
        inspectorFor: kind.aspectId,
        isolation: "container" as const,
        mount(element: HTMLElement, panel: { onSelectionChange(callback: () => void): () => void; getSelectedIds(): readonly string[] }) {
          const off = mountFigureInspector(element, () => editor, (id) => panel.getSelectedIds().includes(id));
          const offSelection = panel.onSelectionChange(() => off.refresh());
          return () => { offSelection(); off(); };
        },
      }],
    },
  };
});

const controls: UiControl[] = [
  ...creationPresets.map((preset): UiControl => ({
    id: preset.name, kind: "action", label: preset.label, icon: preset.icon, placement: "tool-shelf", commandSymbol: command(preset.name), requiresSelection: false,
  })),
  { id: "edit-figure", kind: "action", label: "그림 안쪽 편집", icon: icons.edit, placement: "selection-bar", commandSymbol: EDIT, requiresSelection: true },
];

export default {
  ...createPackageManifest(metadata),
  summary: metadata.summary,
  aspects,
  ui: { controls },
  activate(context: ActivationContext) {
    let active = true;
    const disposers: Array<() => void> = [];
    const live = () => { if (!active) throw new Error("STEM 작도 확장이 비활성화되었습니다. 공개 API를 다시 조회하세요."); };
    const creation = () => {
      const service = context.services.get<{ create(request: EntityCreationRequest): string }>("canvas.creation");
      if (!service) throw new Error("STEM 작도에는 canvas.creation 호스트 서비스가 필요합니다.");
      return service;
    };

    const create = (name: string) => {
      live();
      const preset = creationPresets.find((item) => item.name === name);
      if (!preset) throw new Error(`Unknown STEM creation preset: ${name}`);
      return creation().create({
        caller: command(preset.name),
        aspects: { [aspectOf.get(preset.kind)!]: structuredClone(preset.props) },
        width: mmToWorld(preset.size_mm.w),
        height: mmToWorld(preset.size_mm.h),
      });
    };

    for (const preset of creationPresets) {
      const spec: CommandSpec = { id: command(preset.name), title: preset.label, summary: preset.summary, shortcutScope: "canvas", run: () => create(preset.name) };
      disposers.push(context.commands.register(spec));
    }

    // ── inner editing: follows the active canvas view; absent without a selection tool ──
    const surfaces = context.services.get<CanvasToolSurfaceProvider>("canvas.active-tool-surface");
    let bound: CanvasToolSurface | undefined, toolbar: FigureToolbar | undefined;
    const bind = (): FigureEditor | undefined => {
      const tool = surfaces?.get();
      if (tool === bound && editor) return editor;
      toolbar?.dispose(); toolbar = undefined;
      editor?.dispose(); editor = undefined; bound = tool;
      if (!tool) return undefined;
      editor = new FigureEditor({
        world: context.world, engine, kinds, tool, namespace: metadata.id,
        frames: context.services.get<CanvasFrameScheduler>("canvas.frames"),
        externalKeyboard: !!context.services.get("canvas.tool-input"),
        onEditingChanged: () => tool.host.requestRender(),
      });
      toolbar = new FigureToolbar(editor, tool.surface.hud);
      return editor;
    };
    const enterEdit = () => {
      live();
      const current = bind();
      if (!current || bound?.host.isSelectionEnabled?.() === false) return false;
      const ids = bound!.selection.getSelection();
      return ids.length === 1 && current.enter(ids[0]!);
    };
    bind();
    if (surfaces) disposers.push(surfaces.subscribe(() => { bind(); }));
    disposers.push(context.commands.register({
      id: EDIT,
      title: "그림 안쪽 편집",
      summary: "선택한 그림의 점·경로·라벨을 직접 끌어 편집합니다. 더블클릭이나 Enter로 들어가고 Esc나 Enter로 끝냅니다.",
      shortcutScope: "canvas",
      run: enterEdit,
    }));
    const input = context.services.get<CanvasToolInputRegistry>("canvas.tool-input");
    const plainEnter = (event: KeyboardEvent) => event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    if (input) disposers.push(input.register(metadata.id, {
      handleKeyDown: (event) => {
        if (editor?.editingEntityId) return editor.handleKeyDown(event);
        // Enter on one selected figure enters editing, like the vector path editor.
        return plainEnter(event) && !event.isComposing && enterEdit();
      },
    }));

    // stemfig/v1 JSON on the clipboard pastes as figures. Optional: needs core.clipboard.
    // Reading a provider's service throws when no provider is installed at all.
    let clipboard: ClipboardService | undefined;
    try { clipboard = context.services.get<ClipboardService>("canvas.clipboard"); } catch { clipboard = undefined; }
    if (clipboard) {
      disposers.push(clipboard.registerPasteHandler({
        id: `${metadata.id}:stemfig`,
        priority: PASTE_PRIORITY,
        canHandle: (ctx) => looksLikeStemfig(ctx.clipboardData.getData("text/plain")),
        buildOps: (ctx) => {
          live();
          return stemfigToOps(ctx.clipboardData.getData("text/plain"), kinds, ctx.targetPoint, () => `ent_stem_${crypto.randomUUID()}`).ops;
        },
      }));
    }

    const api = Object.freeze({
      kinds: engine.kinds,
      aspectIds: kinds.map((kind) => kind.aspectId),
      presets: creationPresets.map((preset) => preset.name),
      create,
      /** Enters inner editing on the single selected figure. */
      edit: enterEdit,
      renderFigureSvg: (...args: Parameters<typeof engine.renderFigureSvg>) => { live(); return engine.renderFigureSvg(...args); },
    });
    return {
      api,
      dispose() {
        if (!active) return;
        active = false;
        for (const dispose of disposers.splice(0).reverse()) dispose();
        toolbar?.dispose(); toolbar = undefined;
        editor?.dispose(); editor = undefined; bound = undefined;
      },
    };
  },
};
