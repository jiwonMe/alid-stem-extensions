/**
 * DisplayItem 을 축정렬 상자로 자른다.
 * SVG clipPath / nested svg 는 Grida 가 무시한다. 선·다각형만 좌표를 자른다.
 * 원·타원은 상자 안이면 primitive. 걸치면 샘플 후 자른다.
 * text 가 상자에 걸치면 glyphs. renderSvg 는 좌표만 그린다.
 * kind / spec 을 읽지 않는다.
 */
import { clipTextItem } from "./clip-label.ts";
import {
  clipPolygonPts,
  clipSeg,
  ringFit,
  sampleRing,
  samePt,
} from "./clip-geom.ts";
import type { DisplayItem, Frame } from "../types.ts";

/**
 * figure.frame (시트와 교집합일 수 있음) 으로 자른다.
 * @param items plugin.compile 결과. 페이지 mm
 * @param clip figure 상자. mm
 * @returns 상자 밖 점이 빠진 새 배열. 원본을 변이하지 않는다
 */
export function clipItems(items: DisplayItem[], clip: Frame): DisplayItem[] {
  return items.flatMap((item) => clipOne(item, clip));
}

function clipOne(item: DisplayItem, clip: Frame): DisplayItem[] {
  switch (item.op) {
    case "polyline":
      return clipPolyline(item, clip);
    case "polygon":
      return clipPolygon(item, clip);
    case "circle":
      return clipCircle(item, clip);
    case "ellipse":
      return clipEllipse(item, clip);
    case "text":
      return clipTextItem(item, clip);
    case "glyphs":
      return clipGlyphs(item, clip);
    case "group":
      return [
        {
          ...item,
          items: clipItems(item.items, clip),
        },
      ];
  }
}

function clipPolyline(
  item: Extract<DisplayItem, { op: "polyline" }>,
  clip: Frame,
): DisplayItem[] {
  const pts =
    item.close && item.points[0]
      ? [...item.points, item.points[0]]
      : item.points;
  const out: DisplayItem[] = [];
  let run: [number, number][] = [];
  const flush = () => {
    if (run.length >= 2) {
      out.push({ ...item, points: run, close: false });
    }
    run = [];
  };
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const seg = clipSeg(a[0], a[1], b[0], b[1], clip);
    if (!seg) {
      flush();
      continue;
    }
    if (run.length === 0) {
      run.push(seg[0], seg[1]);
      continue;
    }
    if (samePt(run[run.length - 1]!, seg[0])) {
      run.push(seg[1]);
    } else {
      flush();
      run.push(seg[0], seg[1]);
    }
  }
  flush();
  return out;
}

function clipPolygon(
  item: Extract<DisplayItem, { op: "polygon" }>,
  clip: Frame,
): DisplayItem[] {
  const points = clipPolygonPts(item.points, clip);
  return points.length >= 3 ? [{ ...item, points }] : [];
}

function clipGlyphs(
  item: Extract<DisplayItem, { op: "glyphs" }>,
  clip: Frame,
): DisplayItem[] {
  const rings = item.rings
    .map((ring) => clipPolygonPts(ring, clip))
    .filter((ring) => ring.length >= 3);
  return rings.length === 0 ? [] : [{ ...item, rings }];
}

/**
 * 완전 밖만 버린다. 걸치면 sampleRing — Grida 가 svg clip 을 버리기 때문.
 */
function clipCircle(
  item: Extract<DisplayItem, { op: "circle" }>,
  clip: Frame,
): DisplayItem[] {
  return clipRing(item.cx, item.cy, item.r, item.r, item, clip);
}

/**
 * 타원 AABB 는 rx·ry. 원은 circleFit 과 같다.
 */
function clipEllipse(
  item: Extract<DisplayItem, { op: "ellipse" }>,
  clip: Frame,
): DisplayItem[] {
  return clipRing(item.cx, item.cy, item.rx, item.ry, item, clip);
}

/**
 * in 은 primitive. hit 만 샘플. fill 있으면 다각형, 없으면 닫힌 선.
 */
function clipRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  item: Extract<DisplayItem, { op: "circle" | "ellipse" }>,
  clip: Frame,
): DisplayItem[] {
  const fit = ringFit(cx, cy, rx, ry, clip);
  if (fit === "out") {
    return [];
  }
  if (fit === "in") {
    return [item];
  }
  const points = sampleRing(cx, cy, rx, ry);
  if (item.fill) {
    return clipPolygon(
      {
        op: "polygon",
        points,
        stroke: item.stroke,
        fill: item.fill,
        width: item.width,
      },
      clip,
    );
  }
  return clipPolyline(
    {
      op: "polyline",
      points,
      close: true,
      stroke: item.stroke,
      width: item.width,
    },
    clip,
  );
}
