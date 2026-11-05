import { describe, expect, it } from "vitest";
import { renderSvg } from "./render-svg.ts";
import { isLatexString, latexToSvg, shouldTypeset, texSource } from "./latex.ts";

const SHEET = { x: 0, y: 0, w: 80, h: 60 };

describe("texSource", () => {
  it("wraps a point label in mathrm", () => {
    expect(texSource("A")).toBe("\\mathrm{A}");
  });

  it("unwraps dollar math", () => {
    expect(isLatexString("$\\theta$")).toBe(true);
    expect(texSource("$\\theta$")).toBe("\\theta");
  });

  it("keeps raw commands", () => {
    expect(texSource("\\frac{1}{2}")).toBe("\\frac{1}{2}");
  });

  it("skips hangul so Computer Modern is not asked for it", () => {
    expect(shouldTypeset("중점")).toBe(false);
    expect(shouldTypeset("A")).toBe(true);
    expect(shouldTypeset("$\\theta$")).toBe(true);
    expect(shouldTypeset("60°")).toBe(true);
    expect(shouldTypeset("θ")).toBe(true);
    expect(texSource("60°")).toBe("60^{\\circ}");
    expect(texSource("θ")).toBe("\\theta ");
    expect(shouldTypeset("60° 각")).toBe(false);
  });
});

describe("latexToSvg", () => {
  it("bakes a roman A into paths", () => {
    const built = latexToSvg("\\mathrm{A}", 12.8, "#111111");
    expect(built?.svg).toContain("<path");
    expect(built?.svg).toContain("#111111");
    expect(built?.width).toBeGreaterThan(0);
  });

  it("typesets a fraction", () => {
    const built = latexToSvg("\\frac{1}{2}", 12.8, "#111111");
    expect(built?.svg).toContain("<path");
    expect(built?.height).toBeGreaterThan(built!.width * 0.4);
  });
});

describe("renderSvg text", () => {
  it("replaces a label with a MathJax group", () => {
    const svg = renderSvg({
      width_mm: 80,
      height_mm: 60,
      frames: [SHEET],
      items: [
        {
          op: "text",
          x: 10,
          y: 10,
          text: "A",
          size: 3.2,
          fill: "#111111",
        },
      ],
    });
    expect(svg).toContain("<g transform=");
    expect(svg).toContain("<path");
    expect(svg).not.toContain(">A</text>");
  });

  it("keeps hangul as SVG text", () => {
    const svg = renderSvg({
      width_mm: 80,
      height_mm: 60,
      frames: [SHEET],
      items: [
        {
          op: "text",
          x: 10,
          y: 10,
          text: "중점",
          size: 3.2,
          fill: "#111111",
        },
      ],
    });
    expect(svg).toContain(">중점</text>");
  });

  it("keeps plain error copy as SVG text", () => {
    const svg = renderSvg({
      width_mm: 80,
      height_mm: 60,
      frames: [SHEET],
      items: [
        {
          op: "text",
          x: 2,
          y: 6,
          text: "missing plugin: math.geometry",
          size: 3.2,
          fill: "#111111",
          plain: true,
        },
      ],
    });
    expect(svg).toContain(">missing plugin: math.geometry</text>");
    expect(svg).not.toContain("<path");
  });
});
