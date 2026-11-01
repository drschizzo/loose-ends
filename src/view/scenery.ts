// What a level looks like: the room, its bars, shelves, eyelets, gates, the
// switches of its pulls, the hooks its cords hang from, its buttons, what
// harms the lace (blades, flames, water). Built
// in a group of its own, dropped as a whole when the course builds its next
// window.
//
// Plain on purpose: what each element is matters, not yet how it looks. The
// materials are all at the top, where a theme would swap them.

import * as THREE from 'three';
import { MATS, ROOM, type Level, type Mat, type Ring } from '../level/level';
import { ringFrame } from '../level/surfaces';
import type { Rules } from '../play/rules';
import type { World } from '../sim/world';
import { PLAY } from '../tuning';

const PAPERS: [string, string, string][] = [['#efe2cb', '#e6d3b4', '#d9b98a'], ['#dde8ef', '#cfdde7', '#a9c2d4'], ['#efe0e4', '#e6d0d6', '#d6a9b6'], ['#e3efe0', '#d3e6cf', '#a9cfa0'], ['#ece6f2', '#ddd3e8', '#b5a3cf']];
const BUTTON_COLORS = ['#e35d6a', '#4f8fe0', '#f2c14e', '#5fbf7a', '#a06ad8'];

// shared by every build: only geometries, and the materials that light up, are made per build
const MAT = Object.fromEntries(Object.entries(MATS).map(([k, m]) => [k, new THREE.MeshStandardMaterial({ color: m.color, metalness: m.metalness, roughness: m.roughness })])) as Record<Mat, THREE.MeshStandardMaterial>;
const SIDE = new THREE.MeshStandardMaterial({ color: '#f7f2ea', roughness: 0.6 });
const FLOOR = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.8 });
const FLAG = new THREE.MeshStandardMaterial({ color: '#e2b13c', emissive: '#3a2a00' });
const HOOK = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.35 });
const PIN = new THREE.MeshStandardMaterial({ color: '#8d8f93', metalness: 0.9, roughness: 0.3 });
const HOLE = new THREE.MeshStandardMaterial({ color: '#2a1e18' });
/** what harms the lace: blades, flames, water */
const BLADE = new THREE.MeshStandardMaterial({ color: '#3b3f45', metalness: 0.9, roughness: 0.25 });
const FLAME = new THREE.MeshBasicMaterial({ color: '#ff8a1e', transparent: true, opacity: 0.85 });
const WATER = new THREE.MeshBasicMaterial({ color: '#4aa3ff', transparent: true, opacity: 0.35, depthWrite: false });
/** the marks that tie a trapdoor to its key */
const MARK = new THREE.CircleGeometry(0.014, 20);
const MARKS = ['#2fd3c4', '#e04fd3', '#f2e14e', '#7a6cff'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
const papers = new Map<number, THREE.MeshStandardMaterial>();

export class Scenery {
  readonly group = new THREE.Group();
  /** the mesh of each gold bar (a post), by its index among the bars */
  readonly posts = new Map<number, THREE.Mesh>();
  /** the mesh of each bar (those that move are moved) */
  private bars: THREE.Mesh[] = [];
  /** what harms the lace, and what moves of it (a blade's two halves, a flame) */
  private hazards: { kind: string; parts: THREE.Mesh[] }[] = [];
  readonly buttons: THREE.Group[] = [];
  readonly rings: THREE.Mesh[] = [];
  readonly gates: THREE.Mesh[] = [];
  /** the switch box of each pull, which lights when it clicks */
  readonly pulls: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, L: Level, look: number) {
    const add = <T extends THREE.Object3D>(m: T, shadows = true): T => {
      if (shadows) m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const height = L.top - L.bottom + 2, mid = (L.top + L.bottom) / 2;

    const wall = add(new THREE.Mesh(new THREE.PlaneGeometry(2 * ROOM.x + 4, height), paper(look)), false);
    wall.position.set(0, mid, -ROOM.z);
    wall.receiveShadow = true;
    if (L.bottom <= 0) add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 2), FLOOR)).position.set(0, -0.15, 0.5);
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.3, height, 2 * ROOM.z + 0.1), SIDE)).position.set(s * (ROOM.x + 0.15), mid, 0);

    L.bars.forEach((b, k) => {
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, 2 * ROOM.z + 0.04, 24), b.mat === 'gold' ? MAT.gold.clone() : MAT[b.mat]));
      m.rotation.x = Math.PI / 2;
      m.position.set(b.x, b.y, 0);
      this.bars.push(m);
      if (b.mat !== 'gold') return;
      this.posts.set(k, m);
      const flag = add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 3), FLAG), false);
      flag.position.set(b.x, b.y + 0.09, -ROOM.z + 0.03);
      flag.rotation.z = -Math.PI / 2;
    });
    for (const s of L.shelves) add(new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, 0.03, 2 * ROOM.z + 0.04), MAT[s.mat ?? 'wood'])).position.set((s.x0 + s.x1) / 2, s.y - 0.015, 0);
    for (const g of L.gates) {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(g.x1 - g.x0, g.y1 - g.y0, 2 * ROOM.z + 0.04), new THREE.MeshStandardMaterial({ color: MATS.gate.color, metalness: 0.3, roughness: 0.5 })));
      m.position.set((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, 0);
      this.gates.push(m);
    }
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
      const w = h.x1 - h.x0, ht = h.y1 - h.y0, cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2, parts: THREE.Mesh[] = [];
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
      this.hazards.push({ kind: h.kind, parts });
    }

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

  /** what the rules say, shown: eyelets threaded glow, gates light up as they near opening and slide away, pulls and posts light, buttons taken go */
  update(rules: Rules, world: World, t: number, dt: number): void {
    const now = performance.now() / 1000;
    for (const m of world.level.movers) { const p = world.barAt(m.bar, t); this.bars[m.bar].position.set(p.x, p.y, 0); }
    for (const h of this.hazards) {
      if (h.kind === 'blade') h.parts.forEach((m) => (m.rotation.z = m.userData.tilt * (0.6 + 0.4 * Math.abs(Math.sin(now * 4)))));
      else if (h.kind === 'flame') h.parts[0].scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(now * 13) * Math.sin(now * 7)), 1);
    }
    this.rings.forEach((m, k) => (m.material as THREE.MeshStandardMaterial).emissive.set(rules.threaded[k] ? '#2fbf5a' : '#000000'));
    this.gates.forEach((m, k) => {
      const lit = rules.progress(k), mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setRGB(0.1 * lit, 0.35 * lit, 0.12 * lit);
      m.scale.x = Math.max(0.001, Math.min(1, m.scale.x + (rules.isOpen(k) ? -dt * 1.5 : dt * 3)));
    });
    this.pulls.forEach((m, k) => (m.material as THREE.MeshStandardMaterial).emissive.set(rules.pulled[k] >= PLAY.pullTime ? '#f2c14e' : rules.pulled[k] > 0 ? '#6a4a00' : '#000000'));
    this.posts.forEach((m, k) => (m.material as THREE.MeshStandardMaterial).emissive.set(rules.isSaved(k) ? '#6a4a00' : '#000000'));
    this.buttons.forEach((b, k) => {
      b.visible = !rules.isTaken(k);
      b.rotation.y = Math.sin(now * 1.7 + k) * 0.6;
    });
  }

  /** takes it out of the scene, and frees what was made for it */
  dispose(): void {
    this.group.removeFromParent();
    const shared = new Set<THREE.Material>([...Object.values(MAT), SIDE, FLOOR, FLAG, HOOK, PIN, HOLE, BLADE, FLAME, WATER, ...MARKS, ...papers.values()]);
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.geometry !== MARK) o.geometry.dispose();
      if (!shared.has(o.material)) (o.material as THREE.Material).dispose();
    });
  }
}

/** the wallpaper of look k: stripes and little stars, drawn once */
function paper(look: number): THREE.MeshStandardMaterial {
  const k = ((look % PAPERS.length) + PAPERS.length) % PAPERS.length;
  let m = papers.get(k);
  if (m) return m;
  const [hue, stripe, star] = PAPERS[k];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = hue;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = stripe;
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 26, 256);
  g.fillStyle = star;
  for (const [x, y] of [[45, 40], [109, 150], [173, 70], [237, 200], [45, 230]]) {
    g.beginPath();
    for (let q = 0; q < 10; q++) {
      const r = q % 2 ? 4 : 10, a = (Math.PI * q) / 5 - Math.PI / 2;
      g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 24);
  t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  papers.set(k, m);
  return m;
}
