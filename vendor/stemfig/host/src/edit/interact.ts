/**
 * figure 손잡이. kind 문자열로 분기하지 않는다. resolvePlugin 만.
 * 플러그인에 hit/apply/toSpec/place 가 없으면 빈 손잡이. 교과는 모른다.
 * 봉투를 파싱하지 않는다. 이미 검증된 Document 만 받는다.
 */
import { DEFAULT_STYLE, type DisplayItem } from "@stemfig/display";
import type { Document } from "../envelope/document.ts";
import { isNodeLocked } from "../envelope/lock.ts";
import type { Figure } from "../envelope/node.ts";
import { indexNodes, mapFigure } from "../envelope/tree.ts";
import type {
  HandleAnchor,
  HandleId,
  HandlePatch,
  SnapHit,
} from "../plugin/plugin.ts";
import { resolvePlugin, type Registry } from "../plugin/registry.ts";

/**
 * 페이지 mm 점이 손잡이면 id. 아니면 null.
 * @param doc parseDocument 를 통과한 봉투
 * @param figureId Figure.id
 * @param x_mm 페이지 mm
 * @param y_mm 페이지 mm
 * @returns 손잡이 id. 엔진이 없거나 빗나가면 null
 */
export function hitFigure(
  doc: Document,
  figureId: string,
  x_mm: number,
  y_mm: number,
  registry: Registry,
): HandleId | null {
  const loaded = loadFigure(doc, figureId, registry);
  const hit = loaded?.plugin.hit;
  if (!loaded || !hit) {
    return null;
  }
  const { plugin, spec, figure } = loaded;
  return hit(
    {
      frame: figure.frame,
      view: figure.view,
      x_mm,
      y_mm,
      handles: figure.interaction?.handles,
    },
    plugin.init(spec),
  );
}

/**
 * 손잡이 패치를 spec 에 반영한 새 문서.
 * apply/toSpec 이 없으면 입력 문서를 그대로 돌려준다.
 * @returns 새 문서. 실패 시 입력 문서
 */
export function applyFigure(
  doc: Document,
  figureId: string,
  patch: HandlePatch,
  registry: Registry,
): Document {
  if (isNodeLocked(doc, figureId)) return doc;
  const loaded = loadFigure(doc, figureId, registry);
  const apply = loaded?.plugin.apply;
  const toSpec = loaded?.plugin.toSpec;
  if (!loaded || !apply || !toSpec) {
    return doc;
  }
  const { plugin, spec, figure } = loaded;
  try {
    const state = plugin.init(spec);
    const next = apply({ frame: figure.frame, view: figure.view }, state, patch);
    /* 거절·무변경은 문서 참조도 보존해야 빈 undo와 redo 소실이 생기지 않는다. */
    if (next === state) return doc;
    const nextSpec = toSpec(next);
    return mapFigure(doc, figure.id, (item) => ({ ...item, spec: nextSpec }));
  } catch {
    /* init 재평가가 깨지면 문서를 버리지 않는다. compile 과 같이 박스만. */
    return doc;
  }
}

/**
 * 편집 모드 HUD 용 앵커. 없으면 빈 배열.
 * @returns 페이지 mm 앵커
 */
export function listAnchors(
  doc: Document,
  figureId: string,
  registry: Registry,
): HandleAnchor[] {
  const loaded = loadFigure(doc, figureId, registry);
  const anchors = loaded?.plugin.anchors;
  if (!loaded || !anchors) {
    return [];
  }
  const { plugin, spec, figure } = loaded;
  return anchors(
    {
      frame: figure.frame,
      view: figure.view,
      mmToPage: (x, y) => [figure.frame.x + x, figure.frame.y + y],
      style: DEFAULT_STYLE,
      handles: figure.interaction?.handles,
    },
    plugin.init(spec),
  );
}

/**
 * 도구 클릭 → spec 패치.
 * place/toSpec 이 없거나 플러그인이 모르면 입력 문서 그대로.
 * @param unsnap Alt. 자석만 끈다. 클릭 mm 는 그대로
 * @param px_per_mm 캔버스 CSS px / 페이지 mm. 자석 반경용. 없으면 zoom 1
 * @param constrain Shift. 호스트는 격자를 적용하지 않고 플러그인에만 전달한다
 * @returns 새 문서와 첫 손잡이 id. 실패면 입력 문서, handleId null
 */
