// The decor of a window of the course: the walls of each floor, papered as
// its theme says, the height gauge, the red thread that runs up through the
// house, what hangs on the walls and stands on the floors (the story, told by
// things), the windows and what they look out on; above the house, the sky.
// And what lives in it: dust in the air, a spider on its thread, birds,
// shooting stars, memories floating. Built with the scenery, into its group,
// dropped with it.
//
// None of it is in the solver: it costs nothing to the physics. It is all on
// the wall, behind what is played with, or far behind in the sky.

import * as THREE from 'three';
import type { Storey } from '../gen/course';
import { HOUSE } from '../gen/floors';
import { ROOM, type Shelf } from '../level/level';
import { art, DOT, gauge, outside, RING, seeded, sky, TILE, wallpaper } from './paint';
import { MEMORIES, THEMES, type Air, type Mood, type Theme } from './themes';

export const theme = (f: number): Theme => THEMES[Math.min(f, THEMES.length - 1)];

/** a floor's stretch of height, in this window: [y0, y1], and whether its top is where the next floor begins */
export interface Band { floor: number; y0: number; y1: number; closed: boolean }

/** the light of a height, mixed between two floors near where they meet */
export interface Light { bg: THREE.Color; sky: THREE.Color; ground: THREE.Color; ambient: number; sun: THREE.Color; sunI: number }

const WALL = -ROOM.z;
const W = 2 * ROOM.x;
/** the floors of the house that keep the height gauge (not the roof) */
const GAUGED = HOUSE - 1;
/** what floats in the sky: things from the house, faded */
const DRIFT = ['shoes', 'frame:wedding', 'knitting', 'teddy', 'slippers', 'glasses', 'drawing:papi', 'frame:couple', 'calendar', 'hat', 'letters', 'drawing:mamie', 'frame:baby'];

// what every build shares: the plane every picture is drawn on, the materials of the pictures, papers and woods
const PLANE = new THREE.PlaneGeometry(1, 1);
const kept = new Set<THREE.Material | THREE.BufferGeometry>([PLANE]);
const mats = new Map<string, THREE.Material>();
function shared<T extends THREE.Material>(key: string, make: () => T): T {
  let m = mats.get(key) as T | undefined;
  if (!m) { m = make(); mats.set(key, m); kept.add(m); }
  return m;
}
/** what is shared between builds, not to be freed with one */
export const keeps = (o: THREE.Material | THREE.BufferGeometry): boolean => kept.has(o);

const SHAFT = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d')!, gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();

/** a picture's material: lit like the wall and a little dulled, or glowing (the sky: dimmed as dark as its floor), or faded (a memory) */
function picture(name: string, faded = false, floor = 0): THREE.Material {
  const a = art(name);
  if (faded) return shared(`memory ${name}`, () => new THREE.MeshBasicMaterial({ map: a.tex, transparent: true, depthWrite: false, opacity: 0.5, color: '#e6ecff' }));
  if (a.glow && name === 'cloud') {
    const m = theme(floor).mood;
    return shared(`cloud ${floor}`, () => new THREE.MeshBasicMaterial({ map: a.tex, transparent: true, depthWrite: false, color: new THREE.Color(m.bg).lerp(new THREE.Color('#ffffff'), Math.min(1, m.ambient / 1.6) ** 2) }));
  }
  return shared(`art ${name}`, () => a.glow
    ? new THREE.MeshBasicMaterial({ map: a.tex, transparent: true, depthWrite: false })
    : new THREE.MeshStandardMaterial({ map: a.tex, transparent: true, alphaTest: a.soft ? 0 : 0.1, depthWrite: !a.soft, roughness: 0.95, color: '#e9e3da' }));
}

const lerpColor = (a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) => out.copy(a).lerp(b, t);
const MOODS = THEMES.map((t) => ({
  bg: new THREE.Color(t.mood.bg), sky: new THREE.Color(t.mood.sky), ground: new THREE.Color(t.mood.ground), ambient: t.mood.ambient, sun: new THREE.Color(t.mood.sun), sunI: t.mood.sunI,
}));

