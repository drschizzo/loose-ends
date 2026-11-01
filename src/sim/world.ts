// The physical world of a level: the solver with the level's static shapes
// and cords in it, and the lace. Built in one go from a level; the course
// builds a new one each time its window moves (or the lace breaks),
// with the lace where it was and the cords it had already settled where they
// lay. In between, it moves what moves: bars that slide, the lace drying.

import { CableSim } from '@drschizzo/avbd-cables';
import { placeKey, type Level } from '../level/level';
import { surfaces, type Surface } from '../level/surfaces';
import { Lace } from '../play/lace';
import { LACE, PARAMS, PLAY, VINE } from '../tuning';
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
        if (k === 0 || !cb || cb.count !== set.defs[k].points.length / 3) return;
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
    });
    for (const [a, i, b, j] of set.knots) sim.addBundle([starts[a] + i, starts[b] + j], VINE.radius + 0.001);
    this.lace = new Lace(sim, starts[0], sim.cables[0].count, this.surfaces, this.cordNodes, wear);
    this.surfaces.forEach((s, k) => { if (s.bar >= 0) this.barShape.set(s.bar, k); });
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
    if (this.wet > 0) this.dry(Math.max(0, this.wet - dt / PLAY.dryTime));
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
