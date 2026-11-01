// The parts of the course as data (catalog.json, made with the level
// editor), and what lays them out. A part is a list of steps, each one thing
// put into the section (a bar, a cord, an eyelet...) or a way of putting
// several (bars zigzagging up, a few times over, only if...). Where a thing
// goes is an expression, read from the holds the part knows:
//
//   an ascent    from, to    the hold it starts from, its station; s: the side
//                            `from` is on (1 right, −1 left)
//   an obstacle  st, k, key  its station, the side it is on, the key that
//                            opens its trapdoor (key.floor, key.beyond)
//   a key        st, k, F    the same, and the height of the trapdoor's floor
//
// and from the stretch's twist (twist.slack, twist.chrome...), from what the
// steps before have named (`let`, or `as` on a step: a bar named b is b.x,
// b.y, and b.i its index, for a drape or a mover), and from a few helpers:
// rnd() (0 to 1), jitter(a) (± a), lerp, clampX (inside the room), side,
// pick(COLORS), abs, min, max, round, floor, hypot, PI.
//
// The steps run in order, and each draw of rnd() comes in turn: the same
// seed lays the same course.

import { bar, type Gate, type Level, type Mat } from '../level/level';

/** a number, or what to work it out from */
export type Expr = number | string;

/** one step of a part: what it does (`op`), its fields, what it is named, the steps it holds */
export interface Step {
  op: string;
  as?: string;
  do?: Step[];
  then?: Step[];
  else?: Step[];
  [field: string]: unknown;
}

/** what every part has: when it comes in, how often, how hard it is, what it says the first time, its steps */
export interface PartData {
  name: string;
  /** the section from which it may come */
  from: number;
  /** how often it comes, against the others of its family */
  weight: number;
  /** how hard it is, 0 to 3: a section's effort is its parts' together */
  effort: number;
  tip?: string;
  steps: Step[];
}
export interface AscentData extends PartData {
  /** how high it climbs (m), at least and at most */
  rise: [number, number];
  /** where the station is, from the hold it starts from: on the other side, the same side, either */
  side: 'cross' | 'same' | 'any';
  /** the cords it adds, roughly (nodes of the solver): never two ascents full of cords in a row */
  nodes: number;
}
export interface ObstacleData extends PartData {
  /** how far from the middle its station is, on side k (negative: on the other side) */
  x: number;
  /** a trapdoor: a key opens it */
  locked?: boolean;
}
export interface KeyData extends PartData {
  /** how far from the middle its station is, on side k */
  x: number;
  /** how high above its station the trapdoor's floor is */
  floor: number;
  /** how high above the floor the hold beyond it is (0.3 if not said) */
  beyond?: number;
}

/** what makes a stretch of course harder or softer, whatever its parts */
export interface Twist {
  name: string;
  /** the rise of ascents, × */
  gap: number;
  /** how likely a chrome bar (it cannot be gripped) is set beside the way, or a floor is chrome */
  chrome: number;
  /** how much slacker lines are (m) */
  slack: number;
  /** how likely a bar is rubber (it rests a grip) */
  rubber: number;
}

/** the rules of the course's assembly that are numbers (see course.ts) */
export interface CourseRules {
  /** the section from which stretches have a twist (before: the first, plain) */
  twistFrom: number;
  /** an ascent with more nodes than this is full of cords */
  heavy: number;
  /** the most effort a section may have: base, one more every `every` sections, `most` more at most */
  cap: { base: number; every: number; most: number };
  /** the sections of a stretch before its post: the same, and one more as often as `longer` */
  stretch: { base: number; every: number; most: number; longer: number };
}

/** everything the course is assembled from */
export interface Catalog {
  course: CourseRules;
  twists: Twist[];
  /** what each floor (by its name) has more of: × the weight of parts, by their name */
  favours: Record<string, Record<string, number>>;
  ascents: AscentData[];
  obstacles: ObstacleData[];
  keys: KeyData[];
}

export type Family = 'ascents' | 'obstacles' | 'keys';

/** where the lace holds on: the bar a part starts from or ends on */
export interface Hold { x: number; y: number }

