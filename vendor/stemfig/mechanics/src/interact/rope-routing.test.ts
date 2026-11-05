/** 실의 캔버스 경유 선택과 명시적 경로 완료를 실제 좌표로 검증한다. */
import { toPage } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import { initMechanics } from "../init.ts";
import type { Pulley, Vec } from "../schema.ts";
import { placeMechanics, finishMechanics, guidanceMechanics } from "./place.ts";
import { previewMechanics } from "./preview.ts";
import { pulleyAt, shortestWrap } from "./rope-routing.ts";
import { ropePoints } from "../apparatus-geometry.ts";
const ctx = { frame: { x: 0, y: 0, w: 100, h: 100 }, view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 } };
const wheel: Pulley = { id: "wheel", type: "pulley", center: [5, 6], radius: 1 };
const initial = initMechanics({ objects: [wheel] });
function at(tool: string, point: Vec, unsnap = false): PlaceCtx {
  const [x_mm, y_mm] = toPage(ctx.view, ctx.frame)(...point);
  return { ...ctx, tool, x_mm, y_mm, unsnap, px_per_mm: 4 };
}
const length = (points: Vec[]) => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index]![0], point[1] - points[index]![1]), 0);

describe("캔버스에서 실 경유 선택", () => {
  it("시작→원주→끝의 세 클릭으로 짧은 방향의 실을 만들고 ghost는 저장하지 않는다", () => {
    const start = placeMechanics(at("rope", [1, 2]), initial)!.state;
    const before = JSON.stringify(start.spec);
    expect(previewMechanics(at("rope", [5, 7]), start).length).toBeGreaterThan(1);
    expect(previewMechanics(at("rope", [5 + Math.cos(0.31), 6 + Math.sin(0.31)]), start).some(item => item.op === "polyline")).toBe(true);
    expect(JSON.stringify(start.spec)).toBe(before);
    const via = placeMechanics(at("rope", [5, 7]), start)!;
    expect(via.handles).toBeUndefined();
    expect(via.state.spec.draft?.pulley).toBe("wheel");
    expect(guidanceMechanics({ tool: "rope" }, via.state)?.message).toContain("바깥");
    expect(previewMechanics(at("rope", [9, 2]), via.state).length).toBeGreaterThan(1);
    const done = placeMechanics(at("rope", [9, 2]), via.state)!;
    expect(done.handles).toEqual(["rope1"]);
    expect(done.state.byId.get("rope1")).toMatchObject({ pulley: "wheel", wrap: shortestWrap([1, 2], [9, 2], wheel) });
    expect(done.state.spec.draft).toBeUndefined();
    expect(length(done.state.paths.get("rope1")!)).toBeCloseTo(Math.min(length(ropePoints([1, 2], [9, 2], "cw", wheel)), length(ropePoints([1, 2], [9, 2], "ccw", wheel))));
  });

  it("Alt로 원주를 클릭하면 직선으로 끝내고 중심이나 숨은 바퀴는 경유 후보가 아니다", () => {
    const start = placeMechanics(at("rope", [1, 2]), initial)!.state;
    const done = placeMechanics(at("rope", [5, 7], true), start)!;
    expect(done.state.byId.get("rope1")).not.toHaveProperty("pulley");
    expect(done.state.paths.get("rope1")).toEqual([[1, 2], [5, 7]]);
    expect(pulleyAt(at("rope", [5, 6]), initial)).toBeUndefined();
    expect(pulleyAt(at("rope", [5, 7]), initMechanics({ objects: [{ ...wheel, show: false }] }))).toBeUndefined();
  });

  it("경유 선택 후 원 안의 끝점은 거절하고 작도를 계속할 수 있다", () => {
    const start = placeMechanics(at("rope", [1, 2]), initial)!.state;
    const via = placeMechanics(at("rope", [5, 7]), start)!.state;
    expect(placeMechanics(at("rope", [5, 6]), via)?.state).toBe(via);
    expect(placeMechanics(at("rope", [9, 2]), via)?.handles).toEqual(["rope1"]);
  });

  it("꼭짓점 두 개부터 명시적으로 완료할 수 있고 클릭을 더 추가하지 않는다", () => {
    const start = placeMechanics(at("track", [1, 2]), initial)!.state;
    expect(guidanceMechanics({ tool: "track" }, start)?.canFinish).toBe(false);
    expect(finishMechanics({ ...ctx, tool: "track" }, start)).toBeUndefined();
    const next = placeMechanics(at("track", [9, 2]), start)!.state;
    expect(guidanceMechanics({ tool: "track" }, next)?.canFinish).toBe(true);
    const done = finishMechanics({ ...ctx, tool: "track" }, next)!;
    expect(done.state.byId.get("track1")).toMatchObject({ points: [[1, 2], [9, 2]] });
    expect(done.state.spec.draft).toBeUndefined();
  });
});
