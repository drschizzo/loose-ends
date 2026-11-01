// The steps of a part, as the editor shows them: a card per step, its fields
// as inputs (a number, or what to work it out from), the steps it holds
// inside it. Every change is made to the catalog in place, then said
// (`changed`): the course is laid out again, the view built again.

import { HAZARDS, MAT_CHOICES, OPS, type Family, type Field, type PartData, type Step } from '../gen/layout';

/** a tag, its attributes (on…: listeners), its children */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k in el && k !== 'list') (el as any)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** the step at `path` in part p ("2", "2.do.0"), and the list it is in */
export function stepAt(p: PartData, path: string): { step: Step; list: Step[]; index: number } | null {
  const bits = path.split('.');
  let list: Step[] | undefined = p.steps;
  for (let i = 0; i < bits.length; i += 2) {
    const index = Number(bits[i]), step: Step | undefined = list?.[index];
    if (!step || !list) return null;
    if (i + 1 >= bits.length) return { step, list, index };
    list = step[bits[i + 1]] as Step[] | undefined;
  }
  return null;
}

const MAT_LABELS: Record<string, string> = { '': 'par défaut', auto: 'auto (bois ou caoutchouc)', 'auto-chrome': 'auto (bois ou chrome)', wood: 'bois', chrome: 'chrome', rubber: 'caoutchouc', gold: 'or (poteau)' };
const HAZARD_LABELS: Record<string, string> = { blade: 'ciseaux', flame: 'flamme', water: 'eau' };

/** what an input holds, back as the catalog keeps it: a number if it is one, else what to work it out from */
export const parseExpr = (v: string): number | string => (/^\s*-?(\d+\.?\d*|\.\d+)(e-?\d+)?\s*$/i.test(v) ? Number(v) : v.trim());

/** a new step of kind op, its fields to fill */
function blank(op: string): Step {
  const s: Step = { op };
  for (const f of OPS[op].fields) {
    if (f.optional) continue;
    if (f.kind === 'steps') s[f.key] = [];
    else if (f.kind === 'name') s[f.key] = f.key === 'as' ? 'b' : 'v';
    else if (f.kind === 'hazard') s[f.key] = 'blade';
    else if (f.kind === 'color') s[f.key] = '#d9534f';
    else if (f.kind === 'bool') s[f.key] = f.key === 'test' ? 'true' : false;
    else s[f.key] = 0;
  }
  return s;
}

export interface StepsEditor {
  el: HTMLElement;
  /** shows an error on the step at `path` (none: clears) */
  error(path: string | null, message?: string): void;
  /** brings the step at `path` into view, lit */
  reveal(path: string): void;
}

/**
 * The editor of part p's steps (of `family`): `changed` after each change
 * (`structure`: steps added, removed, moved: the cards are drawn again),
 * `hover` with the path of the step the pointer is on (null: none)
 */