/** what a part is laid out with */
export interface Ctx {
  /** the section the part goes into */
  L: Level;
  twist: Twist;
  rnd: () => number;
  /** the course has not had this part yet: it says what to do (see `tip`) */
  first: (name: string) => boolean;
  /** for the editor: what made each thing of the section, by its kind and index (the step's path in its part) */
  origins?: Origins;
}

/** the arrays of a level that hold things */
export const KINDS = ['bars', 'shelves', 'hangs', 'rings', 'gates', 'pulls', 'skeins', 'drapes', 'lines', 'nets', 'movers', 'hazards', 'winds', 'searches', 'zips', 'clocks', 'hooks', 'lifts', 'buttons', 'tips'] as const;
export type Kind = (typeof KINDS)[number];
/** what made a thing: a part (or the course itself) and the path of the step in it ("2", "2.do.0") */
export interface Origin { part: string; path: string }
export type Origins = Partial<Record<Kind, Origin[]>>;

/** the things of each kind so far: after a step, those that came are its own */
const counts = (L: Level) => KINDS.map((k) => L[k].length);
export function stamp(c: Ctx, before: number[], who: Origin): void {
  if (!c.origins) return;
  KINDS.forEach((k, j) => {
    const a = (c.origins![k] ??= []);
    for (let i = before[j]; i < c.L[k].length; i++) a[i] ??= who;
  });
}
/** runs `f`, the things it put in the section marked as made by `who` */
export function made<T>(c: Ctx, who: Origin, f: () => T): T {
  const before = counts(c.L), out = f();
  stamp(c, before, who);
  return out;
}

// ------------------------------------------------------------- the steps

/**
 * What a field of a step is: a number (or what to work it out from), any
 * value, a list of numbers, yes or no, a material, a colour, one of a few words, a name, steps
 */
export type FieldKind = 'num' | 'any' | 'nums' | 'bool' | 'mat' | 'color' | 'hazard' | 'name' | 'steps';
export interface Field { key: string; kind: FieldKind; label: string; optional?: boolean }
export interface Op {
  label: string;
  /** what it does, in a line */
  help: string;
  fields: Field[];
  /** the families it makes sense in (all, if not said) */
  only?: Family[];
}

const f = (key: string, kind: FieldKind, label: string, optional = false): Field => ({ key, kind, label, optional });
const NUM = (key: string, label: string, optional = false) => f(key, 'num', label, optional);
const AS = f('as', 'name', 'nom', true);

