/**
 * 그려지기는 하지만 저자 의도와 어긋나기 쉬운 것들. 판정(오류 박스)을 바꾸지 않는다.
 * 모르는 키, 제어 문자, 시트 밖 figure. 전부 JSON 모양과 봉투 상자만 본다. kind 로 분기하지 않는다.
 */
import { frameContains, intersectFrames, type Frame } from "@stemfig/display";
import { documentSchema } from "../envelope/document.ts";
import { isFrameNode, type Figure } from "../envelope/node.ts";
import type { NodeIndex } from "../envelope/tree.ts";
import type { StemfigPlugin } from "../plugin/plugin.ts";
import { pluginKey } from "../plugin/registry.ts";
import { diag, type Diagnostic } from "./diagnostic.ts";
import { keyAdvice, unknownKeys } from "./zod-keys.ts";
import { isRecord, type PathKey } from "./zod-walk.ts";

/* JSON 이 글자 하나로 만드는 제어 문자. "\b" → U+0008 처럼 TeX 명령(\beta)의 첫 글자를 먹는다. */
const JSON_LETTER: Record<string, string> = { "\b": "b", "\t": "t", "\n": "n", "\f": "f", "\r": "r" };
const CONTROL = /[\u0000-\u001f]/;

/**
 * 플러그인 스키마가 버리는 spec 키. spec 파싱이 실패해도 찾는다 (def 를 deff 로 쓴 경우 등).
 * 봉투는 strict 라 같은 실수가 SCHEMA 오류지만, spec 객체는 zod 기본(strip)이라 여기서만 잡힌다.
 * @param path 문서 안 figure 경로. 예: nodes.0.children.1
 */
export function ignoredKeyWarnings(figure: Figure, path: string, plugin: StemfigPlugin): Diagnostic[] {
  const owner = pluginKey(plugin.kind, plugin.version);
  return unknownKeys(plugin.specSchema, figure.spec).map(({ path: keys, allowed }) => {
    const key = String(keys[keys.length - 1]);
    const message = `${owner} does not use key ${JSON.stringify(key)} here, so it is ignored${keyAdvice(key, allowed)}`;
    return diag("warning", "IGNORED_KEY", `${path}.spec.${keys.join(".")}`, message, figure.id);
  });
}

/**
 * 그려질 수 있는 문자열(spec, 축 라벨)의 제어 문자.
 * 거의 언제나 JSON 에 TeX 명령을 백슬래시 하나로 쓴 것이다. 고칠 문자열을 함께 보여 준다.
 * 경로 데이터의 줄바꿈처럼 일부러 넣은 경우도 있을 수 있어 경고로만 낸다.
 */
export function controlCharWarnings(figure: Figure, path: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const visit = (value: unknown, at: string) => {
    if (typeof value === "string") {
      const found = CONTROL.exec(value)?.[0];
      if (found !== undefined) {
        out.push(diag("warning", "CONTROL_CHAR", at, controlMessage(value, found), figure.id));
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${at}.${index}`));
    } else if (isRecord(value)) {
      Object.entries(value).forEach(([key, item]) => visit(item, `${at}.${key}`));
    }
  };
  visit(figure.spec, `${path}.spec`);
  visit(figure.axes, `${path}.axes`);
  return out;
}

function controlMessage(value: string, found: string): string {
  const code = `U+${found.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
  const letter = JSON_LETTER[found];
  if (!letter) {
    return `string contains control character ${code}; remove it`;
  }
  /* 제어 문자를 원래의 \문자 로 되돌린 글자. JSON.stringify 가 백슬래시를 두 번 써서 보여 준다. */
  const intended = value.replace(/[\b\t\n\f\r]/g, (char) => `\\${JSON_LETTER[char]}`);
  return `string contains ${code}, which is how JSON reads "\\${letter}"; for a TeX command write the backslash twice: ${JSON.stringify(intended)}`;
}

/**
 * compile 의 attachClip 과 같은 규칙. 직속 부모 시트와의 교집합만 그린다. root figure 는 자르지 않는다.
 */
export function placementWarnings(figure: Figure, path: string, index: NodeIndex): Diagnostic[] {
  const parentId = index.byId.get(figure.id)?.parent;
  const parent = parentId ? index.byId.get(parentId)?.node : undefined;
  if (!parent || !isFrameNode(parent)) {
    return [];
  }
  const where = `figure ${box(figure.frame)}, sheet ${JSON.stringify(parent.id)} ${box(parent.frame)}`;
  if (!intersectFrames(figure.frame, parent.frame)) {
    return [diag("warning", "HIDDEN", `${path}.frame`, `figure lies entirely outside its sheet, so nothing is drawn (${where})`, figure.id)];
  }
  if (!frameContains(parent.frame, figure.frame)) {
    return [diag("warning", "CLIPPED", `${path}.frame`, `figure extends past its sheet; the overflow is clipped (${where})`, figure.id)];
  }
  return [];
}

function box(frame: Frame): string {
  return `x ${frame.x}..${frame.x + frame.w} y ${frame.y}..${frame.y + frame.h} mm`;
}

/**
 * 봉투에서 조용히 버려지는 키. frame·view·interaction 처럼 strict 가 아닌 하위 객체의 오타.
 * 봉투 본체와 노드는 strict 라 parseDocument 가 이미 오류로 낸다. spec 안은 ignoredKeyWarnings 가 본다.
 * 문서를 만들지 않는다. parseDocument 가 성공한 바로 그 입력을 다시 훑기만 한다 (app-kit readText 가 부른다).
 * @param input parseDocument 에 넣은 JSON 값
 * @returns 경고. 실패하지 않는다
 */
export function checkEnvelopeKeys(input: unknown): Diagnostic[] {
  return unknownKeys(documentSchema, input).map(({ path, allowed }) => {
    const key = String(path[path.length - 1]);
    const message = `stemfig/v1 does not use key ${JSON.stringify(key)} here, so it is ignored${keyAdvice(key, allowed)}`;
    return diag("warning", "IGNORED_KEY", path.join("."), message, nodeIdAt(input, path));
  });
}

/** 경로가 지나는 가장 깊은 노드(nodes·children 원소)의 id. */
function nodeIdAt(input: unknown, path: readonly PathKey[]): string | undefined {
  let value = input;
  let id: string | undefined;
  path.forEach((key, index) => {
    value = Array.isArray(value) ? value[Number(key)] : isRecord(value) ? value[String(key)] : undefined;
    const owner = path[index - 1];
    if ((owner === "nodes" || owner === "children") && isRecord(value) && typeof value.id === "string") {
      id = value.id;
    }
  });
  return id;
}
