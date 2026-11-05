/**
 * 작도 객체 id. 스키마 POINT_ID / EDGE_ID 만 만든다.
 * 호스트 figure.id 규칙과 섞지 말 것.
 */
import type { GeometryState } from "../init.ts";

/** 점 ^[A-Z][A-Z0-9]*$ . A–Z 다음 A1. */
const POINT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** 선 ^[a-z][a-z0-9_]*$ . a–z 다음 a1. */
const EDGE_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/**
 * 쓰이지 않는 대문자 id. 중점 M 도 쓴 것으로 본다.
 * @returns A–Z, 그다음 A1…Z999
 */
export function nextPointId(state: GeometryState): string {
  return nextId(state, POINT_LETTERS, (ch, n) => (n === 0 ? ch : `${ch}${n}`));
}

/**
 * 쓰이지 않는 소문자 id.
 * @returns a–z, 그다음 a1…z999
 */
export function nextEdgeId(state: GeometryState): string {
  return nextId(state, EDGE_LETTERS, (ch, n) => (n === 0 ? ch : `${ch}${n}`));
}

/**
 * 점·선·각·변 마크가 안 쓰는 소문자 id.
 * hit/fields 가 HandleId 하나를 쓴다.
 * @returns a–z, 그다음 a1
 */
export function nextAnnotId(state: GeometryState): string {
  return nextId(state, EDGE_LETTERS, (ch, n) => (n === 0 ? ch : `${ch}${n}`));
}

function nextId(
  state: GeometryState,
  letters: string,
  make: (ch: string, n: number) => string,
): string {
  for (let n = 0; n < 1000; n += 1) {
    for (const ch of letters) {
      const id = make(ch, n);
      if (!idUsed(state, id)) {
        return id;
      }
    }
  }
  throw new Error("geometry id space exhausted");
}

function idUsed(state: GeometryState, id: string): boolean {
  if (state.byId.has(id)) {
    return true;
  }
  if (state.spec.angles?.some((item) => item.id === id)) {
    return true;
  }
  return Boolean(state.spec.marks?.some((item) => item.id === id));
}