interface Rect { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Rect, list: Rect[]) => list.some((b) => a.x0 < b.x1 + 0.03 && b.x0 < a.x1 + 0.03 && a.y0 < b.y1 + 0.03 && b.y0 < a.y1 + 0.03);

/** what drifts in the air, by kind: its look, how it moves (m/s), how many of the particles show */
const AIRS: Record<Air, { tex: THREE.Texture; color: string; size: number; opacity: number; add: boolean; vy: number; sway: number; share: number }> = {
  dust: { tex: DOT, color: '#fff0d0', size: 0.012, opacity: 0.55, add: true, vy: 0.004, sway: 0.01, share: 1 },
  lint: { tex: DOT, color: '#f4ece0', size: 0.016, opacity: 0.6, add: false, vy: -0.025, sway: 0.03, share: 0.7 },
  bubbles: { tex: RING, color: '#e8f6ff', size: 0.03, opacity: 0.55, add: false, vy: 0.05, sway: 0.02, share: 0.5 },
  sparkles: { tex: DOT, color: '#ffe6a8', size: 0.016, opacity: 0.8, add: true, vy: 0.006, sway: 0.006, share: 0.8 },
  petals: { tex: DOT, color: '#f6b8c4', size: 0.018, opacity: 0.8, add: false, vy: -0.05, sway: 0.06, share: 0.6 },
  none: { tex: DOT, color: '#ffffff', size: 0.01, opacity: 0, add: true, vy: 0, sway: 0, share: 0 },
};
const MOTES = 90;

export class Decor {
  readonly bands: Band[] = [];
  /** the sections that keep a memory (a rare room): from where to where */
  readonly memories: { index: number; y0: number; y1: number }[] = [];
  private own: { dispose(): void }[] = [];
  private spiders: { body: THREE.Mesh; line: THREE.Line; top: number; phase: number }[] = [];
  private floats: { m: THREE.Object3D; y: number; phase: number; spin: number }[] = [];
  private birds: THREE.Mesh[] = [];
  private streak: THREE.Mesh;
  private streakT = 99;
  private stars: THREE.ShaderMaterial[] = [];
  private air: THREE.Points;
  private airKind: Air = 'none';
  private motes = new Float32Array(MOTES * 3);
  private moteSeed = Float32Array.from({ length: MOTES }, () => Math.random());
  private light: Light = { bg: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color(), ambient: 1, sun: new THREE.Color(), sunI: 1 };

