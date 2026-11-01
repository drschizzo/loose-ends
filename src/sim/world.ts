// The physical world of a level: the solver with the level's static shapes
// and cords in it, and the lace. Built in one go from a level; the course
// builds a new one each time its window moves (or the lace breaks),
// with the lace where it was and the cords it had already settled where they
// lay. In between, it moves what moves: bars that slide, the lace drying.

import { CableSim } from '@drschizzo/avbd-cables';
import { placeKey, type Level } from '../level/level';
import { HANDLE, handleAt, handTip, spoolAt, surfaces, type Surface } from '../level/surfaces';
import { Lace } from '../play/lace';
import { LACE, LIFT, PARAMS, PLAY, VINE, ZIP } from '../tuning';
import { cordsOf, type Cord } from './cords';

export class World {
  readonly sim = new CableSim(PARAMS);
  readonly lace: Lace;
  readonly surfaces: Surface[];
  readonly cords: Cord[];
  /** the nodes of the cords the lace may grab (not those pinned, nor those next to a pin) */
  readonly cordNodes: number[] = [];
  /** the top node of each pull, and what the pull weighs alone (N): what more it holds hangs on it */
  readonly pullTops: number[] = [];
  readonly pullRest: number[] = [];
  /** how wet the lace is, 1 soaked to 0 dry */
  wet = 0;
  /** the cable of each fragile thread (by its hang) */
  readonly threadCable = new Map<number, number>();
  /** each lift: how far its handle has risen (m), how fast, whether the catch holds the weight, how long since anything gripped the handle (s) */
  readonly lifts: { d: number; v: number; caught: boolean; idle: number }[];
  private handleShape: number[] = [];
  /** the nodes of the cobwebs: the lace sticks to them */
  readonly webNodes: number[] = [];
  /** each zip line's spool: how far down the wire it has run (m), how fast, how long since anything gripped it (s) */
  readonly spools: { d: number; v: number; idle: number }[];
  /** the static shapes each spool, each clock hand is made of */
  private spoolShape: number[] = [];
  private handShapes: number[][] = [];
  /** the angle of each clock's hand (rad, from straight up, clockwise) */
  readonly hands: number[];
  /** how hard each wind blows now, 0 to 1 */
  readonly gusts: number[];
  /** the static shape of each bar, by its index among the bars */
  private barShape = new Map<number, number>();
  /** the lace dry: the length at rest of its segments, the mass of its nodes */
  private dryRest: Float64Array;
  private dryMass: Float64Array;

  /**
   * `lace`: where its nodes are (lying on the level's start if null).
   * `previous`: a world of an overlapping level, whose cords that are in
   * this one too (same key, same length) keep where they lay.
   */
  constructor(readonly level: Level, lace: ArrayLike<number> | null, seed: number, previous?: World, wear?: ArrayLike<number>) {
    const set = cordsOf(level, lace, seed);
    if (previous) {
      const was = new Map(previous.cords.map((c, k) => [c.key, k]));
      set.cords.forEach((c, k) => {
        const p = was.get(c.key), cb = p === undefined ? null : previous.sim.cables[p];
        // (a thread that snapped mends, a lift goes back up: built anew)
        if (k === 0 || !cb || cb.count !== set.defs[k].points.length / 3 || c.fragile !== undefined) return;
        set.defs[k].points = Array.from(previous.sim.x.subarray(3 * cb.start, 3 * (cb.start + cb.count)));
      });
    }
    this.cords = set.cords;
    this.surfaces = surfaces(level);
    const sim = this.sim, starts = sim.build(set.defs);
    sim.setStatics(this.surfaces.map((s) => s.shape));
    this.cords.forEach((c, k) => {
      if (k === 0) return;
      const { start, count } = sim.cables[k], last = start + count - 1;
      const pin = (i: number) => sim.pin(i, sim.x[3 * i], sim.x[3 * i + 1], sim.x[3 * i + 2]);
      if (c.pinFirst) pin(start);
      if (c.pinLast) pin(last);
      if (c.pull !== undefined) {
        this.pullTops[c.pull] = start;
        sim.setTarget(start, sim.x[3 * start], sim.x[3 * start + 1], 0, PLAY.gripK, 0.25);
        let w = 0;
        for (let i = start; i <= last; i++) w += sim.mass[i] * 9.81;
        this.pullRest[c.pull] = w;
      }
      for (let i = start + (c.pinFirst || c.pull !== undefined ? 2 : 0); i <= last - (c.pinLast ? 2 : 0); i++) this.cordNodes.push(i);
      if (c.fragile !== undefined) this.threadCable.set(c.fragile, k);
      if (c.sticky) for (let i = start; i <= last; i++) this.webNodes.push(i);
    });
    for (const [a, i, b, j] of set.knots) sim.addBundle([starts[a] + i, starts[b] + j], VINE.radius + 0.001);
    this.lace = new Lace(sim, starts[0], sim.cables[0].count, this.surfaces, this.cordNodes, wear);
    this.surfaces.forEach((s, k) => {
      if (s.bar >= 0) this.barShape.set(s.bar, k);
      if (s.moves?.kind === 'spool') this.spoolShape[s.moves.k] = k;
      if (s.moves?.kind === 'hand') (this.handShapes[s.moves.k] ??= []).push(k);
      if (s.moves?.kind === 'handle') this.handleShape[s.moves.k] = k;
    });
    this.spools = level.zips.map(() => ({ d: 0, v: 0, idle: 0 }));
    this.hands = level.clocks.map((c) => c.phase);
    this.gusts = level.winds.map(() => 0);
    this.lifts = level.lifts.map(() => ({ d: 0, v: 0, caught: true, idle: 0 }));
    const { start, count } = this.lace;
    this.dryRest = sim.rest.slice(start, start + count);
    this.dryMass = sim.mass.slice(start, start + count);
  }

