// The cords of a level, as the solver builds them: where their nodes are,
// what is pinned, what is knotted to what. Plain geometry, nothing built yet.

import type { CableInit } from '@drschizzo/avbd-cables';
import { placeKey, type Level } from '../level/level';
import { BRAIDED, LAID } from '../view/laceMaterial';
import { LACE, VINE } from '../tuning';

/** what a cord is, beyond its nodes: how it looks, what holds it, what it does */
export interface Cord {
  /** the same cord from one build of the level to the next (see `placeKey`) */
  key: string;
  color: string;
  /** its weave (see laceMaterial) */
  tag: number;
  segment: number;
  /** its first node is pinned where it is built, and its last too */
  pinFirst: boolean;
  pinLast: boolean;
  /** the pull it is, if any: its first node is held by a stiff spring, which feels what hangs on it */
  pull?: number;
}

/** the cords of a level: the lace first (cable 0), then the others; knots tie a node of a cord to a node of another */
export interface CordSet {
  defs: CableInit[];
  cords: Cord[];
  /** [cord, node along it, cord, node along it] */
  knots: [number, number, number, number][];
}

/** how many nodes the lace has, whole */
export const LACE_NODES = Math.round(LACE.length / LACE.segment) + 1;

/** the lace lying on the start of a level, back and forth if the room is too narrow for it */
export function lyingLace(L: Level): number[] {
  const n = LACE_NODES, p: number[] = [];
  let x = L.start.x0, y = L.start.y + LACE.radius + 0.002, dir = 1;
  for (let k = 0; k < n; k++) {
    p.push(x, y, 0);
    const nx = x + dir * LACE.segment;
    if (nx > L.start.x1 || nx < L.start.x0) { dir = -dir; y += 2.4 * LACE.radius; } else x = nx;
  }
  return p;
}

/** the nodes of a lace cut shorter, made whole again: what was cut grows back hanging down from its last node */
export function regrown(points: ArrayLike<number>): number[] {
  const p = Array.from(points);
  for (let k = p.length / 3; k < LACE_NODES; k++) p.push(p[p.length - 3], p[p.length - 2] - LACE.segment, p[p.length - 1]);
  return p;
}

/** points along a dense path, `seg` apart */
function resample(d: number[], seg: number): number[] {
  const out = [d[0], d[1], d[2]];
  let px = d[0], py = d[1], pz = d[2];
  for (let i = 3; i < d.length; i += 3) {
    const l = Math.hypot(d[i] - px, d[i + 1] - py, d[i + 2] - pz);
    if (l >= seg) { const f = seg / l; px += (d[i] - px) * f; py += (d[i + 1] - py) * f; pz += (d[i + 2] - pz) * f; out.push(px, py, pz); i -= 3; }
  }
  return out;
}

/** a straight cord from one point to another */
function straight(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, seg = VINE.segment): number[] {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / seg) + 1), p: number[] = [];
  for (let k = 0; k < n; k++) { const t = k / (n - 1); p.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t); }
  return p;
}

/** a line `slack` longer than the gap between its ends, sagging as a parabola */
function sagging(x0: number, y0: number, x1: number, y1: number, slack: number): number[] {
  const gap = Math.hypot(x1 - x0, y1 - y0), path = (d: number) => {
    const p: number[] = [];
    for (let j = 0; j <= 300; j++) { const t = j / 300; p.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 4 * d * t * (1 - t), 0); }
    return p;
  };
  const length = (p: number[]) => { let l = 0; for (let i = 3; i < p.length; i += 3) l += Math.hypot(p[i] - p[i - 3], p[i + 1] - p[i - 2]); return l; };
  let lo = 0, hi = gap;
  for (let k = 0; k < 40; k++) { const d = (lo + hi) / 2; if (length(path(d)) < gap + slack) lo = d; else hi = d; }
  return resample(path(lo), VINE.segment);
}

