// The decor of a window of the course: the walls of each floor, papered as
// its theme says: hung with its cloth (or papered, as before: ?papier), the
// height gauge, the red thread that runs up through the house, the windows
// and what they look out on (on paper only); above the house, the sky. And
// what lives in it: dust in the air, shooting stars, clouds. Built with the
// scenery, into its group, dropped with it.
//
// Nothing stands between the camera and the room: the silhouettes that did,
// and then the blurred threads, read as cut-outs or as black bars.
//
// None of it is in the solver: it costs nothing to the physics. It is all on
// the wall, behind what is played with, or far behind in the sky.

import * as THREE from 'three/webgpu';
import type { Storey } from '../gen/course';
import { HOUSE } from '../gen/floors';
import { ROOM } from '../level/level';
import { fixtureMesh, flicker, layFixtures, type Fixture } from './lamps';
import { art, DOT, gauge, outside, relief, RING, seeded, sky, TILE, wallpaper } from './paint';
import { MEMORIES, THEMES, type Air, type Cloth, type Theme } from './themes';
import { hash2, tsl, type ShaderNode } from './tsl';

const {
  color, cos, float, floor, fract, fwidth, instancedBufferAttribute, materialColor, max, mix, mx_fractal_noise_float, normalize, positionView,
  positionWorld, pow, select, sin, smoothstep, texture, transformNormalToView, uniform, uv, vec2, vec3, vec4,
} = tsl;

/** the walls of the house hung with cloth; papered as before with ?papier */
const CLOTHED = !new URLSearchParams(location.search).has('papier');

export const theme = (f: number): Theme => THEMES[Math.min(f, THEMES.length - 1)];

/** a floor's stretch of height, in this window: [y0, y1], and whether its top is where the next floor begins */
export interface Band { floor: number; y0: number; y1: number; closed: boolean }

/**
 * The light of a height, mixed between two floors near where they meet.
 * `shade`: how much the key light's shadows show (0 to 1); `front`: where it
 * stands, raking the wall from one side (0) or from just above the camera
 * (1). A floor lit by its lamps has their long shadows alone: there, the key
 * light comes from the front, and only leaves a short soft shadow under each
 * bar (it stands out from the wall), never a second long one from a light
 * nowhere to be seen.
 */
export interface Light { bg: THREE.Color; sky: THREE.Color; ground: THREE.Color; ambient: number; sun: THREE.Color; sunI: number; rays: number; shade: number; front: number }

const WALL = -ROOM.z;
const W = 2 * ROOM.x;
/** the floors of the house that keep the height gauge (not the roof) */
const GAUGED = HOUSE - 1;

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

/** how bright the outside is through a window, × white */
const WINDOW_LIGHT = 1.8;
/** the clock of what twinkles (s) */
const clock = uniform(0);
/** how bright a star is, × white */
const STAR_LIGHT = 3;

/**
 * Points of light or dust, each a sprite facing the camera, `pos` 3 numbers
 * a point (WebGPU draws points a pixel wide: these are quads, instanced)
 */
function sprites(pos: THREE.InstancedBufferAttribute, m: THREE.PointsNodeMaterial): THREE.Sprite {
  m.positionNode = instancedBufferAttribute(pos);
  const s = new THREE.Sprite(m);
  s.count = pos.count;
  s.frustumCulled = false;
  return s;
}

/** a stitch over the seam where two cloths meet */
const STITCH = new THREE.CapsuleGeometry(0.0022, 0.013, 2, 6);
kept.add(STITCH);
/** how far apart the stitches (m) */
const STITCH_EVERY = 0.022;

const SHAFT = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d')!, gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();

/**
 * The paper of a floor: its motif embossed (the light grazing it picks it
 * out), and grimy: stains of damp and smoke, darker in the corners, the
 * paper paler only where the frames hung
 */
