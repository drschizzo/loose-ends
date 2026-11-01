// The parts the endless course is assembled from. A section of course is
// three of them, chosen apart from one another:
//
//   an ascent    takes the lace from the hold it is on up to a station (a
//                bar): bars, cords to swing across, a rope, lines, a net...
//   an obstacle  stands above the station, from which the lace gets past it
//                to the hold the next section starts from: nothing, a floor
//                with a slot, an overhang, chicanes, a ceiling to traverse
//                under, or a trapdoor;
//   a key        opens the trapdoor: eyelets, pulls, a post.
//
// Each part only knows the holds it starts from and ends on: any ascent
// leads to any obstacle, any key opens any trapdoor, and a new part of any
// kind makes new sections with all the others. The layouts come from the
// hand-made levels, where they were played: between two holds, the lace never
// climbs more than about half a metre, nor crosses more than 60 cm.
//
// `k` is the side the station is on (1 right, −1 left): a part is laid out
// from it, mirrored. The twist of a stretch of course (between two posts)
// turns the same parts harder or softer.

import { bar, type Gate, type Level, type Mat } from '../level/level';

/** where the lace holds on: the bar a part starts from or ends on */
export interface Hold { x: number; y: number }

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

export const TWISTS: Twist[] = [
  { name: '', gap: 1, chrome: 0.15, slack: 0, rubber: 0.18 },
  { name: 'glissant', gap: 1, chrome: 0.6, slack: 0, rubber: 0.1 },
  { name: 'lâche', gap: 1, chrome: 0.15, slack: 0.12, rubber: 0.18 },
  { name: 'sans repos', gap: 1, chrome: 0.2, slack: 0, rubber: 0 },
  { name: 'espacé', gap: 1.12, chrome: 0.15, slack: 0.04, rubber: 0.25 },
];

/** what a part is laid out with */
export interface Ctx {
  /** the section the part goes into */
  L: Level;
  twist: Twist;
  rnd: () => number;
  /** the course has not had this part yet: it says what to do (see `tip`) */
  first: (name: string) => boolean;
}

/** what every part has: when it comes in, how often, what it says the first time */
interface Part {
  name: string;
  /** the section from which it may come */
  from: number;
  /** how often it comes, against the others of its family */
  weight: number;
  /** how hard it is, 0 to 3: a section's effort is its parts' together */
  effort: number;
  tip?: string;
}

export interface Ascent extends Part {
  /** how high it climbs (m), at least and at most */
  rise: [number, number];
  /** where the station is, from the hold it starts from: on the other side, the same side, either */
  side: 'cross' | 'same' | 'any';
  /** the cords it adds, roughly (nodes of the solver): never two ascents full of cords in a row */
  nodes: number;
  lay(c: Ctx, from: Hold, to: Hold): void;
}

export interface Obstacle extends Part {
  /** how far from the middle its station is, on side k (negative: on the other side) */
  x: number;
  /** a trapdoor: a key opens it */
  locked?: boolean;
  /** lays it out above the station (and the key, if locked); returns the hold at its top */
  lay(c: Ctx, k: number, st: Hold, key?: Key): Hold;
}

export interface Key extends Part {
  /** how far from the middle its station is, on side k */
  x: number;
  /** how high above its station the trapdoor's floor is */
  floor: number;
  /** how high above the floor the hold beyond it is */
  beyond?: number;
  /** lays out what is under the floor at F; returns what opens the trapdoor */
  lay(c: Ctx, k: number, st: Hold, F: number): Pick<Gate, 'rings' | 'pulls' | 'post' | 'held'>;
}