export function placeFigure(
  doc: Document,
  figureId: string,
  tool: string,
  x_mm: number,
  y_mm: number,
  registry: Registry,
  unsnap = false,
  px_per_mm?: number,
  constrain = false,
): { doc: Document; handleId: HandleId | null } {
  /* 봉투가 잠겼으면 플러그인도 실행하지 않는다. 저장되지 않은 손잡이 선택을 만들지 않는다. */
  if (isNodeLocked(doc, figureId)) return { doc, handleId: null };
  const loaded = loadFigure(doc, figureId, registry);
  const place = loaded?.plugin.place;
  const toSpec = loaded?.plugin.toSpec;
  if (!loaded || !place || !toSpec) {
    return { doc, handleId: null };
  }
  try {
    const state = loaded.plugin.init(loaded.spec);
    const result = place(
      {
        frame: loaded.figure.frame,
        view: loaded.figure.view,
        x_mm,
        y_mm,
        tool,
        unsnap,
        px_per_mm,
        constrain,
      },
      state,
    );
    if (!result) return { doc, handleId: null };
    /* 기존 점을 다시 고르는 도구는 상태 변화 없이 선택 결과만 돌려줄 수 있다. */
    if (result.state === state) return { doc, handleId: result.handles?.[0] ?? null };
    const nextSpec = toSpec(result.state);
    return {
      doc: mapFigure(doc, loaded.figure.id, (item) =>
        mergeHandles({ ...item, spec: nextSpec }, result.handles),
      ),
      handleId: result.handles?.[0] ?? null,
    };
  } catch {
    return { doc, handleId: null };
  }
}

/**
 * 도구 커서 미리보기. place 와 같은 ctx 를 넘기되 spec 은 쓰지 않는다.
 * preview 가 없거나 모르면 빈 배열. 호출 측이 HUD extras 로 그린다.
 * @param unsnap Alt. 자석만 끈다. ghost 도 클릭 좌표
 * @param px_per_mm 캔버스 CSS px / 페이지 mm. 자석 반경용. 없으면 zoom 1
 * @param constrain Shift. 미리보기 각도도 클릭과 같은 격자를 쓴다
 * @returns DisplayItem. 페이지 mm. 실패·미구현은 []
 */
export function previewFigure(
  doc: Document,
  figureId: string,
  tool: string,
  x_mm: number,
  y_mm: number,
  registry: Registry,
  unsnap = false,
  px_per_mm?: number,
  constrain = false,
): DisplayItem[] {
  const loaded = loadFigure(doc, figureId, registry);
  const preview = loaded?.plugin.preview;
  if (!loaded || !preview) {
    return [];
  }
  try {
    return (
      preview(
        {
          frame: loaded.figure.frame,
          view: loaded.figure.view,
          x_mm,
          y_mm,
          tool,
          unsnap,
          px_per_mm,
          constrain,
        },
        loaded.plugin.init(loaded.spec),
      ) ?? []
    );
  } catch {
    return [];
  }
}

/**
 * 커서 자석. spec 을 쓰지 않는다.
 * snap 이 없거나 빗나가면 null. 호스트는 kind 로 분기하지 않는다.
 * @param unsnap Alt. 자석만 끈다. 호출 측 좌표를 고치지 않는다
 * @param px_per_mm 캔버스 CSS px / 페이지 mm. 자석 반경용. 없으면 zoom 1
 * @returns 페이지 mm. 실패·미구현은 null
 */
export function snapFigure(
  doc: Document,
  figureId: string,
  x_mm: number,
  y_mm: number,
  registry: Registry,
  exclude?: HandleId,
  unsnap = false,
  px_per_mm?: number,
): SnapHit | null {
  const loaded = loadFigure(doc, figureId, registry);
  const snap = loaded?.plugin.snap;
  if (!loaded || !snap) {
    return null;
  }
  try {
    return (
      snap(
        {
          frame: loaded.figure.frame,
          view: loaded.figure.view,
          x_mm,
          y_mm,
          exclude,
          unsnap,
          px_per_mm,
        },
        loaded.plugin.init(loaded.spec),
      ) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * 봉투 interaction 이 잠겨 있을 때만 손잡이를 연다.
 * 없으면 플러그인이 자유 손잡이 전부라 붙일 것이 없다.
 */
function mergeHandles(
  figure: Figure,
  extra: readonly string[] | undefined,
): Figure {
  if (!extra?.length || !figure.interaction) {
    return figure;
  }
  const seen = new Set(figure.interaction.handles);
  const handles = [...figure.interaction.handles];
  for (const id of extra) {
    if (!seen.has(id)) {
      seen.add(id);
      handles.push(id);
    }
  }
  return {
    ...figure,
    interaction: { ...figure.interaction, handles },
  };
}

function loadFigure(
  doc: Document,
  figureId: string,
  registry: Registry,
):
  | {
      figure: Figure;
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
