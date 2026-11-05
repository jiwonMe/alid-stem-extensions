import metadata from "../extension.json";
import { createEngine } from "./engine.ts";
import { stemfigPlugins } from "./kinds.ts";
import { createPackageManifest } from "./manifest.js";

/**
 * P0: the package installs and exposes the stemfig engine as its public API.
 * Canvas aspects, creation tools and editing arrive in P1–P3 (docs/PLAN.md).
 * Installing or activating never writes document data.
 */
export const engine = createEngine(stemfigPlugins);

export default {
  ...createPackageManifest(metadata),
  summary: metadata.summary,
  aspects: [],
  activate() {
    let active = true;
    const api = Object.freeze({
      kinds: engine.kinds,
      renderFigureSvg: (...args: Parameters<typeof engine.renderFigureSvg>) => {
        if (!active) throw new Error("STEM 작도 확장이 비활성화되었습니다. 공개 API를 다시 조회하세요.");
        return engine.renderFigureSvg(...args);
      },
    });
    return { api, dispose() { active = false; } };
  },
};