const COLORS = ['#d9534f', '#5b8def', '#9b6bd1', '#3fae74', '#e0a03a'];
const pick = <T>(c: Ctx, a: T[]): T => a[Math.floor(c.rnd() * a.length)];
/** ± a, at random */
const jitter = (c: Ctx, a: number) => (c.rnd() - 0.5) * 2 * a;
const clampX = (x: number) => Math.max(-0.7, Math.min(0.7, x));
const side = (x: number) => (x >= 0 ? 1 : -1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** a bar; where a grip may rest, wood or sometimes rubber */
export function pushBar(c: Ctx, x: number, y: number, mat?: Mat, r?: number): number {
  c.L.bars.push(bar(x, y, mat ?? (c.rnd() < c.twist.rubber ? 'rubber' : 'wood'), r));
  return c.L.bars.length - 1;
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

/** a chrome bar beside the way, now and then (the twist says how often) */
function decoy(c: Ctx, x: number, y: number): void {
  if (c.rnd() < c.twist.chrome && Math.abs(x) > 0.3) pushBar(c, clampX(-x * 0.8), y + 0.12, 'chrome', 0.018);
}

function tip(c: Ctx, part: Part, x: number, y: number, r: number, gate?: number): void {
  if (part.tip && c.first(part.name)) c.L.tips.push({ x, y, r, text: part.tip, gate });
}

/** a cord hanging at x, unless it would hang through one of the bars at `clear` (the station, the bar to get on from) */
function hang(c: Ctx, clear: number[], x: number, top: number, length: number): void {
  if (clear.some((b) => Math.abs(b - x) < 0.1)) return;
  c.L.hangs.push({ x, top, length: Math.max(0.3, length) });
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
  const gx = clampX(-0.1 * k + jitter(c, 0.2)), w = 0.06 + 0.05 * c.rnd(), F = st.y + 0.5;
  floor(c, F, gx, w, c.rnd() < c.twist.chrome ? 'chrome' : 'wood');
  c.L.buttons.push([gx, F + 0.12]);
  const x = clampX(gx - 0.25 * k);
  pushBar(c, x, F + 0.32);
  return { exit: { x, y: F + 0.32 }, gx, w, F };
}

/** a floor across the room, with a gap `w` wide centred on x (two shelves) */
function floor(c: Ctx, y: number, x: number, w: number, mat: Mat = 'wood'): void {
  if (x - w / 2 > -0.84) c.L.shelves.push({ x0: -0.85, x1: x - w / 2, y, mat });
  if (x + w / 2 < 0.84) c.L.shelves.push({ x0: x + w / 2, x1: 0.85, y, mat });
}

// ------------------------------------------------------------- ascents

export const ASCENTS: Ascent[] = [
  {
    name: 'barres', effort: 1, from: 0, weight: 3, rise: [0.45, 1.4], side: 'any', nodes: 0,
    lay(c, from, to) {
      for (const b of zigzag(c, from, to)) decoy(c, c.L.bars[b].x, c.L.bars[b].y);
    },
  },
  {
    name: 'barres mobiles', effort: 2, from: 8, weight: 1.5, rise: [0.9, 1.4], side: 'any', nodes: 0,
    tip: 'Barres mobiles : elles glissent d\'un côté à l\'autre. Accroche-toi quand elle passe à ta portée, elle t\'emmène.',
    lay(c, from, to) {
      // the bars between the two holds slide back and forth, sideways or up and down, each its own pace
      for (const b of zigzag(c, from, to)) {
        const bar = c.L.bars[b], up = c.rnd() < 0.35, room = 0.72 - Math.abs(bar.x);
        c.L.movers.push({ bar: b, dx: up ? 0 : Math.min(0.25, room), dy: up ? 0.15 : 0, period: 2.5 + 2 * c.rnd(), phase: c.rnd() * 6.28 });
      }
      tip(c, this, 0, lerp(from.y, to.y, 0.5), 0.6);
    },
  },
  {
    name: 'bougies', effort: 2, from: 11, weight: 1.2, rise: [0.9, 1.4], side: 'any', nodes: 0,
    tip: 'Bougies : leur flamme brûle le lacet qui s\'y attarde, et il raccourcit. Passe vite, ou passe à côté.',
    lay(c, from, to) {
      // a candle under each bar between the holds: what hangs from a bar hangs in its flame
      for (const b of zigzag(c, from, to)) {
        const bar = c.L.bars[b];
        c.L.hazards.push({ kind: 'flame', x0: bar.x - 0.03, y0: bar.y - 0.45, x1: bar.x + 0.03, y1: bar.y - 0.33 });
      }
      tip(c, this, 0, lerp(from.y, to.y, 0.5), 0.6);
    },
  },
  {
    name: 'cascade', effort: 2, from: 13, weight: 1.2, rise: [0.9, 1.4], side: 'cross', nodes: 0,
    tip: 'Cascade : l\'eau trempe le lacet, il rétrécit et s\'alourdit le temps de sécher. Traverse-la d\'un coup, ou attends d\'être sec pour forcer.',
    lay(c, from, to) {
      // water falling down the middle, across the way from one side to the other
      zigzag(c, from, to);
      const x = jitter(c, 0.1);
      c.L.hazards.push({ kind: 'water', x0: x - 0.1, y0: from.y, x1: x + 0.1, y1: to.y + 0.6 });
      tip(c, this, 0, lerp(from.y, to.y, 0.5), 0.6);
    },
  },
  {
    name: 'ciseaux', effort: 3, from: 17, weight: 1, rise: [0.9, 1.4], side: 'any', nodes: 0,
    tip: 'Ciseaux : ils coupent le lacet qui les touche, et il lâche tout. Garde-le loin des lames : un poteau le rend entier.',
    lay(c, from, to) {
      // a pair of scissors under every other bar between the holds, where the lace would hang
      zigzag(c, from, to).forEach((b, i) => {
        if (i % 2) return;
        const bar = c.L.bars[b], x = bar.x + jitter(c, 0.08);
        c.L.hazards.push({ kind: 'blade', x0: x - 0.06, y0: bar.y - 0.5, x1: x + 0.06, y1: bar.y - 0.4 });
      });
      tip(c, this, 0, lerp(from.y, to.y, 0.5), 0.6);
    },
  },
  {
    name: 'rideau de cordes', effort: 2, from: 1, weight: 2, rise: [1.0, 1.3], side: 'cross', nodes: 130,
    tip: 'Cordes : approche un bout et maintiens son clic, tu t\'y suspends et tu te balances jusqu\'à la suivante.',
    lay(c, from, to) {
      // no bar for a metre: cords hanging from above to swing across
      const s = side(from.x), n = 4 + Math.floor(c.rnd() * 2), top = to.y + 0.05;
      pushBar(c, s * 0.55, from.y + 0.35);
      for (let i = 0; i < n; i++) hang(c, [s * 0.55, to.x], s * (0.45 - (0.95 * i) / (n - 1)), top, top - from.y - 0.5 - 0.12 * c.rnd());
      tip(c, this, 0, from.y + 0.8, 0.6);
      c.L.buttons.push([0, from.y + 0.55]);
    },
  },
  {
    name: 'fils posés', effort: 2, from: 2, weight: 2, rise: [1.2, 1.35], side: 'cross', nodes: 60,
    tip: 'Fil posé sur du chrome : il glisse sous ton poids. Sur du caoutchouc, le frottement le retient.',
    lay(c, from) {
      // a cord over chrome (it slides away under the lace), one over rubber (it holds), a wood bar beside
      const s = side(from.x), y = from.y;
      c.L.drapes.push({ bar: pushBar(c, s * 0.35 + jitter(c, 0.08), y + 0.45, 'chrome', 0.018), length: 0.6, left: 0.5, color: pick(c, COLORS) });
      c.L.drapes.push({ bar: pushBar(c, -s * 0.4 + jitter(c, 0.08), y + 0.9, 'rubber'), length: 0.6, left: 0.5, color: pick(c, COLORS) });
      pushBar(c, -s * 0.62, y + 0.55, 'wood');
      tip(c, this, 0, y + 0.6, 0.5);
      c.L.buttons.push([s * 0.6, y + 0.9]);
    },
  },
  {
    name: 'fils à linge', effort: 2, from: 3, weight: 2, rise: [1.25, 1.4], side: 'same', nodes: 150,
    tip: 'Fil à linge : accroche-toi n\'importe où. Il plie sous ton poids, d\'autant plus qu\'il est lâche.',
    lay(c, from, to) {
      // a clothesline across, then one from the far wall to the middle
      const s = side(from.x), y = from.y;
      c.L.lines.push({ x0: -0.83, y0: y + 0.62, x1: 0.83, y1: y + 0.62, slack: 0.05 + c.twist.slack + 0.08 * c.rnd() });
      c.L.lines.push({ x0: -s * 0.83, y0: to.y - 0.1, x1: s * 0.15, y1: to.y - 0.25, slack: 0.03 + c.twist.slack + 0.06 * c.rnd(), color: '#9fc7e8' });
      tip(c, this, 0, y + 0.5, 0.5);
      c.L.buttons.push([-s * 0.5, y + 0.95]);
    },
  },
  {
    name: 'écheveau', effort: 2, from: 6, weight: 1.5, rise: [1.1, 1.35], side: 'cross', nodes: 220,
    tip: 'Écheveau : agrippe les brins de laine. Ensemble, emmêlés, ils te portent.',
    lay(c, from, to) {
      const s = side(from.x);
      pushBar(c, s * 0.6, from.y + 0.4);
      c.L.skeins.push({ x: s * 0.05 + jitter(c, 0.1), top: to.y - 0.1, length: 0.55, count: 4, color: pick(c, COLORS) });
      tip(c, this, 0, from.y + 0.8, 0.5);
      c.L.buttons.push([-s * 0.35, from.y + 0.8]);
    },
  },
  {
    name: 'corde lisse', effort: 3, from: 9, weight: 1.2, rise: [1.2, 1.7], side: 'any', nodes: 80,
    tip: 'Corde lisse : rien pour se reposer, monte une main après l\'autre, vite.',
    lay(c, from, to) {
      // one long rope and nothing else: hand over hand, against the clock of the grips
      // beside the station, not under it, nor through the bar to get on from
      const s = side(from.x), top = to.y + 0.15;
      let x = clampX(to.x + (to.x >= from.x ? -0.3 : 0.3));
      if (Math.abs(x - s * 0.5) < 0.12) x = clampX(to.x - (x - to.x));
      pushBar(c, s * 0.5, from.y + 0.3);
      c.L.hangs.push({ x, top, length: top - from.y - 0.3 });
      tip(c, this, x, from.y + 0.9, 0.6);
      c.L.buttons.push([x + 0.2, lerp(from.y, to.y, 0.6)]);
    },
  },
  {
    name: 'pendule', effort: 3, from: 10, weight: 1.2, rise: [0.7, 1.0], side: 'cross', nodes: 50,
    tip: 'Pendule : une seule corde au-dessus du vide. Accroche son bout, balance-toi, lance l\'autre bout de l\'autre côté.',
    lay(c, from, to) {
      // a long cord across a gap with no bar: swing from one side to the other
      // its top no higher than what stands over the station
      const s = side(from.x), top = to.y + 0.3;
      pushBar(c, s * 0.62, from.y + 0.3);
      hang(c, [s * 0.62, to.x], -s * 0.05, top, top - from.y - 0.4);
      tip(c, this, 0, from.y + 0.7, 0.6);
      c.L.buttons.push([-s * 0.05, from.y + 0.25]);
    },
  },
  {
    name: 'échelle de corde', effort: 2, from: 12, weight: 1.2, rise: [1.5, 1.85], side: 'cross', nodes: 220,
    tip: 'Échelle de corde : elle tourne quand tu tires de côté. Grimpe droit, un barreau après l\'autre.',
    lay(c, from, to) {
      const s = side(from.x), lx = s * 0.05 - 0.11;
      pushBar(c, s * 0.5, from.y + 0.3);
      c.L.nets.push({ x0: lx, x1: lx + 0.22, top: to.y - 0.15, bottom: from.y + 0.35, cols: 2, rows: Math.round((to.y - from.y) / 0.3), ladder: true, color: '#b08a58' });
      tip(c, this, lx + 0.11, from.y + 1.0, 0.55);
      c.L.buttons.push([-s * 0.45, lerp(from.y, to.y, 0.6)]);
    },
  },
  {
    name: 'forêt de lianes', effort: 2, from: 16, weight: 1, rise: [0.6, 0.9], side: 'cross', nodes: 280,
    tip: 'Forêt de lianes : elles s\'emmêlent avec toi. Maintiens Espace pour faufiler l\'aiguillette devant ou derrière.',
    lay(c, from, to) {
      // cords close together across the way: the lace goes through them, and gets tangled
      const s = side(from.x), n = 7, top = to.y + 0.3;
      pushBar(c, s * 0.62, from.y + 0.4);
      for (let i = 0; i < n; i++) hang(c, [s * 0.62, to.x], s * (0.42 - (0.84 * i) / (n - 1)), top, top - from.y - 0.45 - 0.2 * c.rnd());
      tip(c, this, 0, from.y + 0.8, 0.6);
      c.L.buttons.push([0, from.y + 0.75]);
    },
  },
  {
    name: 'filet', effort: 1, from: 18, weight: 1, rise: [1.5, 1.8], side: 'same', nodes: 400,
    tip: 'Filet : accroche ses cordes ou ses nœuds. Il cède sous toi, mais tout le filet te porte.',
    lay(c, from, to) {
      // a climbing net tied top and bottom over the other half of the room
      const s = side(from.x), [x0, x1] = s > 0 ? [-0.6, 0.15] : [-0.15, 0.6];
      pushBar(c, s * 0.62, from.y + 0.35);
      c.L.nets.push({ x0, x1, top: to.y - 0.2, bottom: from.y + 0.3, cols: 4, rows: 4, tied: true });
      tip(c, this, (x0 + x1) / 2, from.y + 0.9, 0.55);
      c.L.buttons.push([s * 0.55, lerp(from.y, to.y, 0.6)]);
    },
  },
  {
    name: 'escalier de chrome', effort: 3, from: 26, weight: 1, rise: [1.3, 1.7], side: 'any', nodes: 80,
    tip: 'Escalier de chrome : seuls les fils posés se prennent, et ils glissent. Ne t\'attarde pas.',
    lay(c, from, to) {
      // chrome bars only, a cord draped over each: they slide away under the lace
      const s = side(from.x);
      [0.25, 0.55, 0.85].forEach((t, i) => c.L.drapes.push({
        bar: pushBar(c, clampX(lerp(from.x, to.x, t) + (i % 2 ? 0.3 : -0.3) * s), lerp(from.y, to.y, t), 'chrome', 0.018),
        length: 0.5, left: 0.5, color: pick(c, COLORS),
      }));
      tip(c, this, 0, lerp(from.y, to.y, 0.5), 0.6);
      c.L.buttons.push([-s * 0.4, lerp(from.y, to.y, 0.7)]);
    },
  },
];

// ---------------------------------------------------------------- keys

export const KEYS: Key[] = [
  {
    name: 'poteau', effort: 1, from: 0, weight: 0, x: 0.4, floor: 0.8,
    tip: 'Poteau doré : pose le lacet dessus et lâche tout. S\'il tient en équilibre, c\'est sauvegardé, et la trappe au-dessus s\'ouvre.',
    lay(c, k, st, F) {
      const px = jitter(c, 0.08), post = pushBar(c, px, F - 0.35, 'gold', 0.022);
      tip(c, this, px, F - 0.35, 0.45);
      return { post };
    },
  },
  {
    name: 'œillets', effort: 2, from: 4, weight: 2, x: 0.62, floor: 0.8,
    tip: 'Œillets : le lacet passé dans tous à la fois ouvre la trappe. Accroche un bout d\'un côté, enfile l\'autre.',
    lay(c, k, st, F) {
      // the first gate of "Le laçage": three eyelets in a row beside the station
      pushBar(c, 0.4 * k, F - 0.3); pushBar(c, -0.4 * k, F - 0.3);
      const r0 = c.L.rings.length;
      for (const x of [-0.3, 0, 0.3]) c.L.rings.push({ x, y: F - 0.67, r: 0.075, turn: 0.9 });
      tip(c, this, 0, F - 0.67, 0.75, c.L.gates.length);
      c.L.buttons.push([-0.7 * k, F - 0.57]);
      return { rings: [r0, r0 + 1, r0 + 2] };
    },
  },
  {
    name: 'œillets croisés', effort: 2, from: 11, weight: 1.5, x: 0.62, floor: 0.8,
    tip: 'Œillets croisés : un de côté, un à plat. Le lacet dans les deux à la fois ouvre la trappe.',
    lay(c, k, st, F) {
      pushBar(c, 0.4 * k, F - 0.3); pushBar(c, -0.4 * k, F - 0.3);
      const r0 = c.L.rings.length;
      c.L.rings.push({ x: 0.3 * k, y: F - 0.72, r: 0.075, turn: 0.9 }, { x: -0.22 * k, y: F - 0.47, r: 0.075, up: true });
      tip(c, this, 0, F - 0.6, 0.7, c.L.gates.length);
      return { rings: [r0, r0 + 1] };
    },
  },
  {
    name: 'tirette', effort: 1, from: 5, weight: 1.5, x: 0.6, floor: 0.85, beyond: 0.35,
    tip: 'Tirette : accroche-toi et laisse ton poids tirer. La trappe s\'ouvre.',
    lay(c, k, st, F) {
      // the gate of "La mercerie": hang on the pull, the trapdoor above opens
      pushBar(c, -k * 0.6, F - 0.5); pushBar(c, 0, F - 0.42);
      c.L.pulls.push({ x: -k * 0.35, top: F - 0.05, length: 0.55 });
      tip(c, this, -k * 0.35, F - 0.4, 0.45, c.L.gates.length);
      c.L.buttons.push([k * 0.6, F - 0.4]);
      return { pulls: [c.L.pulls.length - 1] };
    },
  },
  {
    name: 'porte à ressort', effort: 3, from: 14, weight: 1.2, x: 0.6, floor: 0.75, beyond: 0.22,
    tip: 'Porte à ressort : elle ne s\'ouvre que tant que tu pèses sur la tirette. Pends un bout à la tirette, passe l\'autre par la trappe.',
    lay(c, k, st, F) {
      // a pull that holds the trapdoor open only while weighed on: one end on it, the other through
      pushBar(c, -k * 0.55, F - 0.45);
      c.L.pulls.push({ x: -k * 0.25, top: F - 0.05, length: 0.4 });
      tip(c, this, -k * 0.25, F - 0.35, 0.5, c.L.gates.length);
      c.L.buttons.push([k * 0.55, F - 0.35]);
      return { pulls: [c.L.pulls.length - 1], held: true };
    },
  },
  {
    name: 'colonne d\'œillets', effort: 3, from: 20, weight: 1, x: 0.5, floor: 0.9,
    tip: 'Colonne d\'œillets : enfile le lacet de bas en haut dans les trois à la fois.',
    lay(c, k, st, F) {
      // eyelets facing up one above the other: the lace threaded up through all of them
      pushBar(c, -k * 0.5, F - 0.55); pushBar(c, k * 0.5, F - 0.25);
      const r0 = c.L.rings.length;
      for (const dy of [0.85, 0.6, 0.35]) c.L.rings.push({ x: 0, y: F - dy, r: 0.075, up: true });
      tip(c, this, 0, F - 0.6, 0.6, c.L.gates.length);
      c.L.buttons.push([-k * 0.6, F - 0.2]);
      return { rings: [r0, r0 + 1, r0 + 2] };
    },
  },
  {
    name: 'deux tirettes', effort: 2, from: 22, weight: 1, x: 0.6, floor: 0.85, beyond: 0.35,
    tip: 'Deux tirettes : la trappe ne s\'ouvre que si tu pèses sur les deux à la fois, un bout à chacune.',
    lay(c, k, st, F) {
      pushBar(c, -k * 0.6, F - 0.85); pushBar(c, 0, F - 0.5);
      c.L.pulls.push({ x: -0.4, top: F - 0.05, length: 0.5 }, { x: 0.4, top: F - 0.05, length: 0.5 });
      const p = c.L.pulls.length;
      tip(c, this, 0, F - 0.4, 0.6, c.L.gates.length);
      c.L.buttons.push([0, F - 0.25]);
      return { pulls: [p - 2, p - 1] };
    },
  },
];

// ----------------------------------------------------------- obstacles

export const OBSTACLES: Obstacle[] = [
  {
    name: 'rien', effort: 0, from: 0, weight: 3, x: 0.5,
    lay: (c, k, st) => st,
  },
  {
    name: 'trappe', effort: 0, from: 4, weight: 2.5, x: 0, locked: true,
    lay(c, k, st, key) {
      // a floor whose middle is a trapdoor, the key under it
      const F = st.y + key!.floor;
      return trapdoor(c, k, F, key!.lay(c, k, st, F), key!.beyond);
    },
  },
  {
    name: 'trappe minutée', effort: 2, from: 10, weight: 1.2, x: 0.5,
    tip: 'Trappe minutée : elle s\'ouvre et se referme toute seule. Elle s\'éclaire avant de s\'ouvrir : sois prêt à passer.',
    lay(c, k, st) {
      // a trapdoor that opens and shuts by itself, a bar under it to wait on
      const F = st.y + 0.75;
      pushBar(c, 0, F - 0.4);
      tip(c, this, 0, F - 0.4, 0.6, c.L.gates.length);
      return trapdoor(c, k, F, { period: 3 + 2 * c.rnd() }, 0.25);
    },
  },
  {
    name: 'fente', effort: 2, from: 8, weight: 1.5, x: 0.45,
    tip: 'Fente : un plancher et une fente étroite. Glisse un bout dedans, accroche-le au-dessus.',
    lay(c, k, st) {
      tip(c, this, -0.1 * k, st.y + 0.5, 0.5);
      return slot(c, k, st).exit;
    },
  },
  {
    name: 'fente gardée', effort: 3, from: 19, weight: 1, x: 0.45,
    tip: 'Fente gardée : des ciseaux de part et d\'autre de la fente. Vise juste, ou le lacet y laisse un bout.',
    lay(c, k, st) {
      // the slot, scissors either side of it, just over the floor
      const { exit, gx, w, F } = slot(c, k, st);
      for (const s of [-1, 1]) c.L.hazards.push({ kind: 'blade', x0: gx + s * (w / 2 + 0.05) - 0.04, y0: F + 0.02, x1: gx + s * (w / 2 + 0.05) + 0.04, y1: F + 0.1 });
      tip(c, this, gx, F, 0.5);
      return exit;
    },
  },
  {
    name: 'surplomb', effort: 2, from: 13, weight: 1.2, x: -0.1,
    tip: 'Surplomb : le plancher te couvre. Contourne son bord, d\'un bout puis de l\'autre.',
    lay(c, k, st) {
      // a floor over the station, open on one side only: round its edge
      const F = st.y + 0.45;
      floor(c, F, 0.6 * k, 0.5, c.rnd() < c.twist.chrome ? 'chrome' : 'wood');
      tip(c, this, 0.3 * k, F, 0.5);
      c.L.buttons.push([0.6 * k, F - 0.1]);
      pushBar(c, 0.35 * k, F + 0.3);
      return { x: 0.35 * k, y: F + 0.3 };
    },
  },
  {
    name: 'chicanes', effort: 1, from: 7, weight: 1.5, x: 0.4,
    tip: 'Chicanes : chaque étagère ne laisse qu\'un passage, d\'un côté puis de l\'autre. Pose le lacet sur une étagère pour reprendre des forces.',
    lay(c, k, st) {
      // floors one above the other, each with its gap on the other side: the lace snakes up
      let gx = k * 0.35, y = st.y;
      for (let i = 0; i < 3; i++) {
        y += 0.45;
        floor(c, y, gx, 0.32);
        if (i < 2) gx = -gx * (0.75 + 0.3 * c.rnd());
      }
      tip(c, this, 0, st.y + 0.6, 0.6);
      c.L.buttons.push([-gx, y - 0.15]);
      const x = clampX(gx);
      pushBar(c, x, y + 0.35);
      return { x, y: y + 0.35 };
    },
  },
  {
    name: 'traversée', effort: 2, from: 24, weight: 1, x: 0.6,
    tip: 'Traversée : un plafond de chrome, un fil dessous. Suis le fil jusqu\'à l\'ouverture de l\'autre côté.',
    lay(c, k, st) {
      // a chrome ceiling over most of the room, a line under it: across to the opening on the far side
      const C = st.y + 0.9;
      c.L.shelves.push(k > 0 ? { x0: -0.4, x1: 0.85, y: C, mat: 'chrome' } : { x0: -0.85, x1: 0.4, y: C, mat: 'chrome' });
      c.L.lines.push({ x0: k * 0.83, y0: st.y + 0.6, x1: -k * 0.83, y1: st.y + 0.6, slack: 0.06 + c.twist.slack });
      tip(c, this, 0, st.y + 0.5, 0.6);
      c.L.buttons.push([0, st.y + 0.35]);
      pushBar(c, -k * 0.62, C + 0.25);
      return { x: -k * 0.62, y: C + 0.25 };
    },
  },
];

/** the floor the course starts from, and two low bars */
export function start(c: Ctx): Hold {
  const s = c.rnd() < 0.5 ? 1 : -1;
  pushBar(c, -0.35 * s, 0.33);
  pushBar(c, 0.38 * s, 0.58);
  return { x: 0.38 * s, y: 0.58 };
}
