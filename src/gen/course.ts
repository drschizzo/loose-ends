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
//     slacker lines, no rest, wider rises).
//
// Only a window of the course is built at a time: from the section below the
// post the lace last saved on, to the next post, whose trapdoor stays shut
// until the lace saves there. Everything between the last post and the lace
// is there: a fall is a real fall, down to where the lace catches itself, or
// below the post, and back to it.

import { emptyLevel, merge, type Level } from '../level/level';
import { ASCENTS, KEYS, OBSTACLES, pushBar, start, TWISTS, type Ascent, type Ctx, type Hold, type Key, type Obstacle, type Twist } from './parts';

export interface Section {
  index: number;
  /** what it is made of, in words */
  name: string;
  /** it ends on a post */
  post: boolean;
  level: Level;
  /** the hold at its top, where the next one starts */
  exit: Hold;
  twist: Twist;
  ascent?: Ascent;
  obstacle?: Obstacle;
  key?: Key;
}

interface Combo { ascent: Ascent; obstacle: Obstacle; key?: Key; effort: number; weight: number }

const POST = KEYS.find((k) => k.name === 'poteau')!;
const TRAPDOOR = OBSTACLES.find((o) => o.locked)!;

export class Course {
  private sections: Section[] = [];
  private seen = new Set<string>();
  private rnd: () => number;
  /** the stretch being laid out: its twist, the sections left before its post */
  private twist = TWISTS[0];
  private left = 0;

  constructor(readonly seed: number) {
    let s = (seed * 7919 + 104729) % 2147483647 || 1;
    this.rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  /** section k, laid out (with all those below it) the first time it is asked for */
  section(k: number): Section {
    while (this.sections.length <= k) this.next();
    return this.sections[k];
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

  /** the section that ends at or above height y */
  at(y: number): number {
    for (let i = 0; ; i++) if (this.section(i).exit.y >= y) return i;
  }

  private next(): void {
    const index = this.sections.length, prev = this.sections[index - 1];
    const L = emptyLevel(prev ? prev.exit.y : 0, 0);
    const c: Ctx = { L, twist: this.twist, rnd: this.rnd, first: (name) => !this.seen.has(name) };
    if (!prev) {
      const exit = start(c);
      L.top = exit.y;
      this.sections.push({ index, name: 'départ', post: true, level: L, exit, twist: this.twist });
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
    ascent.lay(c, prev.exit, st);
    pushBar(c, st.x, st.y);
    const exit = obstacle.lay(c, k, st, key);
    for (const p of [ascent, obstacle, key]) if (p) this.seen.add(p.name);
    L.top = exit.y;
    const name = [ascent.name, obstacle.locked ? key!.name : obstacle.name].filter((n) => n !== 'rien').join(', ');
    this.sections.push({ index, name, post, level: L, exit, twist: this.twist, ascent, obstacle, key });
    if (post) this.newStretch(index); else this.left--;
  }

  /** a stretch begins: how many sections before its post (more as the course goes up), its twist (none at first) */
  private newStretch(index: number): void {
    this.left = 2 + Math.min(3, Math.floor(index / 20)) + (this.rnd() < 0.3 ? 1 : 0);
    this.twist = index < 12 ? TWISTS[0] : TWISTS[Math.floor(this.rnd() * TWISTS.length)];
  }

  /** the parts of section `index`, as the rules allow (see the top of this file) */
  private choose(index: number, prev: Section, post: boolean): Combo {
    const open = <T extends { from: number; name: string }>(a: T[]) => a.filter((p) => p.from <= index);
    const heavy = (a?: Ascent) => (a?.nodes ?? 0) > 100;
    const cap = 3 + Math.min(3, Math.floor(index / 15));
    const prevEffort = (prev.ascent?.effort ?? 0) + (prev.obstacle?.effort ?? 0) + (prev.key?.effort ?? 0);
    const combos: Combo[] = [];
    for (const ascent of open(ASCENTS)) {
      const obstacles = post ? [TRAPDOOR] : open(OBSTACLES);
      for (const obstacle of obstacles) {
        const keys = obstacle.locked ? (post ? [POST] : open(KEYS).filter((q) => q !== POST)) : [undefined];
        for (const key of keys) {
          const effort = ascent.effort + obstacle.effort + (key?.effort ?? 0);
          combos.push({ ascent, obstacle, key, effort, weight: ascent.weight * (post ? 1 : obstacle.weight) * (key && !post ? key.weight : 1) });
        }
      }
    }
    const parts = (q: Combo) => [q.ascent, q.obstacle, q.key].filter((p) => p !== undefined);
    const novel = (q: Combo) => parts(q).filter((p) => !this.seen.has(p.name)).length;
    const most = Math.min(1, Math.max(...combos.map(novel)));
    // the rules, the most important first: the last ones give way first when nothing fits them all
    const rules: ((q: Combo) => boolean)[] = [
      (q) => !(heavy(q.ascent) && heavy(prev.ascent)),
      (q) => q.ascent !== prev.ascent && (q.obstacle !== prev.obstacle || q.obstacle.name === 'rien') && (!q.key || q.key !== prev.key || post),
      (q) => q.effort <= cap,
      (q) => prevEffort < cap - 1 || q.effort <= 2,
      // something new as soon as it comes in, one thing at a time, with easy parts around it
      (q) => post || novel(q) === most,
      (q) => !novel(q) || parts(q).filter((p) => this.seen.has(p.name)).reduce((e, p) => e + p.effort, 0) <= 1,
    ];
    for (let n = rules.length; n >= 0; n--) {
      const fit = combos.filter((q) => rules.slice(0, n).every((r) => r(q)));
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
