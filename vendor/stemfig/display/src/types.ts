/**
 * DisplayList 도형 계약.
 * 교과(작도·플롯·칸)를 모른다. 선·원·글자·글리프·클립만 안다.
 * 좌표는 페이지 mm, 원점 왼쪽 위, y는 아래 (SVG와 동일).
 * Skia/path/symbol 은 소비 플러그인이 생기기 전에 넣지 않는다.
 */

/** figure 또는 clip 의 축정렬 상자. 단위 mm. 색은 없다. */
export type Frame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * 흰 시트. DisplayList.frames 만.
 * fill 생략은 DEFAULT_SHEET_FILL. clip 상자에는 쓰지 않는다.
 */
export type DisplaySheet = Frame & {
  fill?: string;
};

/**
 * 캔버스 한 장 분량의 그리기 명령. 캔버스 바깥 배경은 넣지 않는다. preview가 처리.
 * width/height 는 프레임을 전부 덮는 크기다. 원점은 언제나 (0,0).
 * frames 는 시트의 자리. 프레임은 플러그인 출력이 아니라 배경이라 items 에 섞지 않는다.
 */
export type DisplayList = {
  width_mm: number;
  height_mm: number;
  frames: DisplaySheet[];
  items: DisplayItem[];
};

/** 렌더러가 구현하는 op만 허용. 모르는 op를 플러그인이 발명하면 안 된다. */
export type DisplayItem =
  | {
      op: "polyline";
      points: [number, number][];
      stroke: string;
      width: number;
      close?: boolean;
    }
  | {
      op: "polygon";
      points: [number, number][];
      stroke: string;
      fill?: string;
      width: number;
    }
  | {
      op: "circle";
      cx: number;
      cy: number;
      r: number;
      stroke: string;
      fill?: string;
      width: number;
    }
  | {
      op: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      stroke: string;
      fill?: string;
      width: number;
    }
  | {
      op: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      /* true 면 평문 SVG <text>. 오류 박스만. 라벨은 MathJax path. */
      plain?: boolean;
    }
  | {
      /**
       * clip 이 글자를 자른 결과. 플러그인은 만들지 않는다.
       * rings 는 evenodd. 페이지 mm.
       */
      op: "glyphs";
      rings: [number, number][][];
      fill: string;
    }
  | {
      op: "group";
      clip?: Frame;
      items: DisplayItem[];
    };
