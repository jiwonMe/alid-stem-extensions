/**
 * 미설치 엔진·figure 오류 박스.
 * 문서 전체를 실패시키지 않기 위해 compile 이 이걸 group 으로 넣는다.
 */
import { DEFAULT_STYLE, type DisplayItem, type Frame } from "@stemfig/display";
import type { StemfigErrorCode } from "../envelope/errors.ts";

const STROKE = DEFAULT_STYLE.stroke;
const FILL = "#f4f4f4";
const WIDTH = DEFAULT_STYLE.width;
const TEXT_SIZE = DEFAULT_STYLE.textSize;

export function placeholderGroup(
  frame: Frame,
  message: string,
): DisplayItem {
  return {
    op: "group",
    clip: frame,
    items: [
      {
        op: "polygon",
        points: frameRect(frame),
        stroke: STROKE,
        fill: FILL,
        width: WIDTH,
      },
      {
        op: "text",
        x: frame.x + 2,
        y: frame.y + 6,
        text: message,
        size: TEXT_SIZE,
        fill: STROKE,
        /* 오류 문장은 TeX 가 아니다. */
        plain: true,
      },
    ],
  };
}

export function missingPluginBox(frame: Frame, kind: string): DisplayItem {
  return placeholderGroup(frame, `missing plugin: ${kind}`);
}

export function figureErrorBox(
  frame: Frame,
  code: StemfigErrorCode,
): DisplayItem {
  return placeholderGroup(frame, `error: ${code}`);
}

function frameRect(frame: Frame): [number, number][] {
  const { x, y, w, h } = frame;
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}
