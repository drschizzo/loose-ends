// What the player does: the pointer on the plane of the lace, the buttons
// that make each end grip (left or A: the head, right or D: the tail), Space
// to slip the aglet through the cords, R to go back to the last post, H for
// help, Enter to start.

import * as THREE from 'three';

export interface ControlHandlers {
  hold(k: number, on: boolean): void;
  slip(on: boolean): void;
  respawn(): void;
  toggleHints(): void;
  enter(): void;
  /** the first gesture of the page (sound may start then) */
  wake(): void;
}

export class Controls {
  /** where the pointer is, on the plane of the lace */
  readonly pointer = { x: 0, y: 0.5 };
  private keys = { a: false, d: false };
  private buttons = 0;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hit = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, private camera: THREE.Camera, private on: ControlHandlers) {
    canvas.addEventListener('pointermove', (e) => this.aim(e));
    canvas.addEventListener('pointerdown', (e) => { on.wake(); this.aim(e); this.press(e.buttons); });
    addEventListener('pointerup', (e) => this.press(e.buttons));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => { this.keys.a = this.keys.d = false; this.press(0); on.slip(false); });
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); on.slip(true); }
      else if (k === 'a' || k === 'd') { this.keys[k] = true; this.press(this.buttons); }
      else if (k === 'r') on.respawn();
      else if (k === 'h') on.toggleHints();
      else if (e.key === 'Enter') on.enter();
    });
    addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') on.slip(false);
      else if (k === 'a' || k === 'd') { this.keys[k] = false; this.press(this.buttons); }
    });
  }

  /** the mouse buttons down, and the keys that stand for them, to each end */
  private press(buttons: number): void {
    this.buttons = buttons;
    this.on.hold(0, (buttons & 1) !== 0 || this.keys.a);
    this.on.hold(1, (buttons & 2) !== 0 || this.keys.d);
  }

  private aim(e: PointerEvent): void {
    this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (this.ray.ray.intersectPlane(this.plane, this.hit)) { this.pointer.x = this.hit.x; this.pointer.y = this.hit.y; }
  }
}
