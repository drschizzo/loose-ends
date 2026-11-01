// The level editor, beside the game (npm run dev, then /editor.html): a
// whole climb of a seed, drawn as the game draws it, and the catalog it is
// assembled from (catalog.json), to edit. Three tabs:
//
//   la montée   the sections of the climb, floor by floor: what each is made
//               of; a part can be tried in one (it is chosen there, not
//               drawn), and the game opened there to play it;
//   les pièces  the ascents, obstacles and keys: their settings, their steps
//               (what they put where), new ones;
//   réglages    the twists of the stretches, the rules of the assembly that
//               are numbers, what each floor has more of.
//
// Each change lays the course out again at once, and the view follows. Saved,
// the catalog is written into the repository (see plugin.ts) and the game
// plays it; until then, a draft is kept in the browser.

import { Course, type Forced, type Section } from '../gen/course';
import { FLOORS, HOUSE } from '../gen/floors';
import { LayoutError, type AscentData, type Catalog, type Family, type KeyData, type ObstacleData, type PartData } from '../gen/layout';
import { h, parseExpr, stepAt, stepsEditor, type StepsEditor } from './steps';
import { KIND_NAMES, View, type Thing } from './view';

const DRAFT = 'loose-ends:editor:draft', PREFS = 'loose-ends:editor:prefs';
const FAMILIES: { key: Family; label: string }[] = [{ key: 'ascents', label: 'Montées' }, { key: 'obstacles', label: 'Obstacles' }, { key: 'keys', label: 'Clés' }];
const SIDES: Record<string, string> = { any: 'au choix', cross: 'de l\'autre côté', same: 'du même côté' };

type Tab = 'climb' | 'parts' | 'settings';

const read = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; } };
const write = (key: string, v: unknown) => { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* private window */ } };

const prefs = read(PREFS, { seed: 1, count: 0, tab: 'climb' as Tab, family: 'ascents' as Family, part: '', physics: true, tips: true, labels: true });
const state = {
  catalog: null as unknown as Catalog,
  /** the catalog as the file has it */
  saved: '',
  seed: prefs.seed,
  /** the sections shown (0: up to the sky, and a little more) */
  count: prefs.count,
  shown: 0,
  /** the sections whose parts are chosen */
  force: {} as Record<number, Forced>,
  course: null as Course | null,
  error: null as Error | null,
  section: 0,
  tab: prefs.tab,
  family: prefs.family,
  part: prefs.part,
};

const view = new View(document.getElementById('view')!);
Object.assign(view, { physics: prefs.physics, tips: prefs.tips, labels: prefs.labels });
const panel = document.getElementById('panel')!;
const header = h('header'), errorBar = h('div', { class: 'errorbar', hidden: true }), tabs = h('nav', { class: 'tabs' }), body = h('div', { class: 'body' });
panel.append(header, errorBar, tabs, body);
let editor: StepsEditor | null = null;

const keep = () => write(PREFS, { seed: state.seed, count: state.count, tab: state.tab, family: state.family, part: state.part, physics: view.physics, tips: view.tips, labels: view.labels });
const dirty = () => JSON.stringify(state.catalog) !== state.saved;
const parts = (f: Family): PartData[] => state.catalog[f];
const findPart = (name: string): { family: Family; part: PartData } | null => {
  for (const { key } of FAMILIES) { const part = parts(key).find((p) => p.name === name); if (part) return { family: key, part }; }
  return null;
};

// ------------------------------------------------------------------ course

/** the course of the seed laid out again with the catalog as it is now */
function regenerate(): void {
  try {
    const course = new Course(state.seed, state.catalog, { trace: true, force: state.force });
    let n = state.count;
    if (!n) {
      // up to the sky, and a few sections into it
      let i = 0;
      while (course.section(i).floor < HOUSE && i < 300) i++;
      n = Math.min(300, i + 8);
    }
    for (let i = 0; i < n; i++) course.section(i);
    state.course = course;
    state.shown = n;
    state.error = null;
    view.setCourse(course, n);
  } catch (err) {
    state.error = err as Error;
  }
  refresh();
}

