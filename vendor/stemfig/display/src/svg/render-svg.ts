/**
 * DisplayList → 완전한 SVG 문자열.
 * Grida 투영이 svgkit.toDocument 로 이 문자열을 다시 먹는다.
 * 좌표는 mm 가 아니라 CSS px. viewBox mm + width mm 는 프레임만 px 가 된다.
 * 원·타원은 `<circle>` / `<ellipse>`. polygon 으로 나누지 않는다.
 */
import { clipItems } from "../clip/clip.ts";
import { DEFAULT_SHEET_FILL } from "../style.ts";
import type { DisplayItem, DisplayList, DisplaySheet, Frame } from "../types.ts";
import { mmToPx } from "../units.ts";
import { latexGroup, shouldTypeset, texSource } from "./latex.ts";

/**
 * xmlns 와 viewBox(CSS px) 를 포함한 SVG.
 * 원점(0,0) 은 페이지. 도형 bbox 로 viewBox 를 바꾸면 드래그 때 카메라가 튄다.
 * padPx 는 고정값만. 에디터가 root figure 를 프레임 밖에 남길 때 쓴다.
 * 시트는 frames 마다 rect 하나. fill 은 DisplaySheet.fill.
 * group.clip 은 clipItems 로 푼다. 그리기만 한다.
 * clipPath·mask·nested svg 는 svgkit 이 버리거나 원점을 옮긴다.
 * 라벨 text 는 MathJax path 로 굽는다. Grida 는 font-family 를 버린다.
 * plain text 만 font-family 가 남는다.
 * polyline·polygon 은 stroke-linecap/join round. 두 선 끝이 겹쳐 둥글다.
 * @param options.padPx 뷰포트 여백 CSS px. 기본 0 (preview zoomToFit).
 * @param options.crop 이 상자만 보이게. 아이템 좌표는 페이지 mm 그대로.
 */
export function renderSvg(
  list: DisplayList,
  options?: { padPx?: number; crop?: Frame },
): string {
  const body = list.items.map((item) => renderItem(item)).join("");
  const pad = options?.padPx ?? 0;
  const crop = options?.crop;
  const originX = crop ? mmToPx(crop.x) : 0;
  const originY = crop ? mmToPx(crop.y) : 0;
  const w = mmToPx(crop ? crop.w : list.width_mm);
  const h = mmToPx(crop ? crop.h : list.height_mm);
  const vw = w + pad * 2;
  const vh = h + pad * 2;
  const sheets = list.frames.map((frame) => sheetSvg(frame)).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` viewBox="${originX - pad} ${originY - pad} ${vw} ${vh}"` +
    ` width="${vw}" height="${vh}"` +
    ` font-family="Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif">` +
    `${sheets}${body}` +
    `</svg>`
  ).replace(XML_ILLEGAL, "");
}

/*
 * XML 1.0 이 허용하지 않는 C0 제어 문자. 탭·줄바꿈·CR 만 남는다.
 * JSON 에 "$\beta$" 를 "$\\beta$" 대신 쓰면 \b 가 U+0008 이 된다. MathJax 가 실패해 평문 <text> 로
 * 떨어진 그 글자가 남으면 SVG 가 깨져 래스터화(브라우저·resvg)가 통째로 실패한다. 라벨·수식 어느 경로든
 * 마지막에 한 번 걸러 낸다. 저자에게 알리는 일은 호스트 checkDocument(CONTROL_CHAR)가 한다.
 */
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/**
 * 시트 한 장. 테두리 #ccc 는 잠긴 값. 속만 Node.color.
 */
function sheetSvg(frame: DisplaySheet): string {
  const fill = frame.fill ?? DEFAULT_SHEET_FILL;
  return (
    `<rect x="${mmToPx(frame.x)}" y="${mmToPx(frame.y)}"` +
    ` width="${mmToPx(frame.w)}" height="${mmToPx(frame.h)}"` +
    ` fill="${esc(fill)}" stroke="#cccccc" stroke-width="1"/>`
  );
}

function renderItem(item: DisplayItem): string {
  switch (item.op) {
    case "polyline":
      return polylineSvg(item);
    case "polygon":
      return polygonSvg(item);
    case "circle":
      return circleSvg(item);
    case "ellipse":
      return ellipseSvg(item);
    case "text":
      return textSvg(item);
    case "glyphs":
      return glyphPathSvg(item.rings, item.fill);
    case "group":
      return groupSvg(item);
  }
}

