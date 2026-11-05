import { describe, expect, it } from "vitest";
import { placeFigure } from "@stemfig/host";
import { initGeometry } from "../init.ts";
import { fixtureDoc, pageAt, pageOf, registry, specOf } from "./test-harness.ts";

describe("place intersection", () => {
  it("reuses G when the two medians are clicked", () => {
    /* 중선 am 위. A·G 꼭짓점 반경 밖. */
    const [ax, ay] = pageAt(fixtureDoc, 1.3, 0.75);
    const first = placeFigure(
      fixtureDoc,
      "tri",
      "intersection",
      ax,
      ay,
      registry(),
    );
    expect(specOf(first.doc).draft?.tool).toBe("intersection");
    const [bx, by] = pageAt(fixtureDoc, 2.3, 0.75);
    const next = placeFigure(first.doc, "tri", "intersection", bx, by, registry());
    expect(
      specOf(next.doc).objects.filter((obj) => obj.def[0] === "intersect"),
    ).toHaveLength(1);
    expect(next.handleId).toBeNull();
  });

  it("builds an intersection from two path clicks", () => {
    /* AB 위. H(1.2,0)·M(2,0) 반경 밖. */
    const [x1, y1] = pageAt(fixtureDoc, 3, 0);
    const first = placeFigure(fixtureDoc, "tri", "intersection", x1, y1, registry());
    expect(specOf(first.doc).draft).toEqual({ tool: "intersection", path: "c" });
    const [x2, y2] = pageAt(fixtureDoc, 3.3, 0.75);
    const next = placeFigure(first.doc, "tri", "intersection", x2, y2, registry());
    const hit = specOf(next.doc).objects.find(
      (obj) => obj.def[0] === "intersect" && obj.id !== "G",
    );
    expect(hit?.def[0]).toBe("intersect");
    expect(next.handleId).toBeNull();
  });
});

describe("place perpendicular", () => {
  it("reuses H from C then AB", () => {
    const [cx, cy] = pageOf(fixtureDoc, "C");
    const first = placeFigure(
      fixtureDoc,
      "tri",
      "perpendicular",
      cx,
      cy,
      registry(),
    );
    expect(specOf(first.doc).draft?.tool).toBe("perpendicular");
    /* AB 위. M 중점 반경 밖. */
    const [x, y] = pageAt(fixtureDoc, 3, 0);
    const next = placeFigure(
      first.doc,
      "tri",
      "perpendicular",
      x,
      y,
      registry(),
    );
    expect(
      specOf(next.doc).objects.filter((obj) => obj.def[0] === "projection"),
    ).toHaveLength(1);
  });
});

describe("fixture G and H", () => {
  it("puts G at the centroid", () => {
    const g = initGeometry(specOf(fixtureDoc)).points.get("G");
    expect(g?.x).toBeCloseTo(5.2 / 3);
    expect(g?.y).toBeCloseTo(1);
  });

  it("puts H at the foot from C to AB", () => {
    expect(initGeometry(specOf(fixtureDoc)).points.get("H")).toEqual({
      x: 1.2,
      y: 0,
    });
  });
});