let timer = 0;
/** the catalog changed: kept as a draft, laid out again in a moment */
function changed(): void {
  write(DRAFT, dirty() ? state.catalog : null);
  drawHeader();
  clearTimeout(timer);
  timer = window.setTimeout(regenerate, 180);
}

/** what is wrong with the catalog, if anything: the same name twice, or a part that cannot be laid out */
function validate(): string | null {
  const names = new Set<string>();
  for (const { key } of FAMILIES) for (const p of parts(key)) {
    if (!p.name.trim()) return 'une pièce n\'a pas de nom';
    if (names.has(p.name)) return `deux pièces s'appellent « ${p.name} »`;
    names.add(p.name);
  }
  try {
    for (const seed of [1, 2, 3, state.seed]) { const c = new Course(seed, state.catalog); for (let i = 0; i < 160; i++) c.section(i); }
  } catch (err) { return (err as Error).message; }
  return null;
}

async function save(): Promise<boolean> {
  const wrong = validate();
  if (wrong) { alert(`Pas enregistré : ${wrong}`); return false; }
  const res = await fetch('/__catalog', { method: 'POST', body: JSON.stringify(state.catalog) });
  if (!res.ok) { alert(`Pas enregistré : ${await res.text()}`); return false; }
  state.saved = JSON.stringify(state.catalog);
  write(DRAFT, null);
  drawHeader();
  return true;
}

/** the game, in a tab of its own, on the climb of this seed from section k (its parts as chosen there) */
async function play(k: number): Promise<void> {
  if (dirty() && !(await save())) return;
  const q = new URLSearchParams({ seed: String(state.seed), at: String(k) });
  for (const [key, v] of Object.entries(state.force[k] ?? {})) if (v) q.set(key, v);
  window.open(`./?${q}`, 'loose-ends-play');
}

// ------------------------------------------------------------------- panel

function drawHeader(): void {
  const d = dirty();
  header.replaceChildren(
    h('h1', {}, 'Loose Ends ', h('small', {}, 'éditeur de niveaux')),
    h('span', { class: `status${d ? ' dirty' : ''}` }, d ? 'modifié' : 'enregistré'),
    h('button', { disabled: !d, title: 'Revenir au catalogue du fichier', onclick: () => {
      if (!confirm('Oublier les modifications non enregistrées ?')) return;
      state.catalog = JSON.parse(state.saved);
      changed();
      drawTab();
    } }, 'Annuler'),
    h('button', { class: 'primary', disabled: !d, title: 'Écrire src/gen/catalog.json', onclick: () => void save() }, 'Enregistrer'),
  );
}

function drawTabs(): void {
  const tab = (key: Tab, label: string) => h('button', { class: state.tab === key ? 'on' : '', onclick: () => { state.tab = key; keep(); drawTabs(); drawTab(); } }, label);
  tabs.replaceChildren(tab('climb', 'La montée'), tab('parts', 'Les pièces'), tab('settings', 'Réglages'));
}

function drawError(): void {
  const e = state.error;
  errorBar.hidden = !e;
  if (!e) return;
  errorBar.replaceChildren(h('b', {}, 'Le parcours ne se construit plus. '), e.message);
  errorBar.onclick = () => { if (e instanceof LayoutError) openPart(e.part, e.path); };
}

/** after the course was laid out again: what depends on it */
function refresh(): void {
  drawHeader();
  drawError();
  if (state.tab === 'climb') drawTab();
  if (state.tab === 'parts') { drawUses(); showStepError(); }
}

function drawTab(): void {
  editor = null;
  view.mark(null);
  // the lists keep where they were scrolled to
  const scrolled = [...body.querySelectorAll('.sections, .partlist')].map((e) => e.scrollTop), top = body.scrollTop;
  body.className = `body ${state.tab}`;
  body.replaceChildren(state.tab === 'climb' ? climbTab() : state.tab === 'parts' ? partsTab() : settingsTab());
  body.querySelectorAll('.sections, .partlist').forEach((e, i) => (e.scrollTop = scrolled[i] ?? 0));
  body.scrollTop = top;
  if (state.tab === 'parts') showStepError();
}