export const OPS: Record<string, Op> = {
  let: { label: 'variable', help: 'Donne un nom à une valeur, pour les étapes suivantes (la redonner la change).', fields: [f('name', 'name', 'nom'), f('value', 'any', 'valeur')] },
  bar: { label: 'barre', help: 'Une barre en travers de la pièce. Matière « auto » : bois, ou caoutchouc selon le tronçon.', fields: [AS, NUM('x', 'x'), NUM('y', 'y'), f('mat', 'mat', 'matière', true), NUM('r', 'rayon', true)] },
  shelf: { label: 'étagère', help: 'Une étagère de x0 à x1.', fields: [NUM('x0', 'x0'), NUM('x1', 'x1'), NUM('y', 'y'), f('mat', 'mat', 'matière', true)] },
  floor: { label: 'plancher', help: 'Un plancher d\'un mur à l\'autre, ouvert sur une largeur w autour de x.', fields: [NUM('y', 'y'), NUM('x', 'x de l\'ouverture'), NUM('w', 'largeur'), f('mat', 'mat', 'matière', true)] },
  hang: { label: 'corde pendue', help: 'Une corde pendue à un crochet (pas si elle passerait à moins de 10 cm des x de « libre »). « Fragile » : un fil qui cède après avoir porté le lacet tant de secondes.', fields: [NUM('x', 'x'), NUM('top', 'haut'), NUM('length', 'longueur'), f('clear', 'nums', 'libre', true), NUM('fragile', 'fragile (s)', true)] },
  ring: { label: 'œillet', help: 'Un œillet de rayon r. Tourné : 0 de côté, π/2 face à nous. À plat : trou vers le haut.', fields: [AS, NUM('x', 'x'), NUM('y', 'y'), NUM('r', 'rayon'), NUM('turn', 'tourné', true), f('up', 'bool', 'à plat', true)] },
  pull: { label: 'tirette', help: 'Une tirette, qui sent ce qui s\'y pend.', fields: [AS, NUM('x', 'x'), NUM('top', 'haut'), NUM('length', 'longueur')] },
  skein: { label: 'écheveau', help: 'Des brins de laine pendus à un crochet, croisés.', fields: [NUM('x', 'x'), NUM('top', 'haut'), NUM('length', 'longueur'), NUM('count', 'brins'), f('color', 'color', 'couleur')] },
  drape: { label: 'fil posé', help: 'Un fil posé sur une barre (son index : b.i), « gauche » de sa longueur à gauche.', fields: [NUM('bar', 'barre'), NUM('length', 'longueur'), NUM('left', 'gauche'), f('color', 'color', 'couleur')] },
  line: { label: 'fil tendu', help: 'Un fil entre deux crochets, plus long que l\'écart de « mou ».', fields: [NUM('x0', 'x0'), NUM('y0', 'y0'), NUM('x1', 'x1'), NUM('y1', 'y1'), NUM('slack', 'mou'), f('color', 'color', 'couleur', true)] },
  net: { label: 'filet', help: 'Un filet pendu par le haut (noué en bas aussi), ou une échelle de corde (deux colonnes).', fields: [NUM('x0', 'x0'), NUM('x1', 'x1'), NUM('top', 'haut'), NUM('bottom', 'bas'), NUM('cols', 'colonnes'), NUM('rows', 'rangs'), f('tied', 'bool', 'noué en bas', true), f('ladder', 'bool', 'échelle', true), f('color', 'color', 'couleur', true), f('sticky', 'bool', 'toile collante', true)] },
  mover: { label: 'barre mobile', help: 'Fait aller et venir une barre (son index : b.i) de dx, dy de part et d\'autre, en `period` secondes.', fields: [NUM('bar', 'barre'), NUM('dx', 'dx'), NUM('dy', 'dy'), NUM('period', 'période'), NUM('phase', 'phase')] },
  hazard: { label: 'danger', help: 'Une lame (coupe), une flamme (brûle), de l\'eau (trempe), dans la boîte de (x0, y0) à (x1, y1).', fields: [f('kind', 'hazard', 'sorte'), NUM('x0', 'x0'), NUM('y0', 'y0'), NUM('x1', 'x1'), NUM('y1', 'y1')] },
  wind: { label: 'courant d\'air', help: 'De l\'air qui pousse le lacet à (vx, vy) m/s dans la boîte de (x0, y0) à (x1, y1) : l\'air chaud d\'un radiateur monte, une bouche souffle de côté. Par rafales toutes les `period` s, si dit.', fields: [NUM('x0', 'x0'), NUM('y0', 'y0'), NUM('x1', 'x1'), NUM('y1', 'y1'), NUM('vx', 'vx'), NUM('vy', 'vy'), NUM('period', 'période', true), NUM('phase', 'phase', true)] },
  search: { label: 'lampe qui cherche', help: 'Une lampe en (x, y) dont le faisceau balaie la pièce, de `arc` (rad) de part et d\'autre de la verticale, en `period` s. Dans sa lumière, les prises fatiguent vite : se cacher dans l\'ombre des barres.', fields: [NUM('x', 'x'), NUM('y', 'y'), NUM('arc', 'arc'), NUM('period', 'période'), NUM('phase', 'phase')] },
  zip: { label: 'tyrolienne', help: 'Un fil tendu de (x0, y0) en haut à (x1, y1) en bas, une bobine dessus qui file vers le bas quand on s\'y accroche.', fields: [AS, NUM('x0', 'x0'), NUM('y0', 'y0'), NUM('x1', 'x1'), NUM('y1', 'y1')] },
  clock: { label: 'horloge', help: 'Une horloge en (x, y) dont l\'aiguille, longue de `length`, fait un tour en `period` s (négatif : à rebours). S\'y accrocher fait tourner avec elle.', fields: [AS, NUM('x', 'x'), NUM('y', 'y'), NUM('length', 'longueur'), NUM('period', 'période'), NUM('phase', 'phase')] },
  hook: { label: 'crochet', help: 'Un crochet de fer qui sort du mur, la pointe relevée : aucun bout ne s\'y accroche, le lacet s\'y pend par-dessus.', fields: [NUM('x', 'x'), NUM('y', 'y')] },
  lift: { label: 'monte-charge', help: 'Un fil sur une poulie (la barre b.i, en chrome), un plomb de `weight` fois le lacet d\'un côté, retenu ; une poignée `drop` plus bas de l\'autre (côté `side`). Saisir la poignée lâche le plomb, qui hisse le lacet.', fields: [NUM('bar', 'poulie'), NUM('drop', 'descente'), NUM('weight', 'poids'), NUM('side', 'côté')] },
  button: { label: 'bouton', help: 'Un bouton à ramasser.', fields: [NUM('x', 'x'), NUM('y', 'y')] },
  tip: { label: 'aide', help: 'Où l\'aide de la pièce s\'affiche, la première fois (tant que la trappe à venir est fermée, si « trappe »).', fields: [NUM('x', 'x'), NUM('y', 'y'), NUM('r', 'rayon'), f('gate', 'bool', 'trappe', true)] },
  decoy: { label: 'leurre', help: 'De temps en temps (selon twist.chrome), une barre de chrome de l\'autre côté de x.', fields: [NUM('x', 'x'), NUM('y', 'y')] },
  zigzag: { label: 'barres en zigzag', help: 'Des barres en zigzag de from à to, autant qu\'il en faut, un bouton à mi-chemin ; puis « faire » pour chacune (nommée, i : son rang).', only: ['ascents'], fields: [AS, f('do', 'steps', 'faire', true)] },
  repeat: { label: 'répéter', help: 'Les étapes de « faire », n fois (i : 0, 1, ...).', fields: [NUM('count', 'fois'), f('as', 'name', 'rang', true), f('do', 'steps', 'faire')] },
  if: { label: 'si', help: 'Les étapes de « alors » si le test est vrai, sinon celles de « sinon ».', fields: [f('test', 'bool', 'test'), f('then', 'steps', 'alors'), f('else', 'steps', 'sinon', true)] },
  slot: { label: 'fente', help: 'Un plancher 50 cm au-dessus de la station, une fente étroite dedans, une barre au-delà (la sortie). Nommée f : f.x, f.w, f.F.', only: ['obstacles'], fields: [AS] },
  trapdoor: { label: 'trappe', help: 'Un plancher à F, une trappe au milieu (ouverte par la clé, ou toute seule toutes les `period` s), une barre au-delà (la sortie).', only: ['obstacles'], fields: [NUM('F', 'F'), f('key', 'bool', 'par la clé', true), NUM('period', 'période', true), NUM('beyond', 'au-delà', true)] },
  exit: { label: 'sortie', help: 'La prise où la section finit, d\'où part la suivante (sinon : la station).', only: ['obstacles'], fields: [NUM('x', 'x'), NUM('y', 'y')] },
  opens: { label: 'ouvre', help: 'Ce qui ouvre la trappe : des œillets (a.i...) enfilés à la fois, des tirettes pesées à la fois, un poteau. « Tenue » : seulement tant qu\'on pèse.', only: ['keys'], fields: [f('rings', 'nums', 'œillets', true), f('pulls', 'nums', 'tirettes', true), NUM('post', 'poteau', true), f('held', 'bool', 'tenue', true)] },
};

