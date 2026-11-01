// The air of the climb: what makes a still picture live. A haze before the
// wall, lit by the lamps as dust or steam would be, drifting up; banks of mist
// across the sky, at three depths that drift at three speeds; a halo round
// every lamp, in the dusty air; smoke rising from every flame. All of it
// worked out on the GPU from the clock: nothing is moved from the CPU.
//
// None of it is in the solver, and none of it writes the depth: the depth of
// field and the occlusion see the room behind it.

import * as THREE from 'three/webgpu';
import { DOT } from './paint';
import { tsl, type ShaderNode } from './tsl';

const { color, float, fract, instancedBufferAttribute, mrt, mx_fractal_noise_float, positionWorld, sin, smoothstep, texture, uniform, uv, vec3, vec4 } = tsl;

/** the clock of what moves by itself (s) */
export const clock = uniform(0);

/**
 * What a glow or a puff writes into the image's normals: nothing (its quad,
 * facing the camera, would be taken for a surface, and the occlusion would
 * darken a square round it)
 */
const NO_NORMAL = () => mrt({ normal: vec4(0, 0, 0, 0) });

/** a sprite's size node for a size in metres (the camera's field is 38° high) */
const METRES = 1 / Math.tan((19 * Math.PI) / 180);

/**
 * A sheet of mist: patches of it, thicker here, thinner there, at most
 * `amount` thick, drifting `rise` m/s up and `drift` across. `scale`: how many
 * patches a metre; across, they are `stretch` times longer than high. `lit`:
 * lit as the room is (the lamps light it from within), or glowing by itself
 * (the sky's).
 */
export interface Mist { color: string; amount: number; rise: number; drift: number; scale: number; stretch: number; lit: boolean; seed: number }

export function mist(o: Mist): THREE.Material {
  const m = o.lit
    ? new THREE.MeshStandardNodeMaterial({ roughness: 1, transparent: true, depthWrite: false })
    : new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const p = positionWorld.xy;
  const at = vec3(p.x.sub(clock.mul(o.drift)).mul(o.scale / o.stretch), p.y.sub(clock.mul(o.rise)).mul(o.scale), clock.mul(0.02).add(o.seed));
  const n = mx_fractal_noise_float(at, 3, 2, 0.5, 1).mul(0.5).add(0.5);
  m.colorNode = color(o.color);
  m.opacityNode = smoothstep(0.47, 0.72, n).mul(o.amount);
  return m;
}

/**
 * Points that glow, each a soft disc facing the camera: `at` four numbers a
 * point (where, and a phase); `size` (m) and `glow` (its colour × how bright,
 * and how opaque) worked out from the phase. Added to the light behind.
 */
function glows(at: Float32Array, make: (src: ShaderNode) => { position: ShaderNode; size: ShaderNode; color: ShaderNode; alpha: ShaderNode }): THREE.Sprite {
  const src = instancedBufferAttribute(new THREE.InstancedBufferAttribute(at, 4));
  const m = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const g = make(src);
  m.positionNode = g.position;
  m.sizeNode = g.size.mul(METRES);
  m.colorNode = vec4(g.color, g.alpha.mul(texture(DOT, uv()).a));
  m.mrtNode = NO_NORMAL();
  const s = new THREE.Sprite(m);
  s.count = at.length / 4;
  s.frustumCulled = false;
  s.renderOrder = 3;
  return s;
}

/** a light round a lamp: (x, y, z) where, its colour, how far it reaches (m); `flicker`: a candle's */
export interface Halo { x: number; y: number; z: number; color: THREE.Color; reach: number; flicker: boolean }

/**
 * The halos round the lamps: the air glows round each, as dusty air does,
 * the more the closer. A candle's breathes with its flame.
 */
export function halos(list: Halo[]): THREE.Sprite | null {
  if (!list.length) return null;
  const c = list[0].color, reach = list[0].reach, flick = list[0].flicker;
  const at = new Float32Array(list.flatMap((h, k) => [h.x, h.y, h.z, k * 1.7]));
  return glows(at, (src) => {
    const breath = flick ? sin(clock.mul(9.1).add(src.w)).mul(0.08).add(sin(clock.mul(3.3).add(src.w.mul(3))).mul(0.06)).add(0.86) : float(1);
    return { position: src.xyz, size: float(2 * reach), color: vec3(c.r, c.g, c.b).mul(0.9), alpha: breath.mul(0.32) };
  });
}

/** how many puffs of smoke a flame gives at once, how long one lives (s), how high it goes (m) */
const PUFFS = 9, PUFF_LIFE = 3.2, PUFF_RISE = 0.32;

/**
 * Smoke from flames (x, y: the tip of each): puffs that rise, sway, widen
 * and thin away, one after another. Thin and grey, never past the light of
 * the room: it shows against a lit wall, and softens what is behind it.
 */
export function smoke(tips: { x: number; y: number; z: number }[]): THREE.Sprite | null {
  if (!tips.length) return null;
  const at = new Float32Array(tips.flatMap((t, k) => Array.from({ length: PUFFS }, (_, i) => [t.x, t.y, t.z, i / PUFFS + k * 0.37]).flat()));
  const m = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const src = instancedBufferAttribute(new THREE.InstancedBufferAttribute(at, 4));
  const t = fract(clock.div(PUFF_LIFE).add(src.w));
  const sway = sin(t.mul(6).add(src.w.mul(40)).add(clock.mul(0.7))).mul(t).mul(0.03);
  m.positionNode = src.xyz.add(vec3(sway, t.mul(PUFF_RISE), 0));
  m.sizeNode = t.mul(0.07).add(0.012).mul(METRES);
  m.colorNode = vec4(vec3(0.62, 0.6, 0.58), smoothstep(0, 0.12, t).mul(float(1).sub(t)).mul(0.22).mul(texture(DOT, uv()).a));
  m.mrtNode = NO_NORMAL();
  const s = new THREE.Sprite(m);
  s.count = at.length / 4;
  s.frustumCulled = false;
  s.renderOrder = 3;
  return s;
}