const num = (label: string, value: number | undefined, set: (v: number | undefined) => void, attrs: Record<string, unknown> = {}) =>
  h('label', {}, label, h('input', { type: 'number', step: 'any', value: value ?? '', ...attrs, oninput: (e: Event) => {
    const t = (e.target as HTMLInputElement).value;
    set(t === '' ? undefined : Number(t));
    changed();
  } }));
const check = (label: string, value: boolean, set: (v: boolean) => void) =>
  h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: value, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), label);

// ---------------------------------------------------------------- the climb

function climbTab(): HTMLElement {
  const c = state.course, out = h('div', { class: 'climb' });
  out.append(h('div', { class: 'row' },
    h('label', {}, 'Graine', h('input', { type: 'number', value: state.seed, onchange: (e: Event) => { state.seed = Number((e.target as HTMLInputElement).value) || 1; state.force = {}; keep(); regenerate(); } })),
    h('button', { title: 'Une autre graine', onclick: () => { state.seed = 1 + Math.floor(Math.random() * 1e6); state.force = {}; keep(); regenerate(); } }, '🎲'),
    h('label', {}, 'Sections', h('input', { type: 'number', min: 0, max: 300, value: state.count || '', placeholder: 'jusqu\'au ciel', onchange: (e: Event) => { state.count = Math.max(0, Math.min(300, Number((e.target as HTMLInputElement).value) || 0)); keep(); regenerate(); } })),
  ));
  out.append(h('div', { class: 'row toggles' },
    check('Physique', view.physics, (v) => { view.physics = v; keep(); }),
    check('Zones d\'aide', view.tips, (v) => { view.tips = v; keep(); }),
    check('Étiquettes', view.labels, (v) => { view.labels = v; keep(); }),
  ));
  if (!c) return out;
  const last = c.section(state.shown - 1), sky = (() => { for (let i = 0; i < state.shown; i++) if (c.section(i).floor >= HOUSE) return c.section(i); return null; })();
  out.append(h('p', { class: 'summary' },
    `${state.shown} sections, de 0 à ${last.exit.y.toFixed(1)} m`,
    sky ? ` · le ciel à §${sky.index} (${sky.level.bottom.toFixed(1)} m, ${(sky.pace / 60).toFixed(0)} min estimées)` : ''));
  if (state.section < state.shown) out.append(sectionCard(c.section(state.section)));

  const list = h('div', { class: 'sections' });
  let floor = -1;
  for (let i = 0; i < state.shown; i++) {
    const s = c.section(i);
    if (s.floor !== floor) { floor = s.floor; list.append(h('div', { class: 'floor' }, FLOORS[floor].name, h('small', {}, `${s.level.bottom.toFixed(1)} m`))); }
    list.append(h('div', { class: `sec${s.post ? ' post' : ''}${i === state.section ? ' on' : ''}${state.force[i] ? ' forced' : ''}`, onclick: () => { state.section = i; view.goTo(i); view.select(null); drawTab(); } },
      h('span', { class: 'k' }, `§${i}`),
      h('span', { class: 'y' }, `${s.level.bottom.toFixed(1)}`),
      h('span', { class: 'name' }, s.name),
      h('span', { class: 'effort', title: `effort ${s.effort}` }, '●'.repeat(s.effort)),
      s.twist.name ? h('span', { class: 'twist' }, s.twist.name) : null,
    ));
  }
  out.append(list);
  return out;
}

