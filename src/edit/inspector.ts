/**
 * Inspector section for a figure: while its inside is being edited, the fields
 * stemfig declares for the chosen handle (or the figure, with nothing chosen).
 * Vanilla DOM in the host's inspector panel. Every change goes through the
 * editor, which validates with the plugin and commits one undo step.
 */
import type { InspectField } from "@stemfig/host";
import type { FigureEditor } from "./figure-editor.ts";

const STYLE = `
.stem-inspector{display:flex;flex-direction:column;gap:6px;padding:4px 0;font:12px/1.4 var(--alid-font,system-ui,sans-serif);color:var(--alid-text,#18181b)}
.stem-inspector p{margin:0;color:var(--alid-text-muted,#71717a)}
.stem-inspector details{border-top:1px solid var(--alid-border-subtle,#e4e4e7);padding-top:6px}
.stem-inspector summary{cursor:pointer;font-weight:600;margin-bottom:4px}
.stem-inspector label{display:grid;grid-template-columns:minmax(72px,40%) 1fr;align-items:center;gap:8px;min-height:30px}
.stem-inspector input,.stem-inspector select{box-sizing:border-box;width:100%;min-height:28px;padding:3px 7px;border:1px solid var(--alid-border-subtle,#e4e4e7);
  border-radius:5px;background:var(--alid-bg-surface,#fff);color:inherit;font:inherit}
.stem-inspector input[type=checkbox]{width:auto;min-height:0;justify-self:end}
.stem-inspector input[type=color]{padding:2px;height:28px}
.stem-inspector .stem-seg{display:flex;gap:2px;justify-self:end}
.stem-inspector .stem-seg button{min-height:26px;padding:0 8px;border:1px solid var(--alid-border-subtle,#e4e4e7);border-radius:5px;background:var(--alid-bg-surface,#fff);color:inherit;font:inherit;cursor:pointer}
.stem-inspector .stem-seg button[aria-pressed=true]{background:var(--alid-accent-soft,#eeeeff);color:var(--alid-accent,#625bf6);border-color:transparent}
.stem-inspector .stem-hint{grid-column:1/-1;margin-top:-4px;color:var(--alid-text-muted,#71717a)}
.stem-inspector .stem-error{color:var(--alid-danger,#dc2626)}
.stem-inspector :is(input,select,button):focus-visible{outline:2px solid var(--alid-accent,#625bf6);outline-offset:1px}`;

export function mountFigureInspector(element: HTMLElement, getEditor: () => FigureEditor | undefined, isSelected: (id: string) => boolean): (() => void) & { refresh(): void } {
  const doc = element.ownerDocument;
  const root = doc.createElement("div");
  root.className = "stem-inspector";
  const style = doc.createElement("style"); style.textContent = STYLE;
  element.append(style, root);
  let bound: FigureEditor | undefined, offEditor = () => {};
  let rendered = "";

  const render = () => {
    const editor = getEditor();
    if (editor !== bound) { offEditor(); bound = editor; offEditor = editor?.subscribe(render) ?? (() => {}); }
    const snapshot = editor?.snapshot();
    if (!snapshot || !isSelected(snapshot.entity)) {
      if (rendered !== "idle") { rendered = "idle"; root.replaceChildren(paragraph(doc, "더블클릭하거나 Enter를 눌러 그림 안쪽을 편집하면 점·선·물체의 속성이 여기에 나타납니다.")); }
      return;
    }
    const key = JSON.stringify([snapshot.entity, snapshot.handle ?? null, snapshot.fields, snapshot.error ?? null]);
    if (key === rendered) return;
    // Do not rebuild under a focused text field (typing, IME); its change event commits.
    const focused = doc.activeElement;
    if (focused && root.contains(focused) && (focused as HTMLInputElement).type === "text" && rendered.startsWith(target(snapshot))) return;
    rendered = key;
    root.replaceChildren(...build(doc, snapshot.fields, snapshot.handle, snapshot.error, (field, value) => editor!.setField(field.key, value)));
  };
  render();
  return Object.assign(() => { offEditor(); root.remove(); style.remove(); }, { refresh: render });
}

