/**
 * figure 편집 도구 목록.
 * 호스트는 kind 를 읽지 않는다. resolvePlugin 이 준 tools 만 넘긴다.
 * spec 을 파싱하지 않는다. 도구는 엔진 메타데이터다.
 */
import type { Document } from "../envelope/document.ts";
import { indexNodes } from "../envelope/tree.ts";
import type { FigureTool } from "../plugin/plugin.ts";
import { resolvePlugin, type Registry } from "../plugin/registry.ts";

/**
 * 그룹 사이 구분선. 앱은 Separator 만 그린다. place 금지.
 * @param item toolsAt 한 칸
 */
export function isFigureSeparator(
  item: FigureTool,
): item is Extract<FigureTool, { separator: true }> {
  return "separator" in item;
}

/**
 * 편집 중인 figure 의 플러그인 도구.
 * 엔진이 없거나 tools 가 없으면 빈 배열. throw 하지 않는다.
 * @param doc parseDocument 를 통과한 봉투
 * @param figureId Figure.id
 * @returns 플러그인이 선언한 도구. 없으면 []
 */
export function listTools(
  doc: Document,
  figureId: string,
  registry: Registry,
): readonly FigureTool[] {
  const figure = indexNodes(doc).figures.find((item) => item.id === figureId);
  if (!figure) {
    return [];
  }
  const plugin = resolvePlugin(figure.kind, doc.plugins, registry);
  return plugin?.tools ?? [];
}
