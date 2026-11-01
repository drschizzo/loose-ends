// The renderer, the scene, its light and the camera that follows the lace.
// The light is the floor's: warm in the hall, cold in the laundry, dusk in
// the bedroom, night above the roof (see themes.ts).

import * as THREE from 'three';
import type { Light } from './decor';

export class Stage {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 30);
  private sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  private hemi = new THREE.HemisphereLight('#fff4e0', '#5a4636', 1.4);
  private fog = new THREE.Fog('#2a211b', 3.5, 14);
  private focus = new THREE.Vector3(0, 0.6, 0);

  constructor() {
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.prepend(r.domElement);
    this.scene.background = new THREE.Color('#2a211b');
    this.scene.fog = this.fog;
    this.scene.add(this.hemi);
    const sun = this.sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 8 });
    this.scene.add(sun, sun.target);
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      r.setSize(innerWidth, innerHeight);
    });
  }

  /** the camera eases towards (x, y), kept between the heights `low` and `high`; the sun's shadows follow it */
  follow(x: number, y: number, low: number, high: number, dt: number): void {
    const f = this.focus, k = Math.min(1, dt * 3);
    f.x += (x * 0.4 - f.x) * k;
    f.y += (Math.max(low, Math.min(high, y)) - f.y) * k;
    this.camera.position.set(f.x, f.y + 0.1, 2.5);
    this.camera.lookAt(f.x, f.y, 0);
    this.sun.position.set(f.x + 0.4, f.y + 1.2, 3);
    this.sun.target.position.set(f.x, f.y, 0);
  }

  /** the light of the floor the camera is on */
  mood(l: Light): void {
    (this.scene.background as THREE.Color).copy(l.bg);
    this.fog.color.copy(l.bg);
    this.hemi.color.copy(l.sky);
    this.hemi.groundColor.copy(l.ground);
    this.hemi.intensity = l.ambient;
    this.sun.color.copy(l.sun);
    this.sun.intensity = l.sunI;
  }

  /** the height the camera looks at */
  get y(): number { return this.focus.y; }

  /** the camera there at once (after the lace moved far) */
  jump(x: number, y: number): void {
    this.focus.set(x * 0.4, y, 0);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
