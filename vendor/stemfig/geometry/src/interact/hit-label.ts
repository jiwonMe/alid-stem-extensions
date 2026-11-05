/**
 * 점 라벨 히트. 점·마크가 이긴 뒤.
 * id 는 A:label. 점 A 와 같으면 apply 가 점을 민다.
 * show: false 면 글자만 빼다. 점 마크 히트는 hit.ts.
 * 글자 위가 선에 먹히지 않게 스트로크보다 앞선다.
 */
import { DEFAULT_STYLE } from "@stemfig/display";
import type { HandleId } from "@stemfig/host";
import { labelHandleId } from "../label-handle.ts";
import { labelHitBox, labelOffsetMm } from "../label-pos.ts";
import type { GeometryState } from "../init.ts";
import { isShown } from "../schema.ts";
import { pointRole } from "./free.ts";

/** 상자 밖 여유. 점 HIT_POINT_MM 보다 약하다. */
const HIT_LABEL_PAD_MM = 0.6;

/**
 * @param toLocal 수학 → 로컬 mm
 * @param local 포인터 로컬 mm
 * @param allowed figure.interaction.handles. null 이면 잠금 없음
 * @returns 상자 안 라벨의 A:label. 숨기거나 없으면 null
 */
export function nearestLabel(
  state: GeometryState,
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
  allowed: Set<string> | null,
): HandleId | null {
  let best: { id: string; d: number } | null = null;
  for (const obj of state.spec.objects) {
    if (
      !obj.label ||
      !isShown(obj) ||
      !pointRole(state, obj.id, allowed).hover
    ) {
      continue;
    }
    const pt = state.points.get(obj.id);
    if (!pt) {
      continue;
    }
    const size = obj.labelSize ?? DEFAULT_STYLE.textSize;
    const [px, py] = toLocal(pt.x, pt.y);
    const [dx, dy] = labelOffsetMm(
      obj.labelAngle,
      obj.label,
      size,
      obj.labelDistance,
    );
    const box = labelHitBox(obj.label, size);
    const d = distToRect(
      local,
      px + dx + box.x - HIT_LABEL_PAD_MM,
      py + dy + box.y - HIT_LABEL_PAD_MM,
      box.w + HIT_LABEL_PAD_MM * 2,
      box.h + HIT_LABEL_PAD_MM * 2,
    );
    if (d <= HIT_LABEL_PAD_MM && (!best || d < best.d)) {
      best = { id: labelHandleId(obj.id), d };
    }
  }
  return best?.id ?? null;
}

function distToRect(
  p: [number, number],
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const dx = Math.max(x - p[0], 0, p[0] - (x + w));
  const dy = Math.max(y - p[1], 0, p[1] - (y + h));
  return Math.hypot(dx, dy);
}
