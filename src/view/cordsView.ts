// The cords of a world as tubes, and the knobs at the end of its pulls. Built
// with the world, dropped with it.

import * as THREE from 'three';
import { TubeMesh, TubeNodes, TubeSync } from '@drschizzo/three-cable-tubes';
import type { World } from '../sim/world';
import { chosen } from '../play/laces';
import { laceMaterial } from './laceMaterial';

/** the stripe of the lace's braid: the lace chosen's */
const stripe = new THREE.Color();
const material = laceMaterial(stripe);
const KNOB = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.6, roughness: 0.3 });
const KNOB_SHAPE = new THREE.SphereGeometry(0.018, 16, 12);

export class CordsView {
  private nodes: TubeNodes;
  private tubes: TubeMesh;
  private sync: TubeSync;
  private knobs: THREE.Mesh[];
  /** the last node of each pull, where its knob is */
  private pullEnds: number[];

  constructor(scene: THREE.Scene, private world: World) {
    const sim = world.sim;
    stripe.set(chosen().stripe);
    this.nodes = new TubeNodes(sim.n);
    this.tubes = new TubeMesh(sim.n - sim.cables.length, material, this.nodes, { radial: 16, sub: 8 });
    const color = new THREE.Color();
    let at = 0;
    sim.cables.forEach((cb, c) => {
      const cord = world.cords[c];
      this.tubes.lay(at, cb.start, cb.count, color.set(cord.color).convertSRGBToLinear(), 0, cord.segment, cord.tag);
      at += cb.count - 1;
    });
    this.tubes.castShadow = this.tubes.receiveShadow = true;
    scene.add(this.tubes);
    this.sync = new TubeSync(this.nodes, sim.radius);
    this.pullEnds = world.pullTops.map((top) => { const cb = sim.cables[sim.cableOf[top]]; return cb.start + cb.count - 1; });
    this.knobs = this.pullEnds.map(() => {
      const m = new THREE.Mesh(KNOB_SHAPE, KNOB);
      m.castShadow = true;
      scene.add(m);
      return m;
    });
  }

  /** node i glows with colour c (black: not at all) */
  tint(i: number, c: THREE.Color): void {
    this.nodes.tint(i, c);
  }

  /** the tubes where the nodes are now, the lace as worn as it is */
  update(): void {
    const x = this.world.sim.x, { lace } = this.world;
    this.sync.update(this.world.sim);
    for (let k = 0; k < lace.count; k++) this.nodes.wear(lace.start + k, lace.damage[k]);
    this.pullEnds.forEach((i, k) => this.knobs[k].position.set(x[3 * i], x[3 * i + 1] - 0.012, x[3 * i + 2]));
  }

  dispose(): void {
    this.tubes.removeFromParent();
    this.tubes.geometry.dispose();
    this.tubes.dispose();
    for (const k of this.knobs) k.removeFromParent();
  }
}
