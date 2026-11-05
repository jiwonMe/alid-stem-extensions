/**
 * 내분점 호버. show: false 면 히트·앵커 모두 빼다.
 * 보이는 내분점은 interact.test 가 본다.
 */
import { describe, expect, it } from "vitest";
import { hitFigure, listAnchors, parseDocument } from "@stemfig/host";
import fixture from "../../fixtures/triangle.stemfig.json";
import type { GeometrySpec } from "../schema.ts";
import { pageOf, registry } from "./test-harness.ts";

describe("hover division", () => {
  it("omits M when the object is hidden", () => {
    const page = structuredClone(fixture.nodes[0]!);
    const figure = page.children![0]!;
    const spec = figure.spec as GeometrySpec;
    const hidden = parseDocument({
      ...fixture,
      nodes: [
        {
          ...page,
          children: [
            {
              ...figure,
              spec: {
                ...spec,
                objects: spec.objects.map((obj) =>
                  obj.id === "M" ? { ...obj, show: false } : obj,
                ),
              },
            },
          ],
        },
      ],
    });
    const [x, y] = pageOf(hidden, "M");
    expect(hitFigure(hidden, "tri", x, y, registry())).toBe("c");
    expect(
      listAnchors(hidden, "tri", registry()).map((item) => item.id),
    ).not.toContain("M");
  });
});