export const MAT_CHOICES = ['auto', 'auto-chrome', 'wood', 'chrome', 'rubber', 'gold'] as const;
export const HAZARDS = ['blade', 'flame', 'water'] as const;
export const COLORS = ['#d9534f', '#5b8def', '#9b6bd1', '#3fae74', '#e0a03a'];

/** something wrong in a part: where, and what */
export class LayoutError extends Error {
  constructor(readonly part: string, readonly path: string, message: string) {
    super(`${part}, étape ${path} : ${message}`);
  }
}

const compiled = new Map<string, (scope: object) => unknown>();
function evaluate(src: string, scope: object): unknown {
  let fn = compiled.get(src);
  if (!fn) {
    // a function's body is sloppy code: `with` gives the expression the names of the scope
    fn = new Function('scope', `with (scope) { return (${src}); }`) as (scope: object) => unknown;
    compiled.set(src, fn);
  }
  return fn(scope);
}

const clampX = (x: number) => Math.max(-0.7, Math.min(0.7, x));
const side = (x: number) => (x >= 0 ? 1 : -1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const HELPERS = { lerp, clampX, side, abs: Math.abs, min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, hypot: Math.hypot, sqrt: Math.sqrt, PI: Math.PI, COLORS };

/** a bar; where a grip may rest, wood or sometimes rubber */
export function pushBar(c: Ctx, x: number, y: number, mat?: Mat, r?: number): number {
  c.L.bars.push(bar(x, y, mat ?? (c.rnd() < c.twist.rubber ? 'rubber' : 'wood'), r));
  return c.L.bars.length - 1;
}

/** a floor across the room, with a gap `w` wide centred on x (two shelves) */
function floor(c: Ctx, y: number, x: number, w: number, mat: Mat = 'wood'): void {
  if (x - w / 2 > -0.84) c.L.shelves.push({ x0: -0.85, x1: x - w / 2, y, mat });
  if (x + w / 2 < 0.84) c.L.shelves.push({ x0: x + w / 2, x1: 0.85, y, mat });
}

/** a material as a step says it: `auto` wood or rubber (`auto-chrome`: wood or chrome) as the twist has it */
function material(c: Ctx, m: unknown): Mat | undefined {
  if (m === undefined || m === 'auto') return undefined;
  if (m === 'auto-chrome') return c.rnd() < c.twist.chrome ? 'chrome' : 'wood';
  return m as Mat;
}

/** what a part is laid out from: its holds, and what is said of its key */
export interface Given { from?: Hold; to?: Hold; st?: Hold; k?: number; F?: number; key?: KeyData; layKey?: (F: number) => Partial<Gate> }
/** what a part gives back: the hold it ends on (an obstacle), what opens the trapdoor (a key) */
export interface Laid { exit?: Hold; opens?: Partial<Gate> }

/** lays out part `p` in c's section */
export function lay(c: Ctx, p: PartData, given: Given): Laid {
  const out: Laid = {};
  const scope: Record<string, unknown> = Object.assign(Object.create(HELPERS), {
    rnd: c.rnd,
    jitter: (a: number) => (c.rnd() - 0.5) * 2 * a,
    pick: <T>(a: T[]): T => a[Math.floor(c.rnd() * a.length)],
    twist: c.twist,
    from: given.from, to: given.to, s: given.from ? side(given.from.x) : undefined,
    st: given.st, k: given.k, F: given.F,
    key: given.key && { name: given.key.name, x: given.key.x, floor: given.key.floor, beyond: given.key.beyond },
  });

  const run = (steps: Step[] | undefined, at: string) => steps?.forEach((s, j) => {
    const path = at ? `${at}.${j}` : `${j}`;
    made(c, { part: p.name, path }, () => one(s, path));
  });

  /** field `key` of step s, worked out as its kind says */
  const field = (s: Step, path: string, key: string): unknown => {
    const v = s[key], def = OPS[s.op]?.fields.find((q) => q.key === key), kind = def?.kind ?? 'num';
    if (v === undefined || v === null || v === '') return undefined;
    const value = (e: unknown) => {
      if (typeof e === 'number' || typeof e === 'boolean') return e;
      if (typeof e !== 'string') throw new LayoutError(p.name, path, `${key} : ${JSON.stringify(e)} n'est pas une valeur`);
      try { return evaluate(e, scope); } catch (err) { throw new LayoutError(p.name, path, `${key} = ${e} : ${(err as Error).message}`); }
    };
    switch (kind) {
      case 'mat': case 'hazard': case 'name': return v;
      case 'color': return typeof v === 'string' && v.startsWith('#') ? v : value(v);
      case 'bool': return !!value(v);
      case 'any': return value(v);
      case 'nums': return (v as unknown[]).map((e) => num(value(e), path, key));
      default: { const n = value(v); return n === undefined && def?.optional ? undefined : num(n, path, key); }
    }
  };
  const num = (v: unknown, path: string, key: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new LayoutError(p.name, path, `${key} vaut ${String(v)}, pas un nombre`);
    return v;
  };
  /** the fields of step s, in the order they are written (so that the draws of rnd() come in that order) */
  const fields = (s: Step, path: string): Record<string, any> => {
    const o: Record<string, any> = {};
    for (const key of Object.keys(s)) {
      if (key === 'op' || key === 'as' || OPS[s.op]?.fields.find((q) => q.key === key)?.kind === 'steps') continue;
      o[key] = field(s, path, key);
    }
    return o;
  };
  const name = (s: Step, v: unknown) => { if (s.as) scope[s.as] = v; };

  const one = (s: Step, path: string): void => {
    const L = c.L;
    if (!OPS[s.op]) throw new LayoutError(p.name, path, `« ${s.op} » n'est pas une étape connue`);
    const o = fields(s, path);
    switch (s.op) {
      case 'let': scope[s.name as string] = o.value; break;
      case 'bar': { const i = pushBar(c, o.x, o.y, material(c, o.mat), o.r); name(s, { ...L.bars[i], i }); break; }
      case 'shelf': L.shelves.push({ x0: o.x0, x1: o.x1, y: o.y, ...(o.mat ? { mat: material(c, o.mat) ?? 'wood' } : {}) }); break;
      case 'floor': floor(c, o.y, o.x, o.w, material(c, o.mat ?? 'wood') ?? 'wood'); break;
      case 'hang':
        if (!(o.clear ?? []).some((b: number) => Math.abs(b - o.x) < 0.1)) L.hangs.push(clean({ x: o.x, top: o.top, length: Math.max(0.3, o.length), fragile: o.fragile }));
        break;
      case 'ring': L.rings.push(clean({ x: o.x, y: o.y, r: o.r, turn: o.turn, up: o.up || undefined })); name(s, { ...L.rings[L.rings.length - 1], i: L.rings.length - 1 }); break;
      case 'pull': L.pulls.push({ x: o.x, top: o.top, length: o.length }); name(s, { ...L.pulls[L.pulls.length - 1], i: L.pulls.length - 1 }); break;
      case 'skein': L.skeins.push({ x: o.x, top: o.top, length: o.length, count: o.count, color: o.color }); break;
      case 'drape': L.drapes.push({ bar: o.bar, length: o.length, left: o.left, color: o.color }); break;
      case 'line': L.lines.push(clean({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, slack: o.slack, color: o.color })); break;
      case 'net': L.nets.push(clean({ x0: o.x0, x1: o.x1, top: o.top, bottom: o.bottom, cols: o.cols, rows: o.rows, tied: o.tied || undefined, ladder: o.ladder || undefined, color: o.color, sticky: o.sticky || undefined })); break;
      case 'wind': L.winds.push(clean({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, vx: o.vx, vy: o.vy, period: o.period, phase: o.phase })); break;
      case 'search': L.searches.push({ x: o.x, y: o.y, arc: o.arc, period: o.period, phase: o.phase }); break;
      case 'zip': L.zips.push({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 }); name(s, { ...L.zips[L.zips.length - 1], i: L.zips.length - 1 }); break;
      case 'clock': L.clocks.push({ x: o.x, y: o.y, length: o.length, period: o.period, phase: o.phase }); name(s, { ...L.clocks[L.clocks.length - 1], i: L.clocks.length - 1 }); break;
      case 'hook': L.hooks.push({ x: o.x, y: o.y }); break;
      case 'lift': L.lifts.push({ bar: o.bar, drop: o.drop, weight: o.weight, side: o.side >= 0 ? 1 : -1 }); break;
      case 'mover': L.movers.push({ bar: o.bar, dx: o.dx, dy: o.dy, period: o.period, phase: o.phase }); break;
      case 'hazard': L.hazards.push({ kind: o.kind, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 }); break;
      case 'button': L.buttons.push([o.x, o.y]); break;
      case 'tip': if (p.tip && c.first(p.name)) L.tips.push({ x: o.x, y: o.y, r: o.r, text: p.tip, gate: o.gate ? L.gates.length : undefined }); break;
      case 'decoy': if (c.rnd() < c.twist.chrome && Math.abs(o.x) > 0.3) pushBar(c, clampX(-o.x * 0.8), o.y + 0.12, 'chrome', 0.018); break;
      case 'zigzag': {
        if (!given.from || !given.to) throw new LayoutError(p.name, path, 'les barres en zigzag vont de from à to : seulement dans une montée');
        const bars = zigzag(c, given.from, given.to);
        bars.forEach((b, i) => { name(s, { ...L.bars[b], i: b }); scope.i = i; run(s.do, `${path}.do`); });
        break;
      }
      case 'repeat':
        for (let i = 0; i < o.count; i++) { scope[s.as ?? 'i'] = i; run(s.do, `${path}.do`); }
        break;
      case 'if': run(o.test ? s.then : s.else, `${path}.${o.test ? 'then' : 'else'}`); break;
      case 'slot': {
        if (!given.st || given.k === undefined) throw new LayoutError(p.name, path, 'une fente est au-dessus de la station : seulement dans un obstacle');
        const sl = slot(c, given.k, given.st);
        out.exit = sl.exit;
        name(s, { x: sl.gx, w: sl.w, F: sl.F });
        break;
      }
      case 'trapdoor': {
        if (!given.st || given.k === undefined) throw new LayoutError(p.name, path, 'une trappe est au-dessus de la station : seulement dans un obstacle');
        let opens: Partial<Gate> = {};
        if (o.key) {
          if (!given.layKey) throw new LayoutError(p.name, path, 'une trappe ouverte par la clé : l\'obstacle doit être « fermé »');
          opens = given.layKey(o.F);
        }
        if (o.period !== undefined) opens = { ...opens, period: o.period };
        out.exit = trapdoor(c, given.k, o.F, opens, o.beyond);
        break;
      }
      case 'exit': out.exit = { x: o.x, y: o.y }; break;
      case 'opens': out.opens = clean({ rings: o.rings, pulls: o.pulls, post: o.post, held: o.held || undefined }); break;
    }
  };

  run(p.steps, '');
  return out;
}

/** an object without its fields left undefined */
function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

/**
 * Bars zigzagging up from one hold to the other, as many as the way is long
 * (none if the two are within reach), a button half way: their indices
 */
function zigzag(c: Ctx, from: Hold, to: Hold): number[] {
  const n = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 0.42)), out: number[] = [];
  let px = from.x;
  for (let i = 1; i < n; i++) {
    const t = i / n, y = lerp(from.y, to.y, t);
    const x = Math.max(px - 0.55, Math.min(px + 0.55, clampX(lerp(from.x, to.x, t) + (i % 2 ? -0.35 : 0.35) * side(from.x))));
    out.push(pushBar(c, x, y));
    px = x;
  }
  c.L.buttons.push([lerp(from.x, to.x, 0.5) * 0.5, lerp(from.y, to.y, 0.5)]);
  return out;
}