/** what section s is made of, and how to try another part in it */
function sectionCard(s: Section): HTMLElement {
  const forced = state.force[s.index] ?? {};
  const chip = (p?: PartData) => p ? h('button', { class: 'chip', title: 'Éditer cette pièce', onclick: () => openPart(p.name) }, p.name) : null;
  const choose = (family: Family, label: string, current?: string, locked = false) => {
    const all = parts(family).filter((p) => family !== 'keys' || p.name !== 'poteau');
    return h('label', {}, label, h('select', { disabled: s.index === 0 || (s.post && family !== 'ascents') || locked, onchange: (e: Event) => {
      const v = (e.target as HTMLSelectElement).value || undefined, f = { ...forced, [family === 'ascents' ? 'ascent' : family === 'obstacles' ? 'obstacle' : 'key']: v };
      if (!f.ascent && !f.obstacle && !f.key) delete state.force[s.index]; else state.force[s.index] = f;
      regenerate();
    } }, h('option', { value: '' }, '— tirée au sort —'), ...all.map((p) => h('option', { value: p.name, selected: p.name === current }, p.name))));
  };
  return h('div', { class: 'card' },
    h('h3', {}, `§${s.index} · ${FLOORS[s.floor].name}`, h('small', {}, ` ${s.level.bottom.toFixed(2)} → ${s.level.top.toFixed(2)} m · effort ${s.effort}${s.twist.name ? ` · ${s.twist.name}` : ''}${s.post ? ' · poteau' : ''}`)),
    h('div', { class: 'chips' }, chip(s.ascent), chip(s.obstacle?.locked ? undefined : s.obstacle), chip(s.obstacle?.locked ? s.obstacle : undefined), chip(s.key)),
    s.index > 0 ? h('details', { open: !!state.force[s.index] }, h('summary', {}, 'Essayer d\'autres pièces ici'),
      h('div', { class: 'row' }, choose('ascents', 'Montée', forced.ascent), choose('obstacles', 'Obstacle', forced.obstacle), choose('keys', 'Clé', forced.key)),
      h('p', { class: 'hint' }, 'Les sections au-dessus en sont changées : elles sont tirées à la suite.'),
    ) : null,
    h('div', { class: 'row' },
      h('button', { onclick: () => view.goTo(s.index) }, 'Voir'),
      h('button', { class: 'primary', title: dirty() ? 'Enregistre le catalogue, puis ouvre le jeu ici' : 'Ouvre le jeu ici', onclick: () => void play(s.index) }, dirty() ? 'Enregistrer et jouer ici ▶' : 'Jouer ici ▶'),
    ),
  );
}

// ---------------------------------------------------------------- the parts

/** the part named so, in its tab, its step at `path` shown */
function openPart(name: string, path?: string): void {
  const found = findPart(name);
  if (!found) return;
  state.tab = 'parts';
  state.family = found.family;
  state.part = name;
  keep();
  drawTabs();
  drawTab();
  if (path) editor?.reveal(path);
}

const TEMPLATES: Record<Family, () => PartData> = {
  ascents: (): AscentData => ({ name: 'nouvelle montée', effort: 1, from: 0, weight: 1, rise: [0.9, 1.3], side: 'any', nodes: 0, tip: '', steps: [{ op: 'zigzag', as: 'b' }] }),
  obstacles: (): ObstacleData => ({ name: 'nouvel obstacle', effort: 1, from: 0, weight: 1, x: 0.4, tip: '', steps: [
    { op: 'let', name: 'F', value: 'st.y + 0.5' },
    { op: 'floor', y: 'F', x: '-0.3 * k', w: 0.3 },
    { op: 'bar', x: '-0.3 * k', y: 'F + 0.3' },
    { op: 'exit', x: '-0.3 * k', y: 'F + 0.3' },
  ] }),
  keys: (): KeyData => ({ name: 'nouvelle clé', effort: 1, from: 0, weight: 1, x: 0.6, floor: 0.8, tip: '', steps: [
    { op: 'bar', x: '-k * 0.5', y: 'F - 0.45' },
    { op: 'pull', as: 'p', x: '-k * 0.3', top: 'F - 0.05', length: 0.5 },
    { op: 'opens', pulls: ['p.i'] },
  ] }),
};

function unique(name: string): string {
  if (!findPart(name)) return name;
  for (let i = 2; ; i++) if (!findPart(`${name} ${i}`)) return `${name} ${i}`;
}

