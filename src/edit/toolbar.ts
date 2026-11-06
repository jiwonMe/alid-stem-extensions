/**
 * The figure-editing toolbar: stemfig's tools for the edited kind, the current step
 * and finish/cancel. Vanilla DOM in the gizmo plane (screen space, `data-canvas-ui`
 * so canvas tools ignore its clicks). Local UI only; it never writes the document.
 */
import type { FigureTool } from "@stemfig/host";
import type { WorkbenchIcon } from "../alid.ts";
import { stemfigIcons } from "../stemfig-icons.ts";
import type { EditorSnapshot, FigureEditor } from "./figure-editor.ts";

const NS = "http://www.w3.org/2000/svg";
const STYLE = `
.stem-toolbar{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;
  max-width:calc(100% - 24px);pointer-events:none;font:12px/1.4 var(--alid-font,system-ui,sans-serif);color:var(--alid-text,#18181b)}
.stem-toolbar[hidden]{display:none}
.stem-toolbar-row{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:4px;border:1px solid var(--alid-border-subtle,#e4e4e7);
  border-radius:8px;background:var(--alid-bg-surface,#fff);box-shadow:0 4px 16px #0000000d,0 1px 3px #0000000a;pointer-events:auto}
.stem-toolbar button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:28px;height:28px;padding:0 5px;border:0;border-radius:5px;
  background:transparent;color:inherit;font:inherit;cursor:pointer}
.stem-toolbar .stem-tooltip{display:none;position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:2;pointer-events:none;white-space:nowrap;padding:5px 8px;border:1px solid var(--alid-border-subtle,#e4e4e7);border-radius:5px;background:var(--alid-bg-surface,#fff);color:var(--alid-text,#18181b);box-shadow:0 4px 16px #0000001a;font:12px/1.4 var(--alid-font,system-ui,sans-serif)}
.stem-toolbar button:hover .stem-tooltip,.stem-toolbar button:focus-visible .stem-tooltip{display:block}
.stem-toolbar button:hover{background:var(--alid-bg-muted,#f4f4f5)}
.stem-toolbar button[aria-pressed="true"]{background:var(--alid-accent-soft,#eeeeff);color:var(--alid-accent,#625bf6)}
.stem-toolbar button:focus-visible{outline:2px solid var(--alid-accent,#625bf6);outline-offset:1px}
.stem-toolbar .stem-sep{width:1px;height:18px;margin:0 3px;background:var(--alid-border-subtle,#e4e4e7)}
.stem-toolbar .stem-step{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 10px;border-radius:8px;background:var(--alid-text,#18181b);
  color:var(--alid-bg-surface,#fff);pointer-events:auto}
.stem-toolbar .stem-step[hidden]{display:none}
.stem-toolbar .stem-step button{height:24px;padding:0 8px;background:#ffffff1f}
.stem-toolbar .stem-step button:hover{background:#ffffff33}
.stem-toolbar kbd{font:inherit;opacity:.55}`;

