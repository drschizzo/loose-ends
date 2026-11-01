// The renderer, the scene, its light and the camera that follows the lace.
// The light is the floor's: warm in the hall, cold in the laundry, dusk in
// the bedroom, night above the roof (see themes.ts). The game's fills the
// window; the level editor's, its view, with a camera of its own.
//
// Drawn with WebGPU (WebGL 2 where the browser has none, or with ?webgl), in
// linear HDR, through the passes of image.ts; on an HDR screen the canvas
// goes past white. The quality steps down by itself when the frames come
// late (see adapt).

import * as THREE from 'three/webgpu';
import type { Light } from './decor';
import { ImagePipeline } from './image';
import { LampLights, type Fixture } from './lamps';

/** a level of quality: pixels per CSS pixel, the passes drawn, the size of the shadow map */
export interface Quality { ratio: number; ao: boolean; rays: boolean; dof: boolean; shadow: number }

/** the levels the image steps down through, from the full image: what costs most and shows least first */
export const QUALITY: readonly Quality[] = [
  { ratio: 2, ao: true, rays: true, dof: true, shadow: 2048 },
  { ratio: 1.5, ao: true, rays: true, dof: true, shadow: 2048 },
  { ratio: 1, ao: true, rays: true, dof: true, shadow: 2048 },
  { ratio: 1, ao: true, rays: true, dof: false, shadow: 2048 },
  { ratio: 1, ao: false, rays: true, dof: false, shadow: 2048 },
  { ratio: 1, ao: false, rays: false, dof: false, shadow: 1024 },
  { ratio: 0.75, ao: false, rays: false, dof: false, shadow: 1024 },
];

/** the brightest the image goes on an HDR screen (× white) */
const HDR_HEADROOM = 4;
const HDR_QUERY = '(dynamic-range: high)';
const query = new URLSearchParams(location.search);

