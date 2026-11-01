// What is drawn over the scene about the lace: its aglets and eyes, a gauge
// round each grip (and why it drains or rests), where a free end would take
// hold and which button does it, the leash of the end the pointer leads, a
// burst where an end takes hold. And the lace's glow: the stretch the free
// end lifts as it reaches (red as it strains the grip it reaches from), a grip
// green while it rests, an end about to grip, the aglet slipping through the
// cords.

import * as THREE from 'three';
import type { End } from '../play/lace';
import type { World } from '../sim/world';
import { LACE, PLAY } from '../tuning';
import type { CordsView } from './cordsView';

/** the two ends, each its colour: the head (left button) and the tail (right button) */
export const END_COLORS = ['#ff8a3d', '#3d9bff'].map((c) => new THREE.Color(c));
const RED = new THREE.Color('#ff3b30');
const GREEN = new THREE.Color('#2fbf5a');
const GHOST = new THREE.Color(0, 0.3, 0.9);
const REST = new THREE.Color(0, 0.45, 0.1);
const CORD = new THREE.Color(0.45, 0.32, 0);
const NONE = new THREE.Color(0, 0, 0);

/** the glow of an effort (× the weight of the lace): green at rest, orange then red as it strains; yellow (−1) on a cord */
function strain(c: THREE.Color, effort: number): void {
  if (effort < 0) c.copy(CORD);
  else if (effort < PLAY.restLoad) c.copy(REST);
  else c.setRGB(0.5 + 0.7 * Math.min(1, effort), 0.25 * (1 - Math.min(1, effort)), 0);
}

/** a label drawn on a canvas, as a sprite, redrawn when its text changes */
class Label {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private text = '';

  constructor(scene: THREE.Scene, text = '', color = '#ffffff') {
    this.canvas.width = 256; this.canvas.height = 64;
    const t = new THREE.CanvasTexture(this.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    this.sprite.scale.set(0.26, 0.065, 1);
    this.sprite.renderOrder = 4;
    scene.add(this.sprite);
    this.set(text, color);
  }

  set(text: string, color: string): void {
    if (this.text === text + color) return;
    this.text = text + color;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(20, 16, 12, 0.78)';
    g.beginPath(); g.roundRect(4, 8, 248, 48, 24); g.fill();
    g.fillStyle = color; g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 33);
    this.sprite.material.map!.needsUpdate = true;
  }
}

/** a ring gauge facing us: how much grip an end has left */
function gauge(scene: THREE.Scene, c: THREE.Color): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.ShaderMaterial({
    uniforms: { fill: { value: 1 }, col: { value: c.clone() } },
    transparent: true, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float fill; uniform vec3 col; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        if (r < 0.68 || r > 1.0) discard;
        float t = fract(atan(p.x, p.y) / 6.2831853 + 1.0);
        float edge = smoothstep(1.0, 0.94, r) * smoothstep(0.68, 0.74, r);
        gl_FragColor = vec4(t < fill ? col : vec3(0.12), 0.92 * edge);
      }`,
  }));
  m.renderOrder = 3;
  scene.add(m);
  return m;
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
  private gauges: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[];
  private loads: Label[];
  private targets: THREE.Mesh[];
  private hints: Label[];
  private bursts: { m: THREE.Mesh; t: number }[];
  private leash: THREE.Line;
  private aimDot: THREE.Mesh;
  private tint = new THREE.Color();
  private u = new THREE.Vector3();

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
  }

  /** a ring that widens and fades where end k took hold */
  burst(x: number, y: number, k: number): void {
    const b = this.bursts.find((q) => q.t >= 1) ?? this.bursts[0];
    b.t = 0;
    b.m.position.set(x, y, 0.05);
    (b.m.material as THREE.MeshBasicMaterial).color.copy(END_COLORS[k]);
  }

  draw(world: World, cords: CordsView, playing: boolean, pointer: { x: number; y: number }, showHints: boolean, dt: number): void {
    const { lace, sim } = world, now = performance.now() / 1000, leader = lace.leader(), u = this.u, tint = this.tint;
    // the aglet slipping through the other cords (still, for a moment after, where it lies in them): it glows blue
    for (let i = lace.start; i < lace.start + lace.count; i++) cords.tint(i, sim.ghost[i] ? GHOST : NONE);
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
        // the eyes of the head look where it goes, or down
        const nx = -u.y, ny = u.x;
        const look = leader === e ? [pointer.x - p[0], pointer.y - p[1]] : [0, -1];
        const ll = Math.hypot(look[0], look[1]) || 1;
        this.eyes.forEach((g, s) => {
          const sd = s === 0 ? 1 : -1;
          g.position.set(p[0] + u.x * 0.03 + nx * sd * 0.009, p[1] + u.y * 0.03 + ny * sd * 0.009, p[2] + LACE.radius * 0.8);
          g.getObjectByName('pupil')!.position.set((look[0] / ll) * 0.0045, (look[1] / ll) * 0.0045, 0.006);
        });
      }
    });
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
    g.visible = playing && (!!a || e.stamina < 0.999);
    g.position.set(a ? a[0] : p[0], a ? a[1] : p[1], 0.06);
    g.material.uniforms.fill.value = e.stamina;
    g.material.uniforms.col.value.copy(resting ? GREEN : e.stamina < 0.35 ? RED : END_COLORS[k]);
    l.sprite.visible = playing && !!e.grip && !!a;
    if (!e.grip || !a) return;
    l.sprite.position.set(a[0], a[1] + 0.065, 0.07);
    if (e.grip.kind === 'cord') l.set('sur une corde ↓', '#f2c14e');
    else if (resting) l.set('repos ↑', '#5fe08a');
    else l.set(`effort ${Math.min(300, Math.round(e.load * 10) * 10)} % ↓`, e.load > 0.8 ? '#ff5a4f' : '#ffb04f');
  }
}
