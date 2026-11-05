/**
 * 플러그인 소켓.
 * 없는 메서드는 그 능력이 없는 것. step 을 달력에 강제하지 말 것.
 * CompileCtx / HitCtx / ApplyCtx / PlaceCtx / FieldsCtx 만 넘긴다.
 * Editor / Grida / Skia 금지.
 */
import type { ZodType } from "zod";
import type { DisplayItem, Frame, ResolvedStyle, View } from "@stemfig/display";

/** figure 안 손잡이 id. 점 A, 선분 a. figure.id 와 다른 공간. */
export type HandleId = string;

/**
 * 레이어 패널 한 칸. React 가 아니다.
 * icon 은 UI IconName 문자열. 플러그인은 @stemfig/ui 를 import 하지 않는다.
 * kind 는 표시용 라벨. figure.kind 가 아니다.
 */
export type LayerItem = {
  id: HandleId;
  title: string;
  icon: string;
  kind: string;
};

/** 페이지 mm 델타. 호스트가 kind 를 몰라도 그대로 플러그인에 넘긴다. */
export type HandlePatch = {
  id: HandleId;
  dx_mm: number;
  dy_mm: number;
  /** 점 손잡이 직접 드래그의 절대 위치. 없으면 미세 이동이며 기존 연결을 보존한다. */
  pointer?: { x_mm: number; y_mm: number; unsnap?: boolean; px_per_mm?: number; constrain?: boolean };
  /**
   * Shift. 호스트는 격자 각도나 축을 해석하지 않는다.
   * 포인터를 누르는 순간의 Shift는 다중 선택이라 여기 싣지 않는다.
   */
  constrain?: boolean;
};

/**
 * mmToPage(lx, ly): frame 로컬 mm → 페이지 mm.
 * 호스트 구현은 [frame.x+lx, frame.y+ly]. view 는 봉투. spec.view 를 읽지 말 것.
 */
export type CompileCtx = {
  frame: Frame;
  view: View;
  mmToPage: (x: number, y: number) => [number, number];
  style: ResolvedStyle;
};

/**
 * x_mm/y_mm 은 페이지 mm. 플러그인이 frame 을 빼서 로컬로 만든다.
 * handles 는 봉투 interaction. 없으면 플러그인이 자유 손잡이 전부.
 */
export type HitCtx = {
  frame: Frame;
  view: View;
  x_mm: number;
  y_mm: number;
  handles?: string[];
};

/**
 * apply 가 view↔mm 스케일을 쓰려면 봉투 view+frame 이 필요하다.
 * spec 을 호스트가 해석하지 않는다.
 */
export type ApplyCtx = {
  frame: Frame;
  view: View;
};

/**
 * 속성 패널 한 칸. React 가 아니다. 앱은 type 만 보고 위젯을 고른다.
 * color 는 #rrggbb. 호스트는 key 뜻을 모른다. 단위 문자열은 플러그인이 붙인다.
 */
export type InspectField = {
  /** 표시용 묶음. 그룹의 의미는 플러그인 소유이며 호스트는 이름으로 분기하지 않는다. */
  group?: { id: string; label: string; description?: string; defaultOpen?: boolean };
  /** 단위·편집 의미를 설명하는 사용자 문장. 수식이나 spec으로 해석하지 않는다. */
  description?: string;
} & (
  | {
      key: string;
      label: string;
      type: "number";
      value: number;
      unit?: string;
      step?: number;
      min?: number;
      max?: number;
      disabled?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "text";
      value: string;
      disabled?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "color";
      value: string;
      disabled?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      value: boolean;
      disabled?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "enum";
      value: string;
      options: { value: string; label: string }[];
      disabled?: boolean;
      /** 칸이 적으면 앱이 한 줄 선택으로 그린다. 없으면 목록이다. 호스트는 값을 해석하지 않는다. */
      appearance?: "segmented";
    });

/**
 * 절대값 필드 패치. apply 의 델타와 다르다.
 * id 는 손잡이. key 는 InspectField.key.
 */
export type FieldPatch = {
  id: HandleId;
  key: string;
  value: number | string | boolean;
};

/**
 * 고른 손잡이의 필드. handles 는 봉투 interaction.
 * 없으면 플러그인이 자유 손잡이 전부.
 */
export type FieldsCtx = {
  frame: Frame;
  view: View;
  focus?: HandleId;
  /* 미지정 호출자는 기본 스타일. 속성 UI 가 상속 잉크와 다른 값을 표시하지 않게 한다. */
  style?: ResolvedStyle;
  handles?: string[];
};

/**
 * compile 과 같은 mmToPage. handles 는 봉투 interaction.
 * 없으면 플러그인이 자유 손잡이 전부.
 */
export type AnchorsCtx = CompileCtx & {
  handles?: string[];
};

