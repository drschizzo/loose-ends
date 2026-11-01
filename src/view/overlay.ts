// What is drawn over the scene about the lace: its aglets and eyes, a gauge
// round each grip (and why it drains or rests), where a free end would take
// hold and which button does it, the leash of the end the pointer leads, a
// burst where an end takes hold. And the lace's glow: the stretch the free
// end lifts as it reaches (red as it strains the grip it reaches from), a grip
// green while it rests, an end about to grip, the aglet slipping through the
// cords, a flash where the lace is hurt and a throb where it is worn deep.

import * as THREE from 'three/webgpu';
import type { End } from '../play/lace';
import type { World } from '../sim/world';
import { LACE, PLAY } from '../tuning';
import type { CordsView } from './cordsView';
import { tsl } from './tsl';

/** the two ends, each its colour: the head (left button) and the tail (right button) */
export const END_COLORS = ['#ff8a3d', '#3d9bff'].map((c) => new THREE.Color(c));
const RED = new THREE.Color('#ff3b30');
const GREEN = new THREE.Color('#2fbf5a');
const GOLD = new THREE.Color(2.2, 1.7, 0.5);
const GHOST = new THREE.Color(0, 0.3, 0.9);
const REST = new THREE.Color(0, 0.45, 0.1);
const CORD = new THREE.Color(0.45, 0.32, 0);
const NONE = new THREE.Color(0, 0, 0);
const WORN = new THREE.Color(1.2, 0.08, 0.02);

/** the glow of an effort (× the weight of the lace): green at rest, orange then red as it strains; yellow (−1) on a cord */
function strain(c: THREE.Color, effort: number): void {
  if (effort < 0) c.copy(CORD);
  else if (effort < PLAY.restLoad) c.copy(REST);
  else c.setRGB(0.5 + 0.7 * Math.min(1, effort), 0.25 * (1 - Math.min(1, effort)), 0);
}

/** a label drawn on a canvas, as a sprite as wide as its words, redrawn when they change */
class Label {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private text = '';

  constructor(scene: THREE.Scene, text = '', color = '#ffffff', private plain = false) {
    this.canvas.width = 512; this.canvas.height = 64;
    const t = new THREE.CanvasTexture(this.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    this.sprite.renderOrder = 4;
    scene.add(this.sprite);
    this.set(text, color);
  }

  set(text: string, color: string): void {
    if (this.text === text + color) return;
    this.text = text + color;
    const g = this.canvas.getContext('2d')!, font = 'bold 28px ui-rounded, system-ui, sans-serif';
    g.font = font;
    // the canvas as wide as the words and their pill (a power of two is not needed: it is redrawn whole)
    const w = Math.min(512, Math.ceil(g.measureText(text).width) + 44);
    if (this.canvas.width !== w) { this.canvas.width = w; (this.sprite.material.map as THREE.CanvasTexture).dispose(); }
    g.clearRect(0, 0, w, 64);
    if (!this.plain) { g.fillStyle = 'rgba(20, 16, 12, 0.78)'; g.beginPath(); g.roundRect(4, 8, w - 8, 48, 24); g.fill(); }
    g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (this.plain) { g.lineWidth = 6; g.strokeStyle = 'rgba(20, 16, 12, 0.7)'; g.strokeText(text, w / 2, 33); }
    g.fillText(text, w / 2, 33);
    this.sprite.material.map!.needsUpdate = true;
    this.sprite.scale.set(0.065 * (w / 64), 0.065, 1);
  }
}

const { atan, float, fract, length, select, smoothstep, uniform, uv, vec3, vec4 } = tsl;

/** a ring gauge facing us: how much grip an end has left (`fill`, 0 to 1), in its colour (`col`) */
interface Gauge { mesh: THREE.Mesh; fill: { value: number }; col: { value: THREE.Color } }

function gauge(scene: THREE.Scene, c: THREE.Color): Gauge {
  const fill = uniform(1), col = uniform(c.clone());
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false });
  const p = uv().mul(2).sub(1), r = length(p);
  const t = fract(atan(p.x, p.y).div(2 * Math.PI).add(1));
  const edge = smoothstep(1, 0.94, r).mul(smoothstep(0.68, 0.74, r));
  m.colorNode = vec4(select(t.lessThan(fill), col, vec3(0.12)), 1);
  m.opacityNode = float(0.92).mul(edge);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), m);
  mesh.renderOrder = 3;
  scene.add(mesh);
  return { mesh, fill, col };
}

/** a flat mesh drawn over everything */
function marker<T extends THREE.Mesh | THREE.Line>(scene: THREE.Scene, m: T, order: number): T {
  m.renderOrder = order;
  scene.add(m);
  return m;
}

export class Overlay {
  private aglets: THREE.Mesh[];
  private eyes: THREE.Group[];
  private gauges: Gauge[];
  private loads: Label[];
  private targets: THREE.Mesh[];
  private hints: Label[];
  private bursts: { m: THREE.Mesh; t: number }[];
  private leash: THREE.Line;
  private aimDot: THREE.Mesh;
  /** words that rise from the lace and fade (a clean catch, a button) */
  private pops: { l: Label; t: number; x: number; y: number }[];
  /** the eyes: when they next blink, how open they are */
  private blinkAt = 2;
  private open = 1;
  private tint = new THREE.Color();
  private u = new THREE.Vector3();
  /** the lace's wear at the last frame, and how fresh the hurt of each node is (1 just hurt, fading) */
  private before = new Float32Array(0);
  private hurt = new Float32Array(0);

