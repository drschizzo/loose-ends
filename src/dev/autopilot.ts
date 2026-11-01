// @ts-nocheck
// An ideal player, to show what a climb looks like played well (?autopilot).
// The solver is deterministic: the pilot tries moves from a snapshot of the
// game, keeps the best, and logs what it did, step by step; the log played
// back draws the climb frame by frame.

import type { Game } from '../game';
import { PLAY } from '../tuning';
import { CordsView } from '../view/cordsView';
import { Scenery } from '../view/scenery';

const VIEW = new Set(['stage', 'hud', 'controls', 'overlay', 'cords', 'scenery', 'recorder', 'ghost']);
const DT = 1 / 60;

const skip = (o: any) => o.isObject3D || o.isMaterial || o.isBufferGeometry || o.isTexture || (typeof Node !== 'undefined' && o instanceof Node);

/** the state of the game: each object reachable from its fields (not the view), what it held */
export function snap(game: Game) {
  const recs = new Map<object, any>();
  const visit = (o: any) => {
    if (o === null || typeof o !== 'object' || recs.has(o) || skip(o)) return;
    if (ArrayBuffer.isView(o)) { recs.set(o, { k: 't', d: (o as any).slice() }); return; }
    if (Array.isArray(o)) { recs.set(o, { k: 'a', d: o.slice() }); for (const v of o) visit(v); return; }
    if (o instanceof Map) { const d = [...o.entries()]; recs.set(o, { k: 'm', d }); for (const [a, b] of d) { visit(a); visit(b); } return; }
    if (o instanceof Set) { const d = [...o]; recs.set(o, { k: 's', d }); for (const v of d) visit(v); return; }
    const d = Object.entries(o);
    recs.set(o, { k: 'o', d });
    for (const [, v] of d) visit(v);
  };
  const own = Object.entries(game).filter(([k]) => !VIEW.has(k));
  for (const [, v] of own) visit(v);
  return { recs, own, world: game.world };
}

export function restore(game: Game, s: ReturnType<typeof snap>): void {
  for (const [o, r] of s.recs) {
    if (r.k === 't') o.set(r.d);
    else if (r.k === 'a') { o.length = r.d.length; for (let i = 0; i < r.d.length; i++) o[i] = r.d[i]; }
    else if (r.k === 'm') { o.clear(); for (const [a, b] of r.d) o.set(a, b); }
    else if (r.k === 's') { o.clear(); for (const v of r.d) o.add(v); }
    else {
      const keys = new Set(r.d.map(([k]) => k));
      for (const k of Object.keys(o)) if (!keys.has(k)) delete o[k];
      for (const [k, v] of r.d) o[k] = v;
    }
  }
  for (const [k, v] of s.own) game[k] = v;
}

/** what shows the world, made again if the world is another than the one it shows (after going back across a build) */
export function sync(game: Game): void {
  if (game.cords.world !== game.world) {
    const L = game.world.level;
    game.cords.dispose(); game.cords = new CordsView(game.stage.scene, game.world);
    game.scenery.dispose(); game.scenery = new Scenery(game.stage.scene, L, game.climb.storeys(L), game.climb.course.seed, game.climb.best);
  }
}

