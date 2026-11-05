/**
 * DisplayList text → TeX SVG. 기본 upmath 캐시. 없거나 latex=mathjax 면 MathJax.
 * Grida 는 font-family 를 버리고 내장 폰트만 쓰므로, 글리프를 path 로 굽는다.
 * 교과·spec 을 모른다. 플러그인은 문자열만 넘긴다. @grida/* 금지.
 * mathjax-full 은 CJS. 여기만 interop 한다.
 */
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import "mathjax-full/js/input/tex/base/BaseConfiguration.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import { latexEngine } from "./latex-engine.ts";
import { flattenLatexSvg } from "./latex-flatten.ts";
import type { LatexSvg } from "./latex-svg.ts";
import { paintUpmath, peekUpmathRaw } from "./upmath.ts";

export type { LatexSvg } from "./latex-svg.ts";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const tex = new TeX({ packages: ["base", "ams"] });
const svgOut = new SVG({ fontCache: "none" });
const mathDocument = mathjax.document("", { InputJax: tex, OutputJax: svgOut });

const cache = new Map<string, LatexSvg>();

/**
 * $...$ / $$...$$ 전체면 TeX. 안에 다른 $ 가 있으면 평문 혼합이라 아니다.
 * @param text DisplayItem.text
 * @returns 전체가 수식 래퍼면 true
 */
export function isLatexString(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length >= 4) {
    return !hasBareDollar(trimmed.slice(2, -2));
  }
  if (trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length >= 2) {
    return !hasBareDollar(trimmed.slice(1, -1));
  }
  return false;
}

/**
 * Computer Modern 에 없는 글자는 조판하지 않는다.
 * $...$ 또는 TeX 특수문자는 무조건 시도. 그 외는 ASCII 만.
 * @param text DisplayItem.text
 * @returns false 면 예전 SVG <text>
 */
export function shouldTypeset(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (isLatexString(trimmed) || /[\\^_{}]/.test(trimmed)) {
    return true;
  }
  /* ° 와 그리스 문자는 Computer Modern 으로 보낸다. 한글이 섞이면 평문이다. */
  if (/[°θαβφω]/.test(trimmed) && /^[\x20-\x7E°θαβφω]+$/.test(trimmed)) {
    return true;
  }
  return /^[\x20-\x7E]+$/.test(trimmed);
}

/**
 * MathJax 에 넣을 소스. $ 래퍼를 벗긴다.
 * 명령·첨자가 있으면 그대로. 짧은 라벨은 \mathrm 로 로만.
 * @param text DisplayItem.text
 * @returns MathJax 소스. $ 없음
 */
export function texSource(text: string): string {
  const trimmed = text.trim();
  if (isLatexString(trimmed)) {
    return unwrapLatex(trimmed);
  }
  if (/[\\^_{}]/.test(trimmed)) {
    return trimmed;
  }
  if (/[°θαβφω]/.test(trimmed)) {
    return trimmed
      .replaceAll("θ", "\\theta ")
      .replaceAll("α", "\\alpha ")
      .replaceAll("β", "\\beta ")
      .replaceAll("φ", "\\phi ")
      .replaceAll("ω", "\\omega ")
      .replaceAll("°", "^{\\circ}");
  }
  return `\\mathrm{${escapeTex(trimmed)}}`;
}

/**
 * TeX → 인라인 SVG. 실패하면 undefined. 크기는 CSS px.
 * upmath 모드는 hydrate 캐시가 있을 때만 그걸 쓴다. 없으면 MathJax.
 * @param latex MathJax / upmath 소스. $ 없이
 * @param fontPx item.size 를 mmToPx 한 값
 * @param fill #rrggbb. currentColor 를 이 색으로
 * @returns 없거나 변환 실패면 undefined
 */
export function latexToSvg(
  latex: string,
  fontPx: number,
  fill: string,
): LatexSvg | undefined {
  if (latexEngine() === "upmath") {
    const raw = peekUpmathRaw(latex);
    if (raw) {
      const up = paintUpmath(raw, fontPx, fill);
      if (up) {
        return up;
      }
    }
  }
  const key = `${latex}\0${fontPx}\0${fill}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  let node: unknown;
  try {
    node = mathDocument.convert(latex, { display: false });
  } catch {
    return undefined;
  }
  const html = adaptor.outerHTML(node as Parameters<typeof adaptor.outerHTML>[0]);
  const match = html.match(/<svg[^>]*>[\s\S]*<\/svg>/);
  if (!match) {
    return undefined;
  }
  const built = paintSvg(match[0], fontPx, fill);
  if (!built) {
    return undefined;
  }
  cache.set(key, built);
  return built;
}

/**
 * 페이지 px 기준점 (x,y) 는 기존 <text> 와 같은 baseline.
 * @param latex MathJax 소스. $ 없이
 * @param xPx 페이지 px. 예전 <text> x
 * @param yPx 페이지 px. 예전 <text> baseline y
 * @param fontPx item.size 를 mmToPx 한 값
 * @param fill #rrggbb
 * @returns 바깥 g. 변환 실패면 undefined
 */
export function latexGroup(
  latex: string,
  xPx: number,
  yPx: number,
  fontPx: number,
  fill: string,
): string | undefined {
  const built = latexToSvg(latex, fontPx, fill);
  if (!built) {
    return undefined;
  }
  /* 중첩 svg 는 넣지 않는다. svgkit 이 안쪽 viewBox 를 문서 원점으로 쓴다. */
  const inner = flattenLatexSvg(built.svg, built.width, built.height, fill);
  if (!inner) {
    return undefined;
  }
  /* valign 은 CSS 부호 그대로. top = baseline - height - valign */
  const top = yPx - built.height - built.valign;
  return `<g transform="translate(${xPx} ${top})">${inner}</g>`;
}

function unwrapLatex(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
    return trimmed.slice(2, -2);
  }
  if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function hasBareDollar(inner: string): boolean {
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "$" && inner[i - 1] !== "\\") {
      return true;
    }
  }
  return false;
}

function escapeTex(raw: string): string {
  return raw.replace(/\\/g, "\\textbackslash{}").replace(/([#$%&_{}])/g, "\\$1");
}

function paintSvg(raw: string, fontPx: number, fill: string): LatexSvg | undefined {
  const widthEx = numAttr(raw, "width", "ex");
  const heightEx = numAttr(raw, "height", "ex");
  const valignEx = valignOf(raw);
  const ex = fontPx * 0.5;
  const width = (widthEx ?? 2) * ex;
  const height = (heightEx ?? 1) * ex;
  const valign = valignEx * ex;
  let svg = raw.replace(/currentColor/g, fill);
  svg = svg.replace(/width="[^"]*"/, `width="${width}"`);
  svg = svg.replace(/height="[^"]*"/, `height="${height}"`);
  if (!svg.includes("xmlns=")) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return { svg, width, height, valign };
}

function numAttr(svg: string, name: string, unit: string): number | undefined {
  const match = svg.match(new RegExp(`${name}="([0-9.]+)${unit}"`));
  return match ? Number(match[1]) : undefined;
}

function valignOf(svg: string): number {
  const match = svg.match(/vertical-align:\s*(-?[0-9.]+)ex/);
  return match ? Number(match[1]) : 0;
}
