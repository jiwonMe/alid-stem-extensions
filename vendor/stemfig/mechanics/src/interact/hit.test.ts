/**
 * 보이는 역학 도형과 편집 손잡이의 일치를 검증한다.
 * 페이지 오프셋·회전·라벨 우선순위·허용 목록·자석 해제를 실제 좌표로 확인한다.
 */
import { DEFAULT_STYLE, measureLabelMm } from "@stemfig/display";
import type { AnchorsCtx, HitCtx, SnapCtx } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import { compileMechanics } from "../compile.ts";
import { initMechanics } from "../init.ts";
import type { MechanicsObject } from "../schema.ts";
import { anchorsMechanics, hitMechanics, snapMechanics } from "./hit.ts";

const ctx: AnchorsCtx = { frame: { x: 10, y: 20, w: 100, h: 100 },
  view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  style: DEFAULT_STYLE, mmToPage: (x, y) => [10 + x, 20 + y] };
const block: MechanicsObject = { id: "A", type: "block", width: 4, height: 2,
  pose: { mode: "free", point: [5, 5], angle: 45 } };
function at(x_mm: number, y_mm: number): HitCtx & SnapCtx { return { ...ctx, x_mm, y_mm }; }

describe("mechanics selection", () => {
  it("hits a rotated block interior and closes its HUD outline", () => {
    const state = initMechanics({ objects: [block] });
    expect(hitMechanics(at(53, 63), state)).toBe("A");
    expect(hitMechanics(at(80, 90), state)).toBeNull();
    const outline = anchorsMechanics(ctx, state)[0];
    expect(outline?.kind).toBe("polyline");
    if (outline?.kind !== "polyline") throw new Error("expected block outline");
    expect(outline.points).toHaveLength(5);
    expect(outline.points.at(-1)).toEqual(outline.points[0]);
  });

  it("returns a source vertex id before a nearby rounded track stroke", () => {
    const state = initMechanics({ objects: [{ id: "ramp", type: "track", rounding: 1,
      points: [[1, 1], [4, 1], [7, 4]] }] });
    expect(hitMechanics(at(50, 110), state)).toBe("ramp:point:1");
    expect(hitMechanics(at(30, 110), state)).toBe("ramp");
  });

  it("uses exact rendered text baseline and chooses text before a block", () => {
    const state = initMechanics({ objects: [{ ...block, label: "A", labelOffset: [2, -1] }] });
    const text = compileMechanics(ctx, state).find((item) => item.op === "text")!;
    const anchor = anchorsMechanics(ctx, state).find((item) => item.kind === "text");
    expect(anchor).toMatchObject({ id: "A:label", x_mm: text.x, y_mm: text.y, text: "A", size_mm: text.size, owner: "A" });
    const box = measureLabelMm(text.text, text.size);
    expect(hitMechanics(at(text.x + box.x + box.w / 2, text.y + box.y + box.h / 2), state)).toBe("A:label");
  });

  it("drags a dimension line separately from its source references", () => {
    const state = initMechanics({ objects: [{ id: "height", type: "dimension",
      a: { mode: "free", point: [1, 1] }, b: { mode: "free", point: [1, 7] }, axis: "vertical", offset: 1, label: "h" }] });
    expect(hitMechanics(at(30, 95), state)).toBe("height");
    expect(hitMechanics(at(20, 110), state)).toBe("height:a");
    expect(hitMechanics(at(20, 50), state)).toBe("height:b");
    expect(hitMechanics(at(30, 80), state)).toBe("height:label");
  });

  it("honors exact and owner handle permissions and omits hidden objects", () => {
    const state = initMechanics({ objects: [{ id: "ramp", type: "track", rounding: 0, points: [[1, 1], [7, 1]] },
      { id: "hidden", type: "label", at: { mode: "free", point: [2, 2] }, label: "hidden", show: false }] });
    const limited = { ...ctx, handles: ["ramp:point:0"] };
    expect(anchorsMechanics(limited, state).map((anchor) => anchor.id)).toEqual(["ramp:point:0"]);
    expect(hitMechanics({ ...at(30, 110), handles: limited.handles }, state)).toBeNull();
    expect(hitMechanics({ ...at(20, 110), handles: limited.handles }, state)).toBe("ramp:point:0");
    expect(hitMechanics({ ...at(30, 110), handles: ["ramp"] }, state)).toBe("ramp");
    expect(anchorsMechanics(ctx, state).some((anchor) => anchor.id.startsWith("hidden"))).toBe(false);
    expect(anchorsMechanics({ ...ctx, handles: [] }, state)).toEqual([]);
  });

  it("gives standalone text its root id and keeps its reference as a point", () => {
    const state = initMechanics({ objects: [{ id: "note", type: "label", at: { mode: "free", point: [3, 3] }, label: "F" }] });
    expect(anchorsMechanics(ctx, state).map((anchor) => [anchor.id, anchor.kind])).toEqual([["note:at", "point"], ["note", "text"]]);
    expect(hitMechanics(at(40, 90), state)).toBe("note");
  });
});

describe("mechanics snapping", () => {
  it("returns exact block anchors before paths and respects Alt and owner exclusion", () => {
    const state = initMechanics({ objects: [{ ...block, pose: { mode: "free", point: [5, 5], angle: 0 } }] });
    expect(snapMechanics(at(60.4, 50.5), state)).toEqual({ kind: "point", id: "A", x_mm: 60, y_mm: 50 });
    expect(snapMechanics({ ...at(60, 50), unsnap: true }, state)).toBeUndefined();
    expect(snapMechanics({ ...at(60, 50), exclude: "A:label" }, state)).toBeUndefined();
    expect(snapMechanics(at(100, 100), state)).toBeUndefined();
  });

  it("projects onto a track with screen-scaled radius and excludes dragged vertices", () => {
    const state = initMechanics({ objects: [{ id: "ramp", type: "track", rounding: 0, points: [[1, 1], [7, 1]] }] });
    expect(snapMechanics(at(40, 111), state)).toEqual({ kind: "path", id: "ramp", x_mm: 40, y_mm: 110 });
    expect(snapMechanics({ ...at(40, 111), px_per_mm: 20 }, state)).toBeUndefined();
    expect(snapMechanics({ ...at(40, 110), exclude: "ramp:point:0" }, state)).toBeUndefined();
    expect(snapMechanics({ ...at(40, 110), unsnap: true }, state)).toBeUndefined();
  });
});
