/**
 * kind@version → 플러그인.
 * 호스트는 등록표만 본다. 구현체를 package.json 에 넣지 말 것. preview 가 register 한다.
 */
import type { StemfigPlugin } from "./plugin.ts";

export class Registry {
  private readonly plugins = new Map<string, StemfigPlugin>();

  register(plugin: StemfigPlugin): void {
    this.plugins.set(pluginKey(plugin.kind, plugin.version), plugin);
  }

  get(kind: string, version: number): StemfigPlugin | undefined {
    return this.plugins.get(pluginKey(kind, version));
  }

  /**
   * 등록된 엔진 전부. 문서 모드 create 목록이 여기를 돈다.
   * 등록 순서를 유지한다. kind 리터럴 분기는 호출 측 금지.
   */
  all(): readonly StemfigPlugin[] {
    return [...this.plugins.values()];
  }
}

export function pluginKey(kind: string, version: number): string {
  return `${kind}@${version}`;
}

/**
 * 문서 plugins 에 kind@version 이 있고 레지스트리에 같은 키가 있을 때만 성공.
 * 없으면 undefined. throw 하지 않는다.
 * @param kind figure.kind
 * @param plugins document.plugins
 */
export function resolvePlugin(
  kind: string,
  plugins: string[],
  registry: Registry,
): StemfigPlugin | undefined {
  const req = plugins.find((item) => item.startsWith(`${kind}@`));
  if (!req) {
    return undefined;
  }
  const version = Number(req.slice(kind.length + 1));
  if (!Number.isInteger(version)) {
    return undefined;
  }
  return registry.get(kind, version);
}
