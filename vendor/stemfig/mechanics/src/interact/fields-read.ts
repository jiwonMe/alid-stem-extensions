/**
 * 역학 객체와 손잡이를 호스트의 선언형 속성 행으로 투영한다.
 * 좌표·연결 관계의 뜻은 이 플러그인에 남고 앱은 행 타입만 해석한다.
 * 문서를 변경하지 않으며 연결점 계산은 init의 파생 상태를 사용한다.
 */
import type { InspectField } from "@stemfig/host";
import { DEFAULT_STYLE } from "@stemfig/display";
import { referencePoint, type MechanicsState } from "../init.ts";
import type { MechanicsObject, PointRef, Vec } from "../schema.ts";
import { groupMechanicsFields, objectChoiceName } from "./fields-groups.ts";
import { readMotionFields } from "./fields-motion.ts";
import { readForcePolar, readPolarFields } from "./fields-polar.ts";

/** 유효한 객체와 그 내부 손잡이. 객체 id에 콜론을 금지한 schema 계약을 사용한다. */
export type FieldTarget = { object: MechanicsObject; part?: string; index?: number };

/**
 * @param state 현재 파생 상태
 * @param id 객체 또는 내부 손잡이 id
 * @returns 실제 존재하는 대상. 잘못된 접미사·인덱스는 undefined이며 예외를 던지지 않는다.
 */
export function fieldTarget(state: MechanicsState, id: string): FieldTarget | undefined {
  const [owner, part, index, extra] = id.split(":");
  const object = state.byId.get(owner!);
  if (!object || extra !== undefined) return undefined;
  if (!part) return id === object.id ? { object } : undefined;
  if (part === "point" && object.type === "track") {
    /* 01 같은 별칭은 실제 anchors가 내보낸 id와 다르므로 받지 않는다. */
    const n = Number(index);
    return Number.isInteger(n) && String(n) === index && object.points[n]
      ? { object, part, index: n } : undefined;
  }
  if (index !== undefined) return undefined;
  if (part === "label") return { object, part };
  if ((part === "a" || part === "b") && (object.type === "dimension" || object.type === "guide" || object.type === "spring" || object.type === "rope" || object.type === "trajectory" || object.type === "angle")) return { object, part };
  if ((part === "center" || part === "radius") && object.type === "pulley") return { object, part };
  if (part === "point" && object.type === "support") return { object, part };
  if ((part === "from" || part === "end" || part === "angle-label") && object.type === "force") return { object, part };
  if (part === "at" && (object.type === "label" || object.type === "point")) return { object, part };
  if (object.type === "ball" && part === "center") return { object, part };
  if (object.type === "trajectory" && (part === "aim" || part === "apex" || part === "launch-label" || part === "arrival-label" || part === "angle-label" || part === "apex-label")) return { object, part };
  if (object.type === "angle" && part === "v") return { object, part };
  if (part === "arrow" && object.type === "trajectory") {
    const n = Number(index);
    return Number.isInteger(n) && String(n) === index && object.arrows[n] !== undefined ? { object, part, index: n } : undefined;
  }
  return undefined;
}

/**
 * @param state 현재 작도 상태
 * @param target 검증한 선택 대상
 * @returns 대상에 적용 가능한 행. 미지원 대상은 빈 배열이며 예외를 던지지 않는다.
 */
export function readMechanicsFields(state: MechanicsState, target: FieldTarget): InspectField[] {
  return groupMechanicsFields(baseFields(state, target), target);
}