/** a part renamed: what knows it by its name follows */
function renamed(from: string, to: string): void {
  for (const f of Object.values(state.catalog.favours)) if (from in f) { f[to] = f[from]; delete f[from]; }
  for (const q of Object.values(state.force)) for (const k of ['ascent', 'obstacle', 'key'] as const) if (q[k] === from) q[k] = to;
}

function partsTab(): HTMLElement {
  const out = h('div', { class: 'parts' }), list = parts(state.family);
  out.append(h('div', { class: 'seg' }, ...FAMILIES.map(({ key, label }) => h('button', { class: key === state.family ? 'on' : '', onclick: () => { state.family = key; state.part = parts(key)[0]?.name ?? ''; keep(); drawTab(); } }, `${label} (${parts(key).length})`))));
  const counts = uses();
  out.append(h('div', { class: 'partlist' }, ...list.map((p) => h('div', { class: `part${p.name === state.part ? ' on' : ''}`, onclick: () => { state.part = p.name; keep(); drawTab(); } },
    h('span', { class: 'name' }, p.name),
    h('span', { class: 'meta', title: 'effort · dès la section · poids' }, `${'●'.repeat(p.effort)}${'○'.repeat(Math.max(0, 3 - p.effort))} §${p.from}+ ×${p.weight}`),
    h('span', { class: 'uses', title: 'fois dans cette montée' }, String(counts.get(p.name)?.length ?? 0)),
  ))));
  const part = list.find((p) => p.name === state.part);
  out.append(h('div', { class: 'row' },
    h('button', { onclick: () => { const p = TEMPLATES[state.family](); p.name = unique(p.name); list.push(p); state.part = p.name; keep(); changed(); drawTab(); } }, '+ Nouvelle'),
    h('button', { disabled: !part, onclick: () => { const p = structuredClone(part!); p.name = unique(p.name); list.splice(list.indexOf(part!) + 1, 0, p); state.part = p.name; keep(); changed(); drawTab(); } }, 'Dupliquer'),
    h('button', { class: 'danger', disabled: !part, onclick: () => {
      if (!part || !confirm(`Supprimer « ${part.name} » ?`)) return;
      list.splice(list.indexOf(part), 1);
      for (const f of Object.values(state.catalog.favours)) delete f[part.name];
      state.part = list[0]?.name ?? '';
      keep(); changed(); drawTab();
    } }, 'Supprimer'),
  ));
  if (part) out.append(partEditor(part));
  return out;
}

/** where each part is in the climb shown: the sections */
function uses(): Map<string, number[]> {
  const m = new Map<string, number[]>(), c = state.course;
  if (!c) return m;
  for (let i = 0; i < state.shown; i++) {
    const s = c.section(i);
    for (const p of [s.ascent, s.obstacle, s.key]) if (p) m.set(p.name, [...(m.get(p.name) ?? []), i]);
  }
  return m;
}

const usesBox = h('div', { class: 'uses-line' });
function drawUses(): void {
  const at = uses().get(state.part) ?? [];
  usesBox.replaceChildren(
    h('span', {}, at.length ? 'Dans cette montée : ' : 'Pas dans cette montée. '),
    ...at.slice(0, 24).map((k) => h('button', { class: `chip${k === state.section ? ' on' : ''}`, onclick: () => { state.section = k; view.goTo(k); markPart(); drawUses(); } }, `§${k}`)),
    at.length > 24 ? ' …' : '',
    h('button', { title: 'Choisir cette pièce dans la section sélectionnée', onclick: () => tryHere() }, `Essayer dans §${Math.max(1, state.section)}`),
  );
}

/** the part being edited, chosen in the section selected (or, the start, the next one) */
function tryHere(): void {
  const k = Math.max(1, state.section), key = state.family === 'ascents' ? 'ascent' : state.family === 'obstacles' ? 'obstacle' : 'key';
  state.force[k] = { ...state.force[k], [key]: state.part };
  state.section = k;
  regenerate();
  view.goTo(k);
}

