import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { deflateSync, strToU8 } from 'fflate';

/**
 * MathJax SVG font tables are ~1 MB of glyph path strings, which alone would push the
 * single-file bundle over alid's 2 MiB install limit. This plugin replaces each
 * `output/svg/fonts/tex/*.js` module with a stub that reads its paths from one shared,
 * deflated blob, inflated once and synchronously on first use. Glyph data and MathJax
 * behaviour are unchanged; only the transport encoding differs.
 *
 * fflate (pure JS, fixed level) keeps the committed bundle byte-identical across machines.
 */
const FONT_FILE = /mathjax-full[\\/]js[\\/]output[\\/]svg[\\/]fonts[\\/]tex[\\/]([\w-]+)\.js$/;
const PACK_ID = '\0stem-mathjax-glyphs';
const ADD_PATHS = /\(0, FontData_js_1\.AddPaths\)\((\w+)\.(\w+),/;

function extract(source) {
  let captured;
  const require = path => path.endsWith('/FontData.js')
    ? { AddPaths: (_font, paths, content = {}) => (captured = { paths, content }) }
    : new Proxy({}, { get: () => ({}) });
  vm.runInNewContext(source, { exports: {}, require });
  return captured;
}

/** Every font module that defines its own paths, read eagerly so module load order cannot matter. */
export function readFontTables() {
  const directory = join(dirname(createRequire(import.meta.url).resolve('mathjax-full/js/output/svg.js')), 'svg', 'fonts', 'tex');
  const fonts = new Map();
  for (const file of readdirSync(directory).filter(name => name.endsWith('.js')).sort()) {
    const source = readFileSync(join(directory, file), 'utf8');
    const call = ADD_PATHS.exec(source);
    if (!call) continue; // script, double-struck: no paths of their own.
    const [, commonVar, exportName] = call;
    const commonPath = new RegExp(`var ${commonVar} = require\\("([^"]+)"\\);`).exec(source)?.[1];
    const captured = extract(source);
    if (!commonPath || !captured) throw new Error(`mathjax-glyph-pack: unexpected font module shape in ${file}`);
    fonts.set(file.slice(0, -3), { exportName, commonPath, ...captured });
  }
  if (!fonts.has('normal')) throw new Error('mathjax-glyph-pack: MathJax TeX font tables not found.');
  return fonts;
}

export function mathjaxGlyphPack() {
  const fonts = readFontTables();
  const table = Object.fromEntries([...fonts].map(([name, font]) => [name, font.paths]));
  const packed = Buffer.from(deflateSync(strToU8(JSON.stringify(table)), { level: 9, mem: 8 })).toString('base64');
  return {
    name: 'stem:mathjax-glyph-pack',
    enforce: 'pre',
    resolveId(id) { return id === PACK_ID ? PACK_ID : undefined; },
    load(id) {
      if (id === PACK_ID) {
        return `"use strict";
var fflate = require("fflate");
var PACKED = ${JSON.stringify(packed)};
var table;
exports.glyphPaths = function (name) {
  if (!table) {
    var binary = atob(PACKED), bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    table = JSON.parse(fflate.strFromU8(fflate.inflateSync(bytes)));
  }
  return table[name];
};
`;
      }
      const match = FONT_FILE.exec(id);
      const font = match && fonts.get(match[1]);
      if (!font) return undefined;
      return `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FontData_js_1 = require("../../FontData.js");
var common = require(${JSON.stringify(font.commonPath)});
var pack = require(${JSON.stringify(PACK_ID)});
exports.${font.exportName} = (0, FontData_js_1.AddPaths)(common.${font.exportName}, pack.glyphPaths(${JSON.stringify(match[1])}), ${JSON.stringify(font.content)});
`;
    },
  };
}
