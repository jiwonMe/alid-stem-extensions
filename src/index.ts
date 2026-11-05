import metadata from "../extension.json";
import type { ActivationContext, ClipboardService, CommandSpec, EntityCreationRequest, SymbolId, UiControl } from "./alid.ts";
import { createEngine } from "./engine.ts";
import { createFigureAspect } from "./figure-aspect.ts";
import { creationPresets, figureKinds, stemfigPlugins } from "./kinds.ts";
import { createPackageManifest } from "./manifest.js";
import { looksLikeStemfig, stemfigToOps } from "./stemfig-import.ts";
import { mmToWorld } from "./units.ts";

/**
 * jiwonme.stem: stemfig figures as alid canvas objects (docs/PLAN.md).
 * P1: static figures, creation tools and stemfig/v1 import. Installing or activating
 * never writes document data; only explicit commands and pastes create entities.
 */
export const engine = createEngine(stemfigPlugins);
const kinds = figureKinds(metadata.id);
const aspects = kinds.map((kind) => createFigureAspect(engine, kind));
const aspectOf = new Map(kinds.map((kind) => [kind.kind, kind.aspectId]));
const command = (name: string) => `${metadata.id}:${name}` as SymbolId;
const PASTE_PRIORITY = 60; // ahead of the markdown card's plain-text handler (40)

const toolShelf: UiControl[] = creationPresets.map((preset) => ({
  id: preset.name, kind: "action", label: preset.label, icon: "plus", placement: "tool-shelf", commandSymbol: command(preset.name), requiresSelection: false,
}));

export default {
  ...createPackageManifest(metadata),
  summary: metadata.summary,
  aspects,
  ui: { controls: toolShelf },
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
      renderFigureSvg: (...args: Parameters<typeof engine.renderFigureSvg>) => { live(); return engine.renderFigureSvg(...args); },
    });
    return {
      api,
      dispose() {
        if (!active) return;
        active = false;
        for (const dispose of disposers.splice(0).reverse()) dispose();
      },
    };
  },
};
