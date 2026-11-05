/**
 * path 제어점 손잡이. A:label 과 같은 접미 규칙.
 * 호스트는 suffix 를 모른다. hit / apply / fields 만 해석한다.
 */
import type { BezierSeg } from "./math/bezier.ts";

/** path id 뒤에 붙인다. */
export const PATH_HANDLE_PREFIX = ":c";

export type PathCtrl = {
  index: number;
  x: number;
  y: number;
  role: "anchor" | "handle";
};

export type PathArm = { x1: number; y1: number; x2: number; y2: number };

/**
 * @param ownerId path 객체 id
 * @param index listControls 순서
 */
export function pathHandleId(ownerId: string, index: number): string {
  return `${ownerId}${PATH_HANDLE_PREFIX}${index}`;
}

/**
 * @returns { id, index }. suffix 가 아니면 undefined
 */
export function parsePathHandle(
  handleId: string,
): { id: string; index: number } | undefined {
  const at = handleId.lastIndexOf(PATH_HANDLE_PREFIX);
  if (at <= 0) {
    return undefined;
  }
  const id = handleId.slice(0, at);
  const index = Number(handleId.slice(at + PATH_HANDLE_PREFIX.length));
  if (!id || !Number.isInteger(index) || index < 0) {
    return undefined;
  }
  return { id, index };
}

/**
 * 세그먼트 위 드래그 점. Z 는 없다.
 */
export function listControls(segs: readonly BezierSeg[]): PathCtrl[] {
  const out: PathCtrl[] = [];
  let i = 0;
  for (const seg of segs) {
    if (seg.op === "M" || seg.op === "L") {
      out.push({ index: i, x: seg.x, y: seg.y, role: "anchor" });
      i += 1;
    } else if (seg.op === "C") {
      out.push({ index: i, x: seg.x1, y: seg.y1, role: "handle" });
      out.push({ index: i + 1, x: seg.x2, y: seg.y2, role: "handle" });
      out.push({ index: i + 2, x: seg.x, y: seg.y, role: "anchor" });
      i += 3;
    } else if (seg.op === "Q") {
      out.push({ index: i, x: seg.x1, y: seg.y1, role: "handle" });
      out.push({ index: i + 1, x: seg.x, y: seg.y, role: "anchor" });
      i += 2;
    } else if (seg.op === "A") {
      out.push({ index: i, x: seg.x, y: seg.y, role: "anchor" });
      i += 1;
    }
  }
  return out;
}

/**
 * 제어 팔. knobs 없는 HUD 선.
 */
export function listArms(segs: readonly BezierSeg[]): PathArm[] {
  const out: PathArm[] = [];
  let from: { x: number; y: number } | undefined;
  for (const seg of segs) {
    if (seg.op === "M") {
      from = { x: seg.x, y: seg.y };
      continue;
    }
    if (!from) {
      continue;
    }
    if (seg.op === "C") {
      out.push({ x1: from.x, y1: from.y, x2: seg.x1, y2: seg.y1 });
      out.push({ x1: seg.x, y1: seg.y, x2: seg.x2, y2: seg.y2 });
    } else if (seg.op === "Q") {
      out.push({ x1: from.x, y1: from.y, x2: seg.x1, y2: seg.y1 });
      out.push({ x1: seg.x, y1: seg.y, x2: seg.x1, y2: seg.y1 });
    }
    if (seg.op !== "Z") {
      from = { x: seg.x, y: seg.y };
    }
  }
  return out;
}

/**
 * index 점 좌표를 바꾼다. 없으면 segs 그대로.
 */
export function moveControl(
  segs: BezierSeg[],
  index: number,
  x: number,
  y: number,
): BezierSeg[] {
  let i = 0;
  return segs.map((seg) => {
    if (seg.op === "M" || seg.op === "L" || seg.op === "A") {
      const hit = i === index;
      i += 1;
      return hit ? { ...seg, x, y } : seg;
    }
    if (seg.op === "C") {
      const next = { ...seg };
      if (i === index) {
        next.x1 = x;
        next.y1 = y;
      } else if (i + 1 === index) {
        next.x2 = x;
        next.y2 = y;
      } else if (i + 2 === index) {
        next.x = x;
        next.y = y;
      }
      i += 3;
      return next;
    }
    if (seg.op === "Q") {
      const next = { ...seg };
      if (i === index) {
        next.x1 = x;
        next.y1 = y;
      } else if (i + 1 === index) {
        next.x = x;
        next.y = y;
      }
      i += 2;
      return next;
    }
    return seg;
  });
}