function paper(floor: number, motif: Theme['paper']['motif'], colors: Theme['paper']['colors']): THREE.Material {
  return shared(`paper ${floor}`, () => {
    const map = wallpaper(motif, colors);
    const m = new THREE.MeshStandardNodeMaterial({ map, normalMap: relief(map, motif === 'bricks' || motif === 'beams' ? 4 : 2.5), roughness: 0.95 });
    m.normalScale.set(1, 1);
    const p = positionWorld.xy;
    // broad stains of damp and smoke, browner than the paper; a few darker spots of mould
    const stain = smoothstep(0.35, 0.75, mx_fractal_noise_float(vec3(p.x.mul(0.9), p.y.mul(0.6), 0.5), 4, 2, 0.5, 1).mul(0.5).add(0.5));
    const spots = smoothstep(0.7, 0.85, mx_fractal_noise_float(vec3(p.mul(5), 3.1), 3, 2, 0.5, 1).mul(0.5).add(0.5));
    // towards the sides of the room the paper is older, as if the light never reached it
    const edge = smoothstep(0.45, 0.85, p.x.abs());
    const tint = mix(vec3(1), vec3(0.62, 0.52, 0.4), stain.mul(0.6).add(spots.mul(0.3)).add(edge.mul(0.35)));
    m.colorNode = materialColor.mul(vec4(tint.mul(vec3(0.9, 0.86, 0.8)), 1));
    return m;
  });
}

/**
 * The weave of a cloth at q (m): how high the thread on top stands there (0
 * to 1), and which thread it is (a number, for its colour). Plain weave and
 * twill: the threads up and down (warp) and across (weft) go over and under
 * each other, by one or by two; knit: rows of V's, each leg a slanted
 * ellipse; felt and velvet: no threads to see, a fine fuzz.
 */
function weave(c: Cloth, q: ShaderNode): { h: ShaderNode; id: ShaderNode } {
  const P = Math.PI;
  if (c.weave === 'plain' || c.weave === 'twill') {
    const u = q.x.div(c.pitch), v = q.y.div(c.pitch), i = floor(u), j = floor(v);
    // how high each of the two threads crossing here rides: on top at one crossing, under at the next (twill: two by two)
    const up = c.weave === 'plain' ? cos(v.sub(0.5).add(i).mul(P)) : sin(v.sub(i).mul(P / 2));
    const down = c.weave === 'plain' ? cos(u.sub(0.5).add(j).mul(P)).negate() : sin(j.sub(u).add(1).mul(P / 2)).negate();
    // a thread is round: highest along its middle
    const warp = pow(sin(fract(u).mul(P)), 0.6).mul(up.mul(0.35).add(0.65));
    const weft = pow(sin(fract(v).mul(P)), 0.6).mul(down.mul(0.35).add(0.65));
    return { h: max(warp, weft), id: select(warp.greaterThan(weft), i, j.add(5000)) };
  }
  if (c.weave === 'knit') {
    const u = q.x.div(c.pitch), v = q.y.div(c.pitch * 0.8), fu = fract(u), j = floor(v);
    let h: ShaderNode = float(0);
    // the legs of this row's stitch, and of the rows above and below, which reach into it
    for (const k of [-1, 0, 1]) {
      const fv = fract(v).sub(k);
      for (const s of [-1, 1]) {
        const dx = fu.sub(0.5 + 0.21 * s), dy = fv.sub(0.5);
        const along = dx.mul(0.387 * s).add(dy.mul(0.922)), across = dx.mul(0.922).sub(dy.mul(0.387 * s));
        h = max(h, float(1).sub(along.div(0.62).pow(2)).sub(across.div(0.2).pow(2)).max(0).sqrt());
      }
    }
    return { h, id: j };
  }
  // felt, velvet: a fuzz of fibres
  return { h: mx_fractal_noise_float(vec3(q.mul(c.weave === 'felt' ? 160 : 400), 0.3), 2, 2, 0.5, 1).mul(0.5).add(0.5), id: float(0) };
}

/**
 * A wall of cloth: woven, its threads in relief under the
 * grazing light of the lamps, each thread a little lighter or darker than the
 * next and now and then one of another colour (knit: a stripe); hung in
 * folds, darker in their hollows. Velvet shines at the grazing angles. The
 * weave fades to its average colour where its threads get thinner than the
 * pixels (the editor, from afar).
 */