  /** where bar k is at time t (s): where it was built, or moved along its back and forth */
  barAt(k: number, t: number): { x: number; y: number } {
    const b = this.level.bars[k], m = this.level.movers.find((q) => q.bar === k);
    if (!m) return b;
    const a = Math.sin((2 * Math.PI * t) / m.period + m.phase);
    return { x: b.x + m.dx * a, y: b.y + m.dy * a };
  }

  /** before a step at time t: the bars that move are where they are now (a grip on one goes with it); the lace dries */
  update(t: number, dt: number): void {
    for (const m of this.level.movers) {
      const id = this.barShape.get(m.bar)!, s = this.surfaces[id].shape;
      if (s.kind !== 'capsule') continue;
      const p = this.barAt(m.bar, t), dx = p.x - s.ax, dy = p.y - s.ay;
      const moved = { ...s, ax: p.x, bx: p.x, ay: p.y, by: p.y };
      this.surfaces[id].shape = moved;
      this.sim.updateStatic(id, moved);
      this.lace.shiftGrips(id, dx, dy);
    }
    this.level.clocks.forEach((c, k) => this.turnHand(k, c.phase + (2 * Math.PI * t) / c.period));
    this.level.zips.forEach((z, k) => this.runSpool(k, dt));
    this.level.lifts.forEach((l, k) => this.hoist(k, dt));
    this.blow(t, dt);
    if (this.wet > 0) this.dry(Math.max(0, this.wet - dt / PLAY.dryTime));
  }

  /** the hand of clock k at angle a: its rods moved, a grip on it carried round */
  private turnHand(k: number, a: number): void {
    const c = this.level.clocks[k], da = a - this.hands[k], [tx, ty] = handTip(c, a);
    this.hands[k] = a;
    for (const id of this.handShapes[k] ?? []) {
      const sh = this.surfaces[id].shape;
      if (sh.kind !== 'capsule') continue;
      const moved = { ...sh, bx: tx, by: ty };
      this.surfaces[id].shape = moved;
      this.sim.updateStatic(id, moved);
      this.lace.turnGrips(id, c.x, c.y, da);
    }
  }

  /**
   * The spool of zip line k runs down the wire while something grips it,
   * pulled by the slope (less what the wire's friction takes), and stops
   * hard at the bottom. Let go of a while, a string pulls it back up.
   */
  private runSpool(k: number, dt: number): void {
    const z = this.level.zips[k], sp = this.spools[k], id = this.spoolShape[k];
    const len = Math.hypot(z.x1 - z.x0, z.y1 - z.y0), slope = (z.y0 - z.y1) / len;
    const held = this.lace.ends.some((e) => e.grip?.kind === 'surface' && e.grip.surface === id);
    sp.idle = held ? 0 : sp.idle + dt;
    if (held) sp.v = Math.min(ZIP.top, sp.v + (9.81 * slope - ZIP.drag * sp.v) * dt);
    else sp.v = sp.idle > ZIP.wait && sp.d > 0 ? -ZIP.back : 0;
    const was = spoolAt(z, sp.d / len);
    sp.d = Math.max(0, Math.min(len, sp.d + sp.v * dt));
    if (sp.d >= len) sp.v = 0;
    const p = spoolAt(z, sp.d / len), sh = this.surfaces[id].shape;
    if (sh.kind !== 'capsule' || (p.x === was.x && p.y === was.y)) return;
    const moved = { ...sh, ax: p.x, bx: p.x, ay: p.y, by: p.y };
    this.surfaces[id].shape = moved;
    this.sim.updateStatic(id, moved);
    this.lace.shiftGrips(id, p.x - was.x, p.y - was.y);
  }