  constructor(scene: THREE.Scene) {
    this.aglets = END_COLORS.map((c) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(LACE.radius * 1.2, LACE.radius * 1.1, 0.036, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, emissive: c, emissiveIntensity: 0.15 }));
      m.castShadow = true;
      scene.add(m);
      return m;
    });
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), black = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.2 });
    this.eyes = [0, 1].map(() => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.0095, 16, 12), white));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0047, 12, 8), black);
      pupil.name = 'pupil';
      g.add(pupil);
      scene.add(g);
      return g;
    });
    this.gauges = END_COLORS.map((c) => gauge(scene, c));
    this.loads = END_COLORS.map(() => new Label(scene));
    this.targets = END_COLORS.map((c) => marker(scene, new THREE.Mesh(new THREE.RingGeometry(0.018, 0.026, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false })), 3));
    this.hints = [new Label(scene, 'maintiens clic gauche', '#ff8a3d'), new Label(scene, 'maintiens clic droit', '#3d9bff')];
    this.bursts = Array.from({ length: 4 }, () => ({ m: marker(scene, new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, opacity: 0 })), 3), t: 1 }));
    this.leash = marker(scene, new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, dashSize: 0.015, gapSize: 0.012, depthTest: false })), 2);
    this.aimDot = marker(scene, new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthTest: false })), 2);
    this.pops = Array.from({ length: 4 }, () => { const l = new Label(scene, '', '#ffffff', true); l.sprite.visible = false; return { l, t: 1, x: 0, y: 0 }; });
  }

  /** words that rise from (x, y) and fade */
  pop(text: string, x: number, y: number, color = '#ffe08a'): void {
    const p = this.pops.find((q) => q.t >= 1) ?? this.pops[0];
    p.l.set(text, color);
    p.t = 0; p.x = x; p.y = y;
  }

  /** a ring that widens and fades where end k took hold (gold, for a clean catch) */
  burst(x: number, y: number, k: number, gold = false): void {
    const b = this.bursts.find((q) => q.t >= 1) ?? this.bursts[0];
    b.t = 0;
    b.m.position.set(x, y, 0.05);
    (b.m.material as THREE.MeshBasicMaterial).color.copy(gold ? GOLD : END_COLORS[k]);
  }

  draw(world: World, cords: CordsView, playing: boolean, pointer: { x: number; y: number }, showHints: boolean, dt: number): void {
    const { lace, sim } = world, now = performance.now() / 1000, leader = lace.leader(), u = this.u, tint = this.tint;
    // the aglet slipping through the other cords (still, for a moment after, where it lies in them): it glows blue;
    // where the lace is hurt it flashes red, and where it is worn deep it throbs red, faster as it nears breaking
    if (this.before.length !== lace.count) { this.before = Float32Array.from(lace.damage); this.hurt = new Float32Array(lace.count); }
    for (let k = 0; k < lace.count; k++) {
      const i = lace.start + k, d = lace.damage[k];
      this.hurt[k] = Math.max(this.hurt[k] * Math.exp(-dt / 0.25), Math.min(1, (d - this.before[k]) * 25));
      this.before[k] = d;
      const worn = d < 0.45 ? 0 : ((d - 0.45) / 0.55) * (0.5 + 0.5 * Math.sin(now * (4 + 10 * d)));
      const glow = Math.max(this.hurt[k], 0.7 * worn);
      if (sim.ghost[i]) cords.tint(i, GHOST);
      else if (glow > 0.01) cords.tint(i, tint.copy(WORN).multiplyScalar(glow));
      else cords.tint(i, NONE);
    }
    lace.ends.forEach((e, k) => {
      const p = lace.at(e.node), q = lace.at(e.inward), dir = e.node < e.inward ? 1 : -1;
      const h = !e.grip && playing ? lace.holdFor(e) : null;
      if (e.grip) {
        // at the hand: green while it rests, red as it strains, yellow on a cord
        strain(tint, e.grip.kind === 'cord' ? -1 : e.load);
        for (let j = 0; j < 5; j++) cords.tint(e.node + dir * j, tint);
      } else if (e === leader && lace.reach > PLAY.restLoad && lace.ends.some((o) => o.grip)) {
        // reaching: the stretch it lifts, from the end to the first thing the lace lies on, red as it strains
        strain(tint, lace.reach);
        const to = lace.carried(e);
        for (let i = e.node; i !== to + dir; i += dir) cords.tint(i, tint);
      } else {
        if (h) tint.copy(END_COLORS[k]).multiplyScalar(0.35 + 0.25 * Math.sin(now * 10));
        else if (sim.ghost[e.node]) tint.copy(GHOST);
        else tint.copy(NONE);
        for (let j = 0; j < 4; j++) cords.tint(e.node + dir * j, tint);
      }
      u.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize();
      this.aglets[k].position.set(p[0] + u.x * 0.012, p[1] + u.y * 0.012, p[2] + u.z * 0.012);
      this.aglets[k].scale.set(LACE.radius / 0.008, 1, LACE.radius / 0.008);
      this.aglets[k].quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, u);
      this.grip(e, k, lace.anchor(e), p, playing);
      this.targets[k].visible = this.hints[k].sprite.visible = !!h && !e.held;
      if (h) {
        this.targets[k].position.set(h.x, h.y, 0.05);
        this.targets[k].scale.setScalar(1 + 0.15 * Math.sin(now * 8));
        this.hints[k].sprite.position.set(h.x, h.y + 0.07, 0.06);
        this.hints[k].sprite.visible = !e.held && showHints;
      }
      if (k === 0) {
        // the eyes of the head: they look at the hold it could take, or where it goes, or down; they blink;
        // they narrow as a grip tires, and open wide as the lace falls
        const nx = -u.y, ny = u.x;
        const target = h ?? (e.grip ? null : lace.holdFor(lace.ends[1]));
        const look = target ? [target.x - p[0], target.y - p[1]] : leader === e ? [pointer.x - p[0], pointer.y - p[1]] : [0, -1];
        const ll = Math.hypot(look[0], look[1]) || 1;
        const tired = lace.ends.some((o) => o.grip && o.stamina < 0.35), falling = playing && !lace.ends.some((o) => o.grip) && lace.speedOf() > 1.1;
        this.blinkAt -= dt;
        if (this.blinkAt < -0.13) this.blinkAt = 2.5 + 3 * Math.random();
        const want = this.blinkAt < 0 ? 0.12 : falling ? 1.25 : tired ? 0.5 : 1;
        this.open += (want - this.open) * Math.min(1, dt * (this.blinkAt < 0 ? 40 : 10));
        this.eyes.forEach((g, s) => {
          const sd = s === 0 ? 1 : -1;
          g.position.set(p[0] + u.x * 0.03 + nx * sd * 0.009, p[1] + u.y * 0.03 + ny * sd * 0.009, p[2] + LACE.radius * 0.8);
          g.scale.set(Math.max(1, this.open) * LACE.radius / 0.008, this.open * LACE.radius / 0.008, LACE.radius / 0.008);
          g.getObjectByName('pupil')!.position.set((look[0] / ll) * 0.0045, (look[1] / ll) * 0.0045, 0.006);
          g.getObjectByName('pupil')!.visible = this.open > 0.3;
        });
      }
    });
    for (const q of this.pops) {
      q.t = Math.min(1, q.t + dt / 1.1);
      q.l.sprite.visible = q.t < 1;
      q.l.sprite.position.set(q.x, q.y + 0.05 + 0.1 * q.t, 0.08);
      q.l.sprite.material.opacity = Math.min(1, 3 * (1 - q.t));
    }
    for (const b of this.bursts) {
      b.t = Math.min(1, b.t + dt * 2.5);
      b.m.scale.setScalar(1 + 3 * b.t);
      (b.m.material as THREE.MeshBasicMaterial).opacity = 1 - b.t;
    }
    this.leash.visible = this.aimDot.visible = playing && !!leader;
    if (leader) {
      const p = lace.at(leader.node), pos = this.leash.geometry.attributes.position;
      pos.setXYZ(0, p[0], p[1], 0.04);
      pos.setXYZ(1, lace.aim.x, lace.aim.y, 0.04);
      pos.needsUpdate = true;
      this.leash.computeLineDistances();
      (this.leash.material as THREE.LineDashedMaterial).color.copy(END_COLORS[lace.ends.indexOf(leader)]);
      this.aimDot.position.set(lace.aim.x, lace.aim.y, 0.04);
    }
  }

  /**
   * The gauge round a grip (green while it rests), and above it what the grip
   * is doing: resting, or how hard it works (the other end reaching from it,
   * a pull beyond the lace's weight: that is what tires it)
   */
  private grip(e: End, k: number, a: [number, number, number] | null, p: [number, number, number], playing: boolean): void {
    const g = this.gauges[k], l = this.loads[k];
    const resting = e.grip?.kind === 'surface' && e.load < PLAY.restLoad;
    g.mesh.visible = playing && (!!a || e.stamina < 0.999);
    g.mesh.position.set(a ? a[0] : p[0], a ? a[1] : p[1], 0.06);
    g.fill.value = e.stamina;
    g.col.value.copy(resting ? GREEN : e.stamina < 0.35 ? RED : END_COLORS[k]);
    l.sprite.visible = playing && !!e.grip && !!a;
    if (!e.grip || !a) return;
    l.sprite.position.set(a[0], a[1] + 0.065, 0.07);
    if (e.grip.kind === 'cord') l.set('sur une corde ↓', '#f2c14e');
    else if (resting) l.set('repos ↑', '#5fe08a');
    else l.set(`effort ${Math.min(300, Math.round(e.load * 10) * 10)} % ↓`, e.load > 0.8 ? '#ff5a4f' : '#ffb04f');
  }
}
