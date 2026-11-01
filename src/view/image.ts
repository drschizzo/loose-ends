// The image, from the scene to the screen (after the image pipeline of
// cablemanagement): the scene drawn once into its buffers (linear HDR: its
// colour, its normals, its depth), then the passes that work on them. The
// ambient occlusion darkens the corners and under the bars; the shafts of
// light (godrays) fall through the air from the floor's key light, cut by
// the shadows of what stands in it; the depth of field blurs what passes
// close to the camera and the sky far behind; the glow of what is brighter
// than white (flames, lamps, stars); the tone curve, past white on an HDR
// screen; the antialiasing; the cinema pass (vignette, grain, toning).

import * as THREE from 'three/webgpu';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js';
import { godrays } from 'three/examples/jsm/tsl/display/GodraysNode.js';
import { depthAwareBlend } from 'three/examples/jsm/tsl/display/depthAwareBlend.js';
import { smaa } from 'three/examples/jsm/tsl/display/SMAANode.js';
import { Bloom } from './bloom';
import { Cinema } from './cinema';
import { DepthOfField } from './depthOfField';
import { toneCurve } from './toneCurve';
import { frameTexture, tsl, type ShaderNode } from './tsl';

const { mix, mrt, normalView, output, pass, renderOutput, uniform, vec4 } = tsl;

/**
 * Ambient occlusion. `radius` (m): the bars stand 10 cm off the wall and the
 * lace is 16 mm thick; a reach of 6 cm darkens the wall behind a bar and the
 * corners of the room without muddying the cords. Worked out at half the
 * resolution, then denoised at full.
 */
export const AO = { radius: 0.06, distanceExponent: 1.5, thickness: 0.4, scale: 1.1, samples: 8, resolution: 0.5, blend: 0.75 };
const AO_DENOISE = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6 };

/** the shafts of light: how many steps along a ray, how thick the air (the floor's haze scales it) */
export const RAYS = { steps: 48, density: 0.6, maxDensity: 0.6, distanceAttenuation: 1.2 };

/** what the passes follow from one image to the next */
export interface ImageFrame {
  dt: number;
  /** from the camera to what it looks at (m) */
  viewDistance: number;
  /** the point in focus (the lace) and how far round it everything stays sharp (m); null: everything sharp */
  focus: { at: THREE.Vector3; reach: number } | null;
}

/** what the image draws: the occlusion, the shafts of light, the depth of field */
export interface ImageQuality { ao: boolean; rays: boolean; dof: boolean }

/** a pass that holds targets of its own */
type Owned = { dispose(): void };

interface Chain { owned: Owned[]; bloom: Bloom; dof: DepthOfField | null; cinema: Cinema }

/**
 * The colour of an output blended as each material blends its colour, its
 * other outputs too (a transparent picture wrote its zeros over the normals
 * of the wall behind it, which the occlusion then darkened).
 */
const ASBLENDED = new THREE.BlendMode(THREE.MaterialBlending);

export class ImagePipeline {
  private pipeline: THREE.RenderPipeline;
  private scenePass: ShaderNode;
  private chains = new Map<string, Chain>();
  private chain: Chain | null = null;
  private quality: ImageQuality = { ao: true, rays: true, dof: true };
  /** the light the shafts fall from (it casts shadows), and their colour (× how thick the air) */
  private light: THREE.DirectionalLight | null = null;
  readonly rayColor = uniform(new THREE.Color(0, 0, 0));
  /** how far past white the image goes (× white): 1 on a screen of standard range */
  private headroom = uniform(1);
  private size = new THREE.Vector2();

  constructor(private renderer: THREE.WebGPURenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.pipeline = new THREE.RenderPipeline(renderer);
    // the tone curve and the colour space are the chain's own
    this.pipeline.outputColorTransform = false;
    this.scenePass = pass(scene, camera);
    this.scenePass.setMRT(mrt({ output, normal: normalView }).setBlendMode('normal', ASBLENDED));
  }

