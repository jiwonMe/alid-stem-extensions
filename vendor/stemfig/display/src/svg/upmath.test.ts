import { describe, expect, it } from "vitest";
import { latexGroup, latexToSvg, texSource } from "./latex.ts";
import { latexEngineFromDoc, setLatexEngine } from "./latex-engine.ts";
import {
  inlineUpmathSvg,
  paintUpmath,
  parseUpmathMeta,
  pinUpmathOrigin,
  putUpmathRaw,
  UPMATH_HOST,
  upmathSvgUrl,
} from "./upmath.ts";

const FIXTURE = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="9"',
  ' viewBox="0 0 6 6"><defs><path id="g0-120" d="M1 0h1v1h-1z"/></defs>',
  '<use xlink:href="#g0-120" x="2" y="3"/>',
  '<script type="text/ecmascript">if(window.parent.postMessage)window.parent.postMessage(&quot;0.42534|7.5|6.75|&quot;+window.location,&quot;*&quot;);</script>',
  "</svg>",
].join("");

/** i.upmath.me 실제 x. viewBox 원점이 ~1800. */
const LIVE_X = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="9"',
  ' viewBox="1872.336 1482.872 5.978 5.38"><defs>',
  '<path id="g0-120" d="M1 0h1v1h-1z"/></defs>',
  '<use xlink:href="#g0-120" x="1872.02" y="1487.913"/>',
  '<script type="text/ecmascript">if(window.parent.postMessage)window.parent.postMessage(&quot;0.42534|7.5|6.75|&quot;+window.location,&quot;*&quot;);</script>',
  "</svg>",
].join("");

describe("latexEngineFromDoc", () => {
  it("defaults to upmath unless mathjax is named", () => {
    expect(latexEngineFromDoc(undefined)).toBe("upmath");
    expect(latexEngineFromDoc("upmath")).toBe("upmath");
    expect(latexEngineFromDoc("mathjax")).toBe("mathjax");
  });
});

describe("upmathSvgUrl", () => {
  it("uses the svg encode path from the S2Latex host", () => {
    expect(upmathSvgUrl("x")).toBe(`${UPMATH_HOST}/svg/x`);
    expect(upmathSvgUrl("a+b")).toBe(`${UPMATH_HOST}/svg/a%2Bb`);
    expect(upmathSvgUrl("xxxx", "ab")).toBe(`${UPMATH_HOST}/svgb/ab`);
  });
});

describe("parseUpmathMeta", () => {
  it("reads shift|width|height pt from postMessage", () => {
    expect(parseUpmathMeta(FIXTURE)).toEqual({
      shift: 0.42534,
      width: 7.5,
      height: 6.75,
    });
  });
});

describe("inlineUpmathSvg", () => {
  it("turns use into a filled path so latexPaths can read it", () => {
    const svg = inlineUpmathSvg(FIXTURE, "#111111");
    expect(svg).toContain('<path d="M1 0h1v1h-1z" transform="translate(2 3)" fill="#111111"/>');
    expect(svg).not.toContain("<use");
    expect(svg).not.toContain("<script");
  });
});

describe("paintUpmath / latexToSvg", () => {
  it("scales pt by fontPx/10 and wins over MathJax when cached", () => {
    const painted = paintUpmath(FIXTURE, 20, "#aa0000");
    expect(painted?.width).toBeCloseTo(15);
    expect(painted?.height).toBeCloseTo(13.5);
    expect(painted?.valign).toBeCloseTo(-0.85068);
    putUpmathRaw("x", FIXTURE);
    setLatexEngine("upmath");
    const via = latexToSvg(texSource("$x$"), 20, "#aa0000");
    expect(via?.width).toBeCloseTo(15);
    expect(via?.svg).toContain("#aa0000");
    setLatexEngine("upmath");
  });
});

describe("pinUpmathOrigin", () => {
  it("moves a live upmath viewBox origin to 0 so svgkit cannot explode the scene", () => {
    const pinned = pinUpmathOrigin(inlineUpmathSvg(LIVE_X, "#111111"));
    expect(pinned).toContain('viewBox="0 0 5.978 5.38"');
    expect(pinned).toContain('transform="translate(-1872.336 -1482.872)"');
    expect(pinned).not.toContain('viewBox="1872.336');
    const painted = paintUpmath(LIVE_X, 20, "#111111");
    expect(painted?.svg).toContain('viewBox="0 0 5.978 5.38"');
  });
});

describe("latexGroup", () => {
  it("emits paths without a nested svg so the page viewBox stays the camera origin", () => {
    putUpmathRaw("x", LIVE_X);
    setLatexEngine("upmath");
    const group = latexGroup(texSource("$x$"), 40, 80, 20, "#111111");
    expect(group).toBeDefined();
    expect(group).not.toContain("<svg");
    expect(group).not.toContain("1872");
    expect(group).toContain("<path");
    setLatexEngine("upmath");
  });
});