/** in the view, the things the part made */
function markPart(path?: string): void {
  const name = state.part;
  view.mark((t: Thing) => t.origin?.part === name && (path === undefined || t.origin.path === path || t.origin.path.startsWith(`${path}.`)));
}

function showStepError(): void {
  const e = state.error;
  editor?.error(e instanceof LayoutError && e.part === state.part ? e.path : null, e?.message);
}

function partEditor(p: PartData): HTMLElement {
  const family = state.family, a = p as AscentData, o = p as ObstacleData, k = p as KeyData;
  const settings = h('div', { class: 'grid' },
    h('label', { class: 'wide' }, 'Nom', h('input', { type: 'text', value: p.name, onchange: (e: Event) => {
      const v = (e.target as HTMLInputElement).value.trim();
      if (!v || (v !== p.name && findPart(v))) { (e.target as HTMLInputElement).value = p.name; return; }
      renamed(p.name, v);
      p.name = v;
      state.part = v;
      keep(); changed(); drawTab();
    } })),
    num('Effort (0 à 3)', p.effort, (v) => (p.effort = v ?? 0), { min: 0, max: 3, step: 1 }),
    num('Dès la section', p.from, (v) => (p.from = v ?? 0), { min: 0, step: 1 }),
    num('Poids', p.weight, (v) => (p.weight = v ?? 0), { min: 0 }),
  );
  if (family === 'ascents') settings.append(
    num('Monte au moins (m)', a.rise[0], (v) => (a.rise[0] = v ?? 0)),
    num('Monte au plus (m)', a.rise[1], (v) => (a.rise[1] = v ?? 0)),
    h('label', {}, 'Station', h('select', { onchange: (e: Event) => { a.side = (e.target as HTMLSelectElement).value as AscentData['side']; changed(); } },
      ...Object.entries(SIDES).map(([v, l]) => h('option', { value: v, selected: a.side === v }, l)))),
    num('Nœuds de corde', a.nodes, (v) => (a.nodes = v ?? 0), { min: 0, step: 10, title: `plus de ${state.catalog.course.heavy} : jamais deux de suite` }),
  );
  if (family === 'obstacles') settings.append(
    num('Station à x', o.x, (v) => (o.x = v ?? 0), { title: 'du côté k ; négatif : de l\'autre côté' }),
    check('Fermé (une clé l\'ouvre)', !!o.locked, (v) => { if (v) o.locked = true; else delete o.locked; changed(); }),
  );
  if (family === 'keys') settings.append(
    num('Station à x', k.x, (v) => (k.x = v ?? 0)),
    num('Plancher au-dessus (m)', k.floor, (v) => (k.floor = v ?? 0)),
    num('Prise au-delà (m)', k.beyond, (v) => { if (v === undefined) delete k.beyond; else k.beyond = v; }, { placeholder: '0.3' }),
  );
  settings.append(h('label', { class: 'wide' }, 'Aide (la première fois)', h('textarea', { rows: 2, value: p.tip ?? '', oninput: (e: Event) => {
    const v = (e.target as HTMLTextAreaElement).value;
    if (v) p.tip = v; else delete p.tip;
    changed();
  } })));

  editor = stepsEditor(p, family, changed, (path) => (path === null ? view.mark(null) : markPart(path)));
  const json = h('textarea', { class: 'json', rows: 14, spellcheck: false, value: JSON.stringify(p.steps, null, 2) });
  const raw = h('details', {}, h('summary', {}, 'En JSON'), json, h('button', { onclick: () => {
    try { p.steps = JSON.parse(json.value); changed(); drawTab(); } catch (err) { alert(`JSON invalide : ${(err as Error).message}`); }
  } }, 'Appliquer'));
  drawUses();
  return h('div', { class: 'editor' },
    settings,
    usesBox,
    h('h3', {}, 'Étapes', h('small', {}, ' survoler une étape montre ce qu\'elle a posé ; cliquer un élément montre son étape')),
    help(family),
    editor.el,
    raw,
  );
}

