// What a level looks like: the room, its bars, shelves, eyelets, gates, the
// switches of its pulls, the hooks its cords hang from, its buttons, what
// harms the lace (blades, flames, water). Built
// in a group of its own, dropped as a whole when the course builds its next
// window.
//
// The room itself (its walls, what hangs on them, the sky beyond) is the
// decor's (decor.ts), floor by floor. The wood of the bars and shelves takes
// the floor's look; the rest keeps its own, the same on every floor, so that
// what can be gripped is always told at a glance.

import * as THREE from 'three/webgpu';
import type { Storey } from '../gen/course';
import { MATS, ROOM, type Level, type Mat, type Ring } from '../level/level';
import { HAND, HANDLE, handleAt, ringFrame, SPOOL, spoolAt } from '../level/surfaces';
import { BEAM } from '../play/rules';
import { art } from './paint';
import { tsl } from './tsl';
import type { Rules } from '../play/rules';
import type { World } from '../sim/world';
import { PLAY } from '../tuning';
import { Decor, keeps, theme } from './decor';

const BUTTON_COLORS = ['#e35d6a', '#4f8fe0', '#f2c14e', '#5fbf7a', '#a06ad8'];

// shared by every build: only geometries, and the materials that light up, are made per build
const MAT = Object.fromEntries(Object.entries(MATS).map(([k, m]) => [k, new THREE.MeshStandardMaterial({ color: m.color, metalness: m.metalness, roughness: m.roughness })])) as Record<Mat, THREE.MeshStandardMaterial>;
const FLOOR = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.8 });
const FLAG = new THREE.MeshStandardMaterial({ color: '#e2b13c', emissive: '#3a2a00' });
const HOOK = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.35 });
const PIN = new THREE.MeshStandardMaterial({ color: '#8d8f93', metalness: 0.9, roughness: 0.3 });
const HOLE = new THREE.MeshStandardMaterial({ color: '#2a1e18' });
/** what harms the lace: blades, flames, water */
const BLADE = new THREE.MeshStandardMaterial({ color: '#3b3f45', metalness: 0.9, roughness: 0.25 });
// (a flame is brighter than white: it glows)
const FLAME = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.35), transparent: true, opacity: 0.9 });
const WATER = new THREE.MeshBasicMaterial({ color: '#4aa3ff', transparent: true, opacity: 0.35, depthWrite: false });
/** the new things: a coat hook, a zip line's spool, a lamp's shade and its beam (past white), a lift's weight and handle, a radiator, a vent, the draughts */
const HOOK_SHAFT = new THREE.CylinderGeometry(0.009, 0.009, 0.15, 12).rotateX(Math.PI / 2);
const HOOK_TIP = new THREE.SphereGeometry(0.011, 12, 8).scale(1, 3.2, 1);
const HOOK_PLATE = new THREE.CylinderGeometry(0.024, 0.024, 0.008, 18).rotateX(Math.PI / 2);
const SPOOL_CORE = new THREE.CylinderGeometry(SPOOL.r, SPOOL.r, 0.1, 18);
const SPOOL_FLANGE = new THREE.CylinderGeometry(SPOOL.r * 1.6, SPOOL.r * 1.6, 0.008, 18);
const SEARCH_SHADE = new THREE.CylinderGeometry(0.02, 0.045, 0.07, 20, 1, true).translate(0, -0.012, 0);
const BEAM_BULB = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.4, 4.2), side: THREE.DoubleSide });
/** the beam: a haze of light, soft at its edges (where the cone is seen edge on), fading as it goes */
const BEAM_CONE = (() => {
  const { abs, dot, normalView, positionView, pow, uniform, uv } = tsl;
  const m = new THREE.MeshBasicNodeMaterial({ color: '#fff2d8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const strength = uniform(0.08);
  m.opacityNode = strength.mul(pow(abs(dot(normalView, positionView.normalize())), 2.5)).mul(pow(uv().y, 1.6));
  m.userData.strength = strength;
  return m;
})();
const LIFT_WEIGHT = new THREE.CylinderGeometry(0.022, 0.026, 0.055, 16);
const LIFT_HANDLE = new THREE.CylinderGeometry(HANDLE.r, HANDLE.r, 0.1, 12);
const LIFT_CORD = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6).translate(0, -0.5, 0);
const LIFT_ROPE = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.9 });
const LEAD = new THREE.MeshStandardMaterial({ color: '#4a4c50', metalness: 0.6, roughness: 0.55 });
const RADIATOR_FIN = new THREE.BoxGeometry(0.022, 0.2, 0.05);
const RADIATOR = new THREE.MeshStandardMaterial({ color: '#cfc6b4', metalness: 0.3, roughness: 0.6 });
const VENT = new THREE.MeshStandardMaterial({ color: '#3a3a3a', metalness: 0.6, roughness: 0.5 });
const STREAK_UP = new THREE.PlaneGeometry(0.004, 0.12);
const STREAK_ACROSS = new THREE.PlaneGeometry(0.12, 0.004);
const STREAK = new THREE.MeshBasicMaterial({ color: '#e8eef8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const SILK = new THREE.MeshBasicMaterial({ color: '#d8d0c4', transparent: true, opacity: 0.7 });
const PLANE_1 = new THREE.PlaneGeometry(1, 1);
/** the face of a clock: cream, its hours marked */
let face: THREE.MeshStandardMaterial | null = null;
function clockFace(): THREE.MeshStandardMaterial {
  if (face) return face;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.stroke();
  g.fillStyle = '#2a2018';
  for (let h = 0; h < 12; h++) { const a = (h / 12) * Math.PI * 2; g.save(); g.translate(128 + 100 * Math.sin(a), 128 - 100 * Math.cos(a)); g.rotate(a); g.fillRect(-3, -10, 6, h % 3 ? 12 : 20); g.restore(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
}

/**
 * The end of each bar, facing us: what tells at a glance what can be
 * gripped. Wood, rubber and gold show a bright face (the end grain, the red,
 * the gold) that glows a little even in the dark; chrome a cold dark one,
 * crossed out, that never glows.
 */
const CAP = new THREE.CircleGeometry(1, 28);
const caps = new Map<string, THREE.MeshStandardMaterial>();
function capOf(mat: Mat, color: string): THREE.MeshStandardMaterial {
  const key = `${mat} ${color}`;
  let m = caps.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, base = new THREE.Color(color);
  if (mat === 'chrome') {
    g.fillStyle = '#5c646e'; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill();
    g.strokeStyle = '#1c2026'; g.lineWidth = 7; g.beginPath(); g.moveTo(16, 16); g.lineTo(48, 48); g.moveTo(48, 16); g.lineTo(16, 48); g.stroke();
  } else {
    // end grain: rings round a heart, the rim darker
    const pale = base.clone().lerp(new THREE.Color('#fff4dc'), mat === 'wood' ? 0.45 : 0.25).getStyle();
    g.fillStyle = pale; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill();
    g.strokeStyle = base.clone().multiplyScalar(0.7).getStyle(); g.lineWidth = 2;
    for (const r of mat === 'wood' ? [8, 15, 22] : [18]) { g.beginPath(); g.arc(32, 32, r, 0, 7); g.stroke(); }
    g.lineWidth = 5; g.strokeStyle = base.clone().multiplyScalar(0.55).getStyle(); g.beginPath(); g.arc(32, 32, 28.5, 0, 7); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: mat === 'chrome' ? '#000000' : '#ffffff', emissiveMap: mat === 'chrome' ? null : t, emissiveIntensity: mat === 'gold' ? 0.5 : 0.28 });
  caps.set(key, m);
  return m;
}
/** in the sky, a bar hangs from two ropes that fade out above it, like a swing */
const ROPE_UP = new THREE.PlaneGeometry(0.004, 0.7).translate(0, 0.35, 0);
const ROPE = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d')!, gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  return new THREE.MeshStandardMaterial({ color: '#e8dcc4', alphaMap: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, roughness: 0.9 });
})();
/** a trapdoor's hinges, its ring of a handle, the slit of light under it */
const HINGE = new THREE.CylinderGeometry(0.009, 0.009, 0.03, 12).rotateZ(Math.PI / 2);
const HANDLE_RING = new THREE.TorusGeometry(0.014, 0.0035, 8, 20);
const SLIT = new THREE.PlaneGeometry(1, 0.004);
const IRON = new THREE.MeshStandardMaterial({ color: '#2e2a26', metalness: 0.7, roughness: 0.45 });

/** the marks that tie a trapdoor to its key */
const MARK = new THREE.CircleGeometry(0.014, 20);
const MARKS = ['#2fd3c4', '#e04fd3', '#f2e14e', '#7a6cff'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
/** the wood of each floor: its bars, its planks */
const woods = new Map<string, THREE.MeshStandardMaterial>();
const wood = (color: string) => {
  let m = woods.get(color);
  if (!m) woods.set(color, (m = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: MATS.wood.roughness })));
  return m;
};

