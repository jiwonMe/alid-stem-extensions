/**
 * @stemfig/host public API.
 * 교과 스펙 타입을 export 하지 않는다. GeometrySpec 은 플러그인 패키지에 있다.
 * 파싱은 parseDocument 한 곳뿐이다. 나머지는 전부 검증된 Document 를 주고받는다.
 */

/* envelope — 봉투 타입, 파서, 트리 조회 */
export { SCHEMA_ID, parseDocument } from "./envelope/document.ts";
export type { Document } from "./envelope/document.ts";
export type { LatexEngine } from "@stemfig/display";
export { isFigure, isFrameNode } from "./envelope/node.ts";
export type {
  Figure,
  FrameNode,
  Node,
  ParentRef,
  StemfigNode,
} from "./envelope/node.ts";
export type { Axes, Axis, Frame, Grid, Ticks, View } from "@stemfig/display";
export {
  figuresOf,
  findNode,
  indexNodes,
  mapFigure,
  mapNode,
  offsetNode,
  moveNode,
  orderNode,
  removeNode,
  parentOf,
  reparent,
  rootFrames,
  walk,
} from "./envelope/tree.ts";
export type { NodeIndex, Walked } from "./envelope/tree.ts";
export { sliceEnvelope, unionFrames } from "./envelope/slice.ts";
export { isNodeLocked, setNodeLocked, hasLockedSubtree } from "./envelope/lock.ts";
export type { EnvelopeSlice } from "./envelope/slice.ts";
export {
  StemfigValidationError,
  stemfigError,
} from "./envelope/errors.ts";
export type { StemfigError, StemfigErrorCode } from "./envelope/errors.ts";

/* plugin — 엔진 소켓과 레지스트리 */
export type {
  AnchorsCtx,
  ApplyCtx,
  CompileCtx,
  FieldPatch,
  FieldsCtx,
  FigureTool,
  HandleAnchor,
  HandleId,
  HandlePatch,
  HitCtx,
  InspectField,
  LayerItem,
  PlaceCtx,
  PlaceResult,
  SnapCtx,
  SnapHit,
  StemfigPlugin,
  RemoveResult,
  ToolGuidance,
} from "./plugin/plugin.ts";
export { removeHandles, cancelPlacement, finishPlacement, toolGuidance, validateField } from "./edit/plugin-actions.ts";
export { Registry } from "./plugin/registry.ts";

/* compile — DisplayList */
export { compileDocument } from "./compile/compile.ts";

/* check — 오류 박스 뒤의 이유와 문서 경로, 손으로 쓸 때 보는 문법 */
export { checkDocument } from "./check/check.ts";
export { checkEnvelopeKeys } from "./check/warnings.ts";
export type { Diagnostic, StemfigWarningCode } from "./check/diagnostic.ts";
export { envelopeGrammar, specGrammar } from "./check/grammar.ts";

/* edit — 손잡이와 배치 */
export {
  applyFigure,
  hitFigure,
  listAnchors,
  placeFigure,
  previewFigure,
  snapFigure,
} from "./edit/interact.ts";
export { listFields, patchField } from "./edit/fields.ts";
export { listLayers } from "./edit/layers.ts";
export { setNodeFrame } from "./edit/node-frame.ts";
export { defaultFigureView, setNodeView } from "./edit/node-view.ts";
export { setNodeAxes, setNodeGrid } from "./edit/node-chrome.ts";
export { setNodeColor } from "./edit/node-color.ts";
export { setDocumentColor } from "./edit/document-color.ts";
export { isFigureSeparator, listTools } from "./edit/tools.ts";
export { translateNodes } from "./edit/translate.ts";
export { insertFigure, insertFrame, nextFigureId, nextFrameId } from "./edit/insert.ts";
export {
  frameTitle,
  nextFrameName,
  nodeTitle,
  renameFrame,
  renameNode,
} from "./edit/frame-name.ts";
export { containerAt, frameCenter, updateFigure } from "./edit/placement.ts";