/** a floor across the room at F with a trapdoor in its middle that `opens` says how, and a bar beyond it (`beyond` above, 0.3 if not said): that bar */
function trapdoor(c: Ctx, k: number, F: number, opens: Partial<Gate>, beyond?: number): Hold {
  floor(c, F, 0, 0.3);
  c.L.gates.push({ x0: -0.15, x1: 0.15, y0: F - 0.03, y1: F, ...opens });
  const up = beyond ?? 0.3, x = up < 0.3 ? 0 : k * (0.2 + 0.2 * c.rnd());
  pushBar(c, x, F + up);
  return { x, y: F + up };
}

/** a floor across the room above the station, a slot a few centimetres wide in it (the end must find it), a bar beyond */
function slot(c: Ctx, k: number, st: Hold): { exit: Hold; gx: number; w: number; F: number } {
  const gx = clampX(-0.1 * k + (c.rnd() - 0.5) * 0.4), w = 0.06 + 0.05 * c.rnd(), F = st.y + 0.5;
  floor(c, F, gx, w, c.rnd() < c.twist.chrome ? 'chrome' : 'wood');
  c.L.buttons.push([gx, F + 0.12]);
  const x = clampX(gx - 0.25 * k);
  pushBar(c, x, F + 0.32);
  return { exit: { x, y: F + 0.32 }, gx, w, F };
}
