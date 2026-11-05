import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { DisplayItem } from "@stemfig/display";
import { compileDocument } from "../compile/compile.ts";
import { parseDocument } from "../envelope/document.ts";
import { stemfigError } from "../envelope/errors.ts";
import type { StemfigPlugin } from "../plugin/plugin.ts";
import { Registry } from "../plugin/registry.ts";
import { checkDocument } from "./check.ts";
import { checkEnvelopeKeys } from "./warnings.ts";

type Spec = { items: { id: string; size?: number; ref?: string }[] };

/**
 * 진단만 보는 가짜 엔진. ref 가 앞선 id 를 가리키지 않으면 init 이 UNKNOWN_REF.
 * size 0 은 compile 이 경로 약속(spec.…) 없이 던진다.
 */
const demo: StemfigPlugin<Spec> = {
  kind: "demo.alpha",
  version: 1,
  specSchema: z.object({
    items: z.array(z.object({ id: z.string(), size: z.number().optional(), ref: z.string().optional() })),
  }),
  init: (spec) => {
    const seen = new Set<string>();
    for (const [index, item] of spec.items.entries()) {
      if (item.ref !== undefined && !seen.has(item.ref)) {
        throw stemfigError("UNKNOWN_REF", `spec.items.${item.id}.ref`, `unknown item ${item.ref}`);
      }
      if (item.size === -1) {
        throw stemfigError("SPEC", `spec.items.${index}.size`, "size must not be -1");
      }
      seen.add(item.id);
    }
    return spec;
  },
  compile: (_ctx, state): DisplayItem[] => {
    if (state.items.some((item) => item.size === 0)) {
      throw stemfigError("SPEC", "item.size", "size must not be 0");
    }
    return [];
  },
};

const sheet = { x: 0, y: 0, w: 80, h: 60 };

function figure(spec: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: "fig",
    type: "figure",
    kind: "demo.alpha",
    frame: { x: 5, y: 5, w: 70, h: 50 },
    view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
    spec,
    ...extra,
  };
}

function docOf(figures: unknown[], plugins = ["demo.alpha@1"]) {
  return parseDocument({
    schema: "stemfig/v1",
    plugins,
    nodes: [{ id: "page", type: "frame", frame: sheet, children: figures }],
  });
}

function registry(): Registry {
  const out = new Registry();
  out.register(demo);
  return out;
}

