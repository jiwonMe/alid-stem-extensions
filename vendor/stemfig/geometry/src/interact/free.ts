/**
 * 점 능력 한곳. hit/anchors/snap/apply 는 이 표만 읽는다.
 * handles 는 자유점·경로점의 이동 잠금이다. 파생점은 잠금 밖.
 * 호스트는 이 모듈을 모른다. kind 분기를 앱에 올리지 말 것.
 */
import type { GeometryState } from "../init.ts";
import { isShown } from "../schema.ts";

const NONE: PointRole = {
  snap: false,
  hover: false,
  drag: false,
  free: false,
};

/**
 * 한 점의 네 능력.
 * snap 은 숨긴 파생점도. hover 는 보이는 파생점. drag/free 는 파생점 불가.
 */
export type PointRole = {
  /** 커서 자석. place 가 점을 겹쳐 만들지 않게. */
  snap: boolean;
  /** 히트·HUD 앵커. 내분점은 show 에 있을 때만. */
  hover: boolean;
  /** 점 손잡이. 내분·교점·수선은 false. 선분 선택은 hover. */
  drag: boolean;
  /** spec x,y 를 직접 민다. on_path·내분점은 false. */
  free: boolean;
};

/**
 * 점 id 의 능력. 없는 id 는 전부 false.
 * @param allowed figure.interaction.handles. null 이면 잠금 없음
 * @returns snap/hover/drag/free. 파생은 drag·free 가 꺼진다
 */
export function pointRole(
  state: GeometryState,
  id: string,
  allowed: Set<string> | null,
): PointRole {
  const obj = state.byId.get(id);
  if (!obj) {
    return NONE;
  }
  if (obj.def[0] === "point") {
    const ok = !allowed || allowed.has(id);
    return { snap: true, hover: ok, drag: ok, free: ok };
  }
  if (obj.def[0] === "on_path") {
    const ok = !allowed || allowed.has(id);
    return { snap: true, hover: ok, drag: ok, free: false };
  }
  if (obj.def[0] === "division") {
    return {
      snap: true,
      hover: isShown(obj),
      drag: false,
      free: false,
    };
  }
  if (obj.def[0] === "intersect" || obj.def[0] === "projection") {
    /* 이번 배치에 좌표가 없으면 자석·호버도 끈다. */
    const live = state.points.has(id);
    return {
      snap: live,
      hover: live && isShown(obj),
      drag: false,
      free: false,
    };
  }
  return NONE;
}

/**
 * 선분을 고를 수 있는지. 양 끝이 보이면 된다.
 * 통째 이동은 isMovablePair. 내분·교점 끝이어도 고른다.
 * 좌표가 없거나 숨긴 끝은 빼다.
 * @returns 한쪽 hover 가 꺼지면 false
 */
export function isSegHandle(
  state: GeometryState,
  a: string,
  b: string,
  allowed: Set<string> | null,
): boolean {
  return pointRole(state, a, allowed).hover && pointRole(state, b, allowed).hover;
}

/**
 * 양 끝이 자유점이어야 선분/직선을 통째로 민다.
 * 선택은 isSegHandle. apply 만 이 함수.
 * @returns 한쪽이라도 종속점이면 false
 */
export function isMovablePair(
  state: GeometryState,
  a: string,
  b: string,
  allowed: Set<string> | null,
): boolean {
  return pointRole(state, a, allowed).free && pointRole(state, b, allowed).free;
}
