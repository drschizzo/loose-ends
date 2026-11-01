// The endless course: sections one above the other, from a seed, for ever.
//
// A section is an ascent, an obstacle and, for a trapdoor, its key (see
// parts.ts). Which, is chosen as wave function collapse chooses tiles, in
// one dimension: among all the combinations of parts, those that fit the
// section below and the stretch they are in (the sockets and rules below),
// at random by weight. When none fits, the rules give way one after the
// other, the least important first.
//
//   - a part comes in at its section, and the first time with easy others
//     and its word of help;
//   - never two ascents full of cords in a row (the solver would lag), nor
//     the same part twice in a row;
//   - a section's effort stays under a cap that rises with the course, and
//     a hard one is followed by an easier one;
//   - a stretch ends on a post (a trapdoor whose key is a post), further
//     apart as the course goes up; each stretch has its twist (more chrome,
//     slacker lines, no rest, wider rises);
//   - each stretch is a floor of the house, or of the sky (floors.ts), and
//     teaches its own parts: they come in there, one at a time, then often
//     (a floor's parts are its `favours`); the stretch ends on its exam, the
//     floor's set piece (a part marked `bravura`) under its post;
//   - at each post the player may choose the stretch above: plain, or
//     twisted (more chrome, slacker lines...), which pays more (`choices`).
//
// Only a window of the course is built at a time: from the section below the
// post the lace last saved on, to the next post, whose trapdoor stays shut
// until the lace saves there. Everything between the last post and the lace
// is there: a fall is a real fall, down to where the lace catches itself, or
// below the post, and back to it.

import { emptyLevel, merge, type Level, type Shelf } from '../level/level';
import { STORY } from '../tuning';
import { FLOORS, nextFloor, ROUND } from './floors';