describe("checkDocument", () => {
  it("returns nothing for a clean document", () => {
    expect(checkDocument(docOf([figure({ items: [{ id: "a" }, { id: "b", ref: "a" }] })]), registry())).toEqual([]);
  });

  it("places spec schema errors at their full document path", () => {
    const [found] = checkDocument(docOf([figure({ items: [{ id: "a", size: "big" }] })]), registry());
    expect(found).toMatchObject({
      severity: "error",
      code: "SPEC",
      path: "nodes.0.children.0.spec.items.0.size",
      node: "fig",
    });
  });

  it("joins engine paths and rewrites an id segment to its array index", () => {
    const doc = docOf([figure({ items: [{ id: "a" }, { id: "b", ref: "zz" }] })]);
    expect(checkDocument(doc, registry())).toEqual([
      {
        severity: "error",
        code: "UNKNOWN_REF",
        path: "nodes.0.children.0.spec.items.1.ref",
        message: "unknown item zz",
        node: "fig",
      },
    ]);
  });

  it("keeps an engine path that is not under spec in the message", () => {
    const [found] = checkDocument(docOf([figure({ items: [{ id: "a", size: 0 }] })]), registry());
    expect(found).toMatchObject({ path: "nodes.0.children.0.spec", message: "item.size: size must not be 0" });
  });

  it("tells whether document.plugins is missing the kind or the engine is absent", () => {
    const unlisted = checkDocument(docOf([figure({ items: [] })], []), registry());
    expect(unlisted).toMatchObject([{ code: "MISSING_PLUGIN", path: "plugins", message: 'document.plugins does not list demo.alpha; add "demo.alpha@1"' }]);
    const version = checkDocument(docOf([figure({ items: [] })], ["demo.alpha@2"]), registry());
    expect(version).toMatchObject([{ code: "MISSING_PLUGIN", path: "plugins.0" }]);
    const absent = checkDocument(docOf([figure({ items: [] }, { kind: "demo.beta" })], ["demo.beta@1"]), registry());
    expect(absent).toMatchObject([{ code: "MISSING_PLUGIN", path: "nodes.0.children.0.kind" }]);
  });

  it("warns about spec keys the engine strips", () => {
    const doc = docOf([figure({ items: [{ id: "a", szie: 2 }], extra: true })]);
    expect(checkDocument(doc, registry())).toMatchObject([
      { severity: "warning", code: "IGNORED_KEY", path: "nodes.0.children.0.spec.items.0.szie" },
      { severity: "warning", code: "IGNORED_KEY", path: "nodes.0.children.0.spec.extra" },
    ]);
    expect(checkDocument(doc, registry())[0]?.message).toContain('(did you mean "size"?)');
  });

  it("suggests the intended key even when the spec fails because of it", () => {
    const doc = docOf([figure({ itmes: [{ id: "a" }] })]);
    const found = checkDocument(doc, registry());
    expect(found.map((item) => [item.severity, item.code, item.path])).toEqual([
      ["error", "SPEC", "nodes.0.children.0.spec.items"],
      ["warning", "IGNORED_KEY", "nodes.0.children.0.spec.itmes"],
    ]);
    expect(found[1]?.message).toContain('(did you mean "items"?)');
  });

  it("flags a TeX command whose backslash JSON turned into a control character", () => {
    const doc = docOf([figure({ items: [{ id: "a" }], note: "$\beta + \theta$" }, { axes: { x: { label: "\nu" } } })]);
    const found = checkDocument(doc, registry()).filter((item) => item.code === "CONTROL_CHAR");
    expect(found.map((item) => item.path)).toEqual(["nodes.0.children.0.spec.note", "nodes.0.children.0.axes.x.label"]);
    expect(found[0]?.message).toBe(
      'string contains U+0008, which is how JSON reads "\\b"; for a TeX command write the backslash twice: "$\\\\beta + \\\\theta$"',
    );
  });

  it("warns when a figure leaves its sheet", () => {
    const clipped = figure({ items: [] }, { frame: { x: 60, y: 5, w: 40, h: 20 } });
    const hidden = figure({ items: [] }, { id: "far", frame: { x: 200, y: 5, w: 10, h: 10 } });
    expect(checkDocument(docOf([clipped, hidden]), registry())).toMatchObject([
      { severity: "warning", code: "CLIPPED", path: "nodes.0.children.0.frame", node: "fig" },
      { severity: "warning", code: "HIDDEN", path: "nodes.0.children.1.frame", node: "far" },
    ]);
  });

  it("does not clip a figure that sits at the root", () => {
    const doc = parseDocument({
      schema: "stemfig/v1",
      plugins: ["demo.alpha@1"],
      nodes: [{ id: "page", type: "frame", frame: sheet, children: [] }, figure({ items: [] }, { frame: { x: 200, y: 0, w: 10, h: 10 } })],
    });
    expect(checkDocument(doc, registry())).toEqual([]);
  });

  it("errs on exactly the figures that compile draws as error boxes", () => {
    const doc = docOf([
      figure({ items: [{ id: "a" }] }, { id: "good" }),
      figure({ items: [{ id: "b", ref: "q" }] }, { id: "badref" }),
      figure({ items: [{ id: "c", size: -1 }] }, { id: "badsize" }),
      figure({ items: "no" }, { id: "badspec" }),
    ]);
    const failed = new Set(checkDocument(doc, registry()).filter((item) => item.severity === "error").map((item) => item.node));
    const boxed = compileDocument(doc, registry()).items.map((item) => JSON.stringify(item).includes('"error: '));
    expect(boxed).toEqual(["good", "badref", "badsize", "badspec"].map((id) => failed.has(id)));
  });
});

describe("checkEnvelopeKeys", () => {
  it("warns about keys the envelope drops from non-strict parts", () => {
    const input = {
      schema: "stemfig/v1",
      plugins: [],
      nodes: [{
        id: "page", type: "frame", frame: { x: 0, y: 0, w: 80, h: 60, d: 1 }, children: [
          { ...figure({ items: [] }), view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1, strech: true } },
        ],
      }],
    };
    parseDocument(input);
    const found = checkEnvelopeKeys(input);
    expect(found.map((item) => [item.path, item.node])).toEqual([
      ["nodes.0.frame.d", "page"],
      ["nodes.0.children.0.view.strech", "fig"],
    ]);
    expect(found[1]?.message).toContain('(did you mean "stretch"?)');
  });

  it("does not look inside figure.spec", () => {
    const input = { schema: "stemfig/v1", plugins: [], nodes: [{ id: "page", type: "frame", frame: sheet, children: [figure({ items: [], anything: 1 })] }] };
    expect(checkEnvelopeKeys(input)).toEqual([]);
  });
});