/**
 * HUD 크롬. point/line/polyline/circle 은 그릴 모양이지 figure.kind 가 아니다.
 * 호스트는 교과를 모른다. 좌표는 페이지 mm.
 * line.knobs 는 HUD 모양이다. false 면 끝 노브 없음 (무한직선 clip).
 * text 는 라벨 글리프. 좌표는 baseline. figure.kind 가 아니다.
 * polyline·circle·ellipse 는 주석·작도 글리프. 손잡이 잠금 밖이어도 올린다.
 */
export type HandleAnchor =
  | {
      id: HandleId;
      kind: "point";
      x_mm: number;
      y_mm: number;
    }
  | {
      id: HandleId;
      kind: "line";
      x1_mm: number;
      y1_mm: number;
      x2_mm: number;
      y2_mm: number;
      /* false 면 끝 노브 없음. 무한직선 clip 끝은 손잡이가 아니다. */
      knobs?: boolean;
    }
  | {
      id: HandleId;
      kind: "text";
      x_mm: number;
      y_mm: number;
      text: string;
      size_mm: number;
      /* 이 글리프가 가리키는 점 손잡이. HUD 짝맞춤. figure.kind 가 아니다. */
      owner?: HandleId;
    }
  | {
      id: HandleId;
      kind: "polyline";
      points: [number, number][];
    }
  | {
      id: HandleId;
      kind: "circle";
      cx_mm: number;
      cy_mm: number;
      r_mm: number;
      filled?: boolean;
    }
  | {
      id: HandleId;
      kind: "ellipse";
      cx_mm: number;
      cy_mm: number;
      rx_mm: number;
      ry_mm: number;
      filled?: boolean;
    };

/**
 * figure 편집 툴바 한 칸.
 * React 가 아니다. icon 은 UI IconName 문자열이다.
 * separator 는 버튼이 아니다. place 에 넘기지 말 것.
 * 플러그인은 @stemfig/ui 를 import 하지 않는다. 없는 아이콘은 에디터가 건너뛴다.
 */
export type FigureTool =
  | {
      id: string;
      label: string;
      icon: string;
      /* 도구 키는 플러그인이 소유한다. 앱은 충돌 없는 단일 키만 연결한다. */
      shortcut?: string;
      /**
       * 연속된 같은 id 는 한 버튼이다. 앱은 교과를 모르고 묶기만 한다.
       * 없으면 단독 버튼. 구분선은 그룹을 끊는다.
       */
      group?: { id: string; label: string };
    }
  | {
      id: string;
      separator: true;
    };

/**
 * figure 위 클릭. x_mm/y_mm 은 페이지 mm.
 * tool 은 플러그인이 선언한 tools[].id. 호스트는 뜻을 모른다.
 * unsnap 은 Alt. 자석만 끈다. 클릭 좌표는 그대로 둔다.
 * px_per_mm 은 캔버스 CSS px / 페이지 mm. 자석 반경을 화면 px 로 맞춘다.
 * constrain 은 Shift. 각도 격자의 뜻은 플러그인만 안다.
 */
export type PlaceCtx = {
  frame: Frame;
  view: View;
  x_mm: number;
  y_mm: number;
  tool: string;
  unsnap?: boolean;
  px_per_mm?: number;
  constrain?: boolean;
};

/**
 * place 한 칸. handles 는 새 자유 손잡이.
 * 호스트는 interaction.handles 가 있을 때만 붙인다. spec 을 읽지 않는다.
 */
export type PlaceResult<State> = {
  state: State;
  handles?: readonly HandleId[];
};

/**
 * 커서 스냅. x_mm/y_mm 은 페이지 mm.
 * exclude 는 드래그 중인 손잡이. 자기 자신에 붙지 말 것.
 * unsnap 은 Alt. 자석만 끈다. 호스트가 좌표를 고치지 않는다.
 * px_per_mm 은 캔버스 CSS px / 페이지 mm. 없으면 zoom 1.
 */
export type SnapCtx = {
  frame: Frame;
  view: View;
  x_mm: number;
  y_mm: number;
  exclude?: HandleId;
  unsnap?: boolean;
  px_per_mm?: number;
};

/**
 * 자석 한 칸. 좌표는 페이지 mm.
 * point 는 꼭짓점. path 는 1D (선분·직선·Path·plot 폴리라인).
 * 호스트는 figure.kind 를 모른다. feature 는 객체 id 가 없는 자석.
 */
export type SnapHit =
  | {
      kind: "point";
      id: HandleId;
      x_mm: number;
      y_mm: number;
    }
  | {
      kind: "path";
      id: HandleId;
      x_mm: number;
      y_mm: number;
    }
  | {
      kind: "feature";
      x_mm: number;
      y_mm: number;
    };

/** 내부 객체 삭제 결과. removed 는 종속 객체를 포함한 실제 삭제 id 이다. */
export type RemoveResult<State> = { state: State; removed: readonly HandleId[] };