function help(family: Family): HTMLElement {
  const holds: Record<Family, string> = {
    ascents: '<code>from</code> la prise de départ, <code>to</code> la station (x, y) ; <code>s</code> le côté de from (1 droite, −1 gauche)',
    obstacles: '<code>st</code> la station, <code>k</code> son côté, <code>key</code> la clé de la trappe (key.floor, key.beyond)',
    keys: '<code>st</code> la station, <code>k</code> son côté, <code>F</code> la hauteur du plancher de la trappe',
  };
  const d = h('details', { class: 'help' }, h('summary', {}, 'Ce qu\'on peut écrire dans les champs'));
  d.insertAdjacentHTML('beforeend', `<p>Un nombre, ou une expression : ${holds[family]} ; <code>twist.slack</code>, <code>twist.chrome</code>, <code>twist.gap</code>, <code>twist.rubber</code> ;
    ce que les étapes d'avant ont nommé (variable, ou « nom » d'une étape : une barre nommée b a <code>b.x</code>, <code>b.y</code>, et <code>b.i</code> son index pour un fil posé ou une barre mobile) ;
    <code>rnd()</code> (0 à 1), <code>jitter(a)</code> (± a), <code>lerp(a, b, t)</code>, <code>clampX(x)</code> (dans la pièce), <code>side(x)</code>, <code>pick(COLORS)</code>, <code>abs</code>, <code>min</code>, <code>max</code>, <code>round</code>, <code>floor</code>, <code>hypot</code>, <code>PI</code>.</p>
    <p>La pièce fait 1,70 m de large (x de −0,85 à 0,85), y monte. Entre deux prises : jamais plus d'environ 50 cm de montée ni 60 cm d'écart. Chaque tirage de <code>rnd()</code> vient à son tour : changer l'ordre des étapes change la suite de la montée.</p>`);
  return d;
}

// ------------------------------------------------------------ the settings

