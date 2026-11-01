// The lace the player is: a cord of the solver, its two ends led by the
// player like two hands. Holding a button (left: the head, right: the tail)
// makes that end grip whatever it touches, and keep gripping until the button
// is let go. The end that grips nothing follows the pointer, pulling no harder
// than a muscle can (a spring on a leash), and only hard when the other end
// holds on to something: a lace that holds on to nothing cannot lift itself.
//
// A grip tires as a climber's hand does: by what the lace does from it. Hanging
// below it, the lace rests it. Reaching up with the other end tires it, as
// hard as that end pulls (the solver says how hard: `targetPull` of its
// target): stretched far, a reach wears the grip out in seconds. A lace pulled
// harder than its own weight at the hand (stretched taut across, or caught
// as it fell) tires it too. Draped over a bar next to it, the lace takes
// that off it (the capstan).
//
// The lace wears, node by node: blades, flames, sliding over rough bars, the
// jolt of a catch. Worn through somewhere, it breaks there (see `broken`).

import { CableSim } from '@drschizzo/avbd-cables';
import { MATS } from '../level/level';
import { snap, type Surface } from '../level/surfaces';
import { LACE, PLAY, VINE } from '../tuning';

export type Grip =
  /** `carried`: how long more (s) the surface moves the grip along (a lift, a spool, a clock hand): the hand is carried, what it lags behind is not its effort */
  | { kind: 'surface'; x: number; y: number; z: number; drain: number; surface: number; carried?: number }
  | { kind: 'cord'; bundle: number; node: number };

export class End {
  grip: Grip | null = null;
  /** its button is held */
  held = false;
  stamina = 1;
  /** worn out: it does not grip again until its button is let go and pressed again */
  spent = false;
  /** time left before it may grip again, worn out (s) */
  cooldown = 0;
  /** how hard it works, × the weight of the lace, over the last fifth of a second: the other end reaching from it, and what pulls it harder than the lace weighs */
  load = 0;
  constructor(readonly node: number, readonly inward: number) {}
}

/** what an end could take hold of, and where it would hold */
export type Hold = { kind: 'surface'; surface: number; x: number; y: number; z: number } | { kind: 'cord'; node: number; x: number; y: number; z: number };

/** what happened to an end during a step */
export type Event =
  /** `perfect`: taken at the top of a swing, the lace hardly moving after it moved fast: it costs nothing, and gives back */
  | { end: End; what: 'took'; perfect: boolean }
  | { end: End; what: 'let go' | 'worn out' }
  /** an end about to let go, worn out, got its strength back (a second wind) */
  | { end: End; what: 'rescued' }
  /** the end took hold of something with the lace moving fast: the jolt cost it stamina, or tore it off (`torn`) */
  | { end: End; what: 'jolt'; cost: number; torn: boolean }
  /** the free end was thrown, flicked up from a lace lying with nothing holding it */
  | { end: End; what: 'thrown' };

const pullOut = { x: 0, y: 0, z: 0 };

export class Lace {
  readonly ends: [End, End];
  readonly weight: number;
  readonly length: number;
  /** where the pointer leads the free end, brought within reach of the other's grip */
  readonly aim = { x: 0, y: 0, z: 0 };
  /** how worn each node of the lace is, 0 new to 1 torn through */
  readonly damage: Float32Array;
  /** the end that follows the pointer when neither grips: the one nearest the pointer */
  private loose = 0;
  /** how hard the end the pointer leads pulls, × the weight of the lace, over the last fifth of a second */
  reach = 0;
  /** whether the lace rests on something (a bar, a shelf: not the floor) away from its free end, last step */
  supported = false;
  /**
   * Space held: the aglet slips through the other cords (the solver's
   * ghosts). Only the last few centimetres of the end the pointer leads: it
   * goes over or under a cord without saying which, and the lace behind it
   * stays solid and follows the way it went. To get out of a tangle, the end
   * must be brought back the way it came, as with a real lace.
   */
  slipping = false;
  /** how many nodes at the tip slip through now: the aglet, more while it is forced through a knot (see PLAY.forceLoad) */
  slip: number = PLAY.aglet;
  /** something other than a grip holds the lace up (a cobweb it is stuck to): the free end pulls as hard as from a bar */
  held = false;
  /** how fast the grips tire, × PLAY.drain: the further up the climb, the faster (see `Climb.tiring`) */
  tiring = 1;
  /** how fast the lace wears, × (its kind: a thread wears fast, a cord slowly) */
  wearScale = 1;
  /** an end about to let go, worn out: whether something gives it its strength back (a second wind) */
  rescue: ((e: End) => boolean) | null = null;
  /** how fast the lace slid over surfaces, last step (m/s, summed along it, × its segment): what rustles */
  sliding = 0;
  /** how fast the lace has moved lately (m/s, the fastest, fading over half a second): a catch at the top of a swing comes after it */
  private recent = 0;
  /** how fast the pointer moves (m/s, smoothed), where it was last step; how long before the end may be thrown again (s) */
  private flick = { vx: 0, vy: 0, x: NaN, y: NaN, rest: 0, burst: 0 };
  /** where the free end is led: the pointer, followed with a little lag (the lace has some weight) */
  private follow = { x: 0, y: 0 };
  private followed: End | null = null;
  /** stiffness of a muscle that pulls with the weight of the lace at the end of its leash */
  private kUnit: number;

