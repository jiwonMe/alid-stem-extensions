import { describe, expect, it } from "vitest";
import { clipLabelGlyphs, clipTextItem } from "./clip-label.ts";

const clip = { x: 0, y: 0, w: 80, h: 60 };

describe("clipLabelGlyphs", () => {
  it("keeps a label that sits inside the box", () => {
    const next = clipLabelGlyphs(
      { op: "text", x: 10, y: 20, text: "G", size: 1.6, fill: "#111111" },
      clip,
    );
    expect(next.kind).toBe("keep");
  });

  it("drops a label that sits far outside", () => {
    const next = clipLabelGlyphs(
      { op: "text", x: 120, y: 10, text: "A", size: 1.6, fill: "#111111" },
      clip,
    );
    expect(next.kind).toBe("drop");
  });

  it("cuts Ma at the right edge so no point leaves the box", () => {
    const next = clipLabelGlyphs(
      { op: "text", x: 78, y: 30, text: "Ma", size: 3.2, fill: "#111111" },
      clip,
    );
    expect(next.kind).toBe("rings");
    if (next.kind !== "rings") {
      return;
    }
    expect(next.rings.length).toBeGreaterThan(0);
    for (const ring of next.rings) {
      expect(
        ring.every(
          ([x, y]) =>
            x >= -1e-6 && x <= 80 + 1e-6 && y >= -1e-6 && y <= 60 + 1e-6,
        ),
      ).toBe(true);
    }
  });

  it("emits glyphs from clipTextItem when the box crosses the clip", () => {
    const next = clipTextItem(
      { op: "text", x: 78, y: 30, text: "Ma", size: 3.2, fill: "#111111" },
      clip,
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.op).toBe("glyphs");
  });
});
