/**
 * Writes test/golden/fixtures.json: every vendored fixture figure with the SVG that
 * stemdraw's own source pipeline draws for it (unpacked MathJax). test/bundle.test.mjs
 * compares the built bundle against it, proving the glyph pack and minification change
 * nothing visible. Regenerate after syncing vendor/stemfig: `pnpm golden`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { figureContent, fixtureFigures, figureSize, referenceSvg } from "../src/fixtures.ts";

const cases = fixtureFigures().map(({ name, figure }) => ({
  name,
  kind: figure.kind,
  content: figureContent(figure),
  size: figureSize(figure),
  svg: referenceSvg(figure),
}));
mkdirSync(new URL("../test/golden/", import.meta.url), { recursive: true });
writeFileSync(new URL("../test/golden/fixtures.json", import.meta.url), `${JSON.stringify(cases, null, 1)}\n`);
console.log(`Wrote ${cases.length} golden figures.`);
