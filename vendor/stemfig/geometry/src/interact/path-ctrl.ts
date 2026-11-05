/**
 * path 제어점 hit / apply / anchors / fields.
 * d 는 절대 M L C Q A Z 로 정규화해 다시 쓴다.
 */
import type { ApplyCtx, HandleAnchor, HandlePatch, InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { parseD, serializeD } from "../math/svg-path.ts";
import {
  listArms,
  listControls,
  moveControl,
  parsePathHandle,
  pathHandleId,
} from "../path-handle.ts";
import { viewDelta } from "./view-map.ts";

/** 점 원과 같은 반경. */
const HIT_CTRL_MM = 1.1;

/**
 * 제어점이 스트로크보다 먼저.
 */
export function nearestPathCtrl(
  state: GeometryState,
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
): string | null {
  let best: { id: string; d: number } | null = null;
  for (const obj of state.spec.objects) {
    if (obj.def[0] !== "path") {
      continue;
    }
    const segs = safeSegs(obj.def[1]);
    if (!segs) {
      continue;
    }
    for (const ctrl of listControls(segs)) {
      const [x, y] = toLocal(ctrl.x, ctrl.y);
      const d = Math.hypot(local[0] - x, local[1] - y);
      if (d <= HIT_CTRL_MM && (!best || d < best.d)) {
        best = { id: pathHandleId(obj.id, ctrl.index), d };
      }
    }
  }
  return best?.id ?? null;
}

/**
 * 제어점 + 팔. path 가 깨지면 빈 배열.
 */
export function pathCtrlAnchors(
  state: GeometryState,
  toPage: (x: number, y: number) => [number, number],
): HandleAnchor[] {
  const out: HandleAnchor[] = [];
  for (const obj of state.spec.objects) {
    if (obj.def[0] !== "path") {
      continue;
    }
    const segs = safeSegs(obj.def[1]);
    if (!segs) {
      continue;
    }
    for (const arm of listArms(segs)) {
      const [x1, y1] = toPage(arm.x1, arm.y1);
      const [x2, y2] = toPage(arm.x2, arm.y2);
      out.push({
        id: obj.id,
        kind: "line",
        x1_mm: x1,
        y1_mm: y1,
        x2_mm: x2,
        y2_mm: y2,
        knobs: false,
      });
    }
    for (const ctrl of listControls(segs)) {
      const [x_mm, y_mm] = toPage(ctrl.x, ctrl.y);
      out.push({
        id: pathHandleId(obj.id, ctrl.index),
        kind: "point",
        x_mm,
        y_mm,
      });
    }
  }
  return out;
}

/**
 * 해당 좌표에 viewDelta. 상대 d 는 절대·6자리로 정규화된다.
 */
export function applyPathHandle(
  ctx: ApplyCtx,
  state: GeometryState,
  patch: HandlePatch,
): GeometryState | undefined {
  const parsed = parsePathHandle(patch.id);
  if (!parsed) {
    return undefined;
  }
  const obj = state.byId.get(parsed.id);
  if (!obj || obj.def[0] !== "path") {
    return state;
  }
  const segs = safeSegs(obj.def[1]);
  const at = segs ? listControls(segs).find((c) => c.index === parsed.index) : undefined;
  if (!segs || !at) {
    return state;
  }
  const delta = viewDelta(ctx.view, ctx.frame, patch.dx_mm, patch.dy_mm);
  const next = moveControl(segs, parsed.index, at.x + delta.x, at.y + delta.y);
  return initGeometry(setPathD(state.spec, parsed.id, serializeD(next)));
}

/**
 * p:cN 절대 좌표. 손잡이가 아니면 undefined.
 */
export function applyPathHandleField(
  state: GeometryState,
  patch: { id: string; key: string; value: number | string | boolean },
): GeometryState | undefined {
  const parsed = parsePathHandle(patch.id);
  if (!parsed || (patch.key !== "x" && patch.key !== "y")) {
    return undefined;
  }
  if (typeof patch.value !== "number") {
    return state;
  }
  const obj = state.byId.get(parsed.id);
  if (!obj || obj.def[0] !== "path") {
    return state;
  }
  const segs = safeSegs(obj.def[1]);
  const at = segs ? listControls(segs).find((c) => c.index === parsed.index) : undefined;
  if (!segs || !at) {
    return state;
  }
  const x = patch.key === "x" ? patch.value : at.x;
  const y = patch.key === "y" ? patch.value : at.y;
  return initGeometry(setPathD(state.spec, parsed.id, serializeD(moveControl(segs, parsed.index, x, y))));
}

/**
 * p:c3 포커스. X/Y 만.
 */
export function fieldsPathHandle(
  state: GeometryState,
  focus: string,
): InspectField[] | undefined {
  const parsed = parsePathHandle(focus);
  if (!parsed) {
    return undefined;
  }
  const obj = state.byId.get(parsed.id);
  if (!obj || obj.def[0] !== "path") {
    return [];
  }
  const segs = safeSegs(obj.def[1]);
  const at = segs ? listControls(segs).find((c) => c.index === parsed.index) : undefined;
  if (!at) {
    return [];
  }
  return [
    { key: "x", label: "X", type: "number", value: at.x, step: 0.1 },
    { key: "y", label: "Y", type: "number", value: at.y, step: 0.1 },
  ];
}

function safeSegs(d: string) {
  try {
    return parseD(d, "d");
  } catch {
    return undefined;
  }
}

function setPathD(
  spec: GeometryState["spec"],
  id: string,
  d: string,
): GeometryState["spec"] {
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id && obj.def[0] === "path" ? { ...obj, def: ["path", d] } : obj,
    ),
  };
}