  constructor(
    readonly sim: CableSim,
    readonly start: number,
    readonly count: number,
    private surfaces: Surface[],
    /** the nodes of the cords that may be grabbed (not their pinned tops) */
    private cordNodes: number[],
    /** how worn each node is (new if not given) */
    wear?: ArrayLike<number>,
  ) {
    this.damage = wear ? Float32Array.from(wear) : new Float32Array(count);
    this.ends = [new End(start, start + 2), new End(start + count - 1, start + count - 3)];
    let w = 0;
    for (let i = start; i < start + count; i++) w += sim.mass[i] * 9.81;
    this.weight = w;
    this.length = LACE.segment * (count - 1);
    const hr = sim.P.dt / sim.P.refSubsteps;
    this.kUnit = w / ((sim.mass[this.ends[0].node] / (hr * hr)) * PLAY.lead);
    sim.firm[sim.cableOf[start]] = 1;
  }

  at(i: number): [number, number, number] {
    const x = this.sim.x;
    return [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
  }

  /** where end e holds on (its grip), or null */
  anchor(e: End): [number, number, number] | null {
    const g = e.grip;
    if (!g) return null;
    return g.kind === 'surface' ? [g.x, g.y, g.z] : this.at(g.node);
  }

  /** the end that follows the pointer: the one that grips nothing while the other grips, or the last let go; none if both grip */
  leader(): End | null {
    const [a, b] = this.ends;
    if (a.grip && b.grip) return null;
    if (a.grip) return b;
    if (b.grip) return a;
    return this.ends[this.loose];
  }

  /** the nearest thing end e could grip, within reach, and the point on it the end would snap to */
  holdFor(e: End): Hold | null {
    if (e.cooldown > 0 || e.grip) return null;
    const [px, py, pz] = this.at(e.node);
    let best: Hold | null = null, bd = PLAY.gripReach;
    this.surfaces.forEach((s, id) => {
      if (MATS[s.mat].grip <= 0) return;
      const q = snap(s, px, py, pz);
      if (q && q.d < bd) { bd = q.d; best = { kind: 'surface', surface: id, x: q.x, y: q.y, z: q.z }; }
    });
    const x = this.sim.x;
    for (const i of this.cordNodes) {
      const d = Math.hypot(x[3 * i] - px, x[3 * i + 1] - py, x[3 * i + 2] - pz) - LACE.radius - VINE.radius;
      if (d < bd) { bd = d; best = { kind: 'cord', node: i, x: x[3 * i], y: x[3 * i + 1], z: x[3 * i + 2] }; }
    }
    return best;
  }

  /** end e takes hold of h: it snaps onto it */
  take(e: End, h: Hold): void {
    const sim = this.sim;
    sim.clearTarget(e.node);
    if (h.kind === 'surface') {
      e.grip = { kind: 'surface', x: h.x, y: h.y, z: h.z, drain: MATS[this.surfaces[h.surface].mat].grip, surface: h.surface };
      sim.setTarget(e.node, h.x, h.y, h.z, PLAY.gripK, 0.25);
    } else {
      e.grip = { kind: 'cord', node: h.node, bundle: sim.addBundle([e.node, h.node], 0.5 * (LACE.radius + VINE.radius) + 0.001) };
    }
  }

  /** the surface `id` moved by (dx, dy): the ends that grip it go with it */
  shiftGrips(id: number, dx: number, dy: number): void {
    for (const e of this.ends) {
      const g = e.grip;
      if (g?.kind !== 'surface' || g.surface !== id) continue;
      g.x += dx; g.y += dy;
      g.carried = 0.3;
      this.sim.setTarget(e.node, g.x, g.y, g.z, PLAY.gripK, 0.25);
    }
  }

  /** the surface `id` turned by `da` (rad, clockwise) round (cx, cy): the ends that grip it go round with it */
  turnGrips(id: number, cx: number, cy: number, da: number): void {
    const c = Math.cos(da), s = Math.sin(da);
    for (const e of this.ends) {
      const g = e.grip;
      if (g?.kind !== 'surface' || g.surface !== id) continue;
      const dx = g.x - cx, dy = g.y - cy;
      g.x = cx + dx * c + dy * s; g.y = cy - dx * s + dy * c;
      g.carried = 0.3;
      this.sim.setTarget(e.node, g.x, g.y, g.z, PLAY.gripK, 0.25);
    }
  }

  /** end e lets go */
  release(e: End): void {
    const g = e.grip;
    if (!g) return;
    if (g.kind === 'surface') this.sim.clearTarget(e.node);
    else this.sim.removeBundle(g.bundle);
    e.grip = null;
    this.loose = this.ends.indexOf(e);
  }

  releaseAll(): void {
    for (const e of this.ends) this.release(e);
  }

  /**
   * Before a step: each end grips or lets go as its button says, and the free
   * end is led towards (x, y), within reach of the other's grip. What took
   * hold and what let go.
   */
  control(x: number, y: number): Event[] {
    const out: Event[] = [];
    for (const e of this.ends) {
      if (!e.held) { e.spent = false; if (e.grip) { this.release(e); out.push({ end: e, what: 'let go' }); } continue; }
      if (e.grip || e.spent) continue;
      const h = this.holdFor(e);
      if (!h) continue;
      // catching the lace as it falls or swings jolts the hand: the faster it goes, the more it costs
      const speed = this.speedOf(), cost = Math.max(0, speed - PLAY.catchSpeed) * PLAY.catchCost;
      if (cost >= e.stamina) {
        e.stamina = 0; e.spent = true; e.cooldown = PLAY.cooldown;
        out.push({ end: e, what: 'jolt', cost, torn: true });
        continue;
      }
      e.stamina -= cost;
      // the end that stops the lace takes the jolt in its fibres too
      this.harm(e.node, cost * PLAY.joltWear / PLAY.catchCost, 3);
      this.take(e, h);
      // at the top of a swing (it moved fast a moment ago, it hardly moves now): a clean catch, that gives the hand some strength back
      const perfect = this.recent > PLAY.perfectAfter && speed < PLAY.perfectAt;
      if (perfect) { e.stamina = Math.min(1, e.stamina + PLAY.perfectGain); this.recent = 0; }
      out.push({ end: e, what: 'took', perfect });
      if (cost > 0.05) out.push({ end: e, what: 'jolt', cost, torn: false });
    }
    // gripping nothing, the pointer takes the end nearest to it (and keeps it
    // until the other is clearly nearer, so that it does not flicker between them)
    if (!this.ends[0].grip && !this.ends[1].grip) {
      const d = this.ends.map((e) => { const p = this.at(e.node); return Math.hypot(p[0] - x, p[1] - y); });
      if (d[1 - this.loose] < 0.75 * d[this.loose]) this.loose = 1 - this.loose;
    }
    const a = this.leader();
    for (const e of this.ends) if (e !== a && !e.grip) this.sim.clearTarget(e.node);
    // forced through a knot (pulled hard, the end hardly moves), more of the end slips through
    const v = this.sim.v, n = a ? a.node : 0;
    const forced = this.slipping && !!a && this.reach > PLAY.forceLoad && Math.hypot(v[3 * n], v[3 * n + 1], v[3 * n + 2]) < PLAY.forceStuck;
    this.slip = !this.slipping ? PLAY.aglet : forced ? Math.min(PLAY.forceMost, this.slip + PLAY.forceRate * this.sim.P.dt) : Math.max(PLAY.aglet, this.slip - PLAY.forceRate * this.sim.P.dt);
    this.aglet(a);
    if (!a) return out;
    const b = this.ends[1 - this.ends.indexOf(a)];
    // a new end to lead starts from where it is, then eases after the pointer
    const f = this.follow;
    if (this.followed !== a) { const p = this.at(a.node); f.x = p[0]; f.y = p[1]; this.followed = a; }
    const ease = Math.min(1, this.sim.P.dt / PLAY.inertia);
    f.x += (x - f.x) * ease; f.y += (y - f.y) * ease;
    let tx = f.x, ty = f.y, tz = this.at(a.node)[2] * 0.5;
    const g = this.anchor(b);
    if (g) {
      const dx = tx - g[0], dy = ty - g[1], dz = tz - g[2], d = Math.hypot(dx, dy, dz), r = 0.96 * this.length;
      if (d > r) { tx = g[0] + (dx * r) / d; ty = g[1] + (dy * r) / d; tz = g[2] + (dz * r) / d; }
    }
    this.aim.x = tx; this.aim.y = ty; this.aim.z = tz;
    // anchored (the other end grips, or the lace rests on a bar, a shelf), the
    // free end pulls hard, as over a pulley; on nothing but the floor, it can
    // only lift itself a little
    this.supported = !g && (this.held || this.rests(a));
    if (!g && !this.supported && this.thrown(a, x, y)) out.push({ end: a, what: 'thrown' });
    // thrown, the end pulls hard for a moment: the swing of the arm behind the flick
    const burst = this.flick.burst > 0;
    this.flick.burst = Math.max(0, this.flick.burst - this.sim.P.dt);
    this.sim.setTarget(a.node, tx, ty, tz, this.kUnit * (burst ? PLAY.throwMuscle : g || this.supported ? PLAY.muscle : PLAY.muscleLoose), PLAY.lead);
    return out;
  }

  /**
   * The pointer flicked fast towards where it goes, the lace lying with
   * nothing holding it: the free end is whipped that way, its tip fastest.
   * What lifts it is the speed it is given, not a pull: it rises, slows,
   * falls back unless it grips at the top of its flight.
   */
  private thrown(a: End, x: number, y: number): boolean {
    const f = this.flick, dt = this.sim.P.dt;
    f.rest = Math.max(0, f.rest - dt);
    if (Number.isNaN(f.x)) { f.x = x; f.y = y; }
    // (the pointer moves once a frame, the solver steps once or twice: smoothed over a few frames)
    const k = Math.min(1, dt / 0.05);
    f.vx += ((x - f.x) / dt - f.vx) * k; f.vy += ((y - f.y) / dt - f.vy) * k;
    f.x = x; f.y = y;
    const p = this.at(a.node), speed = Math.hypot(f.vx, f.vy);
    // fast, upward, and towards the pointer from the end
    if (f.rest > 0 || speed < PLAY.throwFlick || f.vy < 0.3 * speed || (x - p[0]) * f.vx + (y - p[1]) * f.vy <= 0) return false;
    f.rest = PLAY.throwRest;
    f.burst = PLAY.throwTime;
    const ux = f.vx / speed, uy = f.vy / speed, v = this.sim.v, dir = a.node < a.inward ? 1 : -1;
    for (let j = 0; j < PLAY.throwNodes; j++) {
      const i = a.node + dir * j, s = PLAY.throwSpeed * (1 - j / PLAY.throwNodes);
      v[3 * i] = ux * s; v[3 * i + 1] = uy * s;
    }
    this.sim.wakeCable(this.sim.cableOf[a.node]);
    return true;
  }

  /**
   * Whether the lace rests on something that holds it up (lying on top of a
   * bar, a shelf, an eyelet, a cord: not on the floor, nor against a wall), away from
   * end a, whose last stretch does not count: it is what lifts.
   */
  rests(a: End): boolean {
    const x = this.sim.x, skip = 12;
    const from = a.node < a.inward ? this.start + skip : this.start, to = a.node < a.inward ? this.start + this.count : this.start + this.count - skip;
    for (let i = from; i < to; i++) {
      const px = x[3 * i], py = x[3 * i + 1], pz = x[3 * i + 2];
      for (const s of this.surfaces) {
        if (s.mat === 'floor' || s.mat === 'wall') continue;
        const q = snap(s, px, py, pz);
        // touching it, from above: lying on it
        if (q && q.d < 0.004 && q.ny > 0.3) return true;
      }
      // lying on a cord (a line, a net, a cord it is caught round): it holds the lace up as well
      for (const c of this.cordNodes) {
        const dx = px - x[3 * c], dy = py - x[3 * c + 1], dz = pz - x[3 * c + 2];
        if (dy > 0.3 * LACE.radius && dx * dx + dy * dy + dz * dz < (LACE.radius + VINE.radius + 0.003) ** 2) return true;
      }
    }
    return false;
  }

  /** after a step of dt: what each grip holds up, its stamina; the ends that let go, worn out */
  wear(dt: number): Event[] {
    const out: Event[] = [];
    // how hard the end the pointer leads pulls (× the weight of the lace): what reaching costs the grip it reaches from
    const a = this.leader();
    const reach = a && a.grip === null && this.sim.targetK[a.node] > 0 ? this.sim.targetPull(a.node) / this.weight : 0;
    this.reach += (reach - this.reach) * Math.min(1, dt / 0.2);
    this.recent = Math.max(this.speedOf(), this.recent * Math.exp(-dt / 0.5));
    for (const e of this.ends) {
      e.cooldown = Math.max(0, e.cooldown - dt);
      const g = e.grip;
      if (!g) {
        e.load = 0;
        e.stamina = Math.min(1, e.stamina + PLAY.recoverFree * dt);
        continue;
      }
      // the lace pulled harder than its own weight at the hand, along it (not what presses the hand onto the bar)
      let over = 0;
      if (g.kind === 'surface') {
        this.sim.targetPull(e.node, pullOut);
        const x = this.sim.x, i = e.node, j = i < e.inward ? i + 1 : i - 1;
        const ux = x[3 * j] - x[3 * i], uy = x[3 * j + 1] - x[3 * i + 1], uz = x[3 * j + 2] - x[3 * i + 2];
        const ul = Math.hypot(ux, uy, uz) || 1;
        over = Math.max(0, -(pullOut.x * ux + pullOut.y * uy + pullOut.z * uz) / ul / this.weight - 1);
        // carried by what it grips, the hand lags its spring's target: not an effort of its own
        if (g.carried) { g.carried = Math.max(0, g.carried - dt); over = 0; }
      }
      // the effort of this hand: the other end reaching from it, and what pulls it harder than the lace weighs
      const other = this.ends[1 - this.ends.indexOf(e)];
      const now = (other === a ? this.reach : 0) + over;
      e.load += (now - e.load) * Math.min(1, dt / 0.2);
      const drain = g.kind === 'surface' ? g.drain : 1;
      const vine = PLAY.vineDrain * this.tiring;
      if (e.load < PLAY.restLoad) e.stamina = Math.min(1, e.stamina + (g.kind === 'cord' ? -vine : PLAY.recover * (1 - e.load / PLAY.restLoad)) * dt);
      else e.stamina -= (PLAY.drain * this.tiring * drain * e.load ** PLAY.drainPow + (g.kind === 'cord' ? vine : 0)) * dt;
      if (e.stamina <= 0 && this.rescue?.(e)) { e.stamina = 0.5; out.push({ end: e, what: 'rescued' }); }
      else if (e.stamina <= 0) {
        e.stamina = 0;
        e.cooldown = PLAY.cooldown;
        e.spent = true;
        this.release(e);
        out.push({ end: e, what: 'worn out' });
      }
    }
    return out;
  }

  /** how many turns the lace makes round a bar along z at (cx, cy), counting nodes within `near` of its axis */
  turns(cx: number, cy: number, near: number): number {
    const x = this.sim.x;
    let sum = 0, prev = NaN;
    for (let i = this.start; i < this.start + this.count; i++) {
      const dx = x[3 * i] - cx, dy = x[3 * i + 1] - cy;
      if (dx * dx + dy * dy > near * near) { prev = NaN; continue; }
      const a = Math.atan2(dy, dx);
      if (!Number.isNaN(prev)) {
        let d = a - prev;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        sum += d;
      }
      prev = a;
    }
    return Math.abs(sum) / (2 * Math.PI);
  }

  /** the fastest node (m/s), of those within `near` of the axis of a bar at (cx, cy) if given: what slides on it, not the ends that swing */
  speed(cx = 0, cy = 0, near = Infinity): number {
    const x = this.sim.x, v = this.sim.v;
    let m = 0;
    for (let i = this.start; i < this.start + this.count; i++) {
      if ((x[3 * i] - cx) ** 2 + (x[3 * i + 1] - cy) ** 2 > near * near) continue;
      m = Math.max(m, v[3 * i] ** 2 + v[3 * i + 1] ** 2 + v[3 * i + 2] ** 2);
    }
    return Math.sqrt(m);
  }

  /**
   * The aglet of end a is a ghost while slipping (the cords and the lace
   * itself let it through), more of the end if forced (`slip`), nothing
   * else. Let go, it turns solid again where it is clear of the cords, and
   * pushes them away where it is not.
   */
  private aglet(a: End | null): void {
    const sim = this.sim, tip = this.slipping ? a : null;
    for (let i = this.start; i < this.start + this.count; i++) {
      const d = tip ? Math.abs(i - tip.node) : Infinity;
      if (d < this.slip) {
        if (sim.ghost[i] !== -1) { sim.ghost[i] = -1; sim.wakeCable(sim.cableOf[i]); }
        // squeezed through beyond the aglet, the fibres fray
        if (d >= PLAY.aglet) this.harm(i, PLAY.forceWear * sim.P.dt, 0);
      }
      else if (sim.ghost[i] === -1) sim.ghost[i] = sim.P.ghostFrames;
    }
  }

  /**
   * The stretch of lace end e carries: from the end inward, the nodes up to
   * the first that lies on something (a bar, a shelf, the floor) or the other
   * end. Returns that node: the end holds up what is between.
   */
  carried(e: End): number {
    const x = this.sim.x, dir = e.node < e.inward ? 1 : -1, last = dir > 0 ? this.start + this.count - 1 : this.start;
    // the bar the end grips does not count where the lace wraps round it at
    // the hand, only once the lace has left it (draped over it further on)
    let held = e.grip?.kind === 'surface' ? this.surfaces[e.grip.surface] : null;
    const on = (s: (typeof this.surfaces)[number], i: number) => { const q = snap(s, x[3 * i], x[3 * i + 1], x[3 * i + 2]); return !!q && q.d < 0.004; };
    for (let i = e.node + dir * 3; i !== last; i += dir) {
      if (held && !on(held, i)) held = null;
      for (const s of this.surfaces) if (s.mat !== 'wall' && s !== held && on(s, i)) return i;
    }
    return last;
  }

  /** whether most of the lace lies on something (a floor, a shelf, a bar): at rest on it, not hanging */
  lying(): boolean {
    const x = this.sim.x;
    let on = 0;
    for (let i = this.start; i < this.start + this.count; i += 4) {
      if (this.surfaces.some((s) => { if (s.mat === 'wall') return false; const q = snap(s, x[3 * i], x[3 * i + 1], x[3 * i + 2]); return !!q && q.d < 2.5 * LACE.radius && q.ny > 0.3; })) on++;
    }
    return on * 4 > this.count / 2;
  }

  /** whether the lace lies against another cord (every other node is enough) */
  againstCords(): boolean {
    const x = this.sim.x, near = (LACE.radius + VINE.radius + 0.003) ** 2;
    for (let i = this.start; i < this.start + this.count; i += 2) {
      for (const c of this.cordNodes) {
        const dx = x[3 * i] - x[3 * c], dy = x[3 * i + 1] - x[3 * c + 1], dz = x[3 * i + 2] - x[3 * c + 2];
        if (dx * dx + dy * dy + dz * dz < near) return true;
      }
    }
    return false;
  }

  /**
   * Whether the lace lies against itself, away along it, off the ground
   * (looped round itself, knotted): lying in a heap on a floor or a shelf
   * is no knot
   */
  againstItself(): boolean {
    const x = this.sim.x, near = (2 * LACE.radius + 0.003) ** 2;
    const lying = (i: number) => this.surfaces.some((s) => {
      if (s.shape.kind !== 'box' || s.mat === 'wall') return false;
      const q = snap(s, x[3 * i], x[3 * i + 1], x[3 * i + 2]);
      // on it, or on the lace that lies on it
      return !!q && q.d < 2.5 * LACE.radius && q.ny > 0.3;
    });
    for (let i = this.start; i < this.start + this.count; i += 2) {
      if (lying(i)) continue;
      for (let j = i + 8; j < this.start + this.count; j += 2) {
        if (lying(j)) continue;
        const dx = x[3 * i] - x[3 * j], dy = x[3 * i + 1] - x[3 * j + 1], dz = x[3 * i + 2] - x[3 * j + 2];
        if (dx * dx + dy * dy + dz * dz < near) return true;
      }
    }
    return false;
  }

  centre(): [number, number] {
    const x = this.sim.x;
    let cx = 0, cy = 0;
    for (let i = this.start; i < this.start + this.count; i++) { cx += x[3 * i]; cy += x[3 * i + 1]; }
    return [cx / this.count, cy / this.count];
  }

  /** wears node i by `amount`, and its neighbours less, `spread` nodes either way */
  harm(i: number, amount: number, spread = 2): void {
    amount *= this.wearScale;
    for (let k = -spread; k <= spread; k++) {
      const j = i + k - this.start;
      if (j >= 0 && j < this.count) this.damage[j] = Math.min(1, this.damage[j] + amount * (1 - Math.abs(k) / (spread + 1)));
    }
  }

  /** after a step of dt: what slides over a surface wears, by how far it slid and how rough the surface is */
  rub(dt: number): void {
    const x = this.sim.x, v = this.sim.v;
    this.sliding = 0;
    for (let i = this.start; i < this.start + this.count; i++) {
      const speed = Math.hypot(v[3 * i], v[3 * i + 1], v[3 * i + 2]);
      if (speed < 0.05) continue;
      for (const s of this.surfaces) {
        const q = snap(s, x[3 * i], x[3 * i + 1], x[3 * i + 2]);
        if (q && q.d < 0.004) { if (s.mat !== 'wall') this.sliding += speed * LACE.segment * 5; this.damage[i - this.start] = Math.min(1, this.damage[i - this.start] + PLAY.rubWear * this.wearScale * MATS[s.mat].wear * speed * dt); break; }
      }
    }
  }

  /** mends the lace round node i (a patch): its fibres back to a third worn, `spread` nodes either way */
  mend(i: number, spread = 6): void {
    for (let k = -spread; k <= spread; k++) {
      const j = i + k - this.start;
      if (j >= 0 && j < this.count) this.damage[j] = Math.min(this.damage[j], 0.3);
    }
  }

  /** the node where the lace is torn through, or −1 */
  broken(): number {
    const k = this.damage.findIndex((d) => d >= 1);
    return k < 0 ? -1 : this.start + k;
  }

  /** how fast the lace as a whole moves (its centre of mass, m/s): what a hand stops when it catches it */
  speedOf(): number {
    const v = this.sim.v, m = this.sim.mass;
    let px = 0, py = 0, pz = 0, M = 0;
    for (let i = this.start; i < this.start + this.count; i++) { px += m[i] * v[3 * i]; py += m[i] * v[3 * i + 1]; pz += m[i] * v[3 * i + 2]; M += m[i]; }
    return Math.hypot(px, py, pz) / M;
  }

  /** where every node is, to come back to */
  save(): Float64Array {
    return this.sim.x.slice(3 * this.start, 3 * (this.start + this.count));
  }

  /** back to where its nodes were (`pos`), new */
  restore(pos: Float64Array): void {
    this.releaseAll();
    this.damage.fill(0);
    for (const e of this.ends) { e.stamina = 1; e.cooldown = 0; e.load = 0; e.spent = e.held; }
    this.loose = 0;
    this.sim.moveNodes(this.start, pos);
    this.sim.firm[this.sim.cableOf[this.start]] = 1;
  }
}
