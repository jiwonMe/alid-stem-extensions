import { describe, expect, it } from "vitest";
import { latexToSvg, texSource } from "./latex.ts";
import { latexPaths } from "./latex-paths.ts";

describe("latexPaths", () => {
  it("keeps a single letter on the flipped y axis only", () => {
    const built = latexToSvg(texSource("A"), 12.8, "#111111");
    const paths = latexPaths(built!.svg);
    expect(paths).toHaveLength(1);
    /* scale(1,-1) 만. 원점에 겹칠 이동은 없다. */
    expect(paths[0]?.matrix).toEqual([1, 0, 0, -1, 0, 0]);
  });

  it("shifts the second letter of Ma so it does not sit on M", () => {
    const built = latexToSvg(texSource("Ma"), 12.8, "#111111");
    const paths = latexPaths(built!.svg);
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const first = paths[0]!.matrix;
    const second = paths[1]!.matrix;
    expect(second[4]).toBeGreaterThan(first[4] + 100);
  });
});
