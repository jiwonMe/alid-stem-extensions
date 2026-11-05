/**
 * figure 레이어 행.
 * kind 로 분기하지 않는다. resolvePlugin 만. spec 을 열지 않는다.
 */
import type { Document } from "../envelope/document.ts";
import { indexNodes } from "../envelope/tree.ts";
import type { LayerItem } from "../plugin/plugin.ts";
import { resolvePlugin, type Registry } from "../plugin/registry.ts";

/**
 * figure 안 객체 행. 엔진이 없거나 layers 가 없으면 빈 배열.
 * @param figureId Figure.id
 * @returns 손잡이 id. 트리 id 는 에디터가 figure.id 와 합친다
 */
export function listLayers(
  doc: Document,
  figureId: string,
  registry: Registry,
): readonly LayerItem[] {
  const figure = indexNodes(doc).figures.find((item) => item.id === figureId);
  if (!figure) {
    return [];
  }
  const plugin = resolvePlugin(figure.kind, doc.plugins, registry);
  const layers = plugin?.layers;
  if (!plugin || !layers) {
    return [];
  }
  const parsed = plugin.specSchema.safeParse(figure.spec);
  if (!parsed.success) {
    return [];
  }
  try {
    return layers(plugin.init(parsed.data));
  } catch {
    return [];
  }
}