function baseFields(state: MechanicsState, target: FieldTarget): InspectField[] {
  const { object, part, index } = target;
  if (part === "label") return common(object);
  if (part === "point" && object.type === "track") return [...coordinates(object.points[index!]!), ...readPolarFields(object, index!)];
  if (part === "point" && object.type === "support") return coordinates(object.point);
  if (object.type === "pulley") {
    if (part === "center") return coordinates(object.center);
    if (part === "radius") return [num("radius", "반지름", object.radius, { min: 0 })];
  }
  if (part === "end" && object.type === "force") {
    const p = referencePoint(object.from, state);
    return coordinates([p[0] + object.delta[0], p[1] + object.delta[1]]);
  }
  if (part) {
    const ref = targetReference(target);
    return ref ? referenceFields(state, ref, "", "") : [];
  }
  switch (object.type) {
    case "track":
      return [num("rounding", "모서리 둥글기", object.rounding, { min: 0 }),
        bool("ground", "지면 채움", Boolean(object.ground)),
        ...(object.ground ? [
          segmented("groundStyle", "채움", object.ground.style, [{ value: "shade", label: "회색" }, { value: "hatch", label: "빗금" }]),
          segmented("groundSide", "방향", object.ground.side, [
            { value: "below", label: "아래" }, { value: "above", label: "위" }, { value: "left", label: "왼쪽" }, { value: "right", label: "오른쪽" },
          ]),
          num("groundDepth", "띠 두께", object.ground.depth, { min: 0, unit: "mm" }),
        ] : []),
        ...common(object)];
    case "block": {
      const pose = object.pose;
      return [
        num("width", "너비", object.width, { min: 0 }), num("height", "높이", object.height, { min: 0 }),
        segmented("fill", "채움", object.fill ?? "paper", [{ value: "paper", label: "흰색" }, { value: "shade", label: "회색" }]),
        choice("track", "부착 경로", pose.mode === "track" ? `track:${pose.track}` : "free", [
          { value: "free", label: "자유 배치" },
          ...state.spec.objects.filter(o => o.type === "track").map(o => ({ value: `track:${o.id}`, label: objectChoiceName(o, state) })),
        ]),
        ...(pose.mode === "free" ? [...coordinates(pose.point), num("angle", "회전", pose.angle, { unit: "°", step: 1 })]
          : [num("t", "경로상 위치", pose.t * 100, { min: 0, max: 100, step: 1, unit: "%" }), num("offset", "경로 간격", pose.offset)]),
        ...common(object),
      ];
    }
    case "force":
      return [...referenceFields(state, object.from, "from.", "시작 "),
        num("deltaX", "화살표 ΔX", object.delta[0]), num("deltaY", "화살표 ΔY", object.delta[1]),
        ...readForcePolar(object.delta),
        bool("angleMark", "각도 표시", Boolean(object.angleMark)),
        ...common(object)];
    case "dimension":
      return [choice("axis", "치수 방향", object.axis, [{ value: "horizontal", label: "가로" }, { value: "vertical", label: "세로" }]),
        num("offset", "치수선 간격", object.offset),
        ...referenceFields(state, object.a, "a.", "시작 "), ...referenceFields(state, object.b, "b.", "끝 "), ...common(object)];
    case "guide":
      return [...referenceFields(state, object.a, "a.", "시작 "), ...referenceFields(state, object.b, "b.", "끝 "), ...common(object)];
    case "spring":
      /* 감김 수의 2..40 범위는 schema의 교재 작도 계약과 동일하다. 길이를 바꿔도 권수는 보존한다. */
      return [num("width", "용수철 폭", object.width, { min: 0 }), num("coils", "감김 수", object.coils, { min: 2, max: 40, step: 1 }),
        ...referenceFields(state, object.a, "a.", "시작 "), ...referenceFields(state, object.b, "b.", "끝 "), ...common(object)];
    case "pulley":
      return [...coordinates(object.center), num("radius", "반지름", object.radius, { min: 0 }), ...common(object)];
    case "support":
      return [...coordinates(object.point), num("width", "받침대 너비", object.width, { min: 0 }),
        num("height", "받침대 높이", object.height, { min: 0 }), num("angle", "회전", object.angle, { unit: "°", step: 1 }), ...common(object)];
    case "rope":
      return [choice("pulley", "경유 도르래", object.pulley ? `pulley:${object.pulley}` : "none", [
        { value: "none", label: "직선 연결" },
        ...state.spec.objects.filter(o => o.type === "pulley").map(o => ({ value: `pulley:${o.id}`, label: objectChoiceName(o, state) })),
      ]), ...(object.pulley ? [choice("wrap", "감는 방향", object.wrap, [{ value: "cw", label: "시계 방향" }, { value: "ccw", label: "반시계 방향" }])] : []),
      ...referenceFields(state, object.a, "a.", "시작 "), ...referenceFields(state, object.b, "b.", "끝 "), ...common(object)];
    case "label":
      return [...referenceFields(state, object.at, "at.", ""), ...common(object)];
    case "ball":
    case "point":
    case "trajectory":
    case "angle":
      return [...readMotionFields(state, object), ...common(object)];
  }
}

/**
 * @param target 검증한 선택 대상
 * @returns 연결점 손잡이가 가리키는 원본. 객체·라벨·화살표 끝은 undefined이며 예외를 던지지 않는다.
 */
export function targetReference(target: FieldTarget): PointRef | undefined {
  const { object, part } = target;
  if (object.type === "force" && part === "from") return object.from;
  if ((object.type === "guide" || object.type === "dimension" || object.type === "spring" || object.type === "rope") && (part === "a" || part === "b")) return object[part];
  if (object.type === "label" && part === "at") return object.at;
  return undefined;
}