const target = (snapshot: { entity: string; handle?: string }) => JSON.stringify([snapshot.entity, snapshot.handle ?? null]).slice(0, -1);

function paragraph(doc: Document, text: string): HTMLParagraphElement {
  const p = doc.createElement("p"); p.textContent = text; return p;
}

type Write = (field: InspectField, value: number | string | boolean) => string | undefined;

function build(doc: Document, fields: readonly InspectField[], handle: string | undefined, error: string | undefined, write: Write): HTMLElement[] {
  const out: HTMLElement[] = [paragraph(doc, handle ? `선택: ${handle}` : "그림 전체")];
  if (!fields.length) out.push(paragraph(doc, "이 대상에는 편집할 속성이 없습니다."));
  const groups = new Map<string, { label: string; open: boolean; rows: HTMLElement[] }>();
  const loose: HTMLElement[] = [];
  for (const field of fields) {
    const row = fieldRow(doc, field, write);
    if (!field.group) { loose.push(row); continue; }
    const group = groups.get(field.group.id) ?? { label: field.group.label, open: field.group.defaultOpen !== false, rows: [] };
    group.rows.push(row); groups.set(field.group.id, group);
  }
  out.push(...loose);
  for (const group of groups.values()) {
    const details = doc.createElement("details"); details.open = group.open;
    const summary = doc.createElement("summary"); summary.textContent = group.label;
    details.append(summary, ...group.rows); out.push(details);
  }
  if (error) { const p = paragraph(doc, error); p.className = "stem-error"; p.setAttribute("role", "alert"); out.push(p); }
  return out;
}

function fieldRow(doc: Document, field: InspectField, write: Write): HTMLElement {
  const label = doc.createElement("label");
  const name = doc.createElement("span");
  name.textContent = field.type === "number" && field.unit ? `${field.label} (${field.unit})` : field.label;
  label.append(name);
  let control: HTMLElement;
  switch (field.type) {
    case "number": {
      const input = doc.createElement("input");
      input.type = "number"; input.value = String(field.value);
      if (field.step !== undefined) input.step = String(field.step); else input.step = "any";
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      input.addEventListener("change", () => { const value = Number(input.value); if (Number.isFinite(value)) write(field, value); });
      control = input; break;
    }
    case "text": {
      const input = doc.createElement("input");
      input.type = "text"; input.value = field.value;
      // IME: commit on change (blur/Enter after composition), never mid-composition.
      input.addEventListener("change", () => write(field, input.value));
      control = input; break;
    }
    case "color": {
      const input = doc.createElement("input");
      input.type = "color"; input.value = field.value;
      input.addEventListener("change", () => write(field, input.value));
      control = input; break;
    }
    case "boolean": {
      const input = doc.createElement("input");
      input.type = "checkbox"; input.checked = field.value;
      input.addEventListener("change", () => write(field, input.checked));
      control = input; break;
    }
    case "enum": {
      if (field.appearance === "segmented") {
        const group = doc.createElement("span"); group.className = "stem-seg"; group.setAttribute("role", "group");
        for (const option of field.options) {
          const button = doc.createElement("button");
          button.type = "button"; button.textContent = option.label;
          button.setAttribute("aria-pressed", String(option.value === field.value));
          button.disabled = !!field.disabled;
          button.addEventListener("click", () => write(field, option.value));
          group.append(button);
        }
        control = group;
      } else {
        const select = doc.createElement("select");
        for (const option of field.options) { const item = doc.createElement("option"); item.value = option.value; item.textContent = option.label; select.append(item); }
        select.value = field.value;
        select.addEventListener("change", () => write(field, select.value));
        control = select;
      }
      break;
    }
  }
  if ("disabled" in control) (control as HTMLInputElement).disabled = !!field.disabled;
  control.setAttribute("aria-label", field.label);
  label.append(control);
  if (field.description) { const hint = doc.createElement("span"); hint.className = "stem-hint"; hint.textContent = field.description; label.append(hint); }
  return label;
}