export function stepsEditor(p: PartData, family: Family, changed: () => void, hover: (path: string | null) => void): StepsEditor {
  const root = h('div', { class: 'steps' });
  const draw = () => {
    root.replaceChildren(list(p.steps, ''));
  };
  const structure = () => { draw(); changed(); };

  /** `attach`: puts the list in its step, the first time a step is added to it (an empty list is not written) */
  const list = (steps: Step[], at: string, attach?: () => void): HTMLElement => {
    const box = h('div', { class: 'step-list' });
    steps.forEach((s, j) => box.append(card(steps, j, at ? `${at}.${j}` : `${j}`)));
    const ops = Object.entries(OPS).filter(([, o]) => !o.only || o.only.includes(family));
    const add = h('select', { class: 'add', title: 'Ajouter une étape', onchange: (e: Event) => {
      const op = (e.target as HTMLSelectElement).value;
      if (!op) return;
      attach?.();
      steps.push(blank(op));
      structure();
    } }, h('option', { value: '' }, '+ étape'), ...ops.map(([k, o]) => h('option', { value: k }, o.label)));
    box.append(add);
    return box;
  };

  const card = (steps: Step[], j: number, path: string): HTMLElement => {
    const s = steps[j], op = OPS[s.op];
    const el = h('div', { class: 'step', 'data-path': path, onmouseenter: (e: Event) => { e.stopPropagation(); hover(path); }, onmouseleave: () => hover(null) });
    const move = (d: number) => { const k = j + d; if (k < 0 || k >= steps.length) return; [steps[j], steps[k]] = [steps[k], steps[j]]; structure(); };
    const opSelect = h('select', { class: 'op', title: op?.help ?? '', onchange: (e: Event) => {
      const next = (e.target as HTMLSelectElement).value, fresh = blank(next);
      // what the two kinds of step share is kept
      for (const f of OPS[next].fields) if (s[f.key] !== undefined && OPS[s.op]?.fields.some((q) => q.key === f.key && q.kind === f.kind)) fresh[f.key] = s[f.key];
      steps[j] = fresh;
      structure();
    } }, ...Object.entries(OPS).filter(([k, o]) => k === s.op || !o.only || o.only.includes(family)).map(([k, o]) => h('option', { value: k, selected: k === s.op }, o.label)));
    el.append(h('div', { class: 'step-head' },
      h('span', { class: 'path' }, path),
      opSelect,
      h('span', { class: 'grow' }),
      h('button', { class: 'icon', title: 'Monter', onclick: () => move(-1) }, '↑'),
      h('button', { class: 'icon', title: 'Descendre', onclick: () => move(1) }, '↓'),
      h('button', { class: 'icon', title: 'Dupliquer', onclick: () => { steps.splice(j + 1, 0, structuredClone(s)); structure(); } }, '⧉'),
      h('button', { class: 'icon danger', title: 'Supprimer', onclick: () => { steps.splice(j, 1); structure(); } }, '✕'),
    ));
    if (!op) { el.append(h('div', { class: 'err' }, `étape inconnue : ${s.op}`)); return el; }
    el.title = op.help;
    const grid = h('div', { class: 'fields' });
    for (const f of op.fields) {
      if (f.kind === 'steps') continue;
      grid.append(h('label', { title: f.optional ? 'facultatif' : '' }, f.label, input(s, f)));
    }
    el.append(grid);
    for (const f of op.fields) {
      if (f.kind !== 'steps') continue;
      const inner = (s[f.key] as Step[] | undefined) ?? [];
      el.append(h('div', { class: 'nested' }, h('div', { class: 'nested-label' }, f.label), list(inner, `${path}.${f.key}`, () => { s[f.key] = inner; })));
    }
    el.append(h('div', { class: 'err', hidden: true }));
    return el;
  };

  /** the input of field f of step s */
  const input = (s: Step, f: Field): HTMLElement => {
    const v = s[f.key];
    const set = (x: unknown) => {
      if (x === undefined || x === '' || (Array.isArray(x) && !x.length)) delete s[f.key];
      else s[f.key] = x;
      changed();
    };
    switch (f.kind) {
      case 'mat':
        return h('select', { onchange: (e: Event) => set((e.target as HTMLSelectElement).value || undefined) },
          ...['', ...MAT_CHOICES].map((m) => h('option', { value: m, selected: (v ?? '') === m }, MAT_LABELS[m])));
      case 'hazard':
        return h('select', { onchange: (e: Event) => set((e.target as HTMLSelectElement).value) }, ...HAZARDS.map((m) => h('option', { value: m, selected: v === m }, HAZARD_LABELS[m])));
      case 'bool':
        if (f.key !== 'test' && typeof v !== 'string') return h('input', { type: 'checkbox', checked: !!v, onchange: (e: Event) => set((e.target as HTMLInputElement).checked || undefined) });
        return h('input', { type: 'text', class: 'expr', value: String(v ?? ''), spellcheck: false, oninput: (e: Event) => set((e.target as HTMLInputElement).value.trim()) });
      case 'color': {
        const text = h('input', { type: 'text', class: 'expr', value: String(v ?? ''), spellcheck: false, placeholder: '#rrggbb ou pick(COLORS)' });
        const swatch = h('input', { type: 'color', value: typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : '#888888' });
        text.addEventListener('input', () => { set(text.value.trim()); if (/^#[0-9a-f]{6}$/i.test(text.value)) swatch.value = text.value; });
        swatch.addEventListener('input', () => { text.value = swatch.value; set(swatch.value); });
        return h('span', { class: 'color' }, swatch, text);
      }
      case 'nums':
        return h('input', { type: 'text', class: 'expr', value: Array.isArray(v) ? v.join(' ; ') : '', spellcheck: false, placeholder: 'a ; b ; …',
          oninput: (e: Event) => set((e.target as HTMLInputElement).value.split(';').map((x) => x.trim()).filter(Boolean).map(parseExpr)) });
      case 'name':
        return h('input', { type: 'text', class: 'name', value: String(v ?? ''), spellcheck: false, placeholder: f.optional ? '—' : '',
          oninput: (e: Event) => { const t = (e.target as HTMLInputElement).value.trim(); (e.target as HTMLElement).classList.toggle('bad', !!t && !/^[A-Za-z_]\w*$/.test(t)); set(t || undefined); } });
      default:
        return h('input', { type: 'text', class: 'expr', value: v === undefined ? '' : String(v), spellcheck: false, placeholder: f.optional ? '—' : '',
          oninput: (e: Event) => { const t = (e.target as HTMLInputElement).value; set(t.trim() === '' ? undefined : parseExpr(t)); } });
    }
  };

  draw();
  return {
    el: root,
    error(path, message) {
      root.querySelectorAll('.step.error').forEach((c) => { c.classList.remove('error'); const e = c.querySelector(':scope > .err') as HTMLElement | null; if (e) e.hidden = true; });
      if (path === null) return;
      const c = root.querySelector(`.step[data-path="${path}"]`);
      if (!c) return;
      c.classList.add('error');
      const e = c.querySelector(':scope > .err') as HTMLElement | null;
      if (e) { e.hidden = false; e.textContent = message ?? ''; }
    },
    reveal(path) {
      root.querySelectorAll('.step.lit').forEach((c) => c.classList.remove('lit'));
      const c = root.querySelector(`.step[data-path="${path}"]`) as HTMLElement | null;
      if (!c) return;
      c.classList.add('lit');
      c.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
  };
}