/** the lace (where `lace` says, or lying on the start) and the cords of level L, `seed` jittering the skeins */
export function cordsOf(L: Level, lace: ArrayLike<number> | null, seed: number): CordSet {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const set: CordSet = { defs: [], cords: [], knots: [] };
  const add = (points: number[], cord: Omit<Cord, 'tag' | 'segment' | 'pinFirst' | 'pinLast'> & Partial<Cord>, def: Partial<CableInit> = {}) => {
    set.defs.push({ points, radius: VINE.radius, mass: VINE.mass, bend: VINE.bend, ...def });
    set.cords.push({ tag: LAID, segment: VINE.segment, pinFirst: false, pinLast: false, ...cord });
    return set.defs.length - 1;
  };
  add(lace ? Array.from(lace) : lyingLace(L), { key: 'lace', color: '#f6f1e7', tag: BRAIDED, segment: LACE.segment },
    { radius: LACE.radius, mass: LACE.mass, bend: LACE.bend, endMass: LACE.endMass, boot: true });

  for (const h of L.hangs) add(straight(h.x, h.top, 0, h.x, h.top - h.length, 0), { key: `hang ${placeKey(h.x, h.top)}`, color: '#a8865a', pinFirst: true });
  for (const k of L.skeins) {
    // loops of yarn hanging from one hook, each its width and its depth, weaving over and under one another
    for (let j = 0; j < k.count; j++) {
      const z0 = -0.07 + (0.14 * j) / (k.count - 1), w = 0.03 + 0.07 * rnd(), ph = rnd() * 6.28, tilt = (rnd() - 0.5) * 0.08;
      const dense: number[] = [];
      for (let q = 0; q <= 400; q++) {
        const t = 0.08 + ((2 * Math.PI - 0.16) * q) / 400, h = k.length / 2;
        dense.push(k.x + w * Math.sin(t) + tilt * (1 - Math.cos(t)), k.top - h * (1 - Math.cos(t)), z0 + 0.004 * Math.sin(t * 2 + ph));
      }
      add(resample(dense, VINE.segment), { key: `skein ${placeKey(k.x, k.top)} ${j}`, color: k.color, pinFirst: true, pinLast: true }, { radius: 0.005, mass: 0.0015, bend: 0.3 });
    }
  }
  for (const d of L.drapes) {
    // a loose cord over a bar: down its left side, over the top, down its right side
    const b = L.bars[d.bar], R = b.r + VINE.radius + 0.0005, seg = VINE.segment, p: number[] = [];
    const n = Math.round(d.length / seg) + 1, arcN = Math.round((Math.PI * R) / seg), left = Math.round((n - arcN) * d.left);
    for (let j = left; j > 0; j--) p.push(b.x - R, b.y - j * seg, 0.02);
    for (let j = 0; j <= arcN; j++) { const a = Math.PI - (Math.PI * j) / arcN; p.push(b.x + R * Math.cos(a), b.y + R * Math.sin(a), 0.02); }
    for (let j = 1; p.length / 3 < n; j++) p.push(b.x + R, b.y - j * seg, 0.02);
    add(p, { key: `drape ${placeKey(b.x, b.y)}`, color: d.color });
  }
  for (const l of L.lines) add(sagging(l.x0, l.y0, l.x1, l.y1, l.slack), { key: `line ${placeKey(l.x0, l.y0)}`, color: l.color ?? '#e8e2d0', pinFirst: true, pinLast: true });
  for (const n of L.nets) {
    // the cords down at the back, those across in front, touching: knotted where they cross
    const zDown = -(VINE.radius + 0.0005), zAcross = VINE.radius + 0.0005, seg = VINE.segment, color = n.color ?? '#c8a46a';
    const xs = Array.from({ length: n.cols }, (_, i) => n.x0 + ((n.x1 - n.x0) * i) / (n.cols - 1));
    const ys = Array.from({ length: n.rows }, (_, j) => n.bottom + 0.06 + ((n.top - n.bottom - 0.16) * j) / Math.max(1, n.rows - 1));
    const down = xs.map((x) => add(straight(x, n.top, zDown, x, n.bottom, zDown), { key: `net ${placeKey(x, n.top)}`, color, pinFirst: true, pinLast: !!n.tied }));
    const reach = n.ladder ? 0 : 0.04;
    for (const y of ys) {
      const across = add(straight(n.x0 - reach, y, zAcross, n.x1 + reach, y, zAcross), { key: `net ${placeKey(n.x0, y)}`, color }, { bend: n.ladder ? 40 : VINE.bend });
      const count = set.defs[across].points.length / 3;
      xs.forEach((x, i) => set.knots.push([down[i], Math.round((n.top - y) / seg), across, Math.round(((x - n.x0 + reach) / (n.x1 - n.x0 + 2 * reach)) * (count - 1))]));
    }
  }
  L.pulls.forEach((p, k) => add(straight(p.x, p.top, 0, p.x, p.top - p.length, 0), { key: `pull ${placeKey(p.x, p.top)}`, color: '#d24a3a', pull: k }, { endMass: 0.006 }));
  return set;
}
