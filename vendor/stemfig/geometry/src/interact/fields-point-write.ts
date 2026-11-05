/**
 * 점 정의의 절대값 갱신. 분할·교점 제약을 먼저 검사하고 새 spec 으로 재평가한다.
 * 이 층은 UI 와 호스트 봉투를 모르며 유효하지 않은 입력은 원래 상태로 남긴다.
 */
import type { FieldPatch } from "@stemfig/host";
import { isInfiniteExternal, type DivisionMode } from "../divide.ts";
import { initGeometry, type GeometryState } from "../init.ts";
import { listIntersections, pathGeomOf } from "../intersect.ts";
import { pathOf } from "../path-of.ts";
import { clampT } from "../path.ts";
import type { GeometrySpec } from "../schema.ts";

/** 분할 비율·모드를 검증한다. @param state 현재 작도 @param id 점 id @param def 기존 분할 정의 @param patch 필드 입력 @returns 유효한 새 상태. 무한 외분·다른 키는 입력 */
export function applyDivisionField(
  state: GeometryState,
  id: string,
  def: Extract<GeometrySpec["objects"][number]["def"], { 0: "division" }>,
  patch: FieldPatch,
): GeometryState {
  const [, a, b, m0, n0, mode0] = def;
  let m = m0;
  let n = n0;
  let mode: DivisionMode = mode0;
  if (patch.key === "m" && typeof patch.value === "number" && patch.value > 0) {
    m = patch.value;
  } else if (patch.key === "n" && typeof patch.value === "number" && patch.value > 0) {
    n = patch.value;
  } else if (
    patch.key === "mode" &&
    (patch.value === "internal" || patch.value === "external")
  ) {
    mode = patch.value;
  } else {
    return state;
  }
  if (isInfiniteExternal(m, n, mode)) {
    return state;
  }
  return initGeometry(setDivision(state.spec, id, a, b, m, n, mode));
}

/** 교점 후보 밖의 인덱스를 거절한다. @param state 현재 작도 @param id 교점 id @param def 기존 교점 정의 @param patch 인덱스 입력 @returns 유효한 후보의 새 상태. 잘못된 값은 입력 */
export function applyIntersectField(
  state: GeometryState,
  id: string,
  def: Extract<GeometrySpec["objects"][number]["def"], { 0: "intersect" }>,
  patch: FieldPatch,
): GeometryState {
  if (patch.key !== "index" || typeof patch.value !== "number" || patch.value < 0) {
    return state;
  }
  const index = Math.floor(patch.value);
  const pa = state.byId.get(def[1]);
  const pb = state.byId.get(def[2]);
  if (!pa || !pb) {
    return state;
  }
  const ga = pathGeomOf(pa, state.points);
  const gb = pathGeomOf(pb, state.points);
  const hits = ga && gb ? listIntersections(ga, gb) : null;
  if (!hits || index >= hits.length) {
    return state;
  }
  return initGeometry(setIntersectIndex(state.spec, id, def[1], def[2], index));
}

/** @param spec 현재 정의 @param id 자유점 id @param x 수학 x @param y 수학 y @returns 점 좌표를 바꾼 정의. 없는 id 는 내용 유지 */
export function setPoint(spec: GeometrySpec, id: string, x: number, y: number): GeometrySpec {
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id && obj.def[0] === "point"
        ? { ...obj, def: ["point", x, y] }
        : obj,
    ),
  };
}

/** @param state 현재 작도 @param id 경로 위 점 id @param t 경로 매개변수 @returns 경로 유효 구간으로 제한한 정의 */
export function setOnPathT(state: GeometryState, id: string, t: number): GeometrySpec {
  const obj = state.byId.get(id);
  const parent =
    obj && obj.def[0] === "on_path" ? state.byId.get(obj.def[1]) : undefined;
  const path = parent ? pathOf(parent, state.points) : undefined;
  const next = path ? clampT(path, t) : t;
  return {
    ...state.spec,
    objects: state.spec.objects.map((item) =>
      item.id === id && item.def[0] === "on_path"
        ? { ...item, def: ["on_path", item.def[1], next] }
        : item,
    ),
  };
}

/** @param spec 현재 정의 @param id 라벨 소유 점 @param raw 각도. 0–360도로 제한 @returns 라벨 방향만 바꾼 정의 */
export function setLabelAngle(spec: GeometrySpec, id: string, raw: number): GeometrySpec {
  const labelAngle = Math.min(360, Math.max(0, raw));
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id ? { ...obj, labelAngle } : obj,
    ),
  };
}

/** @param spec 현재 정의 @param id 라벨 소유 점 @param raw 거리 mm. 음수는 0 @returns 본체를 움직이지 않은 정의 */
export function setLabelDistance(spec: GeometrySpec, id: string, raw: number): GeometrySpec {
  const labelDistance = Math.max(0, raw);
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id ? { ...obj, labelDistance } : obj,
    ),
  };
}

/** @param spec 현재 정의 @param id 라벨 소유 점 @param value 라벨 원문. 빈 값은 제거 @returns 라벨만 바꾼 정의 */
export function setLabel(spec: GeometrySpec, id: string, value: string): GeometrySpec {
  return {
    ...spec,
    objects: spec.objects.map((obj) => {
      if (obj.id !== id) {
        return obj;
      }
      if (value === "") {
        const { label: _omit, ...rest } = obj;
        return rest;
      }
      return { ...obj, label: value };
    }),
  };
}

function setDivision(
  spec: GeometrySpec,
  id: string,
  a: string,
  b: string,
  m: number,
  n: number,
  mode: DivisionMode,
): GeometrySpec {
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id && obj.def[0] === "division"
        ? { ...obj, def: ["division", a, b, m, n, mode] }
        : obj,
    ),
  };
}

function setIntersectIndex(
  spec: GeometrySpec,
  id: string,
  a: string,
  b: string,
  index: number,
): GeometrySpec {
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id && obj.def[0] === "intersect"
        ? { ...obj, def: ["intersect", a, b, index] }
        : obj,
    ),
  };
}