function iconSvg(doc: Document, icon: WorkbenchIcon | undefined): SVGSVGElement | null {
  if (!icon || typeof icon === "string") return null;
  const size = icon.size ?? 20, svg = doc.createElementNS(NS, "svg") as SVGSVGElement;
  for (const [name, value] of [["width", "18"], ["height", "18"], ["viewBox", `0 0 ${size} ${size}`], ["stroke-width", String((1.5 * size) / 20)],
    ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"], ["focusable", "false"]]) svg.setAttribute(name!, value!);
  for (const entry of icon.paths) {
    const path = doc.createElementNS(NS, "path"), filled = icon.fill || (typeof entry === "object" && entry.fill);
    path.setAttribute("d", typeof entry === "string" ? entry : entry.d);
    path.setAttribute("fill", filled ? "currentColor" : "none");
    path.setAttribute("stroke", filled ? "none" : "currentColor");
    svg.append(path);
  }
  return svg;
}

export class FigureToolbar {
  readonly element: HTMLDivElement;
  private readonly tools: HTMLDivElement;
  private readonly step: HTMLDivElement;
  private readonly message: HTMLSpanElement;
  private readonly finish: HTMLButtonElement;
  private readonly cancel: HTMLButtonElement;
  private renderedTools = "";
  private readonly off: () => void;

  constructor(private readonly editor: FigureEditor, host: HTMLElement) {
    const doc = host.ownerDocument;
    this.element = doc.createElement("div");
    this.element.className = "stem-toolbar";
    this.element.dataset.canvasUi = "";
    this.element.hidden = true;
    const style = doc.createElement("style"); style.textContent = STYLE;
    this.tools = doc.createElement("div"); this.tools.className = "stem-toolbar-row"; this.tools.setAttribute("role", "toolbar"); this.tools.setAttribute("aria-label", "작도 도구");
    this.step = doc.createElement("div"); this.step.className = "stem-step"; this.step.setAttribute("role", "status"); this.step.hidden = true;
    this.message = doc.createElement("span");
    this.finish = this.button(doc, "완료", () => editor.finishTool());
    this.cancel = this.button(doc, "취소", () => editor.cancel());
    this.step.append(this.message, this.finish, this.cancel);
    this.element.append(style, this.tools, this.step);
    host.append(this.element);
    this.off = editor.subscribe(() => this.update());
    this.update();
  }

  private button(doc: Document, label: string, run: () => void): HTMLButtonElement {
    const button = doc.createElement("button");
    button.type = "button"; button.textContent = label;
    button.addEventListener("click", (event) => { event.preventDefault(); run(); });
    return button;
  }

  update(): void {
    const snapshot = this.editor.snapshot();
    this.element.hidden = !snapshot;
    if (!snapshot) return;
    this.renderTools(snapshot);
    for (const button of this.tools.querySelectorAll<HTMLButtonElement>("button[data-tool]")) {
      button.setAttribute("aria-pressed", String(button.dataset.tool === (snapshot.tool ?? "")));
    }
    const guidance = snapshot.guidance;
    this.step.hidden = !snapshot.tool;
    this.message.textContent = guidance?.message ?? "";
    this.finish.hidden = !guidance?.canFinish;
    this.cancel.textContent = guidance?.canCancel ? "작도 취소" : "도구 끄기";
  }

  private renderTools(snapshot: EditorSnapshot): void {
    const key = `${snapshot.kind}:${snapshot.tools.map((tool) => tool.id).join(",")}`;
    if (key === this.renderedTools) return;
    this.renderedTools = key;
    const doc = this.element.ownerDocument;
    this.tools.replaceChildren();
    const select = this.toolButton(doc, { id: "", label: "선택·이동", icon: "cursor", shortcut: "V" });
    this.tools.append(select, this.separator(doc));
    for (const tool of snapshot.tools) this.tools.append("separator" in tool ? this.separator(doc) : this.toolButton(doc, tool));
  }

  private separator(doc: Document): HTMLElement {
    const sep = doc.createElement("span"); sep.className = "stem-sep"; sep.setAttribute("role", "separator");
    return sep;
  }

  private toolButton(doc: Document, tool: Extract<FigureTool, { label: string }>): HTMLButtonElement {
    const button = doc.createElement("button");
    button.type = "button";
    button.dataset.tool = tool.id;
    const name = tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label;
    button.setAttribute("aria-label", tool.label);
    const icon = iconSvg(doc, stemfigIcons[tool.icon] ?? (tool.id ? undefined : CURSOR));
    if (icon) button.append(icon); else button.append(doc.createTextNode(tool.label));
    const tooltip = doc.createElement("span"); tooltip.className = "stem-tooltip"; tooltip.setAttribute("role", "tooltip"); tooltip.textContent = name; button.append(tooltip);
    button.addEventListener("click", (event) => { event.preventDefault(); this.editor.setTool(tool.id || undefined); });
    return button;
  }

  dispose(): void { this.off(); this.element.remove(); }
}

/** Selection arrow on the same 20 grid as alid's own `pointer` icon. */
const CURSOR: WorkbenchIcon = { paths: ["m5 3 12 9-6 1-3 6z"] };