export class Scenery {
  readonly group = new THREE.Group();
  /** the mesh of each gold bar (a post), by its index among the bars */
  readonly posts = new Map<number, THREE.Mesh>();
  /** the mesh of each bar (those that move are moved) */
  private bars: THREE.Mesh[] = [];
  /** what harms the lace, and what moves of it (a blade's two halves, a flame) */
  private hazards: { kind: string; parts: THREE.Mesh[]; all: THREE.Mesh[]; at: { x: number; y: number } }[] = [];
  /** each trapdoor's hinges and handle, its slit of light: they go as it opens */
  private gateBits: { bits: THREE.Object3D[]; slit: THREE.Mesh }[] = [];
  readonly buttons: THREE.Group[] = [];
  readonly rings: THREE.Mesh[] = [];
  readonly gates: THREE.Mesh[] = [];
  /** the switch box of each pull, which lights when it clicks */
  readonly pulls: THREE.Mesh[] = [];
  readonly decor: Decor;
  /** what moves of the new things: the spools, the clock hands, the lamps' heads and beams, the weights and handles of the lifts, the draughts, the spider */
  private spools: THREE.Group[] = [];
  private hands: THREE.Mesh[][] = [];
  private searchHeads: { head: THREE.Group; beam: THREE.Mesh }[] = [];
  private lifts: { weight: THREE.Mesh; handle: THREE.Mesh; cords: THREE.Mesh[] }[] = [];
  private draughts: { wind: number; streaks: THREE.Mesh[] }[] = [];
  private spider: THREE.Group | null = null;

