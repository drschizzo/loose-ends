// What the lace and the cords are made of, drawn in the fragment shader from
// where each point lies on its tube (after examples/knots/rope.ts of
// cable-kit): `tubeCoord` gives how far along the cord at rest and the angle
// round it, so the pattern stays put on the cord as it moves. The tag of each
// tube (the last argument of `lay`) picks its make:
//
//   LAID: three strands twisted round one another (cords, yarn);
//   BRAIDED: a braided sheath with a stripe of a second colour (the lace);
//   SMOOTH: nothing but its colour (noodles).
//
// The glow of each node (`tubeTint`) is added to the light the cord gives
// off: the stretch a grip holds up, an end about to grip.
//
// How worn the cord is there (`tubeWear`, 0 to 1) masks its fibres, after the
// fibre-level cloth of Wu and Yuksel (I3D 2017), where each fibre is drawn
// from the curve of its yarn: worn, fibres go missing one by one (the darker
// core shows where they were), the broken ones fray out from the surface, and
// the cord thins until it is torn through (see `frayed`, on the vertices).
//
// Written in TSL, for WebGPURenderer: the relief of the strands bumps the
// normal from its screen derivatives (no tangent needed).

import * as THREE from 'three/webgpu';
import { tubeCoord, tubeRadius, tubeTint, tubeWear } from '@drschizzo/three-cable-tubes/webgpu';
import { hash2, tsl, type ShaderNode } from './tsl';

export const LAID = 0, BRAIDED = 1, SMOOTH = 2;

const {
  Fn, PI, abs, atan, clamp, dFdx, dFdy, faceDirection, float, floor, fract, fwidth, length, max, mix, mod, normalLocal,
  normalView, normalize, positionView, select, sign, sin, smoothstep, sqrt, step, uniform, vec2, vec3, vec4, vertexColor,
} = tsl;

/** the cross-section of a strand at v (0 to 1 across it): its height */
const strand = (v: ShaderNode) => {
  const w = clamp(v.mul(2).sub(1), -0.97, 0.97);
  return sqrt(float(1).sub(w.mul(w)));
};

/** the normal `n` (view space) bumped by a height whose screen derivatives are `dH`, at the point `p` (Mikkelsen) */
const bump = Fn(([p, n, dH]: ShaderNode[]) => {
  const sx = dFdx(p), sy = dFdy(p);
  const r1 = sy.cross(n), r2 = n.cross(sx);
  const det = sx.dot(r1).mul(faceDirection);
  const grad = sign(det).mul(r1.mul(dH.x).add(r2.mul(dH.y)));
  return normalize(n.mul(abs(det)).sub(grad));
});

/**
 * The surface at a point: its height (0 in a groove, 1 on top of a strand),
 * its tone (the stripe of the braid, a darker strand of the twist), whether
 * its fibre is gone with wear, and how fine the pattern is on screen (0: finer
 * than a pixel, 1: seen whole).
 */
