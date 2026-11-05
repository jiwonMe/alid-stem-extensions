/**
 * 포물선은 세 클릭이고 Shift 는 발사각을 15° 격자에 맞춘다.
 * 클릭은 페이지 mm, 저장 각도는 장면 도다.
 */
import { describe, expect, it } from "vitest";
import type { PlaceCtx } from "@stemfig/host";
import { initMechanics } from "../init.ts";
import { placeMechanics } from "./place.ts";

const frame = { x: 0, y: 0, w: 100, h: 100 };
const view = { xmin: 0, xmax: 10, ymin: 0, ymax: 10 };

function click(tool: string, x: number, y: number, constrain = false): PlaceCtx {
  return { frame, view, tool, x_mm: x * 10, y_mm: (10 - y) * 10, constrain };
}

describe("trajectory placement", () => {
  it("stores a 60 degree launch when Shift snaps a nearby aim", () => {
    const start = placeMechanics(click("trajectory", 1, 1), initMechanics({ objects: [] }))!;
    const aimed = placeMechanics(click("trajectory", 2, 2.6, true), start.state)!;
    const done = placeMechanics(click("trajectory", 5, 1, true), aimed.state)!;
    const object = done.state.spec.objects[0];
    expect(object).toMatchObject({ type: "trajectory", angle: 60, dashed: true, arrows: [0.35] });
    expect(done.state.curves.get(object!.id)?.a).toEqual([1, 1]);
    expect(done.state.curves.get(object!.id)?.b[0]).toBeCloseTo(5);
  });
});
