// The cinema pass: the last full-screen touch of the image, after the
// tone curve (display values). A heavy vignette that closes the room round
// the lace, a grain of film stronger in the shadows (it also dithers the
// gradients of the dark rooms), shadows leaning cold and lights warm, a hint
// of chromatic aberration towards the corners. What is brighter than white
// (an HDR image) takes the vignette only.

import { tsl, type ShaderNode } from './tsl';

const { Fn, dot, fract, mix, min, max, screenCoordinate, smoothstep, uniform, uv, vec2, vec3, vec4 } = tsl;

/** the look of the pass: how dark the corners go, how strong the grain, how far the colours part, how strong the toning */
export const CINEMA = { vignette: 0.55, grain: 0.07, aberration: 0.003, tone: 0.06 };

/** hash without sine (Dave Hoskins): no visible pattern, cheap */
const hash = (p: ShaderNode) => {
  const q = fract(p.mul(0.1031)).toVar();
  q.addAssign(dot(q, q.zyx.add(31.32)));
  return fract(q.x.add(q.y).mul(q.z));
};

export class Cinema {
  /** the image, touched */
  readonly node: ShaderNode;
  private time = uniform(0);
  private aspect = uniform(1);
  /** how dark the corners go: deeper in the dark rooms */
  readonly vignette = uniform(CINEMA.vignette);

  /** `image`: the image tone-mapped (display values), as a texture */
  constructor(image: ShaderNode) {
    this.node = Fn(() => {
      const at = uv();
      const d = at.sub(0.5);
      // squared distance, round on screen: 0 at the centre, 1 in the corners
      const dr = d.mul(vec2(this.aspect, 1));
      const r2 = dot(dr, dr).div(this.aspect.mul(this.aspect).add(1).mul(0.25));
      const off = d.mul(r2).mul(CINEMA.aberration);
      const col = vec3(image.sample(at.sub(off)).r, image.sample(at).g, image.sample(at.add(off)).b);
      const base = min(col, vec3(1));
      const above = col.sub(base);
      const luma = dot(base, vec3(0.2126, 0.7152, 0.0722));
      // split toning: shadows towards a cold blue-green, lights towards amber
      const shadowTint = vec3(-0.5, 0.05, 0.45), lightTint = vec3(0.55, 0.15, -0.6);
      const toned = base.add(mix(shadowTint.mul(luma.oneMinus()), lightTint.mul(luma), luma).mul(CINEMA.tone));
      // grain: monochrome, new every frame, mostly in the darks and mids
      const p = screenCoordinate.xy;
      const t = fract(this.time);
      const n = hash(vec3(p, t.mul(977))).add(hash(vec3(p.yx.add(17), t.mul(613)))).sub(1);
      const grained = max(vec3(0), min(vec3(1), toned.add(n.mul(CINEMA.grain).mul(luma.mul(0.75).oneMinus()))));
      // vignette: an oval fall-off that leaves the middle of the room alone
      const fall = mix(1, this.vignette.oneMinus(), smoothstep(0.1, 1.1, r2));
      return vec4(grained.add(above).mul(fall), 1);
    })();
  }

  /** steps the grain, fits the vignette to a screen `w` × `h` (px) */
  frame(dt: number, w: number, h: number): void {
    this.time.value = (this.time.value + dt) % 1000;
    this.aspect.value = w / Math.max(1, h);
  }
}
