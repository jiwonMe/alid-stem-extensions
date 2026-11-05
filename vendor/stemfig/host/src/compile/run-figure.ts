/**
 * figure 한 개를 엔진에 통과시킨다. resolvePlugin → specSchema → init → compile.
 * compileDocument 와 checkDocument 가 이 한 함수를 써서 같은 figure 를 같은 이유로 실패시킨다.
 * kind 문자열로 분기하지 않는다. throw 하지 않는다. 실패는 어느 단계였는지만 돌려준다.
 */
import { DEFAULT_STYLE, type DisplayItem, type ResolvedStyle } from "@stemfig/display";
import type { ZodIssue } from "zod";
import type { Figure } from "../envelope/node.ts";
import type { CompileCtx, StemfigPlugin } from "../plugin/plugin.ts";
import { resolvePlugin, type Registry } from "../plugin/registry.ts";

/**
 * 한 figure 의 결과.
 * plugin: 문서 plugins 와 레지스트리로 엔진을 못 찾음 (미설치 박스).
 * spec: specSchema 가 거절 (SPEC 박스). issues 는 spec 기준 경로.
 * engine: init 이나 compile 이 throw (그 오류의 코드로 박스). error 는 던진 값 그대로.
 */
export type FigureRun =
  | { ok: true; plugin: StemfigPlugin; spec: unknown; items: DisplayItem[] }
  | { ok: false; stage: "plugin" }
  | { ok: false; stage: "spec"; plugin: StemfigPlugin; issues: ZodIssue[] }
  | { ok: false; stage: "engine"; plugin: StemfigPlugin; spec: unknown; error: unknown };

/**
 * @param figure 검증된 봉투의 figure
 * @param plugins document.plugins
 * @param registry 앱이 채운 엔진 표
 * @returns 성공이면 플러그인 아이템. 크롬·clip 은 호출 측이 붙인다
 */
export function runFigure(figure: Figure, plugins: string[], registry: Registry): FigureRun {
  const plugin = resolvePlugin(figure.kind, plugins, registry);
  if (!plugin) {
    return { ok: false, stage: "plugin" };
  }
  const parsed = plugin.specSchema.safeParse(figure.spec);
  if (!parsed.success) {
    return { ok: false, stage: "spec", plugin, issues: parsed.error.issues };
  }
  try {
    const state = plugin.init(parsed.data);
    return { ok: true, plugin, spec: parsed.data, items: plugin.compile(figureCtx(figure), state) };
  } catch (error) {
    return { ok: false, stage: "engine", plugin, spec: parsed.data, error };
  }
}

/**
 * 플러그인에 넘기는 유일한 그리기 문맥. Editor·Grida 를 넣지 말 것.
 * mmToPage 는 frame 로컬 mm → 페이지 mm.
 */
export function figureCtx(figure: Figure): CompileCtx {
  return {
    frame: figure.frame,
    view: figure.view,
    mmToPage: (x, y) => [figure.frame.x + x, figure.frame.y + y],
    style: figureInk(figure),
  };
}

/**
 * kind 를 보지 않는다. 잉크만 덮는다.
 */
export function figureInk(figure: Figure): ResolvedStyle {
  if (!figure.color) {
    return DEFAULT_STYLE;
  }
  return { ...DEFAULT_STYLE, stroke: figure.color, textFill: figure.color };
}
