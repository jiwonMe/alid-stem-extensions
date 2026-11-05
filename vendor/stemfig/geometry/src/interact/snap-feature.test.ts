/** 파생 객체 없는 중점·교차점 스냅을 실제 봉투 경계로 검증한다. */
import { describe, expect, it } from "vitest";
import { parseDocument, snapFigure } from "@stemfig/host";
import { fixtureDoc, pageAt, registry } from "./test-harness.ts";

describe("snap features", () => {
  it("snaps to a segment midpoint without a division object", () => {
    const page = structuredClone(fixtureDoc.nodes[0]!);
    if (page.type !== "frame") throw new Error("fixture requires a frame");
    const figure = page.children[0]!;
    const bare = parseDocument({
      ...fixtureDoc,
      nodes: [
        {
          ...page,
          children: [
            {
              ...figure,
              spec: {
                objects: [
                  { id: "A", def: ["point", 0, 0] },
                  { id: "B", def: ["point", 4, 0] },
                  { id: "s", def: ["segment", "A", "B"] },
                ],
              },
            },
          ],
        },
      ],
    });
    const [x, y] = pageAt(bare, 2, 0);
    const hit = snapFigure(bare, "tri", x, y, registry());
    expect(hit?.kind).toBe("feature");
    expect(hit?.x_mm).toBeCloseTo(x);
    expect(hit?.y_mm).toBeCloseTo(y);
  });

  it("does not snap a dragged vertex onto its own crossing", () => {
    const [x, y] = pageAt(fixtureDoc, 0, 0);
    expect(snapFigure(fixtureDoc, "tri", x, y, registry(), "A")).toBeNull();
  });

  it("snaps to the crossing of the two medians", () => {
    const [x, y] = pageAt(fixtureDoc, 5.2 / 3, 1);
    const hit = snapFigure(fixtureDoc, "tri", x, y, registry());
    expect(hit?.kind === "point" || hit?.kind === "feature").toBe(true);
    expect(hit?.x_mm).toBeCloseTo(x);
    expect(hit?.y_mm).toBeCloseTo(y);
  });
});