function surface() {
  const s = tubeCoord.x, tag = tubeCoord.w;
  const a = atan(tubeCoord.z, tubeCoord.y).div(2 * Math.PI);
  const R = max(tubeRadius, 1e-4);
  // laid: three strands, each a twist of fibres
  const f = a.add(s.div(R.mul(7))).mul(3);
  const g = a.sub(s.div(R.mul(2.2))).mul(18);
  const laidH = strand(fract(f)).mul(sin(g.mul(2 * Math.PI)).mul(0.03).add(0.97));
  const laidTone = select(mod(floor(f), 3).lessThan(0.5), 0.08, 0);
  // braided: two sets of strands over and under one another
  const P = R.mul(9);
  const u1 = a.add(s.div(P)).mul(12), u2 = a.sub(s.div(P)).mul(12);
  const first = mod(floor(u1).add(floor(u2)), 4).lessThan(2);
  const u = select(first, u1, u2), along = fract(select(first, u2, u1));
  const braidH = strand(fract(u)).mul(sin(along.mul(PI)).mul(0.25).add(0.75));
  const bundle = mod(floor(u), 12);
  const braidTone = select(first.and(bundle.lessThan(0.5).or(abs(bundle.sub(6)).lessThan(0.5))), 1, 0);
  const laid = tag.lessThan(0.5), braided = tag.greaterThan(0.5).and(tag.lessThan(1.5));
  let H = select(laid, laidH, select(braided, braidH, 1));
  const tone = select(laid, laidTone, select(braided, braidTone, 0));
  // worn: each fibre (a strand of the braid, a fibre of the twist) is gone if its own threshold is below the wear
  const fibre = select(braided, vec2(floor(u1), floor(u2)), vec2(floor(g), floor(s.div(R.mul(1.2)))));
  const gone = step(hash2(fibre), tubeWear.mul(1.4).sub(0.05)).mul(step(0.001, tubeWear));
  // the fuzz of broken fibres round a gap
  const fuzz = hash2(floor(vec2(s.div(R.mul(0.15)), a.mul(80))));
  H = mix(H, fuzz.mul(0.5).add(0.15), gone);
  // fine on screen: the pattern fades out before it would shimmer
  const fine = clamp(float(1.5).sub(length(fwidth(vec2(s.div(R), a.mul(2 * Math.PI)))).mul(6)), 0, 1);
  return { H: mix(0.8, H, fine), tone, gone, fine, R, braided, smooth: tag.greaterThan(1.5) };
}

/** the material of every cord of the game: give it to a `TubeMesh`, then `frayed` its tubes */
export function laceMaterial(stripe = new THREE.Color('#2b2f3a')): THREE.MeshPhysicalNodeMaterial {
  const m = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.75, sheen: 0.8, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffffff') });
  const { H, tone, gone, fine, R, braided, smooth } = surface();
  const stripeU = uniform(stripe);
  const diffuse = vertexColor().rgb;
  let base = select(braided, mix(diffuse, stripeU, tone), diffuse.mul(tone.oneMinus()));
  // worn, the sheath goes grimy; where fibres are gone, the core shows: dark, browner as the wear goes deep
  base = base.mul(tubeWear.mul(0.4).oneMinus());
  base = mix(base, vec3(0.16, 0.11, 0.08).mul(H.mul(0.4).add(0.6)), gone.mul(tubeWear.mul(0.25).add(0.75)));
  const color = base.mul(mix(0.35, 1, smoothstep(0, 0.9, H)));
  m.colorNode = vec4(color, 1);
  m.roughnessNode = select(smooth, 0.35, mix(0.95, 0.75, H));
  m.sheenNode = color.mul(0.6).add(0.2).mul(0.8);
  m.emissiveNode = tubeTint;
  const relief = H.mul(R).mul(0.25).mul(fine);
  m.normalNode = bump(positionView, normalView, vec2(dFdx(relief), dFdy(relief)));
  return m;
}

/**
 * The tubes of `mesh` thinned where they are worn, tufts of broken fibres
 * standing out: its material's position (the tubes' own, set by the mesh)
 * moved along the normal. Call once, after the mesh is made.
 */
export function frayed(mesh: THREE.Mesh): void {
  const m = mesh.material as THREE.NodeMaterial, swept = m.positionNode;
  m.positionNode = Fn(() => {
    const p = vec3(swept).toVar();
    const w = tubeWear, R = tubeRadius;
    const ang = atan(tubeCoord.z, tubeCoord.y);
    const tuft = step(w.mul(0.7).oneMinus(), hash2(floor(vec2(tubeCoord.x.div(R.mul(1.5)), ang.mul(2)))));
    const out = w.mul(-0.6).mul(w.mul(0.3).oneMinus()).add(w.mul(1.3).mul(tuft).mul(hash2(vec2(tubeCoord.x.mul(91), tubeCoord.y))));
    return p.add(normalLocal.mul(R.mul(out)));
  })();
  m.needsUpdate = true;
}
