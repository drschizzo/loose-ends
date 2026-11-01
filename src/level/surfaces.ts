// A level's static shapes, as the solver collides with them and as an end of
// the lace grips them: where on a surface an end would hold, how far it is.

import * as THREE from 'three';
import type { StaticShape } from '@drschizzo/avbd-cables';
import { LACE } from '../tuning';
import { MATS, ROOM, type Level, type Mat, type Ring } from './level';

/** a static shape, and what it is in the level: the bar, gate or ring it belongs to (or −1) */
export interface Surface { shape: StaticShape; mat: Mat; bar: number; gate: number; ring: number }

/** the axis of a ring, and two directions across it */
export function ringFrame(g: Ring): { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 } {
  const t = g.turn ?? 0;
  const n = g.up ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(Math.cos(t), 0, Math.sin(t));
  const u = g.up ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3().crossVectors(n, u);
  return { n, u, v };
}

/** the static shapes of a level, in order: what the solver collides with, what the lace may grip */
export function surfaces(L: Level): Surface[] {
  const out: Surface[] = [];
  const box = (min: [number, number, number], max: [number, number, number], mat: Mat, gate = -1) =>
    out.push({ shape: { kind: 'box', min, max, mu: MATS[mat].mu }, mat, bar: -1, gate, ring: -1 });
  // no bigger than the room: the solver files static shapes in a grid of small
  // cells, and a box costs as many as it covers (each time a gate opens, too)
  const y0 = L.bottom - 1, y1 = L.top + 1, X = ROOM.x + 0.1, Z = ROOM.z + 0.1, T = 0.1;
  box([-X, -T, -Z], [X, 0, Z], 'floor');                                     // the floor
  box([-X, y0, -Z], [-ROOM.x, y1, Z], 'wall');                              // the sides
  box([ROOM.x, y0, -Z], [X, y1, Z], 'wall');
  box([-X, y0, -Z], [X, y1, -ROOM.z], 'wall');                              // the wall at the back
  box([-X, y0, ROOM.z], [X, y1, Z], 'wall');                                // the glass at the front
  L.bars.forEach((b, k) => out.push({
    shape: { kind: 'capsule', ax: b.x, ay: b.y, az: -ROOM.z - 0.02, bx: b.x, by: b.y, bz: ROOM.z + 0.02, r: b.r, mu: MATS[b.mat].mu },
    mat: b.mat, bar: k, gate: -1, ring: -1,
  }));
  for (const s of L.shelves) box([s.x0, s.y - 0.03, -ROOM.z - 0.02], [s.x1, s.y, ROOM.z + 0.02], s.mat ?? 'wood');
  L.gates.forEach((g, k) => box([g.x0, g.y0, -ROOM.z - 0.02], [g.x1, g.y1, ROOM.z + 0.02], 'gate', k));
  const ring = (g: Ring, k: number, rr: number) => {
    const { u, v } = ringFrame(g), n = 18;
    for (let j = 0; j < n; j++) {
      const a = (2 * Math.PI * j) / n, b = (2 * Math.PI * (j + 1)) / n;
      const p = (t: number) => [g.x + g.r * (Math.cos(t) * u.x + Math.sin(t) * v.x), g.y + g.r * (Math.cos(t) * u.y + Math.sin(t) * v.y), g.r * (Math.cos(t) * u.z + Math.sin(t) * v.z)];
      const [ax, ay, az] = p(a), [bx, by, bz] = p(b);
      out.push({ shape: { kind: 'capsule', ax, ay, az, bx, by, bz, r: rr, mu: MATS.eyelet.mu }, mat: 'eyelet', bar: -1, gate: -1, ring: k });
    }
  };
  L.rings.forEach((g, k) => ring(g, k, 0.008));
  return out;
}

/**
 * Where on a static shape an end at p would hold (its centre, a lace's radius
 * off the surface, at the depth it is), how far p is from the surface, and how
 * much the surface there faces up (the normal's y).
 */
export function snap(s: Surface, px: number, py: number, pz: number): { x: number; y: number; z: number; d: number; ny: number } | null {
  const sh = s.shape, r = LACE.radius + 0.0005;
  if (sh.kind === 'capsule') {
    const ux = sh.bx - sh.ax, uy = sh.by - sh.ay, uz = sh.bz - sh.az;
    const t = Math.max(0, Math.min(1, ((px - sh.ax) * ux + (py - sh.ay) * uy + (pz - sh.az) * uz) / (ux * ux + uy * uy + uz * uz)));
    const cx = sh.ax + t * ux, cy = sh.ay + t * uy, cz = sh.az + t * uz;
    const dx = px - cx, dy = py - cy, dz = pz - cz, l = Math.hypot(dx, dy, dz);
    if (l < 1e-6) return null;
    const k = (sh.r + r) / l;
    return { x: cx + dx * k, y: cy + dy * k, z: cz + dz * k, d: l - sh.r - LACE.radius, ny: dy / l };
  }
  const qx = Math.max(sh.min[0], Math.min(sh.max[0], px));
  const qy = Math.max(sh.min[1], Math.min(sh.max[1], py));
  const qz = Math.max(sh.min[2], Math.min(sh.max[2], pz));
  const dx = px - qx, dy = py - qy, dz = pz - qz, l = Math.hypot(dx, dy, dz);
  if (l < 1e-6) return null;
  return { x: qx + (dx * r) / l, y: qy + (dy * r) / l, z: qz + (dz * r) / l, d: l - LACE.radius, ny: dy / l };
}
