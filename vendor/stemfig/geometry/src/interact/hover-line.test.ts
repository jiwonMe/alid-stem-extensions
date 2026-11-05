/**
 * 무한직선 호버. 끝점이 파생이어도 히트·앵커.
 * clip 끝 노브는 앱 HUD 가 knobs: false 로 뺀다.
 */
import { describe, expect, it } from "vitest";
import { hitFigure, listAnchors } from "@stemfig/host";
import { fixtureDoc, pageAt, registry } from "./test-harness.ts";

describe("hover infinite line", () => {
  it("lists am and bm without endpoint knobs", () => {
    const anchors = listAnchors(fixtureDoc, "tri", registry());
    const am = anchors.find((item) => item.id === "am");
    const bm = anchors.find((item) => item.id === "bm");
    expect(am).toMatchObject({ kind: "line", knobs: false });
    expect(bm).toMatchObject({ kind: "line", knobs: false });
  });

  it("hits am at the A–MA midpoint, not A/MA/G", () => {
    const [x, y] = pageAt(fixtureDoc, 1.3, 0.75);
    expect(hitFigure(fixtureDoc, "tri", x, y, registry())).toBe("am");
  });

  it("hits am beyond the A–MA segment", () => {
    /* A(0,0)→MA(2.6,1.5) 반대. 점 히트 반경 밖. */
    const [x, y] = pageAt(fixtureDoc, -0.26, -0.15);
    expect(hitFigure(fixtureDoc, "tri", x, y, registry())).toBe("am");
  });
});
