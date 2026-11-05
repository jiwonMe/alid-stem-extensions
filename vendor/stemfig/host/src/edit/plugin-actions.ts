/**
 * 내부 객체 삭제·작도 취소·진행 안내의 호스트 경계.
 * spec 은 검증 후 플러그인에만 넘긴다. 객체 참조·손잡이 별칭·도구 뜻을 모른다.
 * 문서 변경은 새 봉투를 돌려주며 HistoryStore 는 앱이 책임진다.
 */
import { isNodeLocked } from "../envelope/lock.ts";
import type { Document } from "../envelope/document.ts";
import { indexNodes, mapFigure } from "../envelope/tree.ts";
import type { FieldPatch, ToolGuidance } from "../plugin/plugin.ts";
import { resolvePlugin, type Registry } from "../plugin/registry.ts";

/**
 * 손잡이를 지우고 플러그인이 보고한 종속 id 를 interaction 에서 제거한다.
 * @param ids 내부 손잡이. 봉투 노드 id 와 다른 공간
 * @returns 새 문서. 미지원·검증 실패·삭제 없음이면 입력 문서
 */
export function removeHandles(doc: Document, figureId: string, ids: readonly string[], registry: Registry): Document {
  if (isNodeLocked(doc, figureId)) return doc;
  const loaded = load(doc, figureId, registry);
  if (!loaded?.plugin.remove || !loaded.plugin.toSpec) return doc;
  try {
    const { figure, plugin, state, ctx } = loaded;
    const result = plugin.remove!(ctx, state, ids);
    if (!result || result.state === state) return doc;
    const removed = new Set(result.removed);
    const spec = plugin.toSpec!(result.state);
    return mapFigure(doc, figureId, (item) => ({
      ...item, spec,
      ...(figure.interaction ? { interaction: {
        ...figure.interaction,
        handles: figure.interaction.handles.filter((id) => !removed.has(id)),
      } } : {}),
    }));
  } catch { return doc; }
}

/**
 * 미완성 작도를 취소한다. 취소 의미는 플러그인이 정한다.
 * @param figureId 편집 중인 figure
 * @returns 새 문서. 취소할 것이 없거나 미지원이면 입력
 */
export function cancelPlacement(doc: Document, figureId: string, registry: Registry): Document {
  if (isNodeLocked(doc, figureId)) return doc;
  const loaded = load(doc, figureId, registry);
  if (!loaded?.plugin.cancel || !loaded.plugin.toSpec) return doc;
  try {
    const next = loaded.plugin.cancel(loaded.ctx, loaded.state);
    if (next === loaded.state) return doc;
    const spec = loaded.plugin.toSpec(next);
    return mapFigure(doc, figureId, (item) => ({ ...item, spec }));
  } catch { return doc; }
}

/**
 * 플러그인이 선언한 진행 중 작도를 명시적으로 완료한다.
 * @param tool 완료할 tools[].id. 호스트는 도구 이름이나 spec을 분기하지 않는다.
 * @returns 새 문서와 선택 손잡이. 완료 불가·잠금·검증 실패이면 원본 문서와 null이다.
 */
export function finishPlacement(doc: Document, figureId: string, tool: string, registry: Registry): { doc: Document; handleId: string | null } {
  const unchanged = { doc, handleId: null };
  if (isNodeLocked(doc, figureId)) return unchanged;
  const loaded = load(doc, figureId, registry);
  if (!loaded?.plugin.finish || !loaded.plugin.toSpec) return unchanged;
  try {
    if (!loaded.plugin.guidance?.({ tool }, loaded.state)?.canFinish) return unchanged;
    const result = loaded.plugin.finish({ ...loaded.ctx, tool }, loaded.state);
    if (!result || result.state === loaded.state) return unchanged;
    const spec = loaded.plugin.toSpec(result.state);
    return { doc: mapFigure(doc, figureId, item => ({ ...item, spec,
      ...(item.interaction && result.handles?.length ? { interaction: {
        ...item.interaction, handles: [...new Set([...item.interaction.handles, ...result.handles])],
      } } : {}),
    })), handleId: result.handles?.[0] ?? null };
  } catch { return unchanged; }
}

/**
 * 도구 단계 안내를 읽는다. 문서를 바꾸지 않는다.
 * @param tool 플러그인이 선언한 tools[].id
 * @returns 표시 문장. 엔진 실패·미지원이면 undefined
 */
export function toolGuidance(doc: Document, figureId: string, tool: string, registry: Registry): ToolGuidance | undefined {
  const loaded = load(doc, figureId, registry);
  try { return loaded?.plugin.guidance?.({ tool }, loaded.state); }
  catch { return undefined; }
}

/**
 * 필드 입력 오류 이유를 읽는다. spec 해석은 플러그인에 남긴다.
 * @param patch 적용하려는 필드 값
 * @returns 유효하면 undefined. 실패하면 표시할 문장
 */
export function validateField(doc: Document, figureId: string, patch: FieldPatch, registry: Registry): string | undefined {
  const loaded = load(doc, figureId, registry);
  if (!loaded) return "편집할 도형을 불러올 수 없습니다.";
  try { return loaded.plugin.validateField?.(loaded.ctx, loaded.state, patch); }
  catch (error) { return error instanceof Error ? error.message : "입력 값을 확인하세요."; }
}

function load(doc: Document, figureId: string, registry: Registry) {
  const figure = indexNodes(doc).figures.find((item) => item.id === figureId);
  if (!figure) return undefined;
  const plugin = resolvePlugin(figure.kind, doc.plugins, registry);
  if (!plugin) return undefined;
  try {
    const parsed = plugin.specSchema.safeParse(figure.spec);
    if (!parsed.success) return undefined;
    return { figure, plugin, state: plugin.init(parsed.data), ctx: { frame: figure.frame, view: figure.view } };
  } catch { return undefined; }
}
