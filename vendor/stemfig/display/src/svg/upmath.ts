/**
 * i.upmath.me SVG. 브라우저 S2Latex 스크립트를 넣지 않는다.
 * URL·deflate-raw·postMessage 크기만 가져온다. DOM 치환은 하지 않는다.
 * 호스트 https://i.upmath.me — 원본 ntwPath //i.upmath.me
 */
import type { LatexSvg } from "./latex-svg.ts";
import { parseSvgViewBox } from "./svg-viewbox.ts";

/** 원본 스크립트 ntwPath. http(s) 만. */
export const UPMATH_HOST = "https://i.upmath.me";

/**
 * upmath 기본 10pt. 크기(pt) × fontPx/10 이 우리 단위.
 * 스크립트 setImgSize 가 pt 를 쓴다.
 */
export const UPMATH_EM_PT = 10;

const rawCache = new Map<string, string>();

/**
 * 이미 받은 SVG 원문. hydrate 가 넣는다.
 */
export function peekUpmathRaw(formula: string): string | undefined {
  return rawCache.get(formula);
}

/**
 * fetch 성공 분. 같은 수식은 다시 받지 않는다.
 */
export function putUpmathRaw(formula: string, svg: string): void {
  rawCache.set(formula, svg);
}

/**
 * @param packed deflate-raw + base64url. 없거나 더 길면 평문 URL
 */
export function upmathSvgUrl(formula: string, packed?: string): string {
  const plain = `${UPMATH_HOST}/svg/${encodeURIComponent(formula)}`;
  if (!packed) {
    return plain;
  }
  const short = `${UPMATH_HOST}/svgb/${packed}`;
  return short.length < plain.length ? short : plain;
}

/**
 * CompressionStream 이 있으면 짧은 URL. 실패·미지원은 undefined.
 */
export async function packUpmathFormula(formula: string): Promise<string | undefined> {
  if (typeof CompressionStream === "undefined") {
    return undefined;
  }
  try {
    const stream = new Blob([formula]).stream().pipeThrough(
      new CompressionStream("deflate-raw"),
    );
    const buffer = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return undefined;
  }
}

/**
 * 스크립트 trackLoading 의 postMessage("shift|x|y|").
 * @returns pt. 없으면 undefined
 */
export function parseUpmathMeta(
  svg: string,
): { shift: number; width: number; height: number } | undefined {
  const match = svg.match(/postMessage\((?:&quot;|")([\d|.\-eE]*)/);
  if (!match?.[1]) {
    return undefined;
  }
  const [shift, width, height] = match[1].split("|").map(Number);
  if (
    !(shift === shift) ||
    !(width === width && width > 0) ||
    !(height === height && height > 0)
  ) {
    return undefined;
  }
  return { shift, width, height };
}

/**
 * &lt;use href&gt; 를 path+translate 로. latexPaths 는 use 를 모른다.
 * script 는 버린다. fill 은 우리 잉크.
 */
export function inlineUpmathSvg(svg: string, fill: string): string {
  const defs = new Map<string, string>();
  for (const block of svg.matchAll(/<path\b([^>]*)>/g)) {
    const attrs = block[1] ?? "";
    const id = attr(attrs, "id");
    const d = attr(attrs, "d");
    if (id && d) {
      defs.set(id, d);
    }
  }
  let out = svg.replace(/<script\b[\s\S]*?<\/script>/g, "");
  out = out.replace(/<use\b([^>]*)\/?>/g, (_all, raw: string) => {
    const href = (attr(raw, "xlink:href") ?? attr(raw, "href") ?? "").replace(
      /^#/,
      "",
    );
    const d = defs.get(href);
    if (!d) {
      return "";
    }
    const x = Number(attr(raw, "x") ?? "0");
    const y = Number(attr(raw, "y") ?? "0");
    return `<path d="${d}" transform="translate(${x} ${y})" fill="${fill}"/>`;
  });
  return out.replace(/<defs\b[\s\S]*?<\/defs>/g, "");
}

/**
 * 캐시된 원문 → 우리 LatexSvg. 크기는 pt × fontPx/10.
 * viewBox 원점은 0 으로. 실제 원문은 ~1800 이라 중첩하면 카메라가 죽는다.
 */
export function paintUpmath(
  raw: string,
  fontPx: number,
  fill: string,
): LatexSvg | undefined {
  const meta = parseUpmathMeta(raw);
  const svg = pinUpmathOrigin(inlineUpmathSvg(raw, fill));
  if (!svg.includes("<path")) {
    return undefined;
  }
  const scale = fontPx / UPMATH_EM_PT;
  const width = (meta?.width ?? 10) * scale;
  const height = (meta?.height ?? 10) * scale;
  const valign = -(meta?.shift ?? 0) * scale;
  let painted = svg.replace(/width="[^"]*"/, `width="${width}"`);
  painted = painted.replace(/height="[^"]*"/, `height="${height}"`);
  if (!painted.includes("xmlns=")) {
    painted = painted.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return { svg: painted, width, height, valign };
}

/**
 * viewBox="ox oy w h" → "0 0 w h" + 내용 translate(-ox,-oy).
 * svgkit 은 중첩 viewBox 를 무시하고 path translate 를 문서 좌표로 쓴다.
 */
export function pinUpmathOrigin(svg: string): string {
  const vb = parseSvgViewBox(svg);
  if (!vb || (vb.x === 0 && vb.y === 0)) {
    return svg;
  }
  let out = svg.replace(
    /viewBox="[^"]*"/,
    `viewBox="0 0 ${vb.w} ${vb.h}"`,
  );
  out = out.replace(
    /(<svg\b[^>]*>)/,
    `$1<g transform="translate(${-vb.x} ${-vb.y})">`,
  );
  return out.replace(/<\/svg>\s*$/, "</g></svg>");
}

/**
 * GET svg. 실패·빈 본문·취소는 undefined. 테스트는 호출하지 않는다.
 * @param signal 호출 측 마감. 헤드리스 CLI 처럼 응답을 무한정 기다릴 수 없는 곳이 넘긴다
 */
export async function fetchUpmathSvg(formula: string, signal?: AbortSignal): Promise<string | undefined> {
  const packed = await packUpmathFormula(formula);
  const path = upmathSvgUrl(formula, packed);
  try {
    const response = await fetch(path, { signal });
    if (!response.ok) {
      return undefined;
    }
    const text = await response.text();
    return text.includes("<svg") ? text : undefined;
  } catch {
    return undefined;
  }
}

function attr(attrs: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attrs.match(new RegExp(`(?:^|[\\s;])${escaped}="([^"]*)"`));
  return match?.[1];
}