function cloth(level: number, c: Cloth): THREE.Material {
  return shared(`cloth ${level}`, () => {
    const [main, shade, accent] = c.colors.map((h) => color(h));
    const m = c.weave === 'velvet'
      ? new THREE.MeshPhysicalNodeMaterial({ roughness: 0.85, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(c.colors[0]).lerp(new THREE.Color('#ffffff'), 0.35) })
      : new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
    const p = positionWorld.xy;
    const threads = c.weave !== 'felt' && c.weave !== 'velvet';
    // the threads fade out as they get thinner than two pixels
    const fine = float(1).sub(smoothstep(0.2, 0.5, fwidth(p.x).div(c.pitch)));
    /** the folds: vertical, as hung, wandering a little as they go down (m, ± FOLD × folds) */
    const FOLD = 0.012;
    const folds = (q: ShaderNode) => {
      if (!c.folds) return float(0);
      const n = mx_fractal_noise_float(vec3(q.x.mul(1.3), q.y.mul(0.35), 7.1), 2, 2, 0.5, 1);
      return sin(q.x.mul((2 * Math.PI) / 0.16).add(n.mul(5))).mul(0.6).add(sin(q.x.mul((2 * Math.PI) / 0.41).add(n.mul(3)).add(1.3)).mul(0.4)).mul(FOLD * c.folds);
    };
    const depth = threads ? c.pitch * 0.18 : 0.0005;
    const height = (q: ShaderNode) => folds(q).add(weave(c, q).h.mul(depth).mul(fine));
    // the slope of the cloth, from its height a fraction of a millimetre away
    const e = 0.0006, h0 = height(p);
    const slope = vec2(height(p.add(vec2(e, 0))).sub(h0), height(p.add(vec2(0, e))).sub(h0)).div(e);
    m.normalNode = transformNormalToView(normalize(vec3(slope.negate(), 1)));

    const w = weave(c, p), tint = hash2(vec2(w.id, 3.7));
    let col: ShaderNode = c.weave === 'felt' ? mix(shade, main, w.h.mul(0.3).add(0.7))
      : c.weave === 'velvet' ? main
      : mix(shade, main, w.h.mul(0.6).add(0.4)).mul(tint.mul(0.16).add(0.92));
    // now and then a thread of another colour; in a knit, a stripe two rows wide
    const other = c.weave === 'knit'
      ? hash2(vec2(floor(w.id.div(9)), 11.3)).greaterThan(0.7).and(w.id.sub(floor(w.id.div(9)).mul(9)).lessThan(2))
      : hash2(vec2(w.id, 11.3)).greaterThan(0.985);
    if (threads) col = select(other, mix(col, accent, 0.7).mul(w.h.mul(0.5).add(0.5)), col);
    col = mix(mix(shade, main, 0.75), col, fine);
    // darker in the hollows of the folds, and in broad patches (dyed unevenly, faded)
    if (c.folds) col = col.mul(smoothstep(-1, 1, folds(p).div(FOLD * c.folds)).mul(0.3).add(0.7));
    col = col.mul(mx_fractal_noise_float(vec3(p.mul(c.weave === 'felt' ? 6 : 2.2), 1.7), 2, 2, 0.5, 1).mul(0.1).add(1));
    m.colorNode = vec4(col, 1);
    return m;
  });
}

/** a picture's material: lit like the wall and a little dulled, or glowing (the sky: dimmed as dark as its floor) */
function picture(name: string, floor = 0): THREE.Material {
  const a = art(name);
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
  bg: new THREE.Color(t.mood.bg), sky: new THREE.Color(t.mood.sky), ground: new THREE.Color(t.mood.ground), ambient: t.mood.ambient, sun: new THREE.Color(t.mood.sun), sunI: t.mood.sunI, rays: t.mood.rays ?? 0, shade: t.lamp ? 0.5 : 1, front: t.lamp ? 1 : 0,
}));