function common(object: MechanicsObject): InspectField[] {
  return [
    { key: "label", label: "라벨", type: "text", value: object.label ?? "" },
    ...(object.label ? [num("labelSize", "라벨 크기", object.labelSize ?? DEFAULT_STYLE.textSize, { unit: "mm", min: 0 })] : []),
    { key: "show", label: "표시", type: "boolean", value: object.show !== false },
    strokeField(object),
    { key: "weight", label: "선 굵기", type: "enum", value: object.weight ?? "auto", appearance: "segmented", options: [
      { value: "auto", label: "역할" }, { value: "thin", label: "가늘게" }, { value: "normal", label: "보통" }, { value: "bold", label: "굵게" },
    ] },
    ...(object.label ? [num("labelOffsetX", "라벨 간격 X", object.labelOffset?.[0] ?? 0, { unit: "mm" }),
      num("labelOffsetY", "라벨 간격 Y", object.labelOffset?.[1] ?? 0, { unit: "mm" })] : []),
  ];
}

function referenceFields(state: MechanicsState, ref: PointRef, prefix: string, label: string): InspectField[] {
  const point = referencePoint(ref, state);
  const owner = ref.mode === "anchor" ? state.byId.get(ref.object) : undefined;
  const selected = ref.mode === "free" ? "free" : ref.mode === "vertex" ? `vertex:${ref.track}:${ref.index}` : `${owner!.type}:${ref.object}`;
  const targets = choice(`${prefix}target`, `${label}연결 대상`, selected, [
    { value: "free", label: "자유 배치" },
    ...state.spec.objects.filter(o => o.type === "block" || o.type === "pulley" || o.type === "support" || o.type === "ball" || o.type === "point" || o.type === "trajectory")
      .map(o => ({ value: `${o.type}:${o.id}`, label: objectChoiceName(o, state) })),
    ...state.spec.objects.filter(o => o.type === "track").flatMap(o => o.points.map((_, index) => ({ value: `vertex:${o.id}:${index}`, label: `${objectChoiceName(o, state)} 점 ${index + 1}` }))),
  ]);
  if (ref.mode === "free") return [targets, ...coordinates(point, prefix, label)];
  if (ref.mode === "vertex") return [targets, num(`${prefix}offsetX`, `${label}연결 간격 X`, ref.offset?.[0] ?? 0), num(`${prefix}offsetY`, `${label}연결 간격 Y`, ref.offset?.[1] ?? 0)];
  return [targets, choice(`${prefix}anchor`, `${label}연결점`, ref.anchor, anchorOptions(owner?.type)),
    num(`${prefix}offsetX`, `${label}연결 간격 X`, ref.offset?.[0] ?? 0), num(`${prefix}offsetY`, `${label}연결 간격 Y`, ref.offset?.[1] ?? 0)];
}

function anchorOptions(type: string | undefined): { value: string; label: string }[] {
  if (type === "point") return [{ value: "center", label: "점" }];
  if (type === "trajectory") return [{ value: "start", label: "시작" }, { value: "end", label: "끝" }, { value: "apex", label: "최고점" }];
  return [{ value: "center", label: "중앙" }, { value: "top", label: "위" }, { value: "bottom", label: "아래" }, { value: "left", label: "왼쪽" }, { value: "right", label: "오른쪽" }];
}

function bool(key: string, label: string, value: boolean): InspectField {
  return { key, label, type: "boolean", value };
}

function coordinates(point: Vec, prefix = "", label = ""): InspectField[] {
  return [num(`${prefix}x`, `${label}X`, point[0]), num(`${prefix}y`, `${label}Y`, point[1])];
}

function num(key: string, label: string, value: number, extra: Partial<Extract<InspectField, { type: "number" }>> = {}): InspectField {
  return { key, label, type: "number", value, step: 0.1, ...extra };
}

function choice(key: string, label: string, value: string, options: { value: string; label: string }[]): InspectField {
  return { key, label, type: "enum", value, options };
}

function segmented(key: string, label: string, value: string, options: { value: string; label: string }[]): InspectField {
  return { key, label, type: "enum", value, options, appearance: "segmented" };
}

function strokeField(object: MechanicsObject): InspectField {
  const dashed = object.dashed ?? (object.type === "guide" || object.type === "trajectory");
  const value = !dashed ? "solid" : object.dash === "dot" ? "dot" : "dash";
  return { key: "stroke", label: "선 모양", type: "enum", value, appearance: "segmented", options: [
    { value: "solid", label: "실선" }, { value: "dash", label: "점선" }, { value: "dot", label: "점점선" },
  ] };
}