  /** the scenery of level L, the window of the course whose sections are `storeys` (course `seed`); `best`: the highest the lace has been */
  constructor(scene: THREE.Scene, L: Level, storeys: Storey[], seed: number, best: number) {
    const add = <T extends THREE.Object3D>(m: T, shadows = true): T => {
      if (shadows) m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    // the wall behind a clock and over a radiator is the level's: the decor hangs nothing there
    const avoid = [
      ...L.clocks.map((c) => ({ x0: c.x - c.length - 0.06, y0: c.y - c.length - 0.06, x1: c.x + c.length + 0.06, y1: c.y + c.length + 0.06 })),
      ...L.winds.filter((w) => Math.abs(w.vy) > Math.abs(w.vx)).map((w) => ({ x0: w.x0, y0: w.y0 - 0.25, x1: w.x1, y1: w.y0 + 0.05 })),
    ];
    this.decor = new Decor(this.group, storeys, seed, L.bottom, L.top, best, avoid);
    const skin = (y: number) => theme(this.decor.floorAt(y));
    if (L.bottom <= 0) add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 2), FLOOR)).position.set(0, -0.15, 0.5);

    L.bars.forEach((b, k) => {
      const w = b.mat === 'wood' ? skin(b.y).wood : null;
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, 2 * ROOM.z + 0.04, w?.sides ?? 24), b.mat === 'gold' ? MAT.gold.clone() : w ? wood(w.color) : MAT[b.mat]));
      m.rotation.x = Math.PI / 2;
      m.position.set(b.x, b.y, 0);
      this.bars.push(m);
      // its end, facing us: what tells it can be gripped (see CAP)
      const cap = new THREE.Mesh(CAP, capOf(b.mat, w?.color ?? MATS[b.mat].color));
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = ROOM.z + 0.0205;
      cap.scale.setScalar(b.r * 0.94);
      m.add(cap);
      // in the sky, nothing holds it up but two ropes from above
      if (skin(b.y).paper.motif === 'none' && b.mat !== 'gold') {
        for (const z of [-ROOM.z + 0.005, ROOM.z + 0.01]) {
          const rope = new THREE.Mesh(ROPE_UP, ROPE);
          rope.rotation.x = -Math.PI / 2;
          rope.position.set(0, z, -b.r);
          m.add(rope);
        }
      }
      if (b.mat !== 'gold') return;
      this.posts.set(k, m);
      const flag = add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 3), FLAG), false);
      flag.position.set(b.x, b.y + 0.09, -ROOM.z + 0.03);
      flag.rotation.z = -Math.PI / 2;
    });
    for (const s of L.shelves) add(new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, 0.03, 2 * ROOM.z + 0.04), (s.mat ?? 'wood') === 'wood' ? wood(skin(s.y).plank) : MAT[s.mat!])).position.set((s.x0 + s.x1) / 2, s.y - 0.015, 0);
    L.gates.forEach((g, k) => {
      // a trapdoor wears the colour of what opens it, hinged on one side, a ring to lift it by, light showing through its slit
      const mark = MARKS[k % MARKS.length].color, cx = (g.x0 + g.x1) / 2;
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(g.x1 - g.x0, g.y1 - g.y0, 2 * ROOM.z + 0.04), new THREE.MeshStandardMaterial({ color: new THREE.Color(MATS.gate.color).lerp(mark, 0.45), metalness: 0.25, roughness: 0.55 })));
      m.position.set(cx, (g.y0 + g.y1) / 2, 0);
      this.gates.push(m);
      const bits: THREE.Object3D[] = [];
      for (const z of [-0.06, 0.06]) { const h = add(new THREE.Mesh(HINGE, IRON)); h.position.set(g.x0 + 0.02, g.y1 + 0.004, z); bits.push(h); }
      const ring = add(new THREE.Mesh(HANDLE_RING, IRON));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(g.x1 - 0.035, g.y1 + 0.004, ROOM.z - 0.02);
      bits.push(ring);
      const slit = add(new THREE.Mesh(SLIT, new THREE.MeshBasicMaterial({ color: mark.clone().multiplyScalar(2.5), transparent: true, depthWrite: false })), false);
      slit.scale.x = g.x1 - g.x0 - 0.01;
      slit.position.set(cx, g.y0 - 0.002, ROOM.z + 0.025);
      this.gateBits.push({ bits, slit });
    });
    const ring = (g: Ring, tube: number, emissive: string) => {
      const m = add(new THREE.Mesh(new THREE.TorusGeometry(g.r, tube, 12, 40), new THREE.MeshStandardMaterial({ color: '#c7ccd2', metalness: 1, roughness: 0.25, emissive, emissiveIntensity: 0.4 })));
      // a torus lies in its xy plane, its axis along z: turn z onto the ring's axis
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringFrame(g).n);
      m.position.set(g.x, g.y, 0);
      return m;
    };
    for (const g of L.rings) this.rings.push(ring(g, 0.008, '#000000'));
    for (const p of L.pulls) {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: '#3a3f46' })));
      m.position.set(p.x, p.top - 0.01, 0);
      this.pulls.push(m);
    }

    for (const h of L.hazards) {
      const w = h.x1 - h.x0, ht = h.y1 - h.y0, cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2, parts: THREE.Mesh[] = [], before = this.group.children.length;
      if (h.kind === 'blade') {
        // the two blades of a pair of scissors, crossed, opening and shutting
        for (const s of [-1, 1]) {
          const m = add(new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(w, ht), 0.012, 0.02), BLADE));
          m.position.set(cx, cy, 0);
          m.userData.tilt = s * Math.atan2(ht, w);
          parts.push(m);
        }
      } else if (h.kind === 'flame') {
        const m = add(new THREE.Mesh(new THREE.ConeGeometry(w / 2, ht, 16), FLAME), false);
        m.position.set(cx, cy, 0);
        parts.push(m);
      } else add(new THREE.Mesh(new THREE.BoxGeometry(w, ht, 2 * ROOM.z), WATER), false).position.set(cx, cy, 0);
      this.hazards.push({ kind: h.kind, parts, all: this.group.children.slice(before) as THREE.Mesh[], at: { x: cx, y: cy } });
    }
    // smoke over the flames (and over the decor's candles)
    this.decor.smokeFrom(L.hazards.filter((h) => h.kind === 'flame').map((h) => ({ x: (h.x0 + h.x1) / 2, y: h.y1 })));

    this.things(L, add);

    // each trapdoor and what opens it wear the same mark: a dot of one colour, on the glass side
    L.gates.forEach((g, k) => {
      const mat = MARKS[k % MARKS.length];
      const mark = (x: number, y: number) => add(new THREE.Mesh(MARK, mat), false).position.set(x, y, ROOM.z - 0.005);
      mark((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2);
      for (const r of g.rings ?? []) mark(L.rings[r].x, L.rings[r].y + L.rings[r].r + 0.025);
      for (const q of g.pulls ?? []) mark(L.pulls[q].x + 0.06, L.pulls[q].top - 0.01);
      if (g.post !== undefined) mark(L.bars[g.post].x, L.bars[g.post].y + L.bars[g.post].r + 0.03);
    });

    // what the cords hang from (only drawn: the cords are pinned there)
    const knob = (x: number, y: number, mat: THREE.Material) => add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), mat), false).position.set(x, y, 0);
    for (const h of [...L.hangs, ...L.skeins]) knob(h.x, h.top + 0.004, PIN);
    for (const l of L.lines) { knob(l.x0, l.y0, HOOK); knob(l.x1, l.y1, HOOK); }
    for (const n of L.nets) {
      for (const y of n.tied ? [n.top + 0.02, n.bottom - 0.02] : [n.top + 0.02]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(n.x1 - n.x0 + 0.06, 0.025, 0.04), MAT.wood)).position.set((n.x0 + n.x1) / 2, y, 0);
      }
    }

    L.buttons.forEach(([x, y], k) => {
      const g = new THREE.Group(), color = BUTTON_COLORS[k % BUTTON_COLORS.length];
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.007, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.25 }));
      disc.rotation.x = Math.PI / 2;
      g.add(disc);
      for (const [hx, hy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const h = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 10), HOLE);
        h.position.set(hx * 0.007, hy * 0.007, 0.0036);
        g.add(h);
      }
      g.position.set(x, y, 0);
      this.buttons.push(add(g, false));
    });
    scene.add(this.group);
  }

  /** the hooks, the zip lines, the clocks, the searching lamps, the lifts, the draughts, the spider of the webs */
  private things(L: Level, add: <T extends THREE.Object3D>(m: T, shadows?: boolean) => T): void {
    for (const h of L.hooks) {
      const g = add(new THREE.Group());
      const shaft = new THREE.Mesh(HOOK_SHAFT, MAT.hook), tip = new THREE.Mesh(HOOK_TIP, MAT.hook), plate = new THREE.Mesh(HOOK_PLATE, MAT.hook);
      shaft.position.set(0, 0, -0.03); tip.position.set(0, 0.018, 0.055); tip.rotation.x = 0.7; plate.position.set(0, 0, -ROOM.z + 0.003);
      for (const m of [shaft, tip, plate]) { m.castShadow = m.receiveShadow = true; g.add(m); }
      g.position.set(h.x, h.y, 0);
    }
    for (const z of L.zips) {
      const dx = z.x1 - z.x0, dy = z.y1 - z.y0, l = Math.hypot(dx, dy);
      const wire = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, l, 6), MAT.wire));
      wire.position.set((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2, 0);
      wire.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      for (const [x, y] of [[z.x0, z.y0], [z.x1, z.y1]]) add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.2), MAT.hook)).position.set(x, y, -0.02);
      const spool = add(new THREE.Group());
      const core = new THREE.Mesh(SPOOL_CORE, wood('#8a5a33')), block = new THREE.Mesh(new THREE.BoxGeometry(0.012, SPOOL.below + 0.01, 0.012), MAT.hook);
      core.rotation.x = Math.PI / 2;
      block.position.set(0, SPOOL.below / 2, 0);
      spool.add(core, block);
      for (const zz of [-0.05, 0.05]) { const f = new THREE.Mesh(SPOOL_FLANGE, wood('#6b4428')); f.rotation.x = Math.PI / 2; f.position.z = zz; spool.add(f); }
      for (const c of spool.children) c.castShadow = true;
      const p = spoolAt(z, 0);
      spool.position.set(p.x, p.y, 0);
      this.spools.push(spool);
    }
    for (const c of L.clocks) {
      const arms = c.arms ?? 1;
      // a clock has its face; a wheel of blades (a fan), only its hub
      if (arms === 1) {
        const face = add(new THREE.Mesh(new THREE.CircleGeometry(c.length + 0.05, 48), clockFace()), false);
        face.position.set(c.x, c.y, -ROOM.z + 0.002);
        face.receiveShadow = true;
      }
      const hands: THREE.Mesh[] = [];
      for (let j = 0; j < arms; j++) {
        const hand = add(new THREE.Mesh(new THREE.BoxGeometry(2 * HAND.r, c.length, HAND.z[2] - HAND.z[0] + 2 * HAND.r), MAT.brass));
        hand.geometry.translate(0, c.length / 2, 0);
        hand.position.set(c.x, c.y, 0);
        hand.userData.arm = (2 * Math.PI * j) / arms;
        hands.push(hand);
      }
      this.hands.push(hands);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 16).rotateX(Math.PI / 2), MAT.brass)).position.set(c.x, c.y, 0);
    }
    for (const q of L.searches) {
      const head = add(new THREE.Group(), false);
      const shade = new THREE.Mesh(SEARCH_SHADE, MAT.hook), bulb = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), BEAM_BULB);
      shade.castShadow = true;
      bulb.rotation.x = Math.PI / 2; bulb.position.y = -0.045;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(BEAM.half) * BEAM.reach, BEAM.reach, 32, 1, true).translate(0, -BEAM.reach / 2, 0), BEAM_CONE);
      beam.renderOrder = 2;
      head.add(shade, bulb, beam);
      head.position.set(q.x, q.y, 0.02);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 6), MAT.hook), false).position.set(q.x, q.y + 0.13, 0.02);
      this.searchHeads.push({ head, beam });
    }
    for (const _ of L.lifts) {
      const weight = add(new THREE.Mesh(LIFT_WEIGHT, LEAD)), handle = add(new THREE.Mesh(LIFT_HANDLE, wood('#7a4e2c')));
      handle.rotation.x = Math.PI / 2;
      // the cord, down either side of the pulley: to the handle, to the weight
      const cords = [0, 1].map(() => add(new THREE.Mesh(LIFT_CORD, LIFT_ROPE)));
      this.lifts.push({ weight, handle, cords });
    }
    L.winds.forEach((w, k) => {
      const up = Math.abs(w.vy) > Math.abs(w.vx), streaks: THREE.Mesh[] = [];
      if (up) {
        // a radiator under the warm air: its fins, painted white long ago
        const r = add(new THREE.Group());
        const width = Math.min(0.4, w.x1 - w.x0);
        for (let x = -width / 2; x <= width / 2 + 1e-6; x += 0.035) { const fin = new THREE.Mesh(RADIATOR_FIN, RADIATOR); fin.position.x = x; fin.castShadow = fin.receiveShadow = true; r.add(fin); }
        r.position.set((w.x0 + w.x1) / 2, w.y0 - 0.1, -ROOM.z + 0.03);
      } else {
        // a vent in the side wall, where the draught comes from
        const vent = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, Math.min(0.3, w.y1 - w.y0), 0.16), VENT));
        vent.position.set(w.vx > 0 ? -ROOM.x + 0.01 : ROOM.x - 0.01, (w.y0 + w.y1) / 2, 0);
      }
      for (let j = 0; j < 7; j++) {
        const m = add(new THREE.Mesh(up ? STREAK_UP : STREAK_ACROSS, STREAK.clone()), false);
        m.userData = { u: j / 7, v: Math.random(), z: (Math.random() - 0.5) * 0.16 };
        m.renderOrder = 2;
        streaks.push(m);
      }
      this.draughts.push({ wind: k, streaks });
    });
    if (L.nets.some((n) => n.sticky)) {
      const g = add(new THREE.Group(), false), body = new THREE.Mesh(PLANE_1, new THREE.MeshStandardMaterial({ map: art('spider').tex, transparent: true, alphaTest: 0.2, roughness: 0.8 }));
      body.scale.set(0.05, 0.05, 1);
      const silk = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 1, 4).translate(0, 0.5, 0), SILK);
      g.add(body, silk);
      g.visible = false;
      this.spider = g;
    }
  }

  /** the new things where the world has them now */
  private moveThings(rules: Rules, world: World, now: number): void {
    const L = world.level;
    this.spools.forEach((g, k) => { const z = L.zips[k], len = Math.hypot(z.x1 - z.x0, z.y1 - z.y0), p = spoolAt(z, world.spools[k].d / len); g.position.set(p.x, p.y, 0); g.children[0].rotation.y = world.spools[k].d / SPOOL.r; });
    this.hands.forEach((arms, k) => { for (const m of arms) m.rotation.z = -world.hands[k] - m.userData.arm; });
    this.searchHeads.forEach(({ head, beam }, k) => {
      head.rotation.z = rules.beams[k] ?? 0;
      (beam.material as THREE.Material).userData.strength.value = 0.07 + 0.05 * rules.dazzle;
    });
    this.lifts.forEach(({ weight, handle, cords }, k) => {
      const l = L.lifts[k], b = L.bars[l.bar], d = world.lifts[k].d, p = handleAt(L, l, d);
      const wx = b.x - l.side * (b.r + 0.004), wy = b.y - 0.1 - d;
      handle.position.set(p.x, p.y, 0);
      weight.position.set(wx, wy - 0.03, 0);
      // (a cord of unit length, from its top down)
      cords[0].position.set(p.x, b.y, 0); cords[0].scale.y = Math.max(0.001, b.y - p.y - HANDLE.r);
      cords[1].position.set(wx, b.y, 0); cords[1].scale.y = Math.max(0.001, b.y - wy);
    });
    this.draughts.forEach(({ wind, streaks }) => {
      const w = L.winds[wind], g = world.gusts[wind], up = Math.abs(w.vy) > Math.abs(w.vx);
      for (const m of streaks) {
        const d = m.userData as { u: number; v: number; z: number };
        const u = (d.u + now * 0.35 * Math.hypot(w.vx, w.vy)) % 1;
        if (up) m.position.set(w.x0 + (w.x1 - w.x0) * d.v + 0.02 * Math.sin(now * 3 + d.v * 9), w.y0 + (w.y1 - w.y0) * u, d.z);
        else m.position.set(w.vx > 0 ? w.x0 + (w.x1 - w.x0) * u : w.x1 - (w.x1 - w.x0) * u, w.y0 + (w.y1 - w.y0) * d.v + 0.015 * Math.sin(now * 4 + d.v * 7), d.z);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.16 * g * Math.sin(Math.PI * u);
      }
    });
    // the spider comes down its silk to the lace stuck in its web
    if (this.spider) {
      const stuck = rules.stuck[0], web = L.nets.find((n) => n.sticky)!;
      this.spider.visible = !!stuck && rules.stuckTime > 1;
      if (stuck && this.spider.visible) {
        const x = world.sim.x, t = Math.min(1, (rules.stuckTime - 1) / (PLAY.spiderAfter - 1));
        const sx = x[3 * stuck.lace], sy = x[3 * stuck.lace + 1], top = web.top + 0.15, y = top + (sy + 0.03 - top) * t;
        this.spider.position.set(sx, y, 0.06);
        const silk = this.spider.children[1];
        silk.scale.y = Math.max(0.001, top - y);
      }
    }
  }

  /** what the rules say, shown: eyelets threaded glow, gates light up as they near opening and slide away, pulls and posts light, buttons taken go */
  update(rules: Rules, world: World, t: number, dt: number): void {
    const now = performance.now() / 1000;
    for (const m of world.level.movers) { const p = world.barAt(m.bar, t); this.bars[m.bar].position.set(p.x, p.y, 0); }
    this.hazards.forEach((h, k) => {
      const box = world.hazardAt(k, t), dx = (box.x0 + box.x1) / 2 - h.at.x, dy = (box.y0 + box.y1) / 2 - h.at.y;
      if (dx || dy) { for (const m of h.all) m.position.set(m.userData.x ??= m.position.x, m.userData.y ??= m.position.y, m.position.z).add(new THREE.Vector3(dx, dy, 0)); }
      if (h.kind === 'blade') h.parts.forEach((m) => (m.rotation.z = m.userData.tilt * (0.6 + 0.4 * Math.abs(Math.sin(now * 4)))));
      else if (h.kind === 'flame') h.parts[0].scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(now * 13) * Math.sin(now * 7)), 1);
    });
    this.rings.forEach((m, k) => (m.material as THREE.MeshStandardMaterial).emissive.set(rules.threaded[k] ? '#2fbf5a' : '#000000'));
    this.gates.forEach((m, k) => {
      const lit = rules.progress(k), mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(MARKS[k % MARKS.length].color).multiplyScalar(0.12 + 0.5 * lit);
      m.scale.x = Math.max(0.001, Math.min(1, m.scale.x + (rules.isOpen(k) ? -dt * 1.5 : dt * 3)));
      const { bits, slit } = this.gateBits[k], shut = m.scale.x > 0.5;
      for (const b of bits) b.visible = shut;
      slit.visible = shut;
      (slit.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * lit * (0.75 + 0.25 * Math.sin(now * 6));
    });
    this.pulls.forEach((m, k) => (m.material as THREE.MeshStandardMaterial).emissive.set(rules.pulled[k] >= PLAY.pullTime ? '#f2c14e' : rules.pulled[k] > 0 ? '#6a4a00' : '#000000'));
    this.posts.forEach((m, k) => (m.material as THREE.MeshStandardMaterial).emissive.set(rules.isSaved(k) ? '#6a4a00' : '#000000'));
    this.moveThings(rules, world, now);
    this.buttons.forEach((b, k) => {
      b.visible = !rules.isTaken(k);
      b.rotation.y = Math.sin(now * 1.7 + k) * 0.6;
    });
  }

  /** takes it out of the scene, and frees what was made for it */
  dispose(): void {
    this.group.removeFromParent();
    this.decor.dispose();
    const shared = new Set<THREE.Material>([...Object.values(MAT), FLOOR, FLAG, HOOK, PIN, HOLE, BLADE, FLAME, WATER, ...MARKS, ...woods.values(), BEAM_BULB, BEAM_CONE, LEAD, LIFT_ROPE, RADIATOR, VENT, SILK, ...(face ? [face] : []), ...caps.values(), ROPE, IRON]);
    const kept = new Set<THREE.BufferGeometry>([HOOK_SHAFT, HOOK_TIP, HOOK_PLATE, SPOOL_CORE, SPOOL_FLANGE, SEARCH_SHADE, LIFT_WEIGHT, LIFT_HANDLE, LIFT_CORD, RADIATOR_FIN, STREAK_UP, STREAK_ACROSS, PLANE_1, CAP, ROPE_UP, HINGE, HANDLE_RING, SLIT]);
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.geometry !== MARK && !kept.has(o.geometry) && !keeps(o.geometry)) o.geometry.dispose();
      if (!shared.has(o.material) && !keeps(o.material)) (o.material as THREE.Material).dispose();
    });
  }
}