/** 도구 진행 안내. 앱은 문장과 취소 가능 여부만 표시하며 spec 을 읽지 않는다. */
export type ToolGuidance = { message: string; canCancel: boolean; canFinish?: boolean };

/**
 * 최소 구현은 specSchema + init + compile.
 * hit/apply/toSpec 은 손잡이가 있는 엔진만. 없으면 편집 모드에서 점이 안 잡힌다.
 * tools 는 편집 툴바. place 는 도구 클릭. preview 는 커서 ghost.
 * snap 은 점·경로 자석. spec 을 쓰지 않는다.
 */
export type StemfigPlugin<Spec = unknown, State = Spec> = {
  kind: string;
  version: number;
  specSchema: ZodType<Spec>;
  init(spec: Spec): State;
  compile(ctx: CompileCtx, state: State): DisplayItem[];
  hit?(ctx: HitCtx, state: State): HandleId | null;
  apply?(ctx: ApplyCtx, state: State, patch: HandlePatch): State;
  /** apply 뒤 JSON 에 되돌릴 spec. 없으면 호스트가 드래그를 저장하지 못한다. */
  toSpec?(state: State): Spec;
  anchors?(ctx: AnchorsCtx, state: State): HandleAnchor[];
  step?(state: State, dt: number): State;
  /**
   * figure 편집 도구. 앱은 kind 로 분기하지 않고 이 목록만 그린다.
   * separator 는 구분선. 클릭 변이는 place 가 버튼 id 로 받는다.
   */
  tools?: readonly FigureTool[];
  /**
   * 도구 클릭. 모르는 tool 이면 undefined.
   * toSpec 이 있어야 호스트가 저장한다.
   */
  place?(ctx: PlaceCtx, state: State): PlaceResult<State> | undefined;
  /**
   * 도구 미리보기. place 와 같은 ctx.
   * spec 을 쓰지 않는다. 호스트가 transact 하지 않는다.
   * undefined = 이 tool 은 미리보기 없음. [] = 이 프레임은 그릴 것 없음.
   */
  preview?(ctx: PlaceCtx, state: State): DisplayItem[] | undefined;
  /**
   * 커서 자석. spec 을 쓰지 않는다.
   * 없으면 호스트가 스냅을 건너뛴다. 가까운 대상이 없으면 undefined.
   */
  snap?(ctx: SnapCtx, state: State): SnapHit | undefined;
  /**
   * 레이어 패널 행. 앱은 kind 로 분기하지 않고 이 목록만 그린다.
   * id 는 손잡이. 호스트가 figure.id 와 합쳐 트리 id 를 만든다.
   * 없으면 figure 는 빈 컨테이너. spec 을 앱이 열지 말 것.
   */
  layers?(state: State): readonly LayerItem[];
  /**
   * 속성 패널 행. 앱은 kind 로 분기하지 않고 이 목록만 그린다.
   * 없으면 플러그인 섹션이 비다. toSpec 이 있어야 저장한다.
   */
  fields?(ctx: FieldsCtx, state: State): readonly InspectField[];
  /**
   * 필드 절대값. 모르는 key 면 입력을 그대로.
   * toSpec 이 있어야 호스트가 저장한다.
   */
  applyField?(ctx: ApplyCtx, state: State, patch: FieldPatch): State;
  /** 내부 객체와 종속 객체 삭제. 참조 관계 해석은 플러그인만 책임진다. */
  remove?(ctx: ApplyCtx, state: State, ids: readonly HandleId[]): RemoveResult<State> | undefined;
  /** 미완성 작도만 취소한다. 이미 생성한 객체는 남기고 상태를 돌려준다. */
  cancel?(ctx: ApplyCtx, state: State): State;
  /** 현재 도구 단계. 모르는 도구나 안내가 없으면 undefined. */
  guidance?(ctx: { tool: string }, state: State): ToolGuidance | undefined;
  /** 도구의 명시적 완료. 완료 가능 판정과 미완성 상태 해석은 플러그인이 소유한다. */
  finish?(ctx: ApplyCtx & { tool: string }, state: State): PlaceResult<State> | undefined;
  /** 쓰기 전 검증. 성공은 undefined, 실패는 사용자에게 표시할 이유. */
  validateField?(ctx: ApplyCtx, state: State, patch: FieldPatch): string | undefined;
  /**
   * 문서 모드에서 새 figure 를 붙일 때.
   * 없으면 이 kind 는 툴바에 안 나온다. 호스트는 spec 을 해석하지 않는다.
   */
  create?: {
    label: string;
    icon: string;
    seed(frame: Frame): {
      spec: Spec;
      /* 없으면 호스트가 frame mm 1:1. 교과 창은 플러그인이 넣는다. */
      view?: View;
      interaction?: { handles: string[]; invariants: string[] };
    };
  };
};
