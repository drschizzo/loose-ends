// What a level does with the lace: buttons to take, eyelets to thread, gates
// that open (rings threaded, pulls weighed on, a post saved on, or by
// themselves now and then), posts that save the lace balanced on them, and
// what harms it: blades, flames, water.
//
// What lasts (buttons taken, gates opened, the post saved on) is kept by
// where it is in the level (`placeKey`), so that it holds when the endless
// course builds its world again; the rest starts over with each world.

import { placeKey } from '../level/level';
import { ringFrame, type Surface } from '../level/surfaces';
import type { World } from '../sim/world';
import { LACE, PLAY } from '../tuning';

/** the beam of a searching lamp: how far it reaches (m), half its width (rad) */
export const BEAM = { reach: 2.6, half: 0.2 };

/** whether surface s (a bar, a shelf: what casts a shadow) stands between a lamp at (lx, ly) and (px, py) */
function shades(s: Surface, lx: number, ly: number, px: number, py: number): boolean {
  const sh = s.shape;
  if (s.mat === 'wall' || s.mat === 'floor' || s.mat === 'eyelet') return false;
  const dx = px - lx, dy = py - ly, l2 = dx * dx + dy * dy;
  if (sh.kind === 'capsule') {
    // a bar across the room: a disc in the plane of the lace
    if (sh.ax !== sh.bx || sh.ay !== sh.by) return false;
    const t = Math.max(0, Math.min(1, ((sh.ax - lx) * dx + (sh.ay - ly) * dy) / l2));
    if (t <= 0.02 || t >= 0.98) return false;
    return (lx + dx * t - sh.ax) ** 2 + (ly + dy * t - sh.ay) ** 2 < (sh.r + 0.004) ** 2;
  }
  // a box (a shelf, a gate): the segment crosses it
  let t0 = 0.02, t1 = 0.98;
  for (const [o, d, lo, hi] of [[lx, dx, sh.min[0], sh.max[0]], [ly, dy, sh.min[1], sh.max[1]]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

export type RuleEvent =
  | { what: 'button' }
  | { what: 'threaded' }
  | { what: 'opened' | 'shut'; gate: number }
  /** the lace lies on post `bar` by itself: will it hold? */
  | { what: 'holding'; bar: number }
  | { what: 'saved'; bar: number }
  /** a blade cut into the lace, a flame began to burn it (both wear it: see `Lace.damage`), water soaked it */
  | { what: 'cut' | 'burnt' }
  | { what: 'soaked' }
  /** a thread gave way under the lace */
  | { what: 'snapped' }
  /** the lace stuck to a cobweb, tore free of it, was bitten by its spider */
  | { what: 'stuck' | 'torn free' | 'bitten' }
  /** the lace came into the beam of a searching lamp */
  | { what: 'seen' }
  /** a lift's catch let its weight go */
  | { what: 'lift' };

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
  /** per world: how long each fragile thread has borne the lace (s), those that snapped */
  borne = new Map<number, number>();
  private snapped = new Set<number>();
  /** the lace's nodes stuck to a web: which, to which node, by which strap; when each lace node may stick again; how long it has been stuck */
  stuck: { lace: number; web: number; bundle: number }[] = [];
  private unstuck = new Map<number, number>();
  stuckTime = 0;
  private tearing = 0;
  /** how much the lace is in a lamp's beam now, 0 to 1 (its grips tire faster), and where each beam points (rad from straight down) */
  dazzle = 0;
  beams: number[] = [];
  /** per world: each lift's catch held its weight, last step */
  private caught: boolean[] = [];
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
    this.borne.clear();
    this.snapped.clear();
    this.stuck = [];
    this.unstuck.clear();
    this.stuckTime = 0;
    this.dazzle = 0;
    this.beams = L.searches.map((q) => q.arc * Math.sin(q.phase));
    this.caught = L.lifts.map(() => true);
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
    this.threads(dt, out);
    this.webs(dt, out);
    this.lamps(dt, t, out);
    this.lifts(out);
    return out;
  }

  /** a fragile thread bears the lace only so long: what it has borne adds up, and past its limit it snaps */
  private threads(dt: number, out: RuleEvent[]): void {
    const { level: L, lace, sim } = this.world;
    for (const [k, ci] of this.world.threadCable) {
      if (this.snapped.has(k)) continue;
      const cb = sim.cables[ci];
      if (!lace.ends.some((e) => e.grip?.kind === 'cord' && e.grip.node >= cb.start && e.grip.node < cb.start + cb.count)) continue;
      const t = (this.borne.get(k) ?? 0) + dt;
      this.borne.set(k, t);
      if (t < (L.hangs[k].fragile ?? PLAY.thread)) continue;
      // the end holding it holds nothing now
      for (const e of lace.ends) if (e.grip?.kind === 'cord' && e.grip.node >= cb.start && e.grip.node < cb.start + cb.count) lace.release(e);
      this.world.snapThread(k);
      this.snapped.add(k);
      out.push({ what: 'snapped' });
    }
  }

  /** how far thread k has worn, 0 to 1 (1: snapped) */
  threadWear(k: number): number {
    return this.snapped.has(k) ? 1 : Math.min(1, (this.borne.get(k) ?? 0) / (this.world.level.hangs[k].fragile ?? PLAY.thread));
  }

  /**
   * A cobweb is sticky: a node of the lace that touches it sticks there
   * (a strap), and holds the lace up as well as a grip would. The aglet
   * slipping through the cords does not stick. Pulled away hard (the free
   * end tugging), the lace tears free, a node at a time, from the end
   * that pulls; stuck too long, the spider comes down and bites.
   */
  private webs(dt: number, out: RuleEvent[]): void {
    const { lace, sim, webNodes } = this.world;
    if (!webNodes.length) return;
    const x = sim.x, near = (LACE.radius + 0.0035 + 0.002) ** 2, now = this.t;
    if (this.stuck.length < 6) {
      for (let i = lace.start; i < lace.start + lace.count; i += 2) {
        if (sim.ghost[i] !== 0 || sim.bundleOf[i] >= 0 || (this.unstuck.get(i) ?? 0) > now) continue;
        for (const w of webNodes) {
          if (sim.bundleOf[w] >= 0) continue;
          const dx = x[3 * i] - x[3 * w], dy = x[3 * i + 1] - x[3 * w + 1], dz = x[3 * i + 2] - x[3 * w + 2];
          if (dx * dx + dy * dy + dz * dz > near) continue;
          if (!this.stuck.length) out.push({ what: 'stuck' });
          this.stuck.push({ lace: i, web: w, bundle: sim.addBundle([i, w], 0.5 * (LACE.radius + 0.0035) + 0.0008) });
          break;
        }
        if (this.stuck.length >= 6) break;
      }
    }
    lace.held = this.stuck.length > 0;
    if (!this.stuck.length) { this.stuckTime = 0; return; }
    this.stuckTime += dt;
    // a tug of the free end tears the lace free, from that end inward
    const a = lace.leader();
    this.tearing = a && lace.reach > PLAY.webPull ? this.tearing + dt : 0;
    const free = (k: number) => {
      const q = this.stuck[k];
      sim.removeBundle(q.bundle);
      this.unstuck.set(q.lace, now + 0.8);
      this.stuck.splice(k, 1);
      if (!this.stuck.length) out.push({ what: 'torn free' });
    };
    if (a && this.tearing > 0.12) {
      this.tearing = 0;
      let k = 0;
      this.stuck.forEach((q, j) => { if (Math.abs(q.lace - a.node) < Math.abs(this.stuck[k].lace - a.node)) k = j; });
      lace.harm(this.stuck[k].lace, 0.04, 1);
      free(k);
    }
    for (let k = this.stuck.length - 1; k >= 0; k--) {
      const q = this.stuck[k], dx = x[3 * q.lace] - x[3 * q.web], dy = x[3 * q.lace + 1] - x[3 * q.web + 1], dz = x[3 * q.lace + 2] - x[3 * q.web + 2];
      if (Math.hypot(dx, dy, dz) > LACE.radius + 0.0035 + PLAY.webStretch) free(k);
    }
    if (this.stuckTime > PLAY.spiderAfter && this.stuck.length) {
      this.stuckTime = 0;
      lace.harm(this.stuck[0].lace, PLAY.spiderBite, 2);
      out.push({ what: 'bitten' });
    }
  }

  /**
   * A searching lamp sweeps the room. The lace in its beam, unless a bar
   * or a shelf stands between them (in their shadow), heats: its grips tire
   * faster (`dazzle`), and it scorches a little.
   */
  private lamps(dt: number, t: number, out: RuleEvent[]): void {
    const { level: L, lace, sim, surfaces } = this.world, x = sim.x;
    let lit = 0;
    L.searches.forEach((q, k) => {
      const beam = q.arc * Math.sin((2 * Math.PI * t) / q.period + q.phase);
      this.beams[k] = beam;
      const bx = Math.sin(beam), by = -Math.cos(beam);
      for (let i = lace.start; i < lace.start + lace.count; i += 3) {
        const dx = x[3 * i] - q.x, dy = x[3 * i + 1] - q.y, d = Math.hypot(dx, dy);
        if (d > BEAM.reach || (dx * bx + dy * by) / d < Math.cos(BEAM.half)) continue;
        if (surfaces.some((s) => shades(s, q.x, q.y, x[3 * i], x[3 * i + 1]))) continue;
        lit++;
        lace.harm(i, PLAY.beamWear * dt * 3, 1);
      }
    });
    const was = this.dazzle;
    const want = Math.min(1, lit / 4);
    this.dazzle += (want - this.dazzle) * Math.min(1, dt / 0.25);
    if (was < 0.3 && this.dazzle >= 0.3) out.push({ what: 'seen' });
  }

  /** a lift's catch lets its weight go (see `World.hoist`) */
  private lifts(out: RuleEvent[]): void {
    this.world.lifts.forEach((l, k) => {
      if (this.caught[k] && !l.caught) out.push({ what: 'lift' });
      this.caught[k] = l.caught;
    });
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
    L.hazards.forEach((kind, k) => {
      const h = { kind: kind.kind, ...this.world.hazardAt(k, this.t) }, at: number[] = [];
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
