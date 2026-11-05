/**
 * 문서 → DisplayList.
 * kind 문자열 리터럴로 분기하지 않는다. resolvePlugin 만 사용.
 * 이미 검증된 Document 만 받는다. 여기서 봉투를 파싱하거나 SCHEMA 를 던지지 않는다.
 * figure 실패는 throw 가 아니라 박스.
 * grid/axes 는 봉투 크롬. kind 분기 없이 플러그인 아이템 앞에 붙인다.
 * 접기: window(view) → chrome → body(plugin) → clip 선언.
 * clipItems 는 부르지 않는다. 좌표 자르기는 renderSvg 한 곳.
 * 플러그인이 창을 채워 그리고, 호스트는 상자 밖을 버리라고만 선언한다.
 */
import {
  compileChrome,
  intersectFrames,
  latexEngineFromDoc,
  setLatexEngine,
  type DisplayItem,
  type DisplayList,
  type DisplaySheet,
  type Frame,
} from "@stemfig/display";
import { isFrameNode, type Figure, type FrameNode } from "../envelope/node.ts";
import type { Document } from "../envelope/document.ts";
import { StemfigValidationError, type StemfigErrorCode } from "../envelope/errors.ts";
import { indexNodes, rootFrames, type NodeIndex } from "../envelope/tree.ts";
import { figureErrorBox, missingPluginBox } from "./placeholder.ts";
import type { Registry } from "../plugin/registry.ts";
import { figureInk, runFigure } from "./run-figure.ts";

/**
 * 문서 하나를 도는 동안 바뀌지 않는 것.
 * 트리 조회표를 figure 마다 다시 만들지 않으려고 들고 다닌다.
 */
type CompileRun = {
  doc: Document;
  index: NodeIndex;
  registry: Registry;
};

/**
 * @param doc parseDocument 를 통과한 봉투
 * @param registry 앱이 채운 엔진 표. 비어 있으면 모든 figure 가 미설치 박스
 * @returns 캔버스 크기, 시트 상자들, figure 별 group. throw 하지 않는다
 */
export function compileDocument(
  doc: Document,
  registry: Registry,
): DisplayList {
  setLatexEngine(latexEngineFromDoc(doc.latex));
  const run: CompileRun = { doc, index: indexNodes(doc), registry };
  const frames = rootFrames(doc).map(displaySheet);
  const size = canvasSize(frames);
  return {
    width_mm: size.w,
    height_mm: size.h,
    frames,
    items: run.index.figures.map((figure) => compileFigure(figure, run)),
  };
}

/**
 * 최상위 프레임을 전부 덮는 크기. 원점은 (0,0) 고정이다.
 * bbox 원점으로 옮기면 프레임을 옮길 때마다 카메라가 튄다.
 * @param frames 최상위 프레임 상자들. 비면 0x0
 */
function canvasSize(frames: Frame[]): { w: number; h: number } {
  return frames.reduce(
    (size, frame) => ({
      w: Math.max(size.w, frame.x + frame.w),
      h: Math.max(size.h, frame.y + frame.h),
    }),
    { w: 0, h: 0 },
  );
}

/**
 * 엔진 단계는 runFigure 한 곳. checkDocument 가 같은 판정으로 오류 경로를 낸다.
 * 여기서는 결과를 박스나 group 으로 바꾸고 크롬·clip 만 붙인다.
 */
function compileFigure(figure: Figure, run: CompileRun): DisplayItem {
  const chrome = figureChrome(figure);
  const result = runFigure(figure, run.doc.plugins, run.registry);
  const body: DisplayItem = result.ok
    ? { op: "group", items: result.items }
    : result.stage === "plugin"
      ? missingPluginBox(figure.frame, figure.kind)
      : figureErrorBox(figure.frame, result.stage === "spec" ? "SPEC" : errorCode(result.error));
  return attachClip(withChrome(chrome, body), figure, run);
}

/**
 * 격자·축은 봉투. 플러그인 아이템보다 아래.
 */
function figureChrome(figure: Figure): DisplayItem[] {
  return compileChrome({
    view: figure.view,
    frame: figure.frame,
    style: figureInk(figure),
    grid: figure.grid,
    axes: figure.axes,
  });
}

function withChrome(chrome: DisplayItem[], body: DisplayItem): DisplayItem {
  const items = body.op === "group" ? body.items : [body];
  return { op: "group", items: [...chrome, ...items] };
}

/**
 * clip 상자만 선언한다. 아이템 좌표는 그대로.
 * 시트와 겹치는 부분만. 중첩 프레임을 누적하지 않는다.
 * 교과 clip 을 호스트에 넣지 말 것. 무한직선은 플러그인이 창을 채운다.
 */
function attachClip(
  item: DisplayItem,
  figure: Figure,
  run: CompileRun,
): DisplayItem {
  const parent = parentFrame(figure, run);
  const clip = parent
    ? intersectFrames(figure.frame, parent)
    : figure.frame;
  if (!clip) {
    return { op: "group", items: [] };
  }
  const items = item.op === "group" ? item.items : [item];
  return { op: "group", clip, items };
}

/** 부모 FrameNode 의 상자. root 소속이면 undefined. */
function parentFrame(figure: Figure, run: CompileRun): Frame | undefined {
  const parent = run.index.byId.get(figure.id)?.parent;
  if (parent === null || parent === undefined) {
    return undefined;
  }
  const node = run.index.byId.get(parent)?.node;
  return node && isFrameNode(node) ? node.frame : undefined;
}

/**
 * 시트 속만. clip 상자에는 fill 을 넣지 않는다.
 */
function displaySheet(node: FrameNode): DisplaySheet {
  return node.color ? { ...node.frame, fill: node.color } : node.frame;
}

/**
 * 오류 박스는 코드만 그린다. 플러그인이 준 path 는 어디에도 실리지 않으므로
 * 여기서 트리 경로를 붙이지 않는다.
 */
function errorCode(error: unknown): StemfigErrorCode {
  if (error instanceof StemfigValidationError && error.errors[0]) {
    return error.errors[0].code;
  }
  return "SPEC";
}
