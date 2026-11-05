/**
 * 변 호 라벨 히트. 점보다 뒤, 마크 스트로크보다 앞.
 * 글자가 호에 먹히지 않게. id 는 k:label.
 */
import { DEFAULT_STYLE } from "@stemfig/display";
import type { HandleId } from "@stemfig/host";
import {
  arcLabelBaselineAt,
  bowApex,
} from "../arc-label-pos.ts";
import { labelHandleId } from "../label-handle.ts";
import { labelHitBox } from "../label-pos.ts";
import { segmentBow } from "../seg-label-arc.ts";
import type { GeometryState } from "../init.ts";

const HIT_LABEL_PAD_MM = 0.6;

/**
 * @param toLocal 수학 → 로컬 mm
 * @param local 포인터 로컬 mm
 * @returns 상자 안 호 라벨 id. 없으면 null
 */
export function nearestAnnotLabel(
  state: GeometryState,
  toLocal: (x: number, y: number) => [number, number],
  local: [number, number],
): HandleId | null {
  let best: { id: string; d: number } | null = null;
  for (const mark of state.spec.marks ?? []) {
    if ((mark.style ?? "tick") !== "arc" || !mark.label) {
      continue;
    }
    const a = state.points.get(mark.a);
    const b = state.points.get(mark.b);
    if (!a || !b) {
      continue;
    }
    const [ax, ay] = toLocal(a.x, a.y);
    const [bx, by] = toLocal(b.x, b.y);
    const bow = segmentBow(
      { x: ax, y: ay },
      { x: bx, y: by },
      mark.distance,
      mark.side,
    );
    if (!bow) {
      continue;
    }
    const size = mark.labelSize ?? DEFAULT_STYLE.textSize;
    const base = arcLabelBaselineAt(bowApex(bow), mark.label, size);
    const box = labelHitBox(mark.label, size);
    const d = distToRect(
      local,
      base.x + box.x - HIT_LABEL_PAD_MM,
      base.y + box.y - HIT_LABEL_PAD_MM,
      box.w + HIT_LABEL_PAD_MM * 2,
      box.h + HIT_LABEL_PAD_MM * 2,
    );
    if (d <= HIT_LABEL_PAD_MM && (!best || d < best.d)) {
      best = { id: labelHandleId(mark.id), d };
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
