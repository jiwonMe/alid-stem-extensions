/**
 * 각·변 마크 HUD 앵커. hit 는 place-annot, 그림은 point-hud.
 */
import { describe, expect, it } from "vitest";
import { listAnchors } from "@stemfig/host";
import { registry, rightDoc } from "./test-harness.ts";

describe("annot anchors", () => {
  it("lists the right square and the segment tick as polylines", () => {
    const anchors = listAnchors(rightDoc, "rt", registry());
    const n = anchors.find((item) => item.id === "n");
    const k = anchors.find((item) => item.id === "k");
    expect(n?.kind).toBe("polyline");
    expect(k?.kind).toBe("polyline");
    if (n?.kind === "polyline") {
      expect(n.points).toHaveLength(3);
    }
    if (k?.kind === "polyline") {
      expect(k.points).toHaveLength(2);
    }
  });
});
