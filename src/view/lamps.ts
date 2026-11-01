// The lamps of the house: the pools of light the climb goes from one to the
// next through the dark (see `Lamp` in themes.ts). Each floor hangs its own
// along the wall, now on one side, now on the other: shaded lamps in the hall
// and the sitting room, bare bulbs on their flex in the wardrobe and the
// laundry, candles in the bedroom, night lights in the children's room.
//
// The lamp itself is decor (it glows past white: the bloom takes it); its
// light is one of a few spotlights that the stage keeps (`LampLights`) and
// gives to the lamps nearest the camera, each casting its shadows: the
// shadows of the bars fan out from the lamp across the wall. Their number
// never changes (three builds its shaders for a set of lights), and a light
// fades out before it goes from one lamp to another.

import * as THREE from 'three/webgpu';
import type { Lamp } from './themes';

/** a lamp on the wall: where, what kind, its colour and power, its flicker */
export interface Fixture { x: number; y: number; kind: Lamp['kind']; color: THREE.Color; power: number; phase: number }

const WALL = -0.1;

/** the lamps of a stretch of wall from y0 to y1, as `lamp` says, at random by `r` */
export function layFixtures(lamp: Lamp, y0: number, y1: number, r: () => number): Fixture[] {
  const out: Fixture[] = [], color = new THREE.Color(lamp.color);
  let side = r() < 0.5 ? -1 : 1;
  for (let y = y0 + 0.5 + r() * 0.4; y < y1 - 0.25; y += lamp.every * (0.85 + 0.3 * r())) {
    out.push({ x: side * (0.3 + 0.32 * r()), y, kind: lamp.kind, color, power: lamp.power, phase: r() * 100 });
    side = -side;
  }
  return out;
}

const BRASS = new THREE.MeshStandardMaterial({ color: '#6a5232', metalness: 0.8, roughness: 0.45 });
const FLEX = new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 0.8 });
const WAX = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.6 });
const glowing = new Map<string, THREE.MeshBasicMaterial>();
/** what glows: as bright as `k` × white in `color` (past white: the bloom takes it) */
function glow(color: THREE.Color, k: number): THREE.MeshBasicMaterial {
  const key = `${color.getHexString()} ${k}`;
  let m = glowing.get(key);
  if (!m) glowing.set(key, (m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k), fog: false })));
  return m;
}
const shades = new Map<string, THREE.MeshStandardMaterial>();
/** the fabric of a shade: lit from within, it glows its lamp's colour */
function shade(color: THREE.Color): THREE.MeshStandardMaterial {
  const key = color.getHexString();
  let m = shades.get(key);
  if (!m) shades.set(key, (m = new THREE.MeshStandardMaterial({ color: '#d9c7a8', roughness: 0.9, emissive: color, emissiveIntensity: 0.9, side: THREE.DoubleSide })));
  return m;
}

const SHAPES = {
  bracket: new THREE.BoxGeometry(0.012, 0.012, 0.05),
  plate: new THREE.CylinderGeometry(0.02, 0.02, 0.006, 16).rotateX(Math.PI / 2),
  shade: new THREE.CylinderGeometry(0.026, 0.046, 0.055, 24, 1, true),
  bulb: new THREE.SphereGeometry(0.014, 16, 12),
  socket: new THREE.CylinderGeometry(0.007, 0.007, 0.02, 12),
  flex: new THREE.CylinderGeometry(0.0016, 0.0016, 1, 6),
  candle: new THREE.CylinderGeometry(0.008, 0.008, 0.06, 14),
  dish: new THREE.CylinderGeometry(0.022, 0.016, 0.006, 18),
  flame: new THREE.SphereGeometry(0.006, 10, 8).scale(1, 2.2, 1),
  moon: new THREE.CircleGeometry(0.022, 24),
};

/** the lamp as seen: its fixture, and what glows of it (a candle's flame flickers: returned to be moved) */
export function fixtureMesh(f: Fixture): { group: THREE.Group; flame: THREE.Mesh | null } {
  const g = new THREE.Group(), add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  let flame: THREE.Mesh | null = null;
  switch (f.kind) {
    case 'sconce':
      add(SHAPES.plate, BRASS, 0, -0.02, WALL + 0.003);
      add(SHAPES.bracket, BRASS, 0, -0.02, WALL + 0.028);
      add(SHAPES.bulb, glow(f.color, 5), 0, -0.005, WALL + 0.05).scale.setScalar(0.6);
      add(SHAPES.shade, shade(f.color), 0, 0, WALL + 0.05);
      break;
    case 'bulb': {
      const flex = add(SHAPES.flex, FLEX, 0, 0.22, WALL + 0.06);
      flex.scale.y = 0.42;
      add(SHAPES.socket, FLEX, 0, 0.018, WALL + 0.06);
      add(SHAPES.bulb, glow(f.color, 4.5), 0, 0, WALL + 0.06);
      break;
    }
    case 'candle':
      add(SHAPES.bracket, BRASS, 0, -0.04, WALL + 0.025);
      add(SHAPES.dish, BRASS, 0, -0.033, WALL + 0.05);
      add(SHAPES.candle, WAX, 0, 0, WALL + 0.05);
      flame = add(SHAPES.flame, glow(new THREE.Color(1, 0.62, 0.25), 10), 0, 0.044, WALL + 0.05);
      break;
    case 'nightlight':
      add(SHAPES.moon, glow(f.color, 5), 0, 0, WALL + 0.004);
      break;
  }
  for (const c of g.children) c.castShadow = c !== flame && !(((c as THREE.Mesh).material as THREE.MeshBasicMaterial).isMeshBasicMaterial);
  g.position.set(f.x, f.y, 0);
  return { group: g, flame };
}