  /** the shafts of light fall from `light` (null: none) */
  setLight(light: THREE.DirectionalLight | null): void {
    if (light === this.light) return;
    this.light = light;
    this.compose();
  }

  setQuality(q: ImageQuality): void {
    if (this.chain && q.ao === this.quality.ao && q.rays === this.quality.rays && q.dof === this.quality.dof) return;
    this.quality = { ...q };
    this.compose();
  }

  /** how far past white the image goes (× white; 1: up to white) */
  setHeadroom(headroom: number): void {
    this.headroom.value = headroom;
  }

  /** puts on the chain the quality asks, each built once: one put aside is kept for when it comes back */
  private compose(): void {
    const rays = this.quality.rays && !!this.light;
    const key = `${+this.quality.ao}${+rays}${+this.quality.dof}${this.light?.uuid ?? ''}`;
    let chain = this.chains.get(key);
    if (!chain) this.chains.set(key, (chain = this.build(rays)));
    this.chain = chain;
    this.pipeline.outputNode = chain.cinema.node;
    this.pipeline.needsUpdate = true;
  }

  private build(rays: boolean): Chain {
    const owned: Owned[] = [];
    const own = <T extends Owned>(n: T): T => { owned.push(n); return n; };
    const sp = this.scenePass, camera = this.camera;
    const color = sp.getTextureNode('output'), normal = sp.getTextureNode('normal'), depth = sp.getTextureNode('depth');
    let image: ShaderNode = color;
    if (this.quality.ao) {
      const gtao: ShaderNode = own(ao(depth, normal, camera));
      for (const k of ['radius', 'distanceExponent', 'thickness', 'scale', 'samples'] as const) gtao[k].value = AO[k];
      gtao.resolutionScale = AO.resolution;
      const smooth: ShaderNode = own(denoise(gtao.getTextureNode(), depth, normal, camera));
      for (const [k, v] of Object.entries(AO_DENOISE)) smooth[k].value = v;
      image = vec4(image.rgb.mul(mix(1, smooth.r, AO.blend)), 1);
    }
    if (rays && this.light) {
      const g: ShaderNode = own(godrays(depth, camera, this.light));
      g.raymarchSteps.value = RAYS.steps;
      g.density.value = RAYS.density;
      g.maxDensity.value = RAYS.maxDensity;
      g.distanceAttenuation.value = RAYS.distanceAttenuation;
      // (the blend samples both images round each pixel: as textures)
      image = depthAwareBlend(own(frameTexture(image)), g.getTextureNode(), depth, camera, { blendColor: this.rayColor, edgeRadius: 2, edgeStrength: 2 });
    }
    image = own(frameTexture(image));
    let dof: DepthOfField | null = null;
    if (this.quality.dof) {
      dof = new DepthOfField(image, depth, camera);
      image = own(frameTexture(dof.node));
    }
    const bloom = own(new Bloom(image));
    const shown = toneCurve(image.rgb.add(bloom.node), this.headroom);
    const display = own(frameTexture(renderOutput(vec4(shown, 1), THREE.NoToneMapping, this.renderer.outputColorSpace)));
    const cinema = new Cinema(own(frameTexture(smaa(display))));
    return { owned, bloom, dof, cinema };
  }

  render(frame: ImageFrame): void {
    if (!this.chain) this.compose();
    const c = this.chain!, ratio = this.renderer.getPixelRatio();
    this.renderer.getDrawingBufferSize(this.size);
    c.bloom.fit(frame.viewDistance, ratio);
    if (c.dof) {
      if (frame.focus) c.dof.frame(frame.focus.at, frame.focus.reach, this.size.x, this.size.y, ratio);
      else c.dof.frame(this.camera.position, 1e4, this.size.x, this.size.y, ratio);
    }
    c.cinema.frame(frame.dt, this.size.x, this.size.y);
    this.pipeline.render();
  }

  dispose(): void {
    for (const c of this.chains.values()) for (const n of c.owned) n.dispose();
    this.pipeline.dispose();
  }
}
