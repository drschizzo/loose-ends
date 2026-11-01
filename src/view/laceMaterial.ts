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
// the cord thins until it is torn through.

import * as THREE from 'three';

export const LAID = 0, BRAIDED = 1, SMOOTH = 2;

const vertexDecl = /* glsl */ `
varying vec4 vRope;
varying vec3 vRopeT;
varying float vRopeR;
varying vec3 vRopeGlow;
varying float vRopeWear;
float ropeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

// worn, the cord thins (what is gone of its fibres), and tufts of broken ones stand out of it
const vertexMain = /* glsl */ `
  vRope = tubeCoord;
  vRopeT = normalize(normalMatrix * tT);
  vRopeR = tEnd.w;
  vRopeGlow = tubeTint;
  vRopeWear = tubeWear;
#include <begin_vertex>
  {
    float w = tubeWear;
    float tuft = step(1.0 - 0.7 * w, ropeHash(floor(vec2(tubeCoord.x / (1.5 * tEnd.w), atan(tubeCoord.z, tubeCoord.y) * 2.0))));
    transformed += tubeNormal * tEnd.w * (-0.6 * w * (1.0 - 0.3 * w) + 1.3 * w * tuft * ropeHash(vec2(tubeCoord.x * 91.0, tubeCoord.y)));
  }`;

const fragmentDecl = /* glsl */ `
varying vec4 vRope;
varying vec3 vRopeT;
varying float vRopeR;
varying vec3 vRopeGlow;
varying float vRopeWear;
float ropeGone;
float ropeHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform vec3 ropeStripe;
float ropeH;
vec2 ropeSlope;
float ropeTone;

vec2 strand(float v) {
  float w = clamp(2.0 * v - 1.0, -0.97, 0.97);
  float h = sqrt(1.0 - w * w);
  return vec2(h, -2.0 * w / h);
}

void ropeSurface(float s, float a, float R, float tag) {
  float C = 6.2831853 * R;
  ropeH = 1.0; ropeSlope = vec2(0.0); ropeTone = 0.0;
  if (tag < 0.5) {
    float L = 7.0 * R;
    float f = 3.0 * (a + s / L);
    vec2 st = strand(fract(f));
    float g = 18.0 * (a - s / (2.2 * R));
    float fib = 0.5 + 0.5 * sin(6.2831853 * g);
    ropeH = st.x * (0.94 + 0.06 * fib);
    float dg = 0.03 * st.x * 3.1415927 * cos(6.2831853 * g) * 18.0;
    ropeSlope = vec2(st.y * 3.0 / L - dg / (2.2 * R), st.y * 3.0 / C + dg / C) * 0.3 * R;
    ropeTone = mod(floor(f), 3.0) == 0.0 ? 0.08 : 0.0;
  } else if (tag < 1.5) {
    float P = 9.0 * R;
    float u1 = 12.0 * (a + s / P), u2 = 12.0 * (a - s / P);
    float cell = mod(floor(u1) + floor(u2), 4.0);
    bool first = cell < 2.0;
    float u = first ? u1 : u2;
    vec2 st = strand(fract(u));
    float along = fract(first ? u2 : u1);
    float dip = 0.75 + 0.25 * sin(3.1415927 * along);
    ropeH = st.x * dip;
    float sgn = first ? 1.0 : -1.0;
    ropeSlope = vec2(st.y * dip * sgn * 12.0 / P, st.y * dip * 12.0 / C) * 0.12 * R;
    float bundle = mod(floor(u), 12.0);
    ropeTone = (first && (bundle == 0.0 || bundle == 6.0)) ? 1.0 : 0.0;
  }
  // worn: each fibre (a strand of the braid, a fibre of the twist) is gone if its own threshold is below the wear
  ropeGone = 0.0;
  if (vRopeWear > 0.0) {
    vec2 fibre = tag < 1.5 && tag > 0.5 ? vec2(floor(12.0 * (a + s / (9.0 * R))), floor(12.0 * (a - s / (9.0 * R))))
                                        : vec2(floor(18.0 * (a - s / (2.2 * R))), floor(s / (1.2 * R)));
    float gone = step(ropeHash2(fibre), vRopeWear * 1.4 - 0.05);
    // the fuzz of broken fibres round a gap
    float fuzz = ropeHash2(floor(vec2(s / (0.15 * R), a * 80.0)));
    ropeGone = gone;
    ropeH = mix(ropeH, 0.15 + 0.5 * fuzz, gone);
    ropeSlope = mix(ropeSlope, (vec2(fuzz, ropeHash2(vec2(fuzz, s))) - 0.5) * 0.6 * R, gone);
  }
}

`;

/** the material of every cord of the game: give it to a `TubeMesh` before anything else touches its shader */
export function laceMaterial(stripe = new THREE.Color('#2b2f3a')): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.75, sheen: 0.8, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffffff'),
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.ropeStripe = { value: stripe };
    s.vertexShader = s.vertexShader
      .replace('void main() {', `${vertexDecl}\nvoid main() {`)
      .replace('#include <begin_vertex>', vertexMain);
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', `${fragmentDecl}\nvoid main() {`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
  float ropeA = atan(vRope.z, vRope.y) / 6.2831853;
  ropeSurface(vRope.x, ropeA, max(vRopeR, 1e-4), vRope.w);
  float ropeFine = clamp(1.5 - 6.0 * length(fwidth(vec2(vRope.x / vRopeR, ropeA * 6.2831853))), 0.0, 1.0);
  ropeH = mix(0.8, ropeH, ropeFine);
  ropeSlope *= ropeFine;
  vec3 ropeBase = vRope.w < 0.5 || vRope.w > 1.5 ? diffuseColor.rgb * (1.0 - ropeTone) : mix(diffuseColor.rgb, ropeStripe, ropeTone);
  // worn, the sheath goes grimy; where fibres are gone, the core shows: dark, browner as the wear goes deep
  ropeBase *= 1.0 - 0.4 * vRopeWear;
  ropeBase = mix(ropeBase, vec3(0.16, 0.11, 0.08) * (0.6 + 0.4 * ropeH), ropeGone * (0.75 + 0.25 * vRopeWear));
  diffuseColor.rgb = ropeBase * mix(0.35, 1.0, smoothstep(0.0, 0.9, ropeH));`)
      .replace('#include <roughnessmap_fragment>', /* glsl */ `#include <roughnessmap_fragment>
  roughnessFactor = vRope.w > 1.5 ? 0.35 : mix(0.95, roughnessFactor, ropeH);`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
  totalEmissiveRadiance += vRopeGlow;`)
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
  {
    vec3 T = normalize(vRopeT - dot(vRopeT, normal) * normal);
    vec3 B = cross(T, normal);
    normal = normalize(normal - ropeSlope.x * T + ropeSlope.y * B);
  }`)
      .replace('#include <lights_physical_fragment>', /* glsl */ `#include <lights_physical_fragment>
  material.sheenColor *= 0.6 * diffuseColor.rgb + 0.2;`);
  };
  m.customProgramCacheKey = () => 'lace';
  return m;
}
