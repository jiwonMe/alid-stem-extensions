/**
 * 문서 진단. compileDocument 가 오류 박스로 삼키는 figure 실패를 문서 JSON 경로와 함께 돌려준다.
 * 판정은 runFigure 한 곳이다. 박스로 그려지는 figure 는 여기서도 반드시 오류가 난다.
 * 경고(warnings.ts)는 그려지기는 하지만 저자 의도와 어긋나기 쉬운 것만. 판정을 바꾸지 않는다.
 * kind 로 분기하지 않는다. 봉투를 파싱하지 않는다. parseDocument 를 통과한 Document 만 받는다.
 * 봉투(SCHEMA) 실패는 parseDocument 의 StemfigValidationError 가 이미 경로를 싣고 있다.
 */
import { runFigure } from "../compile/run-figure.ts";
import type { Document } from "../envelope/document.ts";
import { StemfigValidationError, type StemfigError } from "../envelope/errors.ts";
import type { Figure } from "../envelope/node.ts";
import { indexNodes } from "../envelope/tree.ts";
import type { StemfigPlugin } from "../plugin/plugin.ts";
import { pluginKey, type Registry } from "../plugin/registry.ts";
import { diag, type Diagnostic } from "./diagnostic.ts";
import { controlCharWarnings, ignoredKeyWarnings, placementWarnings } from "./warnings.ts";
import { issuesToErrors } from "./zod-issues.ts";
import { isRecord } from "./zod-walk.ts";

/**
 * @param doc parseDocument 를 통과한 봉투
 * @param registry compileDocument 에 주는 것과 같은 엔진 표
 * @returns figure 선언 순서대로, figure 마다 오류 다음 경고. 문제가 없으면 빈 배열. throw 하지 않는다
 */
export function checkDocument(doc: Document, registry: Registry): Diagnostic[] {
  const index = indexNodes(doc);
  return index.figures.flatMap((figure) => {
    const path = index.byId.get(figure.id)?.path ?? "nodes";
    return [
      ...figureDiagnostics(figure, path, doc, registry),
      ...controlCharWarnings(figure, path),
      ...placementWarnings(figure, path, index),
    ];
  });
}

/**
 * 엔진 단계별 실패. spec 은 zod 경로, init·compile 은 플러그인이 준 경로를 문서 경로로 옮긴다.
 * 모르는 spec 키 경고는 엔진을 찾았으면 spec 이 깨졌어도 낸다. 오타가 실패 원인일 때가 많다.
 */
function figureDiagnostics(figure: Figure, path: string, doc: Document, registry: Registry): Diagnostic[] {
  const run = runFigure(figure, doc.plugins, registry);
  if (!run.ok && run.stage === "plugin") {
    return [missingPlugin(figure, path, doc, registry)];
  }
  const ignored = ignoredKeyWarnings(figure, path, run.plugin);
  if (!run.ok && run.stage === "spec") {
    const scope = { schema: run.plugin.specSchema, input: figure.spec, code: "SPEC" as const, prefix: [...path.split("."), "spec"] };
    return [...issuesToErrors(run.issues, scope).map((error) => fromError(error, figure)), ...ignored];
  }
  return run.ok ? ignored : [...engineErrors(run.error, figure, path, run.plugin), ...ignored];
}

/**
 * 미설치 박스의 원인. 문서 plugins 누락, 버전 불일치, 엔진 자체 없음을 가른다.
 * 고칠 자리를 path 로 준다. 누락이면 plugins, 그 밖에는 figure.kind.
 */
function missingPlugin(figure: Figure, path: string, doc: Document, registry: Registry): Diagnostic {
  const installed = registry.all().map((plugin) => pluginKey(plugin.kind, plugin.version));
  const same = installed.filter((key) => key.startsWith(`${figure.kind}@`));
  const listed = doc.plugins.findIndex((item) => item.startsWith(`${figure.kind}@`));
  if (listed < 0 && same.length > 0) {
    return diag("error", "MISSING_PLUGIN", "plugins", `document.plugins does not list ${figure.kind}; add ${JSON.stringify(same[0])}`, figure.id);
  }
  if (listed >= 0 && same.length > 0) {
    return diag("error", "MISSING_PLUGIN", `plugins.${listed}`, `${doc.plugins[listed]} is not installed; installed: ${same.join(", ")}`, figure.id);
  }
  const known = installed.length > 0 ? installed.join(", ") : "none";
  return diag("error", "MISSING_PLUGIN", `${path}.kind`, `no installed plugin for kind ${JSON.stringify(figure.kind)}; installed: ${known}`, figure.id);
}

/**
 * init·compile 이 던진 오류. 플러그인 경로는 figure 기준 `spec.…` 이 약속이다.
 * 그 약속을 지킨 경로만 문서 경로로 잇고, 아니면 spec 자리에 두고 원래 경로를 메시지에 남긴다.
 * StemfigValidationError 가 아닌 throw 는 엔진 버그일 수 있지만 박스는 SPEC 이므로 같은 코드로 낸다.
 */
function engineErrors(error: unknown, figure: Figure, path: string, plugin: StemfigPlugin): Diagnostic[] {
  if (error instanceof StemfigValidationError && error.errors.length > 0) {
    return error.errors.map((item) => {
      const local = item.path;
      if (local === "spec" || local.startsWith("spec.")) {
        return fromError({ ...item, path: `${path}.${byIndex(figure, local)}` }, figure);
      }
      const message = local ? `${local}: ${item.message}` : item.message;
      return fromError({ ...item, path: `${path}.spec`, message }, figure);
    });
  }
  const reason = error instanceof Error ? error.message : String(error);
  return [diag("error", "SPEC", `${path}.spec`, `${pluginKey(plugin.kind, plugin.version)} failed: ${reason}`, figure.id)];
}

/**
 * 플러그인이 배열 칸을 id 로 적은 경로(spec.objects.ball.angle)를 index 로 고친다.
 * 그 배열에 정확히 그 id 를 가진 원소가 있을 때만 바꾼다. 없으면 그대로 둔다.
 */
function byIndex(figure: Figure, local: string): string {
  const keys = local.split(".");
  let value: unknown = { spec: figure.spec };
  return keys.map((key) => {
    if (Array.isArray(value) && !/^\d+$/.test(key)) {
      const at = value.findIndex((item) => isRecord(item) && item.id === key);
      if (at >= 0) {
        value = value[at];
        return String(at);
      }
    }
    value = Array.isArray(value) ? value[Number(key)] : isRecord(value) ? value[key] : undefined;
    return key;
  }).join(".");
}

function fromError(error: StemfigError, figure: Figure): Diagnostic {
  return diag("error", error.code, error.path, error.message, figure.id, error.expected);
}
