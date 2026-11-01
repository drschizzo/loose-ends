// The ghost of the best run from a post to the next: where the lace was,
// every tenth of a second, sixteen points along it. Recorded as the lace
// climbs, kept (as a short string) when it beats the best, and played back
// beside the lace the next time: a pale lace of beads, never in the solver.

import * as THREE from 'three/webgpu';
import type { Lace } from '../play/lace';

/** how often a frame of the ghost is kept (s), how many points along the lace */
const EVERY = 0.1, POINTS = 16;
/** how many beads it is drawn with, between those points */
const BEADS = 46;

export class GhostRecorder {
  private frames: number[] = [];
  private t = 0;
  private y0 = 0;

  /** a new run, from the post at height y0 */
  start(y0: number): void {
    this.frames = [];
    this.t = 0;
    this.y0 = y0;
  }

  /** dt seconds more of the run, the lace as it is */
  step(lace: Lace, dt: number): void {
    this.t += dt;
    if (this.t < EVERY * (this.frames.length / (2 * POINTS))) return;
    // (a run longer than ten minutes is not worth its room)
    if (this.frames.length > 2 * POINTS * 6000) return;
    for (let j = 0; j < POINTS; j++) {
      const p = lace.at(lace.start + Math.round((j / (POINTS - 1)) * (lace.count - 1)));
      this.frames.push(Math.round(p[0] * 1000), Math.round((p[1] - this.y0) * 1000));
    }
  }

  /** the run, as a string to keep */
  data(): string {
    const a = new Int16Array(this.frames.map((v) => Math.max(-32767, Math.min(32767, v))));
    let bin = '';
    const bytes = new Uint8Array(a.buffer);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return JSON.stringify({ y0: this.y0, d: btoa(bin) });
  }
}

/** a ghost played back */
export class GhostView {
  private mesh: THREE.InstancedMesh;
  private frames: Int16Array | null = null;
  private y0 = 0;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.9, 1.4), transparent: true, opacity: 0.32, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.007, 8, 6), mat, BEADS);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  /** the run to play (null: none) */
  load(data: string | null): void {
    this.frames = null;
    this.mesh.visible = false;
    if (!data) return;
    try {
      const o = JSON.parse(data) as { y0: number; d: string }, bin = atob(o.d), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      this.frames = new Int16Array(bytes.buffer);
      this.y0 = o.y0;
    } catch { this.frames = null; }
  }

  /** where the ghost is `t` seconds into its run (hidden once it is over) */
  show(t: number): void {
    const f = this.frames;
    if (!f) return;
    const n = f.length / (2 * POINTS), u = t / EVERY, k = Math.floor(u), a = u - k;
    this.mesh.visible = k < n - 1;
    if (!this.mesh.visible) return;
    const at = (frame: number, j: number, c: number) => f[2 * (frame * POINTS + j) + c] / 1000;
    for (let b = 0; b < BEADS; b++) {
      const s = (b / (BEADS - 1)) * (POINTS - 1), j = Math.min(POINTS - 2, Math.floor(s)), w = s - j;
      const x = (fr: number) => at(fr, j, 0) * (1 - w) + at(fr, j + 1, 0) * w;
      const y = (fr: number) => at(fr, j, 1) * (1 - w) + at(fr, j + 1, 1) * w;
      this.p.set(x(k) * (1 - a) + x(k + 1) * a, this.y0 + y(k) * (1 - a) + y(k + 1) * a, 0.05);
      this.m.makeTranslation(this.p);
      this.mesh.setMatrixAt(b, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
