/**
 * figure 속성 필드.
 * kind 로 분기하지 않는다. resolvePlugin 만. spec 을 열지 않는다.
 */
import { DEFAULT_STYLE } from "@stemfig/display";
import type { Document } from "../envelope/document.ts";
import { indexNodes, mapFigure } from "../envelope/tree.ts";
import type { FieldPatch, InspectField } from "../plugin/plugin.ts";
import { resolvePlugin, type Registry } from "../plugin/registry.ts";

/**
 * 고른 손잡이의 필드. 엔진이 없거나 fields 가 없으면 빈 배열.
 * @param focus 손잡이 id. 없으면 플러그인이 figure 전체를 줄 수 있다
 */
export function listFields(
  doc: Document,
  figureId: string,
  focus: string | undefined,
  registry: Registry,
): readonly InspectField[] {
  const loaded = load(doc, figureId, registry);
  const fields = loaded?.plugin.fields;
  if (!loaded || !fields) {
    return [];
  }
  const { plugin, spec, figure } = loaded;
  try { return fields(
    {
      frame: figure.frame,
      view: figure.view,
      focus,
      style: figure.color ? { ...DEFAULT_STYLE, stroke: figure.color, textFill: figure.color } : DEFAULT_STYLE,
      handles: figure.interaction?.handles,
    },
    plugin.init(spec),
  ); } catch {
    /* 가져온 문서의 엔진 오류는 캔버스 오류 상자가 표시한다. 속성 패널은 앱을 중단하지 않는다. */
    return [];
  }
}

/**
 * 필드 절대값 → spec. applyField/toSpec 이 없으면 입력 문서.
 * @returns 새 문서. 실패 시 입력
 */
export function patchField(
  doc: Document,
  figureId: string,
  patch: FieldPatch,
  registry: Registry,
): Document {
  const loaded = load(doc, figureId, registry);
  const applyField = loaded?.plugin.applyField;
  const toSpec = loaded?.plugin.toSpec;
  if (!loaded || !applyField || !toSpec) {
    return doc;
  }
  const { plugin, spec, figure } = loaded;
  try {
    const ctx = { frame: figure.frame, view: figure.view };
    const state = plugin.init(spec);
    if (plugin.validateField?.(ctx, state, patch)) return doc;
    const next = applyField(ctx, state, patch);
    /* 같은 값을 확정하거나 거절한 입력은 실행 취소 기록과 redo를 바꾸지 않는다. */
    if (next === state) return doc;
    const nextSpec = toSpec(next);
    return mapFigure(doc, figure.id, (item) => ({ ...item, spec: nextSpec }));
  } catch {
    return doc;
  }
}

function load(
  doc: Document,
  figureId: string,
  registry: Registry,
):
  | {
      figure: NonNullable<ReturnType<typeof indexNodes>["figures"][number]>;
      plugin: NonNullable<ReturnType<typeof resolvePlugin>>;
      spec: unknown;
    }
  | undefined {
  const figure = indexNodes(doc).figures.find((item) => item.id === figureId);
  if (!figure) {
    return undefined;
  }
  const plugin = resolvePlugin(figure.kind, doc.plugins, registry);
  if (!plugin) {
    return undefined;
  }
  const parsed = plugin.specSchema.safeParse(figure.spec);
  if (!parsed.success) {
    return undefined;
  }
  return { figure, plugin, spec: parsed.data };
}
