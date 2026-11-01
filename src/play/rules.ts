// What a level does with the lace: buttons to take, eyelets to thread, gates
// that open (rings threaded, pulls weighed on, a post saved on, or by
// themselves now and then), posts that save the lace balanced on them, and
// what harms it: blades, flames, water.
//
// What lasts (buttons taken, gates opened, the post saved on) is kept by
// where it is in the level (`placeKey`), so that it holds when the endless
// course builds its world again; the rest starts over with each world.

import { placeKey } from '../level/level';
import { ringFrame } from '../level/surfaces';
import type { World } from '../sim/world';
import { LACE, PLAY } from '../tuning';

export type RuleEvent =
  | { what: 'button' }
  | { what: 'threaded' }
  | { what: 'opened' | 'shut'; gate: number }
  /** the lace lies on post `bar` by itself: will it hold? */
  | { what: 'holding'; bar: number }
  | { what: 'saved'; bar: number }
  /** a blade cut into the lace, a flame began to burn it (both wear it: see `Lace.damage`), water soaked it */
  | { what: 'cut' | 'burnt' }
  | { what: 'soaked' };

/** where the lace was saved: on which post (its place), where its nodes were */
export interface Save { post: string; pos: Float64Array }

export class Rules {
  readonly taken = new Set<string>();
  readonly opened = new Set<string>();
  save: Save | null = null;

  private world!: World;
  /** per world: rings the lace goes through, how long each pull has been weighed on, each post held on */
  threaded: boolean[] = [];
  pulled: number[] = [];
  private holding = new Map<number, number>();
  /** per world: how long each hazard has touched the lace; the blades rest a moment after a cut */
  private touching: number[] = [];
  /** per world: the gates that open by themselves, open now */
  private timed: boolean[] = [];
  private bladesRest = 0;
  /** the time of the last step (s) */
  private t = 0;

  /** the world the rules now apply to: the gates opened before are opened in it */
  attach(world: World): void {
    this.world = world;
    const L = world.level;
    this.threaded = L.rings.map(() => false);
    this.pulled = L.pulls.map(() => 0);
    this.holding.clear();
    this.touching = L.hazards.map(() => 0);
    this.timed = L.gates.map(() => false);
    L.gates.forEach((g, k) => { if (!g.held && this.opened.has(world.gateKey(k))) world.setGate(k, true); });
  }

  isTaken(k: number): boolean {
    const [x, y] = this.world.level.buttons[k];
    return this.taken.has(placeKey(x, y));
  }

  isOpen(k: number): boolean {
    return this.world.level.gates[k].period ? !!this.timed[k] : this.opened.has(this.world.gateKey(k));
  }

  /** how near gate k is to opening, 0 to 1 */
  progress(k: number): number {
    const g = this.world.level.gates[k];
    if (g.rings) return g.rings.filter((r) => this.threaded[r]).length / g.rings.length;
    if (g.pulls) return Math.min(...g.pulls.map((p) => Math.min(1, this.pulled[p] / PLAY.pullTime)));
    // its post: how long the lace has balanced on it, of the time it takes to save
    if (g.post !== undefined) return Math.min(1, (this.holding.get(g.post) ?? 0) / PLAY.saveTime);
    // one that opens by itself: it brightens as it is about to
    if (g.period) return 0.5 + 0.5 * Math.sin((2 * Math.PI * this.t) / g.period);
    return 0;
  }

  /** the post the lace is saved on is bar k */
  isSaved(k: number): boolean {
    const b = this.world.level.bars[k];
    return this.save?.post === placeKey(b.x, b.y);
  }

  /** after a step of dt, at time t (s): what happened */
  step(dt: number, t: number): RuleEvent[] {
    this.t = t;
    const out: RuleEvent[] = [], { level: L, lace, sim } = this.world, x = sim.x;
    L.buttons.forEach(([bx, by], k) => {
      if (this.isTaken(k)) return;
      for (let i = lace.start; i < lace.start + lace.count; i++) {
        if ((x[3 * i] - bx) ** 2 + (x[3 * i + 1] - by) ** 2 < 0.038 ** 2) { this.taken.add(placeKey(bx, by)); out.push({ what: 'button' }); break; }
      }
    });
    L.rings.forEach((_, k) => {
      const t = this.through(k);
      if (t && !this.threaded[k]) out.push({ what: 'threaded' });
      this.threaded[k] = t;
    });
    // a pull is weighed on: it holds more than itself, for a moment (a bouncing lace lets go of it
    // now and then: the count goes down then, not back to nothing)
    this.world.pullTops.forEach((i, k) => {
      const on = sim.targetPull(i) - this.world.pullRest[k] > PLAY.pullLoad * lace.weight;
      this.pulled[k] = on ? this.pulled[k] + dt : Math.max(0, this.pulled[k] - dt);
    });
    L.gates.forEach((g, k) => {
      const key = this.world.gateKey(k), open = this.isOpen(k);
      const pulls = !!g.pulls && g.pulls.every((p) => this.pulled[p] >= PLAY.pullTime);
      const want = g.period ? Math.sin((2 * Math.PI * t) / g.period) > 0
        : g.held ? pulls
        : open || pulls || (!!g.rings && g.rings.every((r) => this.threaded[r])) || (g.post !== undefined && this.isSaved(g.post));
      if (want === open) return;
      if (want && !g.period) this.opened.add(key); else this.opened.delete(key);
      if (g.period) this.timed[k] = want;
      this.world.setGate(k, want);
      out.push({ what: want ? 'opened' : 'shut', gate: k });
    });
    this.posts(dt, out);
    this.hazards(dt, out);
    return out;
  }

