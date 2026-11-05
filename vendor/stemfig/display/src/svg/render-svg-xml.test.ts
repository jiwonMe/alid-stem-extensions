import { describe, expect, it } from "vitest";
import { renderSvg } from "./render-svg.ts";

describe("renderSvg XML", () => {
  it("drops characters XML 1.0 forbids so rasterizers can still read the file", () => {
    /* JSON "$\beta$" 는 U+0008 + eta 가 된다. 평문 <text> 로 떨어져도 SVG 가 깨지면 안 된다. */
    const svg = renderSvg({
      width_mm: 10,
      height_mm: 10,
      frames: [],
      items: [{ op: "text", x: 1, y: 5, text: "$\u0008eta$\u000c", size: 3, fill: "#111111", plain: true }],
    });
    expect(svg).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(svg).toContain(">$eta$</text>");
  });

  it("keeps tab and line feed, which XML allows", () => {
    const svg = renderSvg({
      width_mm: 10,
      height_mm: 10,
      frames: [],
      items: [{ op: "text", x: 1, y: 5, text: "a\tb\nc", size: 3, fill: "#111111", plain: true }],
    });
    expect(svg).toContain(">a\tb\nc</text>");
  });
});