export class Stage {
  readonly renderer: THREE.WebGPURenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 30);
  /** the key light of the floor: the shafts of light fall from it, and it casts the shadows where no lamp does */
  readonly sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  private hemi = new THREE.HemisphereLight('#fff4e0', '#5a4636', 1.4);
  private fog = new THREE.Fog('#2a211b', 3.5, 14);
  private focus = new THREE.Vector3(0, 0.6, 0);
  /** where the key light stands: raking from one side (0), from the front (1) (see Light) */
  private front = 0;
  private image: ImagePipeline;
  /** the lights of the lamps nearest the camera, and the lace's own */
  private lamps: LampLights;
  /** the editor: seen from afar, everything sharp */
  private far = false;
  private level: number;
  private fixed: boolean;
  private last = performance.now();
  /** the intervals between the frames of the sample under way (ms), and how many samples in a row were too slow */
  private sample: number[] = [];
  private slow = 0;

  /** drawn in `host` (the whole window: the body) */
  constructor(host: HTMLElement = document.body) {
    const forceWebGL = query.has('webgl');
    const hdr = !forceWebGL && 'gpu' in navigator && matchMedia(HDR_QUERY).matches;
    const r = (this.renderer = new THREE.WebGPURenderer({ antialias: false, powerPreference: 'high-performance', forceWebGL, outputType: hdr ? THREE.HalfFloatType : undefined }));
    const full = host === document.body;
    const size = (): [number, number] => (full ? [innerWidth, innerHeight] : [host.clientWidth || 1, host.clientHeight || 1]);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    host.prepend(r.domElement);
    this.scene.background = new THREE.Color('#2a211b');
    this.scene.fog = this.fog;
    this.scene.add(this.hemi);
    const sun = this.sun;
    sun.castShadow = true;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.004;
    sun.shadow.radius = 3;
    Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 8 });
    this.scene.add(sun, sun.target);
    this.lamps = new LampLights(this.scene);
    this.image = new ImagePipeline(r, this.scene, this.camera);
    this.image.setLight(sun);
    this.image.setHeadroom(hdr ? HDR_HEADROOM : 1);
    // ?quality=N holds the image at level N; otherwise it starts at the full and steps down as needed
    this.fixed = query.has('quality');
    this.level = Math.max(0, Math.min(QUALITY.length - 1, Number(query.get('quality')) || 0));
    this.apply();
    const resize = () => {
      const [w, h] = size();
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      r.setSize(w, h);
    };
    resize();
    if (full) addEventListener('resize', resize);
    else new ResizeObserver(resize).observe(host);
  }

  /** the quality of the level reached */
  private apply(): void {
    const q = QUALITY[this.level];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.ratio));
    this.image.setQuality({ ao: q.ao, rays: q.rays, dof: q.dof && !this.far });
    if (this.sun.shadow.mapSize.x !== q.shadow) {
      this.sun.shadow.mapSize.set(q.shadow, q.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      for (const s of this.lamps.spots) {
        s.shadow.mapSize.setScalar(q.shadow / 2);
        s.shadow.map?.dispose();
        s.shadow.map = null;
      }
    }
  }

  /**
   * A level down when the frames keep coming late: over two samples of 90
   * frames in a row, fewer than 45 a second. Never back up: the image going
   * back and forth would show.
   */
  private adapt(interval: number): void {
    if (this.fixed || this.level === QUALITY.length - 1) return;
    // a hidden page, a long build: not the GPU's doing
    if (interval > 250) { this.sample.length = 0; return; }
    this.sample.push(interval);
    if (this.sample.length < 90) return;
    const mean = this.sample.reduce((a, b) => a + b, 0) / this.sample.length;
    this.sample.length = 0;
    this.slow = mean > 1000 / 45 ? this.slow + 1 : 0;
    if (this.slow < 2) return;
    this.slow = 0;
    this.level++;
    this.apply();
    console.info(`Image abaissée au niveau ${this.level} de qualité (${mean.toFixed(1)} ms par image)`);
  }

  /** the camera eases towards (x, y), kept between the heights `low` and `high`, drawn back `zoom` times as far; the sun's shadows follow it */
  follow(x: number, y: number, low: number, high: number, dt: number, zoom = 1): void {
    const f = this.focus, k = Math.min(1, dt * 3);
    f.x += (x * 0.4 - f.x) * k;
    f.y += (Math.max(low, Math.min(high, y)) - f.y) * k;
    this.camera.position.set(f.x, f.y + 0.1, 2.5 * zoom);
    this.camera.lookAt(f.x, f.y, 0);
    this.rake(f.x, f.y);
  }

  /**
   * The key light rakes the wall from high on one side, as through a window
   * out of sight: the shadows of the bars fall long across the paper, its
   * relief stands out, and the shafts of light cross the air. Where lamps
   * cast the shadows, it comes from just above the camera instead: a short
   * shadow under each bar.
   */
  private rake(x: number, y: number): void {
    const f = this.front;
    this.sun.position.set(x - 1.7 * (1 - f), y + 1.5 - 0.9 * f, 1.3 + 1.2 * f);
    this.sun.target.position.set(x, y, -0.1);
  }

  /** the searching lamp nearest the camera, its beam turned as it is (see LampLights.beam) */
  search(at: { x: number; y: number; angle: number; half: number } | null): void {
    this.lamps.beam(at);
  }

  /** the lamps lit round where the camera looks (the decor's, `fixtures`), at time t; the lace's own light at `lace` */
  lights(fixtures: readonly Fixture[], t: number, lace: THREE.Vector3 | null): void {
    this.lamps.light(fixtures, this.focus.x, this.focus.y, t, lace, this.dark);
  }

  /** the lights out (a blackout), 0 to 1: the room goes dark round the lace's glow */
  dark = 0;

  /** (the editor) the camera `dist` from (x, y), turned `yaw` round the vertical and `pitch` up (rad); the sun's shadows follow it */
  look(x: number, y: number, dist: number, yaw: number, pitch: number): void {
    this.focus.set(x, y, 0);
    this.camera.position.set(x + dist * Math.sin(yaw) * Math.cos(pitch), y + dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch));
    this.camera.lookAt(x, y, 0);
    this.rake(x, y);
    // the shadows cover what is seen, more coarsely from further away
    const half = Math.max(1.6, dist * 0.6), cam = this.sun.shadow.camera;
    if (cam.right !== half) { Object.assign(cam, { left: -half, right: half, top: half, bottom: -half }); cam.updateProjectionMatrix(); }
  }

  /** (the editor) no fog, no depth of field: seen from afar */
  clear(): void {
    this.scene.fog = null;
    this.camera.far = 80;
    this.camera.updateProjectionMatrix();
    this.far = true;
    this.apply();
  }

  /** the light of the floor the camera is on */
  mood(l: Light): void {
    (this.scene.background as THREE.Color).copy(l.bg);
    this.fog.color.copy(l.bg);
    this.hemi.color.copy(l.sky);
    this.hemi.groundColor.copy(l.ground);
    this.hemi.intensity = l.ambient * (1 - 0.88 * this.dark);
    this.sun.color.copy(l.sun);
    this.sun.intensity = l.sunI * (1 - 0.92 * this.dark);
    this.sun.shadow.intensity = l.shade;
    this.front = l.front;
    this.image.rayColor.value.copy(l.sun).multiplyScalar(l.rays);
  }

  /** the height the camera looks at */
  get y(): number { return this.focus.y; }

  /** the camera there at once (after the lace moved far) */
  jump(x: number, y: number): void {
    this.focus.set(x * 0.4, y, 0);
  }

  /** draws the image, sharp round `subject` (the lace; the point looked at if not given) */
  render(subject?: THREE.Vector3): void {
    const now = performance.now(), dt = (now - this.last) / 1000;
    this.adapt(now - this.last);
    this.last = now;
    const viewDistance = this.camera.position.distanceTo(this.focus);
    this.image.render({ dt, viewDistance, focus: this.far ? null : { at: subject ?? this.focus, reach: 0.45 } });
  }
}
