/**
 * DisplayItem text 글리프를 figure 상자로 자른다.
 * mask / clipPath / nested svg 는 Grida 가 버린다. path 좌표만 남긴다.
 * 구멍은 evenodd 서브패스. 교과를 모른다.
 */
import { frameContains, framesOverlap } from "./clip-frame.ts";
import { clipPolygonPts } from "./clip-geom.ts";
import { measureLabelMm } from "../svg/measure-label.ts";
import { latexPaths, type SvgMatrix } from "../svg/latex-paths.ts";
import { latexToSvg, shouldTypeset, texSource } from "../svg/latex.ts";
import { pathRings } from "../svg/path-poly.ts";
import { parseSvgViewBox } from "../svg/svg-viewbox.ts";
import type { DisplayItem, Frame } from "../types.ts";

/** keep 은 원본 text. rings 는 페이지 mm 잘린 글리프. */
export type LabelClip =
  | { kind: "keep" }
  | { kind: "drop" }
  | { kind: "rings"; rings: [number, number][][] };

/**
 * 조판 상자가 완전히 안이면 keep. 밖이면 drop.
 * 걸치면 글리프를 mm 다각형으로 자른다.
 * @param item DisplayList text. plain 은 조판하지 않는다
 * @param clip figure 상자. 페이지 mm
 */
export function clipLabelGlyphs(
  item: Extract<DisplayItem, { op: "text" }>,
  clip: Frame,
): LabelClip {
  const box = measureLabelMm(item.text, item.size);
  const frame = {
    x: item.x + box.x,
    y: item.y + box.y,
    w: box.w,
    h: box.h,
  };
  if (!framesOverlap(frame, clip)) {
    return { kind: "drop" };
  }
  if (frameContains(clip, frame)) {
    return { kind: "keep" };
  }
  if (item.plain || !shouldTypeset(item.text)) {
    return { kind: "keep" };
  }
  const rings = glyphRingsMm(item);
  if (!rings) {
    return { kind: "keep" };
  }
  const clipped = rings
    .map((ring) => clipPolygonPts(ring, clip))
    .filter((ring) => ring.length >= 3);
  return clipped.length === 0 ? { kind: "drop" } : { kind: "rings", rings: clipped };
}

/**
 * clipItems 용. keep 은 text, 걸치면 glyphs.
 * @returns 비면 상자 밖
 */
export function clipTextItem(
  item: Extract<DisplayItem, { op: "text" }>,
  clip: Frame,
): DisplayItem[] {
  const next = clipLabelGlyphs(item, clip);
  if (next.kind === "drop") {
    return [];
  }
  if (next.kind === "keep") {
    return [item];
  }
  return [{ op: "glyphs", rings: next.rings, fill: item.fill }];
}

/**
 * latexGroup 과 같은 자리. 단위만 mm.
 * fontPx 에 size_mm 을 넣어 조판 숫자를 mm 로 쓴다. measureLabelMm 과 같음.
 */
function glyphRingsMm(
  item: Extract<DisplayItem, { op: "text" }>,
): [number, number][][] | undefined {
  const built = latexToSvg(texSource(item.text), item.size, item.fill);
  if (!built) {
    return undefined;
  }
  const vb = parseSvgViewBox(built.svg);
  const paths = latexPaths(built.svg);
  if (!vb || paths.length === 0) {
    return undefined;
  }
  const sx = built.width / vb.w;
  const sy = built.height / vb.h;
  const top = item.y - built.height - built.valign;
  const out: [number, number][][] = [];
  for (const path of paths) {
    for (const ring of pathRings(path.d)) {
      out.push(
        ring.map((pt) => {
          const [gx, gy] = apply(path.matrix, pt);
          return [item.x + (gx - vb.x) * sx, top + (gy - vb.y) * sy];
        }),
      );
    }
  }
  return out;
}

function apply(m: SvgMatrix, p: [number, number]): [number, number] {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