function pts(points: [number, number][]): string {
  return points.map(([x, y]) => `${mmToPx(x)},${mmToPx(y)}`).join(" ");
}

function polylineSvg(item: Extract<DisplayItem, { op: "polyline" }>): string {
  const points = item.close && item.points[0]
    ? [...item.points, item.points[0]]
    : item.points;
  return (
    `<polyline points="${pts(points)}" fill="none"${strokeAttrs(item.stroke, item.width)}/>`
  );
}

function polygonSvg(item: Extract<DisplayItem, { op: "polygon" }>): string {
  const fill = item.fill ?? "none";
  return (
    `<polygon points="${pts(item.points)}" fill="${esc(fill)}"` +
    `${strokeAttrs(item.stroke, item.width)}/>`
  );
}

/**
 * 두 선분이 한 점에서 만날 때 각 DisplayItem 은 따로라 join 이 없다.
 * cap 을 round 로 겹치면 끝이 둥글다. polygon 꼭짓점은 join.
 */
function strokeAttrs(stroke: string, width: number): string {
  return (
    ` stroke="${esc(stroke)}" stroke-width="${mmToPx(width)}"` +
    ` stroke-linecap="round" stroke-linejoin="round"`
  );
}

/**
 * 원을 polygon 으로 나누지 않는다. 각이 보이면 안 된다.
 */
function circleSvg(item: Extract<DisplayItem, { op: "circle" }>): string {
  const fill = item.fill ?? "none";
  return (
    `<circle cx="${mmToPx(item.cx)}" cy="${mmToPx(item.cy)}" r="${mmToPx(item.r)}"` +
    ` fill="${esc(fill)}" stroke="${esc(item.stroke)}"` +
    ` stroke-width="${mmToPx(item.width)}"/>`
  );
}

/**
 * 타원도 같은 이유. 꼭짓점 샘플로 바꾸지 않는다.
 */
function ellipseSvg(item: Extract<DisplayItem, { op: "ellipse" }>): string {
  const fill = item.fill ?? "none";
  return (
    `<ellipse cx="${mmToPx(item.cx)}" cy="${mmToPx(item.cy)}"` +
    ` rx="${mmToPx(item.rx)}" ry="${mmToPx(item.ry)}"` +
    ` fill="${esc(fill)}" stroke="${esc(item.stroke)}"` +
    ` stroke-width="${mmToPx(item.width)}"/>`
  );
}

/**
 * 라벨은 MathJax path. Grida 내장 폰트는 Computer Modern 이 아니다.
 * plain 이거나 변환 실패면 예전 <text>.
 */
function textSvg(item: Extract<DisplayItem, { op: "text" }>): string {
  if (!item.plain && shouldTypeset(item.text)) {
    const math = latexGroup(
      texSource(item.text),
      mmToPx(item.x),
      mmToPx(item.y),
      mmToPx(item.size),
      item.fill,
    );
    if (math) {
      return math;
    }
  }
  return (
    `<text x="${mmToPx(item.x)}" y="${mmToPx(item.y)}" font-size="${mmToPx(item.size)}"` +
    ` fill="${esc(item.fill)}">${esc(item.text)}</text>`
  );
}

/**
 * 잘린 글리프. evenodd 로 구멍. stroke 없음.
 */
function glyphPathSvg(rings: [number, number][][], fill: string): string {
  const d = rings
    .map((ring) => {
      const first = ring[0]!;
      const tail = ring
        .slice(1)
        .map(([x, y]) => `L${mmToPx(x)} ${mmToPx(y)}`)
        .join("");
      return `M${mmToPx(first[0])} ${mmToPx(first[1])}${tail}Z`;
    })
    .join("");
  return `<path d="${d}" fill="${esc(fill)}" fill-rule="evenodd"/>`;
}

/**
 * clip 선언이 있으면 여기서 한 번 푼다. 중첩 svg 는 안 쓴다.
 */
function groupSvg(item: Extract<DisplayItem, { op: "group" }>): string {
  const kids = item.clip ? clipItems(item.items, item.clip) : item.items;
  return `<g>${kids.map((child) => renderItem(child)).join("")}</g>`;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
