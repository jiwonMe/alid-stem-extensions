/**
 * 변 호 라벨 손잡이 k:label.
 * 축은 변 법선 거리와 좌우. 각·극좌표가 아니다.
 * 끝점은 안 옮긴다. 호 높이는 라벨과 같이 간다.
 */
import { fitView } from "@stemfig/display";
import type { ApplyCtx, HandlePatch } from "@stemfig/host";
import { bowApex } from "../arc-label-pos.ts";
import { initGeometry, type GeometryState } from "../init.ts";
import { parseLabelHandle } from "../label-handle.ts";
import {
  clampBowDistance,
  segmentBow,
  type BowSide,
} from "../seg-label-arc.ts";
import type { GeometrySpec, SegMark } from "../schema.ts";

const EPS = 1e-9;

/**
 * 호 라벨 손잡이면 새 상태. 점 라벨·모르는 id 는 null.
 * 델타는 꼭짓점에 더하고 변 중점 법선에 투영한다.
 * @returns 새 상태 또는 null
 */
export function applyArcLabelPose(
  ctx: ApplyCtx,
  state: GeometryState,
  patch: HandlePatch,
): GeometryState | null {
  const markId = parseLabelHandle(patch.id);
  if (!markId) {
    return null;
  }
  const mark = state.spec.marks?.find((item) => item.id === markId);
  if (!mark || (mark.style ?? "tick") !== "arc" || !mark.label) {
    return null;
  }
  const a = state.points.get(mark.a);
  const b = state.points.get(mark.b);
  if (!a || !b) {
    return state;
  }
  const { toLocal } = fitView(ctx.view, ctx.frame);
  const [ax, ay] = toLocal(a.x, a.y);
  const [bx, by] = toLocal(b.x, b.y);
  const ux = bx - ax;
  const uy = by - ay;
  const len = Math.hypot(ux, uy);
  if (len < EPS) {
    return state;
  }
  const lx = -uy / len;
  const ly = ux / len;
  const bow = segmentBow(
    { x: ax, y: ay },
    { x: bx, y: by },
    mark.distance,
    mark.side,
  );
  if (!bow) {
    return state;
  }
  const apex = bowApex(bow);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const signed =
    (apex.x + patch.dx_mm - mx) * lx + (apex.y + patch.dy_mm - my) * ly;
  const side: BowSide = signed < 0 ? "right" : "left";
  return initGeometry(
    setMarkBow(state.spec, mark, side, clampBowDistance(Math.abs(signed))),
  );
}

function setMarkBow(
  spec: GeometrySpec,
  mark: SegMark,
  side: BowSide,
  distance: number,
): GeometrySpec {
  const next: SegMark = { ...mark, side, distance };
  return {
    ...spec,
    marks: (spec.marks ?? []).map((item) =>
      item.id === mark.id ? next : item,
    ),
  };
}