/** the point a fraction s along the polyline pts (by length) */
function along(pts: [number, number][], s: number): [number, number] {
  const len: number[] = [];
  let all = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len.push(l); all += l; }
  let d = s * all;
  for (let i = 0; i < len.length; i++) {
    if (d <= len[i] || i === len.length - 1) { const f = len[i] ? Math.min(1, d / len[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
    d -= len[i];
  }
  return pts[pts.length - 1];
}

/** what the player does in a step: where the pointer is, which buttons are held, Space */
export interface Input { x: number; y: number; h0: boolean; h1: boolean; slip?: boolean }

/** a move: end k lets go (after `wait` s) and is led to surface sid, over T s, along a curve (through a via point, or `pts`), and grips it */
export interface Prm { /** grip only at the top of a swing (a clean catch: see PLAY.perfectAfter) */ top?: boolean; wait?: number; T: number; ax?: number; ay?: number; vx?: number; vy?: number; pts?: [number, number][]; hold?: number; settle?: number; s?: number }

/**
 * What the pilot does, one thing after the other:
 *   move:  end k lets go and grips surface sid (see Prm);
 *   drape: end k is led along `pts` (the other gripping on), then everything let go: the lace hangs over surface sid by itself;
 *   ride:  hold on for `s` seconds (what is gripped carries the lace);
 *   save:  as drape, over the post sid, and still until it saves;
 *   seq:   acts one after the other.
 */
export type Act = { a: 'move' | 'drape' | 'save'; k: number; sid: number; prm: Prm } | { a: 'ride'; prm: Prm } | { a: 'seq'; acts: Act[] };

export function start(game: Game) {
  // nothing the pilot does is kept (buttons earned, ghosts, splits)
  const setItem = Storage.prototype.setItem;
  try { Storage.prototype.setItem = () => {}; } catch { /* */ }
  /** what the pilot did, kept for the page to come (sessionStorage) */
  const plan: Act[] = [];
  const keep = () => setItem.call(sessionStorage, 'pilot:plan', JSON.stringify(plan));
  const ptr = game.controls.pointer;
  const log: Input[] = [];
  // from the very start: the lace lying on the floor; or (&hang=x,y with ?at=k) hanging from (x, y), in the window of section k
  game.stage.renderer.setAnimationLoop(null);
  const query = new URLSearchParams(location.search), hang = query.get('hang')?.split(',').map(Number);
  if (hang) {
    const p: number[] = [];
    for (let i = 0; i < game.lace.count; i++) p.push(hang[0], hang[1] - 0.03 - 0.02 * i, 0);
    game.build(game.climb.course.window(Math.max(0, Number(query.get('at')) - 1)), p);
  } else game.build(game.climb.level(), null);
  game.startPos = game.lace.save();
  // (the page ran a few frames before: the same start whenever the page is loaded)
  Object.assign(game, { time: 0, clock: 0, frame: 0, started: false, flow: 0, lastGrip: -99, atMost: 0, tangled: 0 });
  game.rules.taken.clear(); game.rules.opened.clear(); game.rules.save = null; game.rules.t = 0;
  game.newStretch(game.lace.centre()[1]);
  game.stage.jump(...game.lace.centre());

  /** one step with input i (logged) */
  const step = (i: Input) => {
    ptr.x = i.x; ptr.y = i.y;
    game.hold(0, i.h0); game.hold(1, i.h1);
    game.lace.slipping = !!i.slip && game.state === 'play';
    game.tick();
    // (what the frame drawn would do to the play: how fast the grips tire where the lace is)
    if (game.state === 'play') game.storey(game.lace.centre()[1]);
    log.push(i);
  };
  const mark = () => ({ s: snap(game), n: log.length, plan: plan.length, x: ptr.x, y: ptr.y });
  const back = (b) => { restore(game, b.s); log.length = b.n; plan.length = b.plan; ptr.x = b.x; ptr.y = b.y; };
  /** a target: surface sid, or (an object) the node a fraction f along cord c */
  const node = (t: { c: number; f: number }) => { const cb = game.world.sim.cables[t.c]; return cb.start + Math.round(t.f * (cb.count - 1)); };
  const tc = (sid: any) => {
    if (typeof sid === 'object') { const q = lace().at(node(sid)); return { x: q[0], y: q[1] }; }
    const s = game.world.surfaces[sid].shape; return s.kind === 'capsule' ? { x: s.ax, y: s.ay } : { x: (s.min[0] + s.max[0]) / 2, y: s.max[1] };
  };
  /** whether h is a hold on target sid */
  const isOn = (h: any, sid: any) => {
    if (!h) return false;
    if (typeof sid !== 'object') return h.kind === 'surface' && h.surface === sid;
    const cb = game.world.sim.cables[sid.c];
    return h.kind === 'cord' && h.node >= cb.start && h.node < cb.start + cb.count;
  };
  /** the buttons: end k's as said, the other's gripping on if it grips */
  const held = (k: number, hk: boolean) => { const o = game.lace.ends[1 - k]; return k === 0 ? { h0: hk, h1: !!o.grip } : { h0: !!o.grip, h1: hk }; };
  const lace = () => game.lace;
  const r3 = (v: number) => +v.toFixed(3);

  /** end k led from where it is to (ax, ay), over nT steps, along prm's curve: the point at step i */
  const path = (prm: Prm, sx: number, sy: number, ax: number, ay: number, u: number): [number, number] => {
    const s = u * u * (3 - 2 * u);
    if (prm.pts) return along([[sx, sy], ...prm.pts, [ax, ay]], s);
    const vx = (sx + ax) / 2 + (prm.vx ?? 0), vy = (sy + ay) / 2 + (prm.vy ?? 0);
    return [(1 - s) * (1 - s) * sx + 2 * (1 - s) * s * vx + s * s * ax, (1 - s) * (1 - s) * sy + 2 * (1 - s) * s * vy + s * s * ay];
  };

  /** a move (see Act): what came of it */
  const move = (k: number, sid: number, prm: Prm, extra = 1.2) => {
    // (a cord this world has not)
    if (typeof sid === 'object' && !game.world.sim.cables[sid.c]) return { ok: false, steps: 0 };
    const L = lace(), e = L.ends[k], o = L.ends[1 - k];
    const n0 = log.length, st0 = o.stamina, px = ptr.x, py = ptr.y;
    for (let i = 0, n = Math.round((prm.wait ?? 0) / DT); i < n; i++) step({ x: px, y: py, ...held(k, !!e.grip) });
    const q0 = L.at(e.node);
    const nT = Math.max(1, Math.round(prm.T / DT)), nMax = nT + Math.round(extra / DT);
    for (let i = 0; i < nMax; i++) {
      const c = tc(sid), [x, y] = path(prm, q0[0], q0[1], c.x + (prm.ax ?? 0), c.y + (prm.ay ?? 0), Math.min(1, i / nT));
      const clean = L.recent > PLAY.perfectAfter && L.speedOf() < PLAY.perfectAt;
      const hk = isOn(L.holdFor(e), sid) && (!prm.top || clean);
      step({ x, y, ...held(k, hk) });
      if (e.grip) return { ok: true, steps: log.length - n0, cost: st0 - o.stamina, low: Math.min(e.stamina, o.stamina), flow: game.flow, perfect: clean };
      if (L.centre()[1] < game.world.level.bottom - 0.3) break;
    }
    return { ok: false, steps: log.length - n0 };
  };

  /** end k led along pts (the other gripping on), held there `hold` s, everything let go, `settle` s: hung over surface sid? */
  const drape = (k: number, sid: number, prm: Prm) => {
    const L = lace(), e = L.ends[k], n0 = log.length, q0 = L.at(e.node);
    const nT = Math.max(1, Math.round(prm.T / DT)), pts = prm.pts!, end = pts[pts.length - 1];
    for (let i = 0; i <= nT; i++) { const [x, y] = path({ ...prm, pts: pts.slice(0, -1) }, q0[0], q0[1], end[0], end[1], i / nT); step({ x, y, ...held(k, false) }); }
    for (let i = 0, n = Math.round((prm.hold ?? 0) / DT); i < n; i++) step({ x: end[0], y: end[1], ...held(k, false) });
    const sh = game.world.surfaces[sid].shape;
    for (let i = 0, n = Math.round((prm.settle ?? 1) / DT); i < n; i++) {
      step({ x: end[0], y: end[1], h0: false, h1: false });
      if (game.world !== saved0 || game.rules.save !== save0) break;
    }
    if (game.world !== saved0 || game.rules.save !== save0) return { ok: true, steps: log.length - n0, cost: 0, low: 1, flow: 0, saved: true };
    const turns = L.turns(sh.ax, sh.ay, 0.06), speed = L.speedOf();
    // (on a post, only saving on it will do)
    if (game.world.surfaces[sid].mat === 'gold') return { ok: false, steps: log.length - n0 };
    return { ok: turns > 0.3 && speed < 0.3 && L.centre()[1] > sh.ay - 0.8, steps: log.length - n0, cost: 0, low: 1, flow: 0, turns, speed };
  };
  /** the world and the save before the act: saved on a post, the save is another (and the world, if the window moved) */
  let saved0 = game.world, save0 = game.rules.save;

  /** hold on for prm.s seconds, the free end hanging (the pointer where it is) */
  const ride = (prm: Prm) => {
    const L = lace(), n0 = log.length, a = L.leader();
    for (let i = 0, n = Math.round(prm.s! / DT); i < n; i++) {
      const q = a ? L.at(a.node) : [ptr.x, ptr.y];
      step({ x: q[0], y: q[1] - 0.02, h0: !!L.ends[0].grip, h1: !!L.ends[1].grip });
    }
    return { ok: L.ends.some((e) => e.grip), steps: log.length - n0, cost: 0, low: Math.min(...L.ends.map((e) => e.stamina)), flow: game.flow };
  };

  /** what an act does, played from here */
  const act = (x: Act) => {
    const r = act1(x), L = lace();
    // a lace worn through, broken: no good
    if (L.count !== whole) r.ok = false;
    r.worn = L.damage.reduce((m, d) => Math.max(m, d), 0);
    return r;
  };
  const whole = game.lace.count;
  const act1 = (x: Act) => {
    saved0 = game.world; save0 = game.rules.save;
    if (x.a === 'seq') {
      const n0 = log.length;
      let r = null;
      for (const y of x.acts) { r = act1(y); if (!r.ok) break; }
      return { ...r, steps: log.length - n0 };
    }
    return x.a === 'move' ? move(x.k, x.sid, x.prm) : x.a === 'ride' ? ride(x.prm) : drape(x.k, x.sid, x.prm);
  };

  /** what a clean catch is worth (s): the pilot seeks the top of the swing */
  let PERFECT = 1.5;
  /** fast, the grips fresh, a clean catch, the élan kept, the lace whole, and as high as it gets */
  const score0 = (r) => r.steps * DT + 3 * Math.max(0, r.cost) - 0.3 * r.flow - PERFECT * (r.perfect ? 1 : 0) + 6 * Math.max(0, r.worn - 0.25) + (r.worn > 0.6 ? 100 : 0) - 4 * Math.max(...lace().ends.map((e) => lace().anchor(e)?.[1] ?? -9));
  /** every act of `acts` tried from here: the best (fastest, least tiring) kept, played; null if none works */
  const best = (acts: Act[], score = score0) => {
    const b = mark(), w = game.world;
    let top = null;
    for (const x of acts) {
      const r = act(x);
      if (r.ok) { r.score = score(r, x); r.x = x; if (!top || r.score < top.score) { top = r; top.end = mark(); } }
      // (saved on a post: no need to look further)
      if (r.ok && r.saved) break;
      back(b);
    }
    sync(game);
    if (!top) return null;
    // played again from where it started, the best must do the same: what the pilot keeps is what it will do
    back(b);
    const again = act(top.x), c = lace().centre(), want = top.end.s.recs.get(game.world.sim.x)?.d;
    if (!again.ok || again.steps !== top.steps || (want && want[0] !== game.world.sim.x[0])) console.warn('pilot: not the same played again', top.x, again, c);
    plan.push(top.x); keep();
    return top;
  };

  /** a grid of moves: every combination of the values given */
  const grid = (axes: Record<string, any[]>): Prm[] => {
    let out = [{}];
    for (const [key, vals] of Object.entries(axes)) out = out.flatMap((p) => vals.map((v) => ({ ...p, [key]: v })));
    return out as Prm[];
  };
  /** quick moves: a curve through a point off the middle */
  const G2 = grid({ wait: [0, 0.4], T: [0.6, 1.0], ay: [0.02, 0.06], vx: [0, 0.25, -0.25], vy: [0, 0.3, 0.5] });
  /** moves through a point of a grid round the way, below it to swing up */
  const around = (k: number, sid: number, o: { N?: number; T?: number[]; wait?: number[] } = {}): Prm[] => {
    const q = lace().at(lace().ends[k].node), c = tc(sid), N = o.N ?? 6, out: Prm[] = [];
    const x0 = Math.min(q[0], c.x) - 0.3, x1 = Math.max(q[0], c.x) + 0.3, y0 = Math.min(q[1], c.y) - 0.5, y1 = Math.max(q[1], c.y) + 0.3;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (const T of o.T ?? [0.8, 1.3, 1.8]) for (const wait of o.wait ?? [0]) {
      out.push({ pts: [[r3(x0 + ((x1 - x0) * i) / (N - 1)), r3(y0 + ((y1 - y0) * j) / (N - 1))]], T, ay: 0.03, wait });
    }
    return out;
  };
  const moves = (k: number, sid: number, prms: Prm[]): Act[] => prms.map((prm) => ({ a: 'move', k, sid, prm }));
  /** end k to surface sid: the quick moves, else swinging */
  const reach = (k: number, sid: number, o = {}) => best(moves(k, sid, G2)) ?? best(moves(k, sid, around(k, sid, o)));

  /** the acts of a plan played again (deterministic: where they led) */
  const redo = (acts: Act[] = JSON.parse(sessionStorage.getItem('pilot:plan') ?? '[]')) => {
    for (const x of acts) { const r = act(x); if (!r.ok) return { failed: x, info: info() }; plan.push(x); }
    keep();
    sync(game);
    return info();
  };
  /** the last n acts undone (within this world) */
  const undo = (n = 1) => { const acts = plan.slice(0, -n); back(start0); return redo(acts); };

  /** draws the frames of the log from `from` on, at the pace of play (to watch it) */
  const watch = async (from = 0) => {
    const saved = log.slice(), acts = plan.slice();
    back(start0);
    for (let n = 0; n < saved.length; n++) {
      step(saved[n]);
      if (n < from) continue;
      game.draw(DT);
      await new Promise((r) => requestAnimationFrame(r));
    }
    plan.push(...acts);
  };

  /** where the lace is, what it grips, how strong its ends are */
  const info = () => {
    const L = lace();
    return { t: log.length, acts: plan.length, head: L.at(L.ends[0].node).slice(0, 2).map(r3), tail: L.at(L.ends[1].node).slice(0, 2).map(r3), grips: L.ends.map((e) => e.grip?.kind === 'surface' ? e.grip.surface : e.grip ? 'cord' : null), st: L.ends.map((e) => r3(e.stamina)), c: L.centre().map(r3), flow: game.flow };
  };

  /** every act of `acts` tried from here: those that work, best first (each with where it ended), at most `keep` */
  const ranked = (acts: Act[], keep = 4, score = score0) => {
    const b = mark(), out = [];
    for (const x of acts) {
      const r = act(x);
      if (r.ok) { r.score = score(r, x); r.x = x; r.end = mark(); out.push(r); out.sort((p, q) => p.score - q.score); if (out.length > keep) out.pop(); }
      back(b);
    }
    return out;
  };
  /** what may be done instead of act x of an older plan: x itself, the quick moves, waiting for the top of the swing */
  const instead = (x: Act | { a: 'goal'; k: number; sids: any[] }, wide: boolean): Act[] => {
    // a goal: end k to any of these, every way
    if (x.a === 'goal') return x.sids.flatMap((sid) => instead({ a: 'move', k: x.k, sid, prm: G2[0] }, wide));
    if (x.a === 'drape') {
      // the same way over, from other points of a swing, ending a little off
      const [over, drop] = x.prm.pts!.slice(-2), out: Act[] = [x];
      for (const dx of [-0.25, -0.1, 0.05, 0.2]) for (const dy of [-0.5, -0.2, 0.1]) for (const T of [1.0, 1.5]) {
        out.push({ ...x, prm: { ...x.prm, T, pts: [[r3(over[0] + dx * 1.5), r3(over[1] + dy)], over, drop] } });
      }
      for (const settle of [0.4, 0.8]) out.push({ ...x, prm: { ...x.prm, settle } });
      return out;
    }
    if (x.a !== 'move') return [x];
    let prms = [x.prm, { ...x.prm, top: true }, ...G2, ...G2.map((p) => ({ ...p, top: true }))];
    if (wide) { const a = around(x.k, x.sid, { N: 5, T: [0.6, 1.0, 1.4] }); prms = [...prms, ...a, ...a.map((p) => ({ ...p, top: true }))]; }
    return moves(x.k, x.sid, prms);
  };

  /**
   * The acts of an older plan played again, each tried anew and the best
   * kept; when one can no longer be done, back to the act before and its next
   * best, and so on. In the background, an act at a time; `polished` says how
   * far it got.
   */
  const polished = { at: 0, of: 0, perfect: 0, back: 0, failed: null as Act | null, done: false };
  const polish = (old: Act[], from = 0) => {
    Object.assign(polished, { at: from, of: old.length, perfect: 0, back: 0, failed: null, done: false });
    const stack: { tries: any[]; k: number; before: any }[] = [];
    const next = () => {
      const i = polished.at;
      if (i >= old.length) { polished.done = true; sync(game); keep(); return; }
      const before = mark();
      let tries = ranked(instead(old[i], false));
      if (!tries.length) tries = ranked(instead(old[i], true));
      if (tries.length) {
        stack.push({ tries, k: 0, before });
        // (going back so far is enough: what lies further back is let go)
        if (stack.length > 5) stack.splice(0, stack.length - 5);
        back(tries[0].end); plan.push(tries[0].x); polished.at++; keep(); setTimeout(next, 0); return; }
      // nothing works: the act before, done its next best way
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (++top.k < top.tries.length) { back(top.tries[top.k].end); plan.push(top.tries[top.k].x); polished.back++; setTimeout(next, 0); return; }
        stack.pop(); back(top.before); polished.at--;
      }
      polished.failed = old[i]; polished.done = true; sync(game);
    };
    setTimeout(next, 0);
    return polished;
  };

  /**
   * How hard each act of a plan is, played along it: from where the act
   * starts, how many moves of a broad family get there (`broad`: quick
   * curves and swings through a grid of points), how many of the act a
   * little off still do (`jitter`: begun up to 0.3 s late, faster or slower,
   * aimed 3 cm off), and whether only a swing (down first) gets there. A
   * player has as much room as these leave.
   */
  const measure = (acts: Act[], log: (row: any) => void = () => {}) => {
    const rows = [];
    for (const [i, x] of acts.entries()) {
      if (x.a === 'move' || x.a === 'drape') {
        const b = mark(), tally = (list: Act[]) => { let n = 0; for (const y of list) { if (act(y).ok) n++; back(b); } return n; };
        let quick = 0, swing = 0, broad = 0, jitter = 0, nj = 0;
        if (x.a === 'move') {
          quick = tally(moves(x.k, x.sid, G2));
          swing = tally(moves(x.k, x.sid, around(x.k, x.sid, { N: 5, T: [0.6, 1.0, 1.4] })));
          broad = (quick + swing) / (G2.length + 75);
          const off: Prm[] = [];
          for (const w of [0.1, 0.2, 0.3]) off.push({ ...x.prm, wait: (x.prm.wait ?? 0) + w });
          for (const f of [0.8, 1.25]) off.push({ ...x.prm, T: x.prm.T * f });
          for (const [dx, dy] of [[0.03, 0], [-0.03, 0], [0, 0.03], [0, -0.03]]) off.push({ ...x.prm, ax: (x.prm.ax ?? 0) + dx, ay: (x.prm.ay ?? 0) + dy });
          jitter = tally(moves(x.k, x.sid, off)); nj = off.length;
        } else {
          const all = instead(x, false);
          broad = tally(all) / all.length;
          const off: Act[] = [];
          for (const [dx, dy] of [[0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]]) off.push({ ...x, prm: { ...x.prm, pts: x.prm.pts!.map(([px, py]) => [px + dx, py + dy]) } });
          for (const f of [0.8, 1.25]) off.push({ ...x, prm: { ...x.prm, T: x.prm.T * f } });
          for (const h of [0, 0.3]) off.push({ ...x, prm: { ...x.prm, hold: (x.prm.hold ?? 0) + h } });
          jitter = tally(off); nj = off.length;
        }
        const course = game.climb.course, at = typeof x.sid === 'object' ? tc(x.sid) : tc(x.sid);
        const sec = course.section(course.at(at.y));
        const what = typeof x.sid === 'object' ? game.world.cords[x.sid.c].key.split(' ')[0] : game.world.surfaces[x.sid].mat;
        const row = { i, a: x.a, end: x.k ? 'queue' : 'tête', what, y: r3(at.y), floor: sec.floor, section: sec.name, broad: r3(broad), quick, swing, jitter: `${jitter}/${nj}`, swingOnly: x.a === 'move' && quick === 0 && swing > 0 };
        rows.push(row); log(row);
      }
      const r = act(x);
      if (!r.ok) { log({ i, failed: true }); break; }
      plan.push(x);
    }
    sync(game);
    return rows;
  };

  const start0 = mark();
  const api = { measure, ranked, instead, sync: () => sync(game), polish, polished, setPerfect: (v: number) => { PERFECT = v; }, game, log, plan, step, mark, back, act, best, grid, around, moves, reach, G2, tc, redo, undo, watch, info, start0, DT };
  Object.assign(window, { pilot: api });
  return api;
}
