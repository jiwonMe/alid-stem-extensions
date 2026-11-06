// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { EditorSnapshot, FigureEditor } from "./figure-editor.ts";
import { mountFigureInspector } from "./inspector.ts";
import { FigureToolbar } from "./toolbar.ts";

function fakeEditor(initial: EditorSnapshot | undefined) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const editor = {
    snapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    setTool: vi.fn(), finishTool: vi.fn(), cancel: vi.fn(), setField: vi.fn(() => undefined),
  };
  return { editor: editor as unknown as FigureEditor & typeof editor, set(next: EditorSnapshot | undefined) { snapshot = next; for (const l of listeners) l(); } };
}

const base: EditorSnapshot = {
  entity: "fig", kind: "math.geometry", fields: [],
  tools: [{ id: "point", label: "점", icon: "point", shortcut: "P" }, { id: "sep", separator: true }, { id: "segment", label: "선분", icon: "segment" }, { id: "mystery", label: "이름만", icon: "no-such-icon" }],
};

describe("figure toolbar", () => {
  it("is hidden when not editing and lists the plugin's tools with path icons", () => {
    const host = document.createElement("div"), f = fakeEditor(undefined);
    const bar = new FigureToolbar(f.editor, host);
    expect(bar.element.hidden).toBe(true);
    f.set(base);
    expect(bar.element.hidden).toBe(false);
    expect(bar.element.hasAttribute("data-canvas-ui")).toBe(true);
    const buttons = [...bar.element.querySelectorAll<HTMLButtonElement>("button[data-tool]")];
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["선택·이동", "점", "선분", "이름만"]);
    expect(buttons[1]!.querySelector('[role="tooltip"]')?.textContent).toBe("점 (P)");
    expect(buttons[1]!.querySelector("svg path")).toBeTruthy();
    expect(buttons[3]!.firstChild?.textContent).toBe("이름만"); // unknown icon falls back to the label
    expect(bar.element.querySelectorAll('[role="separator"]')).toHaveLength(2);
    buttons[2]!.click();
    expect(f.editor.setTool).toHaveBeenCalledWith("segment");
    buttons[0]!.click();
    expect(f.editor.setTool).toHaveBeenLastCalledWith(undefined);
    bar.dispose();
    expect(host.children).toHaveLength(0);
  });

  it("shows the step, the finish button only when finishing is possible, and cancels", () => {
    const host = document.createElement("div"), f = fakeEditor({ ...base, tool: "segment", guidance: { message: "두 번째 점을 선택하세요.", canCancel: true } });
    const bar = new FigureToolbar(f.editor, host);
    const step = bar.element.querySelector<HTMLElement>(".stem-step")!;
    expect(step.hidden).toBe(false);
    expect(step.textContent).toContain("두 번째 점을 선택하세요.");
    const [finish, cancel] = [...step.querySelectorAll("button")];
    expect(finish!.hidden).toBe(true);
    expect(cancel!.textContent).toBe("작도 취소");
    expect(bar.element.querySelector('[data-tool="segment"]')!.getAttribute("aria-pressed")).toBe("true");
    f.set({ ...base, tool: "track", guidance: { message: "점을 더 찍거나 완료하세요.", canCancel: true, canFinish: true } });
    expect(finish!.hidden).toBe(false);
    finish!.click(); cancel!.click();
    expect(f.editor.finishTool).toHaveBeenCalled();
    expect(f.editor.cancel).toHaveBeenCalled();
  });
});

describe("figure inspector", () => {
  it("renders stemfig fields by type and writes through the editor", () => {
    const element = document.createElement("div");
    const f = fakeEditor({ ...base, handle: "A", fields: [
      { key: "x", label: "x", type: "number", value: 1, step: 0.1 },
      { key: "label", label: "라벨", type: "text", value: "A" },
      { key: "show", label: "표시", type: "boolean", value: true, group: { id: "g", label: "표시", defaultOpen: false } },
      { key: "style", label: "선", type: "enum", value: "solid", appearance: "segmented", options: [{ value: "solid", label: "실선" }, { value: "dashed", label: "점선" }] },
      { key: "color", label: "색", type: "color", value: "#111111" },
    ] });
    const off = mountFigureInspector(element, () => f.editor, () => true);
    expect(element.textContent).toContain("선택: A");
    const x = element.querySelector<HTMLInputElement>('input[aria-label="x"]')!;
    x.value = "2.5"; x.dispatchEvent(new Event("change"));
    expect(f.editor.setField).toHaveBeenCalledWith("x", 2.5);
    const dashed = [...element.querySelectorAll("button")].find((b) => b.textContent === "점선")!;
    dashed.click();
    expect(f.editor.setField).toHaveBeenLastCalledWith("style", "dashed");
    expect(element.querySelector("details")!.open).toBe(false);
    f.set({ ...f.editor.snapshot()!, error: "x는 유한한 수여야 합니다." });
    expect(element.querySelector('[role="alert"]')!.textContent).toContain("유한한");
    off();
    expect(element.querySelector(".stem-inspector")).toBeNull();
  });

  it("explains how to start editing when the figure is not being edited", () => {
    const element = document.createElement("div");
    const off = mountFigureInspector(element, () => undefined, () => true);
    expect(element.textContent).toContain("더블클릭");
    off();
  });
});