  /**
   * The air on the move: the lace's nodes in a wind are dragged towards its
   * speed (a light end more than it seems: the whole lace is light), as
   * hard as it blows now
   */
  private blow(t: number, dt: number): void {
    const { sim, lace } = this, x = sim.x, v = sim.v;
    this.level.winds.forEach((w, k) => {
      const g = w.period ? Math.max(0, Math.min(1, 0.5 + 1.5 * Math.sin((2 * Math.PI * t) / w.period + (w.phase ?? 0)))) : 1;
      this.gusts[k] = g;
      if (g <= 0) return;
      const pull = Math.min(1, PLAY.windDrag * g * dt);
      let any = false;
      for (let i = lace.start; i < lace.start + lace.count; i++) {
        if (x[3 * i] < w.x0 || x[3 * i] > w.x1 || x[3 * i + 1] < w.y0 || x[3 * i + 1] > w.y1) continue;
        v[3 * i] += (w.vx - v[3 * i]) * pull;
        v[3 * i + 1] += (w.vy - v[3 * i + 1]) * pull;
        any = true;
      }
      if (any) sim.wakeCable(0);
    });
  }

  /**
   * Lift k: gripping its handle lets the catch go, and the weight falls,
   * hoisting the handle and the lace that grips it: the heavier the weight
   * against the lace (and the friction of the pulley), the faster, until the
   * handle knocks against the pulley. Let go a while, the weight is wound
   * back up, the handle down, and the catch holds it again.
   */
  private hoist(k: number, dt: number): void {
    const l = this.level.lifts[k], s = this.lifts[k], id = this.handleShape[k];
    const held = this.lace.ends.some((e) => e.grip?.kind === 'surface' && e.grip.surface === id);
    s.idle = held ? 0 : s.idle + dt;
    if (held) s.caught = false;
    const top = l.drop - HANDLE.top;
    if (!s.caught && held) s.v = Math.min(LIFT.top, s.v + (9.81 * (l.weight - LIFT.friction)) / (l.weight + 1) * dt);
    else if (!s.caught && s.idle > LIFT.wait) s.v = -LIFT.back;
    else s.v = 0;
    const was = handleAt(this.level, l, s.d);
    s.d = Math.max(0, Math.min(top, s.d + s.v * dt));
    if (s.d >= top) s.v = 0;
    if (s.d <= 0 && s.v < 0) { s.v = 0; s.caught = true; }
    const p = handleAt(this.level, l, s.d), sh = this.surfaces[id].shape;
    if (sh.kind !== 'capsule' || p.y === was.y) return;
    const moved = { ...sh, ay: p.y, by: p.y };
    this.surfaces[id].shape = moved;
    this.sim.updateStatic(id, moved);
    this.lace.shiftGrips(id, 0, p.y - was.y);
  }

  /** fragile thread k snaps: its top lets go */
  snapThread(k: number): void {
    const ci = this.threadCable.get(k);
    if (ci === undefined) return;
    const { start, count } = this.sim.cables[ci];
    this.sim.unpin(start);
    // fallen, it is nothing to hold on to (the lace shares this list)
    const kept = this.cordNodes.filter((i) => i < start || i >= start + count);
    this.cordNodes.length = 0;
    this.cordNodes.push(...kept);
  }

  /** the lace in water: soaked through */
  soak(): void {
    this.dry(1);
  }

  /** the lace this wet: shorter by `shrink`, heavier by `soak`, in proportion */
  private dry(wet: number): void {
    const sim = this.sim, { start, count } = this.lace;
    this.wet = wet;
    for (let k = 0; k < count; k++) {
      sim.mass[start + k] = this.dryMass[k] * (1 + PLAY.soak * wet);
      if (k < count - 1) sim.rest[start + k] = this.dryRest[k] * (1 - PLAY.shrink * wet);
    }
    sim.wakeCable(0);
  }

  /**
   * The lace broken at node `at`: the nodes of the piece kept (the one an end
   * still grips, the longer if both or neither do) and how worn they are, or
   * null if that piece is too short to climb with.
   */
  broken(at: number): { pos: number[]; wear: number[] } | null {
    const { start, count, ends } = this.lace, k = at - start;
    const head = { from: 0, to: k }, tail = { from: k + 1, to: count };
    const grips = [!!ends[0].grip, !!ends[1].grip];
    const keep = grips[0] !== grips[1] ? (grips[0] ? head : tail) : head.to - head.from >= tail.to - tail.from ? head : tail;
    if ((keep.to - keep.from) * LACE.segment < PLAY.shortest) return null;
    return {
      pos: Array.from(this.sim.x.subarray(3 * (start + keep.from), 3 * (start + keep.to))),
      wear: Array.from(this.lace.damage.subarray(keep.from, keep.to)),
    };
  }

  /** opens gate k (its box goes away) or shuts it again */
  setGate(k: number, open: boolean): void {
    const g = this.level.gates[k], id = this.surfaces.findIndex((q) => q.gate === k), s = this.surfaces[id].shape;
    if (s.kind !== 'box') return;
    const moved = { ...s, min: [s.min[0], open ? -60 : g.y0, s.min[2]] as [number, number, number], max: [s.max[0], open ? -59.9 : g.y1, s.max[2]] as [number, number, number] };
    this.surfaces[id].shape = moved;
    this.sim.updateStatic(id, moved);
  }

  /** the gate's key (see `placeKey`) */
  gateKey(k: number): string {
    const g = this.level.gates[k];
    return placeKey(g.x0, g.y0);
  }
}