function settingsTab(): HTMLElement {
  const cat = state.catalog, out = h('div', { class: 'settings' });
  const twists = h('table', { class: 'twists' }, h('tr', {}, ...['Variante', 'montée ×', 'chrome', 'mou (m)', 'caoutchouc', ''].map((t) => h('th', {}, t))));
  cat.twists.forEach((t, i) => {
    const cell = (key: 'gap' | 'chrome' | 'slack' | 'rubber') => h('td', {}, h('input', { type: 'number', step: 'any', value: t[key], oninput: (e: Event) => { t[key] = Number((e.target as HTMLInputElement).value) || 0; changed(); } }));
    twists.append(h('tr', {},
      h('td', {}, h('input', { type: 'text', value: t.name, placeholder: i === 0 ? '(ordinaire)' : '', oninput: (e: Event) => { t.name = (e.target as HTMLInputElement).value; changed(); } })),
      cell('gap'), cell('chrome'), cell('slack'), cell('rubber'),
      h('td', {}, i === 0 ? null : h('button', { class: 'icon danger', title: 'Supprimer', onclick: () => { cat.twists.splice(i, 1); changed(); drawTab(); } }, '✕')),
    ));
  });
  out.append(h('h3', {}, 'Variantes de tronçon', h('small', {}, ' une par tronçon (d\'un poteau à l\'autre), tirée au sort ; la première, ordinaire, avant la section de « variantes dès »')),
    twists, h('button', { onclick: () => { cat.twists.push({ name: 'nouvelle', gap: 1, chrome: 0.15, slack: 0, rubber: 0.18 }); changed(); drawTab(); } }, '+ Variante'));

  const r = cat.course;
  out.append(h('h3', {}, 'Assemblage'), h('div', { class: 'grid' },
    num('Variantes dès la section', r.twistFrom, (v) => (r.twistFrom = v ?? 0), { step: 1, min: 0 }),
    num('Montée chargée : plus de nœuds que', r.heavy, (v) => (r.heavy = v ?? 0), { step: 10, min: 0 }),
    num('Effort max. au départ', r.cap.base, (v) => (r.cap.base = v ?? 0), { step: 1 }),
    num('… +1 toutes les (sections)', r.cap.every, (v) => (r.cap.every = Math.max(1, v ?? 1)), { step: 1, min: 1 }),
    num('… jusqu\'à + ', r.cap.most, (v) => (r.cap.most = v ?? 0), { step: 1, min: 0 }),
    num('Sections par tronçon au départ', r.stretch.base, (v) => (r.stretch.base = Math.max(0, v ?? 0)), { step: 1, min: 0 }),
    num('… +1 toutes les (sections)', r.stretch.every, (v) => (r.stretch.every = Math.max(1, v ?? 1)), { step: 1, min: 1 }),
    num('… jusqu\'à +', r.stretch.most, (v) => (r.stretch.most = v ?? 0), { step: 1, min: 0 }),
    num('Chance d\'une de plus', r.stretch.longer, (v) => (r.stretch.longer = v ?? 0), { min: 0, max: 1, step: 0.05 }),
  ));

  out.append(h('h3', {}, 'Ce que chaque étage a de plus', h('small', {}, ' × le poids de la pièce dans cet étage')));
  const all = FAMILIES.flatMap(({ key }) => parts(key).map((p) => p.name)).filter((n) => n !== 'poteau' && n !== 'trappe');
  for (const f of FLOORS) {
    const fav = cat.favours[f.name] ?? {};
    const row = h('div', { class: 'favours' }, h('b', {}, f.name));
    for (const [name, w] of Object.entries(fav)) {
      row.append(h('span', { class: `chip${findPart(name) ? '' : ' bad'}`, title: findPart(name) ? '' : 'pièce inconnue' }, name, ' ×',
        h('input', { type: 'number', step: 0.5, min: 0, value: w, oninput: (e: Event) => { fav[name] = Number((e.target as HTMLInputElement).value) || 0; changed(); } }),
        h('button', { class: 'icon', onclick: () => { delete fav[name]; if (!Object.keys(fav).length) delete cat.favours[f.name]; changed(); drawTab(); } }, '✕')));
    }
    row.append(h('select', { onchange: (e: Event) => {
      const v = (e.target as HTMLSelectElement).value;
      if (!v) return;
      (cat.favours[f.name] ??= {})[v] = 2;
      changed(); drawTab();
    } }, h('option', { value: '' }, '+'), ...all.filter((n) => !(n in fav)).map((n) => h('option', { value: n }, n))));
    out.append(row);
  }
  return out;
}

// -------------------------------------------------------------------- view

view.onSelect = (t) => {
  if (!t) return;
  state.section = t.section;
  const found = t.origin && findPart(t.origin.part);
  if (found) { openPart(found.part.name, t.origin!.path || undefined); view.select(t); return; }
  // the station, the start: what the course itself puts
  state.tab = 'climb';
  keep();
  drawTabs();
  drawTab();
  view.select(t);
};

// ------------------------------------------------------------------- start

async function start(): Promise<void> {
  const res = await fetch('/__catalog');
  if (!res.ok) {
    panel.replaceChildren(h('p', { class: 'errorbar' }, 'Le catalogue ne se lit pas : l\'éditeur tourne avec « npm run dev », qui sait l\'écrire.'));
    return;
  }
  const text = await res.text();
  state.catalog = JSON.parse(text);
  state.saved = JSON.stringify(state.catalog);
  const draft = read<Catalog | null>(DRAFT, null);
  if (draft && JSON.stringify(draft) !== state.saved && confirm('Des modifications du catalogue n\'ont pas été enregistrées. Les reprendre ?')) state.catalog = draft;
  else write(DRAFT, null);
  if (!findPart(state.part)) state.part = parts(state.family)[0]?.name ?? '';
  drawHeader();
  drawTabs();
  regenerate();
  drawTab();
  view.goTo(0);
  addEventListener('beforeunload', (e) => { if (dirty()) e.preventDefault(); });
  // ⌘S / ctrl+S saves
  addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (dirty()) void save(); } });
}

void start();

// for the console
Object.assign(window, { editor: { state, view, stepAt, parseExpr, KIND_NAMES } });