export interface Rect { x0: number; y0: number; x1: number; y1: number }
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
  /** the lamps on its walls (lamps.ts): the stage lights those nearest the camera */
  readonly fixtures: Fixture[] = [];
  private flames: { f: Fixture; flame: THREE.Mesh }[] = [];
  private own: { dispose(): void }[] = [];
  private floats: { m: THREE.Object3D; y: number; phase: number; spin: number }[] = [];
  private streak: THREE.Mesh;
  private streakT = 99;
  private air: THREE.Sprite;
  private airKind: Air = 'none';
  private motes = new Float32Array(MOTES * 3);
  private moteAt = new THREE.InstancedBufferAttribute(this.motes, 3);
  private moteSeed = Float32Array.from({ length: MOTES }, () => Math.random());
  private light: Light = { bg: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color(), ambient: 1, sun: new THREE.Color(), sunI: 1, rays: 0, shade: 1, front: 0 };

  /** the decor of `storeys` (the sections of the window), for course `seed`; the best height reached, marked on the gauge */
  /** `avoid`: where the level has things on the wall (a clock's face): nothing is hung there */
  constructor(private group: THREE.Group, storeys: Storey[], seed: number, bottom: number, top: number, best: number, private avoid: Rect[] = []) {
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

    // a shooting star, what drifts in the air: wherever the camera is
    this.streak = this.add(new THREE.Mesh(PLANE, shared('streak', () => new THREE.MeshBasicMaterial({ map: DOT, color: '#fff6dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
    this.streak.visible = false;
    this.air = sprites(this.moteAt, new THREE.PointsNodeMaterial({ map: DOT, size: 0.012, transparent: true, depthWrite: false, opacity: 0 }));
    this.group.add(this.air);
    this.own.push(this.air.material as THREE.Material);
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
    L.rays = a.rays + (c.rays - a.rays) * t;
    L.shade = a.shade + (c.shade - a.shade) * t;
    L.front = a.front + (c.front - a.front) * t;
    return L;
  }

  /** what lives: `now` seconds of the clock, the camera at height y */
  update(now: number, dt: number, y: number): void {
    clock.value = now;
    for (const { f, flame } of this.flames) { const k = flicker(f, now); flame.scale.set(0.8 + 0.3 * k, 0.7 + 0.4 * k, 1); }
    for (const f of this.floats) {
      f.m.position.y = f.y + 0.04 * Math.sin(now * 0.4 + f.phase);
      f.m.rotation.z = f.spin * Math.sin(now * 0.25 + f.phase);
    }
    const th = theme(this.floorAt(y));
    // now and then, a shooting star
    this.streakT += dt;
    if (th.shooting && this.streakT > 6 + 5 * this.moteSeed[0]) {
      this.streakT = 0;
      this.moteSeed[0] = Math.random();
      this.streak.userData = { x: -2 + 3 * Math.random(), y: y + 0.6 + 0.8 * Math.random() };
    }
    const st = this.streakT / 0.9;
    this.streak.visible = st < 1 && !!th.shooting;
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
      const wall = this.add(new THREE.Mesh(geo, CLOTHED && th.cloth ? cloth(b.floor, th.cloth) : paper(b.floor, th.paper.motif, th.paper.colors)));
      wall.position.set(0, mid, WALL);
      wall.receiveShadow = true;
      for (const s of [-1, 1]) {
        // the sides of the room in shadow: the room is a box of dark round its lamps
        const side = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 2 * ROOM.z + 0.1), shared(`side ${b.floor}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(th.side).multiplyScalar(0.35), roughness: 0.8 }))));
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
    if (th.lamp) {
      for (const f of layFixtures(th.lamp, b.y0, b.y1, seeded('lamps', b.floor, b.y0))) {
        const { group, flame } = fixtureMesh(f);
        this.add(group);
        this.fixtures.push(f);
        if (flame) this.flames.push({ f, flame });
      }
    }
  }

  /** where two floors meet: under, the ceiling's moulding; over, the skirting board; out of the house, a ledge of stone; two cloths, sewn together */
  private seam(below: Band, above: Band): void {
    const F = below.y1, a = theme(above.floor), u = theme(below.floor);
    if (u.paper.motif === 'none') return;
    if (CLOTHED && u.cloth && a.cloth) { this.sew(F, a.cloth.colors[2]); return; }
    const strip = (y: number, h: number, d: number, color: string) => {
      const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(W, h, d), shared(`trim ${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))));
      m.position.set(0, y, WALL + d / 2);
      m.castShadow = m.receiveShadow = true;
    };
    if (a.paper.motif === 'none') { strip(F - 0.045, 0.07, 0.03, '#8a8278'); return; }
    strip(F - 0.06, 0.05, 0.02, '#f2ece0');
    strip(F + 0.035, 0.07, 0.016, a.plank);
  }

  /** a seam across the wall at height y: a fold in shadow, stitches over it in `thread` */
  private sew(y: number, thread: string): void {
    const fold = this.add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.008, 0.004), shared('seam', () => new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 1 }))));
    fold.position.set(0, y, WALL + 0.002);
    const n = Math.floor(W / STITCH_EVERY), m = new THREE.InstancedMesh(STITCH, shared(`stitch ${thread}`, () => new THREE.MeshStandardMaterial({ color: thread, roughness: 0.8 })), n);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      o.position.set(-ROOM.x + (i + 0.5) * STITCH_EVERY, y, WALL + 0.004);
      o.rotation.set(0, 0, 0.8);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.castShadow = m.receiveShadow = true;
    this.add(m);
    this.own.push(m);
  }

  /** the stars of a sky, twinkling */
  private starry(n: number, b: Band, floor: number): void {
    const r = seeded('stars', floor, b.y0), pos = new Float32Array(3 * n), phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(r() - 0.5) * 12, b.y0 - 2 + r() * (b.y1 - b.y0 + 4), -2.6], 3 * i);
      phase[i] = r() * 6.28;
    }
    const at = new THREE.InstancedBufferAttribute(pos, 3), ph = instancedBufferAttribute(new THREE.InstancedBufferAttribute(phase, 1));
    const m = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
    // a star twinkles, brighter than white: it glows on an HDR screen and in the bloom
    const glow = sin(clock.mul(fract(ph.mul(3.1)).add(0.8)).add(ph)).mul(0.45).add(0.55);
    m.colorNode = vec4(vec3(1, 0.96, 0.88).mul(STAR_LIGHT), glow.mul(texture(DOT, uv()).a));
    m.sizeNode = fract(ph.mul(7.3)).mul(14).add(18).mul(float(4).div(positionView.z.negate()));
    const p = sprites(at, m);
    p.renderOrder = -1;
    this.add(p);
    this.own.push(m);
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
   * What a section has on its walls: the height gauge, a window now and then;
   * a rare one opens on a memory. In the sky, clouds drift at some distance.
   */
  private furnish(s: Storey, seed: number, best: number): void {
    const th = theme(s.floor), r = seeded(seed, s.index, 'decor');
    const lo = s.bottom + 0.1, hi = s.ceiling !== undefined && s.above !== s.floor ? s.ceiling - 0.08 : s.top - 0.02;
    const taken: Rect[] = this.avoid.filter((q) => q.y1 > s.bottom && q.y0 < s.top);
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
    // (the cloth has no windows: the room is told by its material and its light)
    if (!CLOTHED && (memory || r() < th.windows)) this.window(s, th, r, lo, hi, taken, memory?.outside);
  }

  /** where a thing of w × h (a window) can hang on the wall, away from what is there (its centre), if anywhere */
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

  /** a window, framed, what it looks out on, and the light it lets in */
  private window(s: Storey, th: Theme, r: () => number, lo: number, hi: number, taken: Rect[], view?: Theme['outside'] | (typeof MEMORIES)[number]['outside']): void {
    const w = 0.34, h = 0.44, at = this.onWall(w + 0.06, h + 0.08, lo, hi, taken, r);
    const o = view ?? th.outside;
    if (!at || !o) return;
    const [x, y] = at, plank = shared(`plank ${th.plank}`, () => new THREE.MeshStandardMaterial({ color: th.plank, roughness: 0.7 }));
    // the outside glows through the glass, brighter than the dim room: past white, the bloom takes it
    const glass = this.add(new THREE.Mesh(PLANE, shared(`outside ${o.top} ${o.view}`, () => new THREE.MeshBasicMaterial({ map: outside(o), fog: false, color: new THREE.Color().setScalar(WINDOW_LIGHT) }))));
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

  /** in the sky, no walls: the moon over the first section of its floor, clouds at some distance */
  private sky(s: Storey, th: Theme, r: () => number): void {
    const things = [...(s.first && th.moon ? ['moon'] : []), ...Array.from({ length: th.clouds ?? 0 }, () => 'cloud')];
    for (const name of things) {
      const a = art(name), m = this.add(new THREE.Mesh(PLANE, picture(name, s.floor)));
      const z = name === 'moon' ? -2.4 : -1.3 - r() * 1.1, y = s.bottom + r() * (s.top - s.bottom);
      m.scale.set(a.w * (name === 'cloud' ? 2 : 1.3), a.h * (name === 'cloud' ? 2 : 1.3), 1);
      m.position.set((r() - 0.5) * (2.4 - z), y, z);
      m.renderOrder = -1;
      this.floats.push({ m, y, phase: r() * 6.28, spin: 0 });
    }
  }

  /** what drifts in the air around the camera at height y: its kind may change as it climbs */
  private drift(kind: Air, now: number, dt: number, y: number): void {
    const A = AIRS[kind], m = this.air.material as THREE.PointsNodeMaterial, p = this.motes;
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
    this.moteAt.needsUpdate = true;
  }
}
