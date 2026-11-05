/**
 * DisplayList 라벨 → upmath 원문 캐시.
 * compile 은 동기하므로 앱이 받은 뒤에만 호출한다.
 * 교과를 모른다. text.plain 은 건너뛴다.
 */
import { shouldTypeset, texSource } from "./latex.ts";
import type { DisplayItem, DisplayList } from "../types.ts";
import { fetchUpmathSvg, peekUpmathRaw, putUpmathRaw } from "./upmath.ts";

/**
 * 조판할 TeX 소스. $ 없음. 중복 없음.
 */
export function latexFormulasOf(list: DisplayList): string[] {
  const seen = new Set<string>();
  walk(list.items, seen);
  return [...seen];
}

/**
 * 없는 수식만 GET. 이미 있으면 0.
 * 실패·취소된 수식은 캐시에 없으므로 그리기가 MathJax 로 대신한다.
 * @param options.signal 마감. 취소되면 받지 못한 수식은 세지 않는다
 * @returns 새로 넣은 개수
 */
export async function hydrateUpmath(
  formulas: readonly string[],
  options?: { signal?: AbortSignal },
): Promise<number> {
  const jobs = formulas.filter((formula) => !peekUpmathRaw(formula));
  if (jobs.length === 0) {
    return 0;
  }
  const results = await Promise.all(
    jobs.map(async (formula) => {
      const svg = await fetchUpmathSvg(formula, options?.signal);
      if (!svg) {
        return 0;
      }
      putUpmathRaw(formula, svg);
      return 1;
    }),
  );
  return results.reduce<number>((sum, n) => sum + n, 0);
}

function walk(items: readonly DisplayItem[], seen: Set<string>): void {
  for (const item of items) {
    if (item.op === "group") {
      walk(item.items, seen);
      continue;
    }
    if (item.op !== "text" || item.plain || !shouldTypeset(item.text)) {
      continue;
    }
    seen.add(texSource(item.text));
  }
}
