/**
 * 라벨 손잡이 A:label. 점은 안 옮긴다.
 * 델타를 상자 중심에 더해 각·거리를 다시 잰다.
 * 페이지 mm 델타 = 로컬 평행이동. viewDelta 를 쓰지 말 것.
 */
import { DEFAULT_STYLE, fitView } from "@stemfig/display";
import type { ApplyCtx, HandlePatch } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { parseLabelHandle } from "../label-handle.ts";
import {
  LABEL_ANGLE_DEFAULT,
  labelHitBox,
  labelOffsetMm,
  labelPoseFromOffset,
} from "../label-pos.ts";
import type { GeometrySpec } from "../schema.ts";
import { applyArcLabelPose } from "./apply-arc-label.ts";

/**
 * 글자 손잡이면 새 상태. 아니면 null 이라 apply 가 점 경로로 간다.
 * 점·라벨이 없으면 입력을 그대로. 호 라벨은 변 거리·좌우.
 * @returns 새 상태 또는 null
 */
export function applyLabelPose(
  ctx: ApplyCtx,
  state: GeometryState,
  patch: HandlePatch,
): GeometryState | null {
  const posed = applyArcLabelPose(ctx, state, patch);
  if (posed) {
    return posed;
  }
  const pointId = parseLabelHandle(patch.id);
  if (!pointId) {
    return null;
  }
  const obj = state.byId.get(pointId);
  const pt = state.points.get(pointId);
  if (!obj?.label || !pt) {
    return state;
  }
  const { toLocal } = fitView(ctx.view, ctx.frame);
  const [px, py] = toLocal(pt.x, pt.y);
  const size = obj.labelSize ?? DEFAULT_STYLE.textSize;
  const [ldx, ldy] = labelOffsetMm(
    obj.labelAngle,
    obj.label,
    size,
    obj.labelDistance,
  );
  const box = labelHitBox(obj.label, size);
  const cx = px + ldx + box.x + box.w / 2 + patch.dx_mm;
  const cy = py + ldy + box.y + box.h / 2 + patch.dy_mm;
  const vx = cx - px;
  const vy = cy - py;
  const pose = labelPoseFromOffset(vx, vy, box);
  const angle =
    vx === 0 && vy === 0 ? (obj.labelAngle ?? LABEL_ANGLE_DEFAULT) : pose.angle;
  return initGeometry(setLabelPose(state.spec, pointId, angle, pose.distance));
}

function setLabelPose(
  spec: GeometrySpec,
  id: string,
  labelAngle: number,
  labelDistance: number,
): GeometrySpec {
  const angle = Math.min(360, Math.max(0, labelAngle));
  const distance = Math.max(0, labelDistance);
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id ? { ...obj, labelAngle: angle, labelDistance: distance } : obj,
    ),
  };
}