  /**
   * A post saves the lace lying on it by itself: nothing gripped, at least
   * half a turn touching it, nothing sliding on it for a second (only what
   * lies on it counts: the ends may swing).
   */
  private posts(dt: number, out: RuleEvent[]): void {
    const { lace } = this.world, free = !lace.ends[0].grip && !lace.ends[1].grip;
    for (const s of this.world.surfaces) {
      const sh = s.shape;
      if (s.mat !== 'gold' || sh.kind !== 'capsule' || this.isSaved(s.bar)) continue;
      const near = sh.r + LACE.radius + 0.006;
      if (!free || lace.turns(sh.ax, sh.ay, near) < PLAY.saveTurns || lace.speed(sh.ax, sh.ay, near) >= PLAY.saveSpeed) { this.holding.delete(s.bar); continue; }
      const t = (this.holding.get(s.bar) ?? 0) + dt;
      if (t === dt) out.push({ what: 'holding', bar: s.bar });
      this.holding.set(s.bar, t);
      if (t >= PLAY.saveTime) {
        const b = this.world.level.bars[s.bar];
        this.save = { post: placeKey(b.x, b.y), pos: lace.save() };
        out.push({ what: 'saved', bar: s.bar });
      }
    }
  }

  /** what harms the lace where it touches it: a blade cuts into it, a flame burns it as long as it stays, water soaks it */
  private hazards(dt: number, out: RuleEvent[]): void {
    const { level: L, lace, sim } = this.world, x = sim.x, r = LACE.radius;
    this.bladesRest = Math.max(0, this.bladesRest - dt);
    L.hazards.forEach((h, k) => {
      const at: number[] = [];
      for (let i = lace.start; i < lace.start + lace.count; i++) {
        if (x[3 * i] > h.x0 - r && x[3 * i] < h.x1 + r && x[3 * i + 1] > h.y0 - r && x[3 * i + 1] < h.y1 + r) at.push(i);
      }
      const was = this.touching[k];
      this.touching[k] = at.length ? was + dt : 0;
      if (!at.length) return;
      if (h.kind === 'blade' && this.bladesRest === 0) {
        this.bladesRest = 0.6;
        lace.harm(at[at.length >> 1], PLAY.bladeWear);
        out.push({ what: 'cut' });
      } else if (h.kind === 'flame') {
        for (const i of at) lace.harm(i, PLAY.flameWear * dt, 1);
        if (was === 0) out.push({ what: 'burnt' });
      } else if (h.kind === 'water' && was === 0) out.push({ what: 'soaked' });
    });
  }

  /** whether the lace goes through ring k: one of its segments crosses the disc of the ring */
  private through(k: number): boolean {
    const { level, lace, sim } = this.world, g = level.rings[k], { n } = ringFrame(g), x = sim.x, rr = g.r - 0.004;
    for (let i = lace.start; i < lace.start + lace.count - 1; i++) {
      const dp = (x[3 * i] - g.x) * n.x + (x[3 * i + 1] - g.y) * n.y + x[3 * i + 2] * n.z;
      const dq = (x[3 * i + 3] - g.x) * n.x + (x[3 * i + 4] - g.y) * n.y + x[3 * i + 5] * n.z;
      if (dp * dq > 0 || dp === dq) continue;
      const t = dp / (dp - dq);
      const px = x[3 * i] + (x[3 * i + 3] - x[3 * i]) * t - g.x, py = x[3 * i + 1] + (x[3 * i + 4] - x[3 * i + 1]) * t - g.y, pz = x[3 * i + 2] + (x[3 * i + 5] - x[3 * i + 2]) * t;
      if (px * px + py * py + pz * pz < rr * rr) return true;
    }
    return false;
  }
}