  /** the decor of `storeys` (the sections of the window), for course `seed`; the best height reached, marked on the gauge */
  constructor(private group: THREE.Group, storeys: Storey[], seed: number, bottom: number, top: number, best: number) {
    // the floors, from bottom to top: one changes to the next at the trapdoor over a post
    let y0 = bottom - 1;
    storeys.forEach((s, k) => {
      const last = k === storeys.length - 1;
      if (s.above !== s.floor && s.ceiling !== undefined) { this.bands.push({ floor: s.floor, y0, y1: s.ceiling, closed: true }); y0 = s.ceiling; }
      if (last) this.bands.push({ floor: s.above !== s.floor && s.ceiling !== undefined ? s.above : s.floor, y0, y1: top + 1, closed: false });
    });
    for (const b of this.bands) this.room(b);
    this.bands.forEach((b, k) => { if (k > 0) this.seam(this.bands[k - 1], b); });
    this.thread(seed);
    for (const s of storeys) this.furnish(s, seed, best);

    // the birds, a shooting star, what drifts in the air: wherever the camera is
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(PLANE, picture('bird'));
      m.scale.set(0.09, 0.045, 1);
      m.visible = false;
      this.add(m);
      this.birds.push(m);
    }
    this.streak = this.add(new THREE.Mesh(PLANE, shared('streak', () => new THREE.MeshBasicMaterial({ map: DOT, color: '#fff6dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
    this.streak.visible = false;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motes, 3));
    this.air = new THREE.Points(geo, new THREE.PointsMaterial({ map: DOT, size: 0.012, transparent: true, depthWrite: false, opacity: 0 }));
    this.air.frustumCulled = false;
    this.group.add(this.air);
    this.own.push(geo, this.air.material as THREE.Material);
  }

  /** the band of floor at height y */
  band(y: number): Band {
    return this.bands.find((b) => y < b.y1) ?? this.bands[this.bands.length - 1];
  }

  floorAt(y: number): number {
    return this.band(y).floor;
  }

  /** the memory (a rare room) the height y is in, or −1 */
  memoryAt(y: number): number {
    return this.memories.find((m) => y >= m.y0 && y < m.y1)?.index ?? -1;
  }

  /** the light at height y: the floor's, mixed with the next one's over the last 70 cm below where they meet (and the first above) */
  lightAt(y: number): Light {
    const k = this.bands.indexOf(this.band(y)), b = this.bands[k], L = this.light;
    let a = MOODS[Math.min(b.floor, MOODS.length - 1)], c = a, t = 0;
    const next = this.bands[k + 1], prev = this.bands[k - 1];
    if (next && y > b.y1 - 0.7) { c = MOODS[Math.min(next.floor, MOODS.length - 1)]; t = 0.5 * (y - (b.y1 - 0.7)) / 0.7; }
    else if (prev && y < b.y0 + 0.7) { c = a; a = MOODS[Math.min(prev.floor, MOODS.length - 1)]; t = 0.5 + 0.5 * (y - b.y0) / 0.7; }
    t = t * t * (3 - 2 * t);
    lerpColor(a.bg, c.bg, t, L.bg); lerpColor(a.sky, c.sky, t, L.sky); lerpColor(a.ground, c.ground, t, L.ground); lerpColor(a.sun, c.sun, t, L.sun);
    L.ambient = a.ambient + (c.ambient - a.ambient) * t;
    L.sunI = a.sunI + (c.sunI - a.sunI) * t;
    return L;
  }

  /** what lives: `now` seconds of the clock, the camera at height y */
  update(now: number, dt: number, y: number): void {
    for (const s of this.stars) s.uniforms.time.value = now;
    for (const s of this.spiders) {
      const sy = s.top - 0.22 - 0.16 * (0.5 + 0.5 * Math.sin(now * 0.22 + s.phase));
      s.body.position.y = sy;
      const p = s.line.geometry.attributes.position as THREE.BufferAttribute;
      p.setY(1, sy + 0.02); p.needsUpdate = true;
    }
    for (const f of this.floats) {
      f.m.position.y = f.y + 0.04 * Math.sin(now * 0.4 + f.phase);
      f.m.rotation.z = f.spin * Math.sin(now * 0.25 + f.phase);
    }
    const th = theme(this.floorAt(y));
    // birds across the sky, flapping
    const flying = !!th.life?.includes('birds');
    this.birds.forEach((b, k) => {
      b.visible = flying;
      if (!flying) return;
      const x = ((now * (0.25 + 0.05 * k) + k * 2.3) % 12) - 6;
      b.position.set(x, y + 0.4 + 0.35 * Math.sin(k * 1.7) + 0.05 * Math.sin(now + k), -1.8);
      b.scale.y = 0.045 * (0.5 + 0.5 * Math.abs(Math.sin(now * 7 + k)));
    });
    // now and then, a shooting star
    this.streakT += dt;
    if (th.life?.includes('shooting') && this.streakT > 6 + 5 * this.moteSeed[0]) {
      this.streakT = 0;
      this.moteSeed[0] = Math.random();
      this.streak.userData = { x: -2 + 3 * Math.random(), y: y + 0.6 + 0.8 * Math.random() };
    }
    const st = this.streakT / 0.9;
    this.streak.visible = st < 1 && !!th.life?.includes('shooting');
    if (this.streak.visible) {
      const { x: sx, y: sy } = this.streak.userData as { x: number; y: number };
      this.streak.position.set(sx + 1.8 * st, sy - 0.7 * st, -2.4);
      this.streak.rotation.z = -0.37;
      this.streak.scale.set(0.5, 0.012, 1);
      (this.streak.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * st);
    }
    this.drift(th.air, now, dt, y);
  }

  /** frees what was made for this build alone (the rest the scenery frees with its group) */
  dispose(): void {
    for (const o of this.own) o.dispose();
  }

  // ------------------------------------------------------------------

  private add<T extends THREE.Object3D>(m: T): T {
    this.group.add(m);
    return m;
  }

  /** the walls of a floor (papered), its sides; or the sky behind it */
  private room(b: Band): void {
    const th = theme(b.floor), h = b.y1 - b.y0, mid = (b.y0 + b.y1) / 2;
    if (th.paper.motif !== 'none') {
      const geo = new THREE.PlaneGeometry(W + 4, h);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + 4) / TILE, (b.y0 + uv.getY(i) * h) / TILE);
      const wall = this.add(new THREE.Mesh(geo, shared(`paper ${b.floor}`, () => new THREE.MeshStandardMaterial({ map: wallpaper(th.paper.motif, th.paper.colors), roughness: 0.95 }))));
      wall.position.set(0, mid, WALL);
      wall.receiveShadow = true;
      for (const s of [-1, 1]) {
        const side = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 2 * ROOM.z + 0.1), shared(`side ${b.floor}`, () => new THREE.MeshStandardMaterial({ color: th.side, roughness: 0.6 }))));
        side.position.set(s * (ROOM.x + 0.15), mid, 0);
        side.receiveShadow = true;
      }
    }
    if (th.backdrop) {
      const back = this.add(new THREE.Mesh(PLANE, shared(`sky ${b.floor}`, () => new THREE.MeshBasicMaterial({ map: sky(th.backdrop!.top, th.backdrop!.bottom), transparent: true, depthWrite: false, fog: false }))));
      back.scale.set(18, h + 5, 1);
      back.position.set(0, mid, -2.7 - 0.01 * (b.floor % 2));
      back.renderOrder = -2;
      if (th.backdrop.stars) this.starry(th.backdrop.stars, b, b.floor);
    }
  }

  /** where two floors meet: under, the ceiling's moulding; over, the skirting board; out of the house, a ledge of stone */
  private seam(below: Band, above: Band): void {
    const F = below.y1, a = theme(above.floor), u = theme(below.floor);
    if (u.paper.motif === 'none') return;
    const strip = (y: number, h: number, d: number, color: string) => {
      const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(W, h, d), shared(`trim ${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))));
      m.position.set(0, y, WALL + d / 2);
      m.castShadow = m.receiveShadow = true;
    };
    if (a.paper.motif === 'none') { strip(F - 0.045, 0.07, 0.03, '#8a8278'); return; }
    strip(F - 0.06, 0.05, 0.02, '#f2ece0');
    strip(F + 0.035, 0.07, 0.016, a.plank);
  }

  /** the stars of a sky, twinkling */
  private starry(n: number, b: Band, floor: number): void {
    const r = seeded('stars', floor, b.y0), pos = new Float32Array(3 * n), phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(r() - 0.5) * 12, b.y0 - 2 + r() * (b.y1 - b.y0 + 4), -2.6], 3 * i);
      phase[i] = r() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, map: { value: DOT } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float phase; uniform float time; varying float vA;
        void main() {
          vA = 0.55 + 0.45 * sin(time * (0.8 + fract(phase * 3.1)) + phase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (18.0 + 14.0 * fract(phase * 7.3)) * (4.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying float vA;
        void main() { gl_FragColor = vec4(vec3(1.0, 0.96, 0.88), vA) * texture2D(map, gl_PointCoord); }`,
    });
    const p = new THREE.Points(geo, m);
    p.renderOrder = -1;
    this.add(p);
    this.stars.push(m);
    this.own.push(geo, m);
  }

  /**
   * The thread up the wall: red through the house, light beyond, from the
   * hall to the dawn, where it ends tied in a bow under a star
   */
  private thread(seed: number): void {
    const ph = (seed % 1000) * 0.0137;
    const at = (y: number) => Math.max(-0.58, Math.min(0.74, 0.42 * Math.sin(0.23 * y + ph) + 0.2 * Math.sin(0.71 * y + 2.1 * ph) + 0.08));
    const dawn = this.bands.find((b) => b.floor === 10 && b.closed), end = dawn ? dawn.y1 - 0.3 : Infinity;
    for (const b of this.bands) {
      const th = theme(b.floor), y0 = Math.max(0.03, b.y0), y1 = Math.min(b.y1, end);
      if (th.thread === 'none' || y1 <= y0) continue;
      const pts: THREE.Vector3[] = [];
      for (let y = y0; y < y1; y += 0.08) pts.push(new THREE.Vector3(at(y), y, WALL + 0.012));
      pts.push(new THREE.Vector3(at(y1), y1, WALL + 0.012));
      if (pts.length < 2) continue;
      const m = this.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.0024, 5),
        th.thread === 'red' ? shared('thread red', () => new THREE.MeshStandardMaterial({ color: '#a8323a', roughness: 0.8 })) : shared('thread light', () => new THREE.MeshBasicMaterial({ color: '#ffd98a' })),
      ));
      m.castShadow = th.thread === 'red';
    }
    if (end < Infinity) {
      const bow = this.add(new THREE.Mesh(PLANE, picture('bow')));
      bow.scale.set(0.12, 0.09, 1);
      bow.position.set(at(end), end + 0.01, WALL + 0.015);
      const star = this.add(new THREE.Mesh(PLANE, picture('star')));
      star.scale.set(0.16, 0.16, 1);
      star.position.set(at(end), end + 0.16, WALL + 0.014);
      this.floats.push({ m: star, y: end + 0.16, phase: 0, spin: 0.15 });
    }
  }

  /**
   * What a section has on its walls and floors: the first of a floor tells
   * its story; a rare one keeps a memory; the rest is filled at random, by
   * the floor's theme. In the sky, things float at some distance instead.
   */
  private furnish(s: Storey, seed: number, best: number): void {
    const th = theme(s.floor), r = seeded(seed, s.index, 'decor');
    const lo = s.bottom + 0.1, hi = s.ceiling !== undefined && s.above !== s.floor ? s.ceiling - 0.08 : s.top - 0.02;
    const taken: Rect[] = [];
    const house = th.paper.motif !== 'none';
    if (house && s.floor < GAUGED) {
      const { tex, w } = gauge(s.bottom, s.top, best);
      const m = this.add(new THREE.Mesh(PLANE, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, roughness: 0.9 })));
      m.scale.set(w, s.top - s.bottom, 1);
      m.position.set(-ROOM.x + w / 2, (s.top + s.bottom) / 2, WALL + 0.002);
      m.receiveShadow = true;
      this.own.push(tex);
      taken.push({ x0: -ROOM.x, y0: s.bottom, x1: -ROOM.x + 0.2, y1: s.top });
    }
    // a memory, now and then, in a house floor (never its first section, nor the hall)
    const memory = house && !s.first && s.floor >= 1 && s.floor < GAUGED && r() < 0.11 ? MEMORIES[Math.floor(r() * MEMORIES.length)] : null;
    if (memory) this.memories.push({ index: s.index, y0: s.bottom, y1: s.top });
    if (!house) { this.sky(s, th, r); return; }
    if (memory?.outside || r() < th.windows) this.window(s, th, r, lo, hi, taken, memory?.outside);
    const things = [...(s.first ? th.story : []), ...(memory?.props ?? [])];
    const pool = [...th.wall, ...th.wall, ...th.ground];
    for (let n = 2 + Math.floor(r() * 3); n > 0 && pool.length; n--) things.push(pool[Math.floor(r() * pool.length)]);
    let z = 0;
    for (const name of new Set(things)) {
      const a = art(name), at = a.ground ? this.onFloor(a.w, a.h, s.shelves, lo - 0.3, hi, taken, r) : this.onWall(a.w, a.h, lo, hi, taken, r);
      if (!at) continue;
      const m = this.add(new THREE.Mesh(PLANE, picture(name)));
      m.scale.set(a.w, a.h, 1);
      m.position.set(at[0], at[1], WALL + 0.004 + 0.0004 * z++);
      m.receiveShadow = true;
    }
    if (th.life?.includes('spider') && r() < 0.6) {
      const x = -0.45 + r() * 1.2, top = hi;
      const body = this.add(new THREE.Mesh(PLANE, picture('spider')));
      body.scale.set(0.04, 0.04, 1);
      body.position.set(x, top - 0.3, WALL + 0.008);
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, top, WALL + 0.007), new THREE.Vector3(x, top - 0.3, WALL + 0.007)]);
      const line = this.add(new THREE.Line(geo, shared('silk', () => new THREE.LineBasicMaterial({ color: '#d8d0c4', transparent: true, opacity: 0.6 }))));
      this.own.push(geo);
      this.spiders.push({ body, line, top, phase: r() * 6.28 });
    }
  }

  /** where a thing of w × h can hang on the wall, away from what is there (its centre), if anywhere */
  private onWall(w: number, h: number, lo: number, hi: number, taken: Rect[], r: () => number): [number, number] | null {
    for (let k = 0; k < 12; k++) {
      const x = -0.6 + w / 2 + r() * (1.42 - w), y = lo + h / 2 + r() * (hi - lo - h);
      const q = { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
      if (hi - lo < h || overlaps(q, taken)) continue;
      taken.push(q);
      return [x, y];
    }
    return null;
  }

  /** where a thing of w × h can stand on a floor or shelf between lo and hi (its centre), if anywhere */
  private onFloor(w: number, h: number, shelves: Shelf[], lo: number, hi: number, taken: Rect[], r: () => number): [number, number] | null {
    const fit = shelves.filter((q) => q.mat !== 'chrome' && q.y >= lo && q.y + h <= hi + 0.1 && q.x1 - q.x0 > w + 0.06);
    for (let k = 0; k < 8 && fit.length; k++) {
      const s = fit[Math.floor(r() * fit.length)], x = s.x0 + 0.03 + w / 2 + r() * (s.x1 - s.x0 - w - 0.06), y = s.y + h / 2;
      const q = { x0: x - w / 2, y0: s.y, x1: x + w / 2, y1: s.y + h };
      if (overlaps(q, taken)) continue;
      taken.push(q);
      return [x, y];
    }
    return null;
  }

  /** a window, framed, what it looks out on, and the light it lets in */
  private window(s: Storey, th: Theme, r: () => number, lo: number, hi: number, taken: Rect[], view?: Theme['outside'] | (typeof MEMORIES)[number]['outside']): void {
    const w = 0.34, h = 0.44, at = this.onWall(w + 0.06, h + 0.08, lo, hi, taken, r);
    const o = view ?? th.outside;
    if (!at || !o) return;
    const [x, y] = at, plank = shared(`plank ${th.plank}`, () => new THREE.MeshStandardMaterial({ color: th.plank, roughness: 0.7 }));
    const glass = this.add(new THREE.Mesh(PLANE, shared(`outside ${o.top} ${o.view}`, () => new THREE.MeshBasicMaterial({ map: outside(o), fog: false }))));
    glass.scale.set(w, h, 1);
    glass.position.set(x, y, WALL + 0.003);
    const bar = (bx: number, by: number, bw: number, bh: number, d = 0.02) => {
      const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), plank));
      m.position.set(bx, by, WALL + d / 2);
      m.castShadow = m.receiveShadow = true;
    };
    bar(x, y + h / 2, w + 0.05, 0.025); bar(x, y - h / 2, w + 0.05, 0.025);
    bar(x - w / 2, y, 0.025, h); bar(x + w / 2, y, 0.025, h);
    bar(x, y, 0.012, h, 0.012); bar(x, y + 0.04, w, 0.012, 0.012);
    bar(x, y - h / 2 - 0.02, w + 0.1, 0.02, 0.05);
    if (!th.shaft) return;
    // a shaft of light, falling from the window across the room
    const geo = new THREE.BufferGeometry();
    const top = y + h / 2 - 0.03, bottom = y - h / 2 - 1.3;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([x - w / 2, top, WALL + 0.01, x + w / 2, top, WALL + 0.01, x + w / 2 + 0.55, bottom, 0.06, x - w / 2 + 0.55, bottom, 0.06], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    const m = this.add(new THREE.Mesh(geo, shared(`shaft ${th.mood.sun}`, () => new THREE.MeshBasicMaterial({ map: SHAFT, color: th.mood.sun, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))));
    m.renderOrder = 1;
  }

  /** in the sky, no walls: what the floor has floats at some distance, and things of the house drift by */
  private sky(s: Storey, th: Theme, r: () => number): void {
    const things = [...(s.first ? th.story : []), ...Array.from({ length: 2 + Math.floor(r() * 2) }, () => th.wall[Math.floor(r() * th.wall.length)])];
    const float = (name: string, faded: boolean) => {
      const a = art(name), m = this.add(new THREE.Mesh(PLANE, picture(name, faded, s.floor)));
      const z = name === 'moon' ? -2.4 : name === 'cloud' ? -1.3 - r() * 1.1 : -0.5 - r() * 1.6, y = s.bottom + r() * (s.top - s.bottom);
      m.scale.set(a.w * (name === 'cloud' ? 2 : 1.3), a.h * (name === 'cloud' ? 2 : 1.3), 1);
      m.position.set((r() - 0.5) * (2.4 - z), y, z);
      m.renderOrder = -1;
      this.floats.push({ m, y, phase: r() * 6.28, spin: name === 'cloud' || name === 'moon' ? 0 : 0.12 });
    };
    for (const name of things) float(name, false);
    if (th.life?.includes('memories')) for (let n = 1 + Math.floor(r() * 2); n > 0; n--) float(DRIFT[Math.floor(r() * DRIFT.length)], true);
  }

  /** what drifts in the air around the camera at height y: its kind may change as it climbs */
  private drift(kind: Air, now: number, dt: number, y: number): void {
    const A = AIRS[kind], m = this.air.material as THREE.PointsMaterial, p = this.motes;
    if (kind !== this.airKind) {
      this.airKind = kind;
      m.map = A.tex; m.color.set(A.color); m.size = A.size; m.blending = A.add ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.needsUpdate = true;
      for (let i = 0; i < MOTES; i++) p.set([(Math.random() - 0.5) * 2 * ROOM.x, y + (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2 * ROOM.z * 0.9], 3 * i);
    }
    m.opacity = A.opacity * (0.75 + 0.25 * Math.sin(now * 0.7));
    for (let i = 0; i < MOTES; i++) {
      const s = this.moteSeed[i];
      if (s > A.share) { p[3 * i + 1] = -1e4; continue; }
      p[3 * i] += (A.sway * Math.sin(now * (0.4 + s) + 10 * s)) * dt;
      p[3 * i + 1] += A.vy * (0.6 + 0.8 * s) * dt;
      // kept within the room, round the camera: what leaves comes back on the other side
      if (p[3 * i + 1] < y - 1.2 || p[3 * i + 1] > y + 1.2 || p[3 * i + 1] < -1e3) p[3 * i + 1] = A.vy >= 0 && p[3 * i + 1] > y ? y - 1.15 : A.vy < 0 && p[3 * i + 1] < y ? y + 1.15 : y + (Math.random() - 0.5) * 2.2;
      if (Math.abs(p[3 * i]) > ROOM.x) p[3 * i] = -Math.sign(p[3 * i]) * (ROOM.x - 0.01);
    }
    this.air.geometry.attributes.position.needsUpdate = true;
  }
}