/** how a candle's light flickers, at time t (s): around 1 */
export function flicker(f: Fixture, t: number): number {
  if (f.kind !== 'candle') return 1;
  const p = f.phase;
  return 0.82 + 0.1 * Math.sin(t * 9.1 + p) + 0.06 * Math.sin(t * 23.7 + 2 * p) + 0.05 * Math.sin(t * 3.3 + 3 * p);
}

/** where the light of each kind is, from the lamp, and where it shines (offsets, m), how wide (rad) and how soft */
const BEAM: Record<Lamp['kind'], { from: [number, number, number]; to: [number, number, number]; angle: number; penumbra: number }> = {
  sconce: { from: [0, -0.01, WALL + 0.12], to: [0, -1, WALL], angle: 1.25, penumbra: 0.85 },
  bulb: { from: [0, -0.02, WALL + 0.16], to: [0, -1, WALL + 0.02], angle: 1.45, penumbra: 0.7 },
  candle: { from: [0, 0.05, WALL + 0.14], to: [0, -1, WALL], angle: 1.5, penumbra: 1 },
  nightlight: { from: [0, 0, WALL + 0.1], to: [0, 1, WALL - 0.05], angle: 1.4, penumbra: 1 },
};

/** a light is whole within this of the camera's focus (m), gone beyond FADE_OUT: it moves to another lamp unseen */
const FADE_IN = 1.2, FADE_OUT = 1.9;
/** the light of a lamp of power 1 (candela) */
const LAMP_GAIN = 0.75;
/** how the light of a lamp falls off with distance (2: physically) */
const LAMP_DECAY = 1.2;
/** the light of a searching lamp (candela): hard and white */
const SEARCH_LIGHT = 6;
/** the light that goes with the lace (candela) */
const LACE_LIGHT = 0.012;

/**
 * The lights of the lamps: a few spotlights, each casting shadows, given to
 * the lamps nearest the camera; and a faint light that goes with the lace,
 * so that it is never lost in the dark.
 */
export class LampLights {
  readonly spots: THREE.SpotLight[];
  readonly lace = new THREE.PointLight('#ffe8cc', LACE_LIGHT, 0.7, 2);
  /** the light of a searching lamp (the nearest), its shadows where the lace can hide */
  readonly search = new THREE.SpotLight('#fff2d8', 0, 4, 0.2, 0.35, 2);
  private order: Fixture[] = [];

  constructor(scene: THREE.Scene, count = 3) {
    this.spots = Array.from({ length: count }, () => {
      // (a falloff gentler than the inverse square: a pool of light round the lamp, not a white spot on the wall behind it)
      const s = new THREE.SpotLight('#ffffff', 0, 4, 1, 0.8, LAMP_DECAY);
      s.castShadow = true;
      s.shadow.mapSize.set(1024, 1024);
      s.shadow.bias = -0.0006;
      s.shadow.normalBias = 0.003;
      s.shadow.radius = 4;
      s.shadow.camera.near = 0.02;
      s.shadow.camera.far = 4;
      scene.add(s, s.target);
      return s;
    });
    scene.add(this.lace);
    const s = this.search;
    s.castShadow = true;
    s.shadow.mapSize.set(1024, 1024);
    s.shadow.bias = -0.0006;
    s.shadow.normalBias = 0.003;
    s.shadow.camera.near = 0.03;
    s.shadow.camera.far = 4;
    scene.add(s, s.target);
  }

  /** the searching lamp at (x, y), its beam turned `angle` from straight down, `half` wide (rad); null: none near */
  beam(at: { x: number; y: number; angle: number; half: number } | null): void {
    const s = this.search;
    s.intensity = at ? SEARCH_LIGHT : 0;
    if (!at) return;
    s.angle = at.half * 1.15;
    s.position.set(at.x, at.y - 0.03, 0.02);
    s.target.position.set(at.x + Math.sin(at.angle), at.y - Math.cos(at.angle), 0);
  }

  /** the lamps lit round (x, y), at time t; the lace's own light at `lace` (null: none); `dark`: the lights out (a blackout, 0 to 1), the lace's glow alone */
  light(fixtures: readonly Fixture[], x: number, y: number, t: number, lace: THREE.Vector3 | null, dark = 0): void {
    const d = (f: Fixture) => Math.hypot(f.x - x, f.y - y);
    this.order = fixtures.filter((f) => d(f) < FADE_OUT).sort((a, b) => d(a) - d(b)).slice(0, this.spots.length);
    this.spots.forEach((s, k) => {
      const f = this.order[k];
      // (never hidden: a light that comes and goes makes three build every shader again)
      if (!f) { s.intensity = 0; return; }
      const b = BEAM[f.kind], fade = 1 - THREE.MathUtils.smoothstep(d(f), FADE_IN, FADE_OUT);
      s.position.set(f.x + b.from[0], f.y + b.from[1], b.from[2]);
      s.target.position.set(f.x + b.to[0], f.y + b.to[1], b.to[2]);
      s.angle = b.angle;
      s.penumbra = b.penumbra;
      s.color.copy(f.color);
      s.intensity = LAMP_GAIN * f.power * fade * flicker(f, t) * (1 - dark);
    });
    this.lace.intensity = lace ? LACE_LIGHT * (1 + 9 * dark) : 0;
    this.lace.distance = 0.7 + 0.5 * dark;
    if (lace) this.lace.position.set(lace.x, lace.y + 0.03, 0.14);
  }
}
