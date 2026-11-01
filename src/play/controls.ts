// What the player does: the pointer on the plane of the lace, the buttons
// that make each end grip (left or A: the head, right or D: the tail), Space
// to slip the aglet through the cords, R to go back to the last post, W (or
// ↑) held to look up the climb, M for silence, H for help, Enter to start.
//
// With one button (an option of the title screen), a click makes the free
// end grip and lets the other go: the climb is a click per hold. The right
// button lets go of everything.
//
// A gamepad does the same: the left stick leads the free end round where it
// is, the triggers (or the shoulders) grip with the head and the tail, A
// slips the aglet, B looks up, Y goes back to the post, Start starts.

import * as THREE from 'three';

export interface ControlHandlers {
  hold(k: number, on: boolean): void;
  slip(on: boolean): void;
  respawn(): void;
  toggleHints(): void;
  enter(): void;
  /** looking up the climb, or not */
  look(on: boolean): void;
  mute(): void;
  /** one button: grip with the free end and let the other go; let go of everything */
  swap(): void;
  drop(): void;
  /** the first gesture of the page (sound may start then) */
  wake(): void;
}

export class Controls {
  /** where the pointer is, on the plane of the lace */
  readonly pointer = { x: 0, y: 0.5 };
  /** a click a hold (see above) */
  oneButton = false;
  /** a gamepad leads the lace, not the mouse (until the mouse moves) */
  pad = false;
  private keys = { a: false, d: false };
  private buttons = 0;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hit = new THREE.Vector3();
  /** the gamepad's buttons last frame */
  private was: boolean[] = [];

  constructor(canvas: HTMLCanvasElement, private camera: THREE.Camera, private on: ControlHandlers) {
    canvas.addEventListener('pointermove', (e) => { this.pad = false; this.aim(e); });
    canvas.addEventListener('pointerdown', (e) => {
      on.wake(); this.aim(e);
      if (this.oneButton) { if (e.button === 0) on.swap(); else if (e.button === 2) on.drop(); return; }
      this.press(e.buttons);
    });
    addEventListener('pointerup', (e) => { if (!this.oneButton) this.press(e.buttons); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => { this.keys.a = this.keys.d = false; if (!this.oneButton) this.press(0); on.slip(false); on.look(false); });
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (e.repeat && k !== ' ') return;
      if (k === ' ') { e.preventDefault(); on.slip(true); }
      else if ((k === 'a' || k === 'd') && !this.oneButton) { this.keys[k] = true; this.press(this.buttons); }
      else if (k === 'a' && this.oneButton) on.swap();
      else if (k === 'r') on.respawn();
      else if (k === 'h') on.toggleHints();
      else if (k === 'm') on.mute();
      else if (k === 'w' || k === 'z' || e.key === 'ArrowUp') on.look(true);
      else if (e.key === 'Enter') on.enter();
    });
    addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') on.slip(false);
      else if ((k === 'a' || k === 'd') && !this.oneButton) { this.keys[k] = false; this.press(this.buttons); }
      else if (k === 'w' || k === 'z' || e.key === 'ArrowUp') on.look(false);
    });
  }

  /**
   * Each frame: the gamepad, if one is plugged in and touched. `at`: where the
   * free end is, round which the left stick leads it.
   */
  poll(at: { x: number; y: number }): void {
    const gp = navigator.getGamepads?.().find((g) => g && g.connected);
    if (!gp) return;
    const b = gp.buttons.map((q) => q.pressed || q.value > 0.4);
    const sx = gp.axes[0] ?? 0, sy = gp.axes[1] ?? 0, moved = Math.hypot(sx, sy) > 0.18;
    if (!this.pad && !moved && !b.some(Boolean)) return;
    if (!this.pad) { this.pad = true; this.on.wake(); }
    // the stick leads the free end up to half a metre from where it is
    const r = moved ? 0.5 * Math.min(1, (Math.hypot(sx, sy) - 0.18) / 0.82) : 0, a = Math.atan2(-sy, sx);
    this.pointer.x = at.x + r * Math.cos(a);
    this.pointer.y = at.y + r * Math.sin(a);
    const edge = (i: number) => b[i] && !this.was[i], up = (i: number) => !b[i] && this.was[i];
    const head = b[6] || b[4], tail = b[7] || b[5], was = { head: this.was[6] || this.was[4], tail: this.was[7] || this.was[5] };
    if (this.oneButton) { if (head && !was.head) this.on.swap(); if (tail && !was.tail) this.on.drop(); }
    else { if (head !== was.head) this.on.hold(0, head); if (tail !== was.tail) this.on.hold(1, tail); }
    if (edge(0)) this.on.slip(true); else if (up(0)) this.on.slip(false);
    if (edge(1)) this.on.look(true); else if (up(1)) this.on.look(false);
    if (edge(3)) this.on.respawn();
    if (edge(9)) this.on.enter();
    this.was = b;
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