/** random numbers of their own, from a few words: what the course adds draws from them, so that its parts stay as they were */
function seeded(...a: (number | string)[]): () => number {
  let h = 2166136261;
  for (const ch of a.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = (h >>> 0) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** the floors where the lights go out now and then (the bedroom, the attic, the night, the stars) */
const DARK = new Set([6, 7, 9, 13]);
/** the floor where the other lace waits, on its post */
export const DAWN = 10;
import { made, type Catalog, type Origins } from './layout';
import { parts, pushBar, start, type Ascent, type Ctx, type Hold, type Key, type Obstacle, type Twist } from './parts';

export interface Section {
  index: number;
  /** its place in its stretch (0: the first above the post), and how many the stretch has */
  place: number;
  of: number;
  /** what it is made of, in words */
  name: string;
  /** it ends on a post */
  post: boolean;
  level: Level;
  /** the hold at its top, where the next one starts */
  exit: Hold;
  twist: Twist;
  /** the floor it is on (floors.ts) */
  floor: number;
  /** a post's: the height of the trapdoor's floor above it, where the floor above begins */
  ceiling?: number;
  /** the seconds a good player would have taken from the start to its top */
  pace: number;
  /** its parts' effort together */
  effort: number;
  ascent?: Ascent;
  obstacle?: Obstacle;
  key?: Key;
  /** (traced: see `Options`) what made each thing in it */
  origins?: Origins;
}

/** what the decor needs to know of a section */
export interface Storey {
  index: number;
  floor: number;
  /** the first of its floor */
  first: boolean;
  bottom: number;
  top: number;
  /** where the floor above begins (if it is another) */
  ceiling?: number;
  /** the floor of the section above */
  above: number;
  /** what can be stood on: its floors and shelves, and the floor it starts on */
  shelves: Shelf[];
}

interface Combo { ascent: Ascent; obstacle: Obstacle; key?: Key; effort: number; weight: number }

/** the parts a section is made of, by their names, if they fit it (to try a part out: the editor, `?at=` in the game) */
export interface Forced { ascent?: string; obstacle?: string; key?: string }

export interface Options {
  /** sections whose parts are chosen, not drawn */
  force?: Record<number, Forced>;
  /** keep what made each thing of each section (the editor shows it) */
  trace?: boolean;
  /** the stretch chosen above each post (by its section): 1 twisted, 0 (or not said) plain */
  choices?: Record<number, number>;
}

/** where the course was when a post was laid: what it needs to lay out the stretch above again, another way */
interface Snap { s: number; seen: string[]; floor: number }

export class Course {
  private sections: Section[] = [];
  private seen = new Set<string>();
  /** the state of the course's random numbers */
  private s: number;
  private rnd = () => (this.s = (this.s * 16807) % 2147483647) / 2147483647;
  /** the course as it was at each post */
  private snaps = new Map<number, Snap>();
  /** the floor each part is taught on: the first whose favours have it */
  private home = new Map<string, number>();
  /** the stretch being laid: where it began, how many sections it has */
  private stretchAt = 0;
  private stretchOf = 0;
  private ascents: Ascent[];
  private obstacles: Obstacle[];
  private keys: Key[];
  /** the key that ends a stretch, the trapdoor it opens */
  private post: Key;
  private trapdoor: Obstacle;
  private twists: Twist[];
  /** the stretch being laid out: its twist, the sections left before its post */
  private twist: Twist;
  private left = 0;
  private floor = 0;

  constructor(readonly seed: number, readonly catalog: Catalog, private options: Options = {}) {
    this.s = (seed * 7919 + 104729) % 2147483647 || 1;
    FLOORS.forEach((f, k) => { for (const name of Object.keys(catalog.favours[f.name] ?? {})) if (!this.home.has(name)) this.home.set(name, k); });
    ({ ascents: this.ascents, obstacles: this.obstacles, keys: this.keys } = parts(catalog));
    const post = this.keys.find((k) => k.name === 'poteau'), trapdoor = this.obstacles.find((o) => o.locked);
    if (!post) throw new Error('le catalogue n\'a pas de clé « poteau » : un tronçon finit sur un poteau');
    if (!trapdoor) throw new Error('le catalogue n\'a pas d\'obstacle fermé (une trappe) : un tronçon finit sur une trappe');
    if (!catalog.twists.length) throw new Error('le catalogue n\'a pas de variante de tronçon');
    this.post = post;
    this.trapdoor = trapdoor;
    this.twists = catalog.twists;
    this.twist = this.twists[0];
  }

  /** section k, laid out (with all those below it) the first time it is asked for */
  section(k: number): Section {
    while (this.sections.length <= k) this.next();
    return this.sections[k];
  }

  /** the twist the stretch above the post of section k has if chosen twisted (none before the twists come) */
  alternative(k: number): Twist | null {
    if (k < this.catalog.course.twistFrom) return null;
    const r = seeded('twist', this.seed, k);
    return this.twists[1 + Math.floor(r() * (this.twists.length - 1))];
  }

  /** the stretch above the post of section k chosen: 1 twisted, 0 plain; laid out again if it was otherwise */
  pick(k: number, c: number): void {
    const choices = (this.options.choices ??= {});
    if ((choices[k] ?? 0) === c) return;
    choices[k] = c;
    const snap = this.snaps.get(k);
    if (!snap || this.sections.length <= k + 1) return;
    this.sections.length = k + 1;
    for (const key of [...this.snaps.keys()]) if (key > k) this.snaps.delete(key);
    this.s = snap.s;
    this.seen = new Set(snap.seen);
    this.floor = snap.floor;
    this.newStretch(k);
  }

  /** whether the stretch above the post of section k is twisted */
  twisted(k: number): boolean {
    return (this.options.choices?.[k] ?? 0) === 1 && !!this.alternative(k);
  }

  /** the first section at or above k that ends on a post */
  nextPost(k: number): number {
    for (let i = k; ; i++) if (this.section(i).post) return i;
  }

  /** the window of the course for a lace saved at the end of section k (0: at the start): the section below, to the next post */
  window(k: number): Level {
    const to = this.nextPost(k + 1), parts: Level[] = [];
    for (let i = Math.max(0, k - 1); i <= to; i++) parts.push(this.section(i).level);
    const L = merge(parts);
    L.top += 1;
    return L;
  }

  /** the sections from height `bottom` to `top`, laid out if they are not yet */
  between(bottom: number, top: number): Section[] {
    const out: Section[] = [];
    for (let i = 0; ; i++) {
      const s = this.section(i);
      if (s.level.bottom >= top) return out;
      if (s.level.top > bottom) out.push(s);
    }
  }

  /** what the decor needs to know of the sections from `bottom` to `top` */
  storeys(bottom: number, top: number): Storey[] {
    return this.between(bottom, top).map((s) => {
      const prev = s.index > 0 ? this.section(s.index - 1) : null;
      const under = prev ? prev.level.shelves.filter((q) => q.y >= s.level.bottom - 0.4) : [{ x0: -0.85, x1: 0.85, y: 0 }];
      return {
        index: s.index, floor: s.floor, first: !prev || prev.floor !== s.floor, bottom: s.level.bottom, top: s.level.top,
        ceiling: s.ceiling, above: this.section(s.index + 1).floor, shelves: [...under, ...s.level.shelves],
      };
    });
  }

  /** the section that ends at or above height y */
  at(y: number): number {
    for (let i = 0; ; i++) if (this.section(i).exit.y >= y) return i;
  }

  private next(): void {
    const index = this.sections.length, prev = this.sections[index - 1];
    const L = emptyLevel(prev ? prev.exit.y : 0, 0);
    const origins: Origins | undefined = this.options.trace ? {} : undefined;
    const c: Ctx = { L, twist: this.twist, rnd: this.rnd, first: (name) => !this.seen.has(name), origins };
    if (!prev) {
      const exit = made(c, { part: 'départ', path: '' }, () => start(c));
      L.top = exit.y;
      this.sections.push({ index, place: 0, of: 1, name: 'départ', post: true, level: L, exit, twist: this.twist, floor: 0, pace: 0, effort: 0, origins });
      this.snaps.set(index, { s: this.s, seen: [...this.seen], floor: this.floor });
      this.newStretch(index);
      return;
    }
    const post = this.left === 0;
    const combo = this.choose(index, prev, post);
    const { ascent, obstacle, key } = combo;
    // the station: on the side the ascent ends on, as far from the middle as the obstacle (or its key) wants it
    const s = prev.exit.x >= 0 ? 1 : -1;
    const k = ascent.side === 'cross' ? -s : ascent.side === 'same' ? s : this.rnd() < 0.5 ? 1 : -1;
    const rise = (ascent.rise[0] + (ascent.rise[1] - ascent.rise[0]) * this.rnd()) * this.twist.gap;
    const st = { x: k * (key ? key.x : obstacle.x), y: prev.exit.y + rise };
    made(c, { part: ascent.name, path: '' }, () => ascent.lay(c, prev.exit, st));
    made(c, { part: 'station', path: '' }, () => pushBar(c, st.x, st.y));
    const exit = made(c, { part: obstacle.name, path: '' }, () => obstacle.lay(c, k, st, key));
    for (const p of [ascent, obstacle, key]) if (p) this.seen.add(p.name);
    this.extras(c, index, prev.exit, exit, post);
    L.top = exit.y;
    const name = [ascent.name, obstacle.locked ? key!.name : obstacle.name].filter((n) => n !== 'rien').join(', ');
    const ceiling = post ? L.gates.find((g) => g.post !== undefined)?.y1 : undefined;
    const pace = prev.pace + STORY.pace.base + STORY.pace.effort * combo.effort + STORY.pace.metre * (exit.y - prev.exit.y);
    this.sections.push({ index, place: index - this.stretchAt - 1, of: this.stretchOf, name, post, level: L, exit, twist: this.twist, floor: this.floor, ceiling, pace, effort: combo.effort, ascent, obstacle, key, origins });
    if (post) {
      this.snaps.set(index, { s: this.s, seen: [...this.seen], floor: this.floor });
      this.newStretch(index);
    } else this.left--;
  }

  /**
   * What the course adds to a section beyond its parts (drawn from numbers
   * of their own, so that the parts stay as they were): a button where it is
   * risky to go (by a hazard, out on the far side), the lights that go out
   * now and then on the darker floors, and at dawn, on its post, the other lace.
   */
  private extras(c: Ctx, index: number, from: { x: number; y: number }, exit: { x: number; y: number }, post: boolean): void {
    const L = c.L, r = seeded('extras', this.seed, index);
    const h = L.hazards[0];
    if (h) L.buttons.push([Math.max(-0.75, Math.min(0.75, (h.x0 + h.x1) / 2 + (r() - 0.5) * 0.1)), h.y1 + 0.07]);
    else if (r() < 0.45) {
      const side = from.x >= 0 ? -1 : 1;
      L.buttons.push([side * (0.66 + 0.08 * r()), from.y + (exit.y - from.y) * (0.35 + 0.3 * r())]);
    }
    if (DARK.has(this.floor) && !post && index - this.stretchAt > 1 && r() < 0.5) L.blackouts.push({ y0: from.y, y1: exit.y, period: 8 + 4 * r(), phase: 10 * r() });
    if (post && this.floor === DAWN) {
      const g = L.bars.find((b) => b.mat === 'gold');
      if (g) L.hangs.push({ x: g.x + g.r + 0.013, top: g.y + 0.004, length: 1.0, partner: true });
    }
  }

  /**
   * A stretch begins: how many sections before its post (more as the course
   * goes up), its twist (none at first), its floor: in the house, the one
   * the time played so far is at (never one skipped); the sky once the
   * house's time is up; up there, a new one each stretch.
   */
  private newStretch(index: number): void {
    const { stretch } = this.catalog.course;
    this.left = stretch.base + Math.min(stretch.most, Math.floor(index / stretch.every)) + (this.rnd() < stretch.longer ? 1 : 0);
    this.stretchAt = index;
    this.stretchOf = this.left + 1;
    // plain, unless the player chose it twisted at the post below
    this.twist = this.twisted(index) ? this.alternative(index)! : this.twists[0];
    // a floor a stretch: the house one after the other, then the sky
    if (index > 0) this.floor = nextFloor(this.floor);
  }

  /** the parts of section `index`, as the rules allow (see the top of this file) */
  private choose(index: number, prev: Section, post: boolean): Combo {
    // a part comes in on the floor that teaches it (or, if no floor does, at its section); a set piece, only as its floor's exam
    const taught = (p: { from: number; name: string }) => { const h = this.home.get(p.name); return h === undefined ? p.from <= index : h <= this.floor || index >= p.from + 60; };
    const open = <T extends { from: number; name: string; bravura?: string }>(a: T[]) => a.filter((p) => !p.bravura && taught(p));
    const exam = post ? this.ascents.filter((a) => a.bravura === FLOORS[this.floor].name || (a.bravura && this.floor >= ROUND && a.bravura !== FLOORS[DAWN].name && this.rnd() < 0.5)) : [];
    const rules = this.catalog.course, POST = this.post, TRAPDOOR = this.trapdoor;
    const heavy = (a?: Ascent) => (a?.nodes ?? 0) > rules.heavy;
    const cap = rules.cap.base + Math.min(rules.cap.most, Math.floor(index / rules.cap.every));
    const favours = this.catalog.favours[FLOORS[this.floor].name] ?? {}, favour = (name?: string) => (name && favours[name]) || 1;
    const prevEffort = (prev.ascent?.effort ?? 0) + (prev.obstacle?.effort ?? 0) + (prev.key?.effort ?? 0);
    const combos: Combo[] = [];
    for (const ascent of exam.length ? exam : open(this.ascents)) {
      const obstacles = post ? [TRAPDOOR] : open(this.obstacles);
      for (const obstacle of obstacles) {
        const keys = obstacle.locked ? (post ? [POST] : open(this.keys).filter((q) => q !== POST)) : [undefined];
        for (const key of keys) {
          const effort = ascent.effort + obstacle.effort + (key?.effort ?? 0);
          // (a set piece has no weight of its own: it never comes but as an exam, where all are alike)
          const weight = (ascent.bravura ? 1 : ascent.weight) * (post ? 1 : obstacle.weight) * (key && !post ? key.weight : 1);
          combos.push({ ascent, obstacle, key, effort, weight: weight * favour(ascent.name) * (post ? 1 : favour(obstacle.name) * favour(key?.name)) });
        }
      }
    }
    // a section chosen (the editor, trying a part out): those combinations that have its parts, whether or not they come yet
    const forced = this.options.force?.[index];
    if (forced) {
      const named = <T extends { name: string }>(a: T[], name?: string) => (name ? a.filter((p) => p.name === name) : a);
      const keys = (o: Obstacle) => (o.locked ? (post ? [POST] : named(this.keys.filter((q) => q !== POST), forced.key)) : [undefined]);
      const fit: Combo[] = [];
      for (const ascent of named(this.ascents, forced.ascent)) {
        for (const obstacle of post ? [TRAPDOOR] : named(this.obstacles, forced.obstacle ?? (forced.key ? TRAPDOOR.name : undefined))) {
          for (const key of keys(obstacle)) fit.push({ ascent, obstacle, key, effort: ascent.effort + obstacle.effort + (key?.effort ?? 0), weight: 1 });
        }
      }
      if (fit.length) return this.weighted(fit);
    }
    const parts = (q: Combo) => [q.ascent, q.obstacle, q.key].filter((p) => p !== undefined);
    const novel = (q: Combo) => parts(q).filter((p) => !this.seen.has(p.name)).length;
    const most = Math.min(1, Math.max(...combos.map(novel)));
    // the rules, the most important first: the last ones give way first when nothing fits them all
    const tests: ((q: Combo) => boolean)[] = [
      (q) => !(heavy(q.ascent) && heavy(prev.ascent)),
      (q) => q.ascent !== prev.ascent && (q.obstacle !== prev.obstacle || q.obstacle.name === 'rien') && (!q.key || q.key !== prev.key || post),
      (q) => q.effort <= cap,
      (q) => prevEffort < cap - 1 || q.effort <= 2,
      // something new as soon as it comes in, one thing at a time, with easy parts around it
      (q) => post || novel(q) === most,
      (q) => !novel(q) || parts(q).filter((p) => this.seen.has(p.name)).reduce((e, p) => e + p.effort, 0) <= 1,
    ];
    for (let n = tests.length; n >= 0; n--) {
      const fit = combos.filter((q) => tests.slice(0, n).every((r) => r(q)));
      if (fit.length) return this.weighted(fit);
    }
    return combos[0];
  }

  private weighted(a: Combo[]): Combo {
    let sum = 0;
    for (const q of a) sum += q.weight;
    let r = this.rnd() * sum;
    for (const q of a) if ((r -= q.weight) <= 0) return q;
    return a[a.length - 1];
  }
}
