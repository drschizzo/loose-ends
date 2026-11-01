// The editor's view of a course: drawn as the game draws it (the floors'
// decor, the bars, the cords as tubes), for the stretch of the course the
// camera looks at, built again as it moves. Over it, what the game does not
// show: where each section begins and what it is made of, the hold it ends
// on, where each help is said, how far each bar that moves goes; what the
// pointer is on, what is selected, what a step of a part made.
//
// The camera: the wheel scrolls up and down the climb (and sideways), with
// ctrl (or a pinch) it zooms; dragging moves the view, with shift or the right
// button it turns round; a double click faces the wall again. A click
// selects what is under the pointer.

import * as THREE from 'three/webgpu';
import type { Course, Section } from '../gen/course';
import { KINDS, type Kind, type Origin } from '../gen/layout';
import { merge, ROOM, type Level } from '../level/level';
import { Rules } from '../play/rules';
import { World } from '../sim/world';
import { CordsView } from '../view/cordsView';
import { Scenery } from '../view/scenery';
import { Stage } from '../view/stage';

/** a thing of the course: its kind, its index in the section it is in, what made it */
export interface Thing { kind: Kind; section: number; index: number; origin?: Origin }

export const KIND_NAMES: Record<Kind, string> = {
  bars: 'barre', shelves: 'étagère', hangs: 'corde pendue', rings: 'œillet', gates: 'trappe', pulls: 'tirette', skeins: 'écheveau',
  drapes: 'fil posé', lines: 'fil tendu', nets: 'filet', movers: 'barre mobile', hazards: 'danger', winds: 'courant d\'air', searches: 'lampe qui cherche',
  zips: 'tyrolienne', clocks: 'horloge', hooks: 'crochet', lifts: 'monte-charge', buttons: 'bouton', tips: 'aide',
};
const MAT_NAMES: Record<string, string> = { wood: 'bois', chrome: 'chrome', rubber: 'caoutchouc', gold: 'poteau doré' };
const HAZARD_NAMES: Record<string, string> = { blade: 'ciseaux', flame: 'flamme', water: 'eau' };

const FOV = 38;
const half = (dist: number) => dist * Math.tan((FOV / 2) * (Math.PI / 180));
const Z = ROOM.z + 0.02;

/**
 * How the overlay is drawn: ribbons on the glass, `width` wide (GL lines are
 * a pixel thin, half a pixel on a retina screen), solid or `dash` long
 */
interface Pen { color: string; opacity: number; width: number; dash?: number }

export class View {
  readonly stage: Stage;
  /** what the pointer clicked on (null: nothing) */
  onSelect: (t: Thing | null) => void = () => {};
  /** the cords move (a solver step each frame), the help zones show, the sections are named */
  physics = true;
  tips = true;
  labels = true;

  private course: Course | null = null;
  private count = 0;
  /** the sections built, from the first to the last */
  private built: [number, number] = [-1, -1];
  private dirty = true;
  private lastBuild = 0;
  private world: World | null = null;
  private rules = new Rules();
  private cords: CordsView | null = null;
  private scenery: Scenery | null = null;
  private level: Level | null = null;
  /** the things of the window, by their kind and their index in it */
  private things = new Map<Kind, Thing[]>();
  private overlay = new THREE.Group();
  private marks = new THREE.Group();
  private hoverMark = new THREE.Group();
  private labelBox: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private sectionLabels: { el: HTMLDivElement; y: number }[] = [];
  /** the sections built, and how wide the overlay's lines are for the camera's distance */
  private sections: Section[] = [];
  private width = 0.006;
  private selected: Thing | null = null;
  private marked: ((t: Thing) => boolean) | null = null;
  private hovered: Thing | null = null;

  // the camera
  private x = 0;
  private y = 0.9;
  private dist = 3;
  private yaw = 0;
  private pitch = 0;
  private time = 0;

  constructor(private host: HTMLElement) {
    this.stage = new Stage(host);
    this.stage.clear();
    this.stage.scene.add(this.overlay, this.marks, this.hoverMark);
    this.labelBox = Object.assign(document.createElement('div'), { className: 'labels' });
    this.tooltip = Object.assign(document.createElement('div'), { className: 'tooltip' });
    host.append(this.labelBox, this.tooltip);
    this.controls(this.stage.renderer.domElement);
    let last = performance.now(), acc = 0;
    this.stage.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      this.frame(dt, () => {
        let steps = 0;
        while (this.world && acc >= this.world.sim.P.dt && steps < 2) { this.step(); acc -= this.world.sim.P.dt; steps++; }
        if (steps === 2) acc = 0;
      });
    });
  }

  /** the course to show, its first `count` sections */
  setCourse(course: Course, count: number): void {
    this.course = course;
    this.count = count;
    this.dirty = true;
  }

  /** the camera on section k */
  goTo(k: number): void {
    if (!this.course) return;
    const s = this.course.section(k), h = s.level.top - s.level.bottom;
    this.y = s.level.bottom + h / 2;
    this.x = 0;
    // the whole width of the room, and the section's height, in view
    const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    this.dist = Math.max(2.4, Math.min(12, Math.max((h * 0.75) / half(1), (ROOM.x + 0.25) / (half(1) * aspect))));
    // not much of what is under the floor
    this.y = Math.max(this.y, half(this.dist) * 0.85);
  }

  /** the height the camera looks at */
  get height(): number { return this.y; }

  /** shows `t` as selected */
  select(t: Thing | null): void {
    this.selected = t;
    this.redrawMarks();
  }

  /** shows the things `which` says (the things a step made), or none */
  mark(which: ((t: Thing) => boolean) | null): void {
    this.marked = which;
    this.redrawMarks();
  }

  /** what a thing is, in words */
  describe(t: Thing): string {
    const L = this.course?.section(t.section).level;
    if (!L) return '';
    const o = L[t.kind][t.index] as any, at = (x: number, y: number) => `(${x.toFixed(2)}, ${y.toFixed(2)})`;
    let what = KIND_NAMES[t.kind];
    if (t.kind === 'bars') what += ` · ${MAT_NAMES[o.mat] ?? o.mat} ${at(o.x, o.y)}`;
    else if (t.kind === 'hazards') what = `${HAZARD_NAMES[o.kind]} ${at((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2)}`;
    else if (t.kind === 'buttons') what += ` ${at(o[0], o[1])}`;
    else if ('x' in o && 'y' in o) what += ` ${at(o.x, o.y)}`;
    else if ('x' in o && 'top' in o) what += ` ${at(o.x, o.top)} · ${(o.length as number).toFixed(2)} m`;
    else if ('x0' in o) what += ` ${at(o.x0, o.y0 ?? o.top ?? o.y)}`;
    const origin = t.origin ? ` — ${t.origin.part}${t.origin.path ? ` · étape ${t.origin.path}` : ''}` : '';
    return `${what}${origin} · §${t.section}`;
  }

  // ------------------------------------------------------------------ build

  /** the sections the camera wants built: what it sees, and some more */
  private wanted(): [number, number] {
    const c = this.course!, h = half(this.dist) * 1.3 + 0.6, last = this.count - 1;
    const lo = Math.max(0, this.y - h), hi = this.y + h;
    let a = 0, b = 0;
    for (let i = 0; i <= last; i++) {
      const s = c.section(i);
      if (s.level.top < lo) a = i + 1;
      if (s.level.bottom <= hi) b = i;
    }
    return [Math.min(a, last), Math.max(Math.min(a, last), b)];
  }

  private rebuildIfNeeded(now: number): void {
    if (!this.course || now - this.lastBuild < 120) return;
    const [a, b] = this.wanted();
    if (!this.dirty && a >= this.built[0] && b <= this.built[1]) return;
    // build a little more than what is seen: scrolling does not build at each step
    const more = 2;
    this.build(Math.max(0, a - more), Math.min(this.count - 1, b + more));
    this.lastBuild = now;
  }

  private build(a: number, b: number): void {
    const course = this.course!, sections: Section[] = [];
    for (let i = a; i <= b; i++) sections.push(course.section(i));
    const L = merge(sections.map((s) => s.level));
    L.top += 1;
    this.things.clear();
    for (const kind of KINDS) {
      const list: Thing[] = [];
      for (const s of sections) s.level[kind].forEach((_, index) => list.push({ kind, section: s.index, index, origin: s.origins?.[kind]?.[index] }));
      this.things.set(kind, list);
    }
    const previous = this.world ?? undefined;
    this.cords?.dispose();
    this.scenery?.dispose();
    this.world = new World(L, null, 13 + course.seed, previous);
    this.rules = new Rules();
    this.rules.attach(this.world);
    this.cords = new CordsView(this.stage.scene, this.world);
    this.scenery = new Scenery(this.stage.scene, L, course.storeys(L.bottom, L.top), course.seed, 0);
    this.level = L;
    this.built = [a, b];
    this.dirty = false;
    this.sections = sections;
    this.drawOverlay();
    this.redrawMarks();
  }

  /** where each section begins, the hold it ends on, the help zones, the way bars move */
  private drawOverlay(): void {
    clear(this.overlay);
    this.labelBox.replaceChildren();
    this.sectionLabels = [];
    const w = this.width;
    for (const s of this.sections) {
      const y = s.level.bottom;
      this.overlay.add(ribbon([[-ROOM.x, y], [ROOM.x, y]], false, { color: s.post ? '#f2c14e' : '#ffffff', opacity: s.post ? 0.85 : 0.5, width: w, dash: 0.04 }));
      const el = document.createElement('div');
      el.className = `section${s.post ? ' post' : ''}`;
      el.innerHTML = `<b>§${s.index}</b> ${esc(s.name)}<small>effort ${s.effort}${s.twist.name ? ` · ${esc(s.twist.name)}` : ''}</small>`;
      this.labelBox.append(el);
      this.sectionLabels.push({ el, y });
      // the hold it ends on: where the next one starts
      this.overlay.add(ribbon(circle(s.exit.x, s.exit.y, 0.035), true, { color: '#7dff9a', opacity: 0.95, width: w }));
      s.level.tips.forEach((t) => {
        const c = ribbon(circle(t.x, t.y, t.r, 72), true, { color: '#6fd3ff', opacity: 0.6, width: w, dash: 0.03 });
        c.userData.tip = true;
        this.overlay.add(c);
      });
      for (const m of s.level.movers) {
        const b = s.level.bars[m.bar];
        this.overlay.add(ribbon([[b.x - m.dx, b.y - m.dy], [b.x + m.dx, b.y + m.dy]], false, { color: '#ffae42', opacity: 0.8, width: w }));
      }
    }
  }

  private redrawMarks(): void {
    clear(this.marks);
    if (!this.level) return;
    const pen = (color: string): Pen => ({ color, opacity: 1, width: this.width * 1.6 });
    if (this.marked) for (const list of this.things.values()) for (const t of list) if (this.marked(t)) this.marks.add(outline(this.course!, t, pen('#4ff0ff')));
    if (this.selected) this.marks.add(outline(this.course!, this.selected, pen('#ffe14a')));
  }

  // ------------------------------------------------------------------ frame

  private step(): void {
    if (!this.world || !this.physics) return;
    this.time += this.world.sim.P.dt;
    this.world.update(this.time, this.world.sim.P.dt);
    this.world.sim.step();
  }

  private frame(dt: number, steps: () => void): void {
    this.rebuildIfNeeded(performance.now());
    if (!this.world || !this.scenery || !this.cords) { this.stage.render(); return; }
    steps();
    if (!this.physics) this.time += dt;
    this.cords.update();
    this.scenery.update(this.rules, this.world, this.time, dt);
    this.scenery.decor.update(performance.now() / 1000, dt, this.y);
    this.stage.mood(this.scenery.decor.lightAt(this.y));
    this.stage.lights(this.scenery.decor.fixtures, performance.now() / 1000, null);
    this.stage.look(this.x, this.y, this.dist, this.yaw, this.pitch);
    // the lines about two pixels wide, whatever the distance
    const w = (4 * half(this.dist)) / Math.max(1, this.host.clientHeight);
    if (Math.abs(w / this.width - 1) > 0.3) { this.width = w; this.drawOverlay(); this.redrawMarks(); }
    for (const o of this.overlay.children) if (o.userData.tip) o.visible = this.tips;
    this.placeLabels();
    this.stage.render();
  }

  /** the names of the sections, on the left of the room, where they begin */
  private placeLabels(): void {
    this.labelBox.hidden = !this.labels;
    if (!this.labels) return;
    const w = this.host.clientWidth, h = this.host.clientHeight, v = new THREE.Vector3();
    for (const { el, y } of this.sectionLabels) {
      v.set(-ROOM.x, y, Z).project(this.stage.camera);
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      el.hidden = sy < -20 || sy > h + 20 || v.z > 1;
      if (!el.hidden) el.style.transform = `translate(${Math.max(4, sx - 8 - el.offsetWidth)}px, ${sy - el.offsetHeight}px)`;
    }
  }

  // --------------------------------------------------------------- pointing

  /** where the pointer is on the wall's plane (z = 0) */
  private onWall(e: MouseEvent): THREE.Vector2 | null {
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.stage.camera);
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
    return p ? new THREE.Vector2(p.x, p.y) : null;
  }

  /** the thing nearest the pointer, if near enough */
  private pick(e: MouseEvent): Thing | null {
    const p = this.onWall(e);
    if (!p || !this.course) return null;
    let best: Thing | null = null, bestD = 0.035 * Math.max(1, this.dist / 2.5);
    for (const [kind, list] of this.things) {
      if (kind === 'movers' || (kind === 'tips' && !this.tips)) continue;
      for (const t of list) {
        const d = distance(this.course.section(t.section).level, t, p.x, p.y);
        if (d < bestD) { bestD = d; best = t; }
      }
    }
    return best;
  }

  private controls(el: HTMLCanvasElement): void {
    let drag: { x: number; y: number; moved: boolean; turn: boolean } | null = null;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) this.dist = Math.max(0.8, Math.min(30, this.dist * Math.exp(e.deltaY * 0.004)));
      else {
        const k = (2 * half(this.dist)) / el.clientHeight;
        this.y = Math.max(-0.5, this.y - e.deltaY * k);
        this.x = Math.max(-2, Math.min(2, this.x + e.deltaX * k));
      }
    }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, moved: false, turn: e.button === 2 || e.shiftKey };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        drag.x = e.clientX;
        drag.y = e.clientY;
        if (drag.turn) {
          this.yaw = Math.max(-1.3, Math.min(1.3, this.yaw - dx * 0.005));
          this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + dy * 0.005));
        } else {
          const k = (2 * half(this.dist)) / el.clientHeight;
          this.x -= dx * k * Math.cos(this.yaw);
          this.y += dy * k;
        }
        this.hover(null, e);
        return;
      }
      this.hover(this.pick(e), e);
    });
    el.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved && e.button === 0) {
        const t = this.pick(e);
        this.select(t);
        this.onSelect(t);
      }
      drag = null;
    });
    el.addEventListener('pointerleave', (e) => this.hover(null, e));
    el.addEventListener('dblclick', () => { this.yaw = 0; this.pitch = 0; });
  }

  private hover(t: Thing | null, e: MouseEvent): void {
    const same = t === this.hovered;
    this.hovered = t;
    if (!same) {
      clear(this.hoverMark);
      if (t) this.hoverMark.add(outline(this.course!, t, { color: '#ffffff', opacity: 0.9, width: this.width * 1.2 }));
    }
    this.tooltip.hidden = !t;
    if (!t) return;
    const r = this.host.getBoundingClientRect();
    if (!same) this.tooltip.textContent = this.describe(t);
    this.tooltip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
  }
}

// ---------------------------------------------------------------- helpers

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function clear(g: THREE.Group): void {
  for (const o of [...g.children]) {
    o.removeFromParent();
    if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
  }
}

/** a ribbon along points on the glass: each segment a quad (cut into dashes, if the pen says so) */
function ribbon(pts: [number, number][], closed: boolean, pen: Pen): THREE.Mesh {
  const pos: number[] = [], idx: number[] = [], hw = pen.width / 2;
  const quad = (x0: number, y0: number, x1: number, y1: number) => {
    const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (-(y1 - y0) / l) * hw, ny = ((x1 - x0) / l) * hw, v = pos.length / 3;
    // a little longer at both ends: the corners close
    const ex = ((x1 - x0) / l) * hw, ey = ((y1 - y0) / l) * hw;
    pos.push(x0 - ex + nx, y0 - ey + ny, Z, x0 - ex - nx, y0 - ey - ny, Z, x1 + ex - nx, y1 + ey - ny, Z, x1 + ex + nx, y1 + ey + ny, Z);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  };
  const n = closed ? pts.length : pts.length - 1;
  let along = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], l = Math.hypot(x1 - x0, y1 - y0);
    if (!pen.dash) { quad(x0, y0, x1, y1); continue; }
    // dashes as long as the gaps, carried on from one segment to the next: those of [along, along + l]
    const at = (d: number) => [x0 + ((x1 - x0) * (d - along)) / l, y0 + ((y1 - y0) * (d - along)) / l] as const, period = 2 * pen.dash;
    for (let k = Math.floor(along / period); k * period < along + l; k++) {
      const d0 = Math.max(along, k * period), d1 = Math.min(along + l, k * period + pen.dash);
      if (d1 > d0) quad(...at(d0), ...at(d1));
    }
    along += l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: pen.color, transparent: true, opacity: pen.opacity, depthTest: false, depthWrite: false, toneMapped: false }));
  m.renderOrder = 10;
  return m;
}

const circle = (x: number, y: number, r: number, n = 36): [number, number][] =>
  Array.from({ length: n }, (_, i) => [x + r * Math.cos((2 * Math.PI * i) / n), y + r * Math.sin((2 * Math.PI * i) / n)]);
const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** a line strung with `slack`, sagging (roughly as the cords do: a parabola as long) */
function sag(x0: number, y0: number, x1: number, y1: number, slack: number): [number, number][] {
  const gap = Math.hypot(x1 - x0, y1 - y0), d = Math.sqrt((3 * gap * slack) / 8), out: [number, number][] = [];
  for (let j = 0; j <= 20; j++) { const t = j / 20; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 4 * d * t * (1 - t)]); }
  return out;
}

/** the outline of a thing, to show it */
function outline(course: Course, t: Thing, pen: Pen): THREE.Object3D {
  const L = course.section(t.section).level, o = L[t.kind][t.index] as any, pad = 0.012;
  const ring = (x: number, y: number, r: number) => ribbon(circle(x, y, r, r > 0.2 ? 72 : 36), true, pen);
  const box = (x0: number, y0: number, x1: number, y1: number) => ribbon(rect(x0, y0, x1, y1), true, pen);
  switch (t.kind) {
    case 'bars': return ring(o.x, o.y, o.r + pad);
    case 'rings': return ring(o.x, o.y, o.r + pad);
    case 'buttons': return ring(o[0], o[1], 0.026 + pad);
    case 'tips': return ring(o.x, o.y, o.r);
    case 'shelves': return box(o.x0, o.y - 0.03 - pad, o.x1, o.y + pad);
    case 'gates': case 'hazards': return box(o.x0 - pad, o.y0 - pad, o.x1 + pad, o.y1 + pad);
    case 'nets': return box(o.x0 - pad, o.bottom - pad, o.x1 + pad, o.top + pad);
    case 'hangs': case 'pulls': return box(o.x - 0.02, o.top - o.length - pad, o.x + 0.02, o.top + pad);
    case 'skeins': return box(o.x - 0.1, o.top - o.length - pad, o.x + 0.1, o.top + pad);
    case 'drapes': { const b = L.bars[o.bar]; return box(b.x - 0.04, b.y - o.length * Math.max(o.left, 1 - o.left), b.x + 0.04, b.y + b.r + pad); }
    case 'movers': { const b = L.bars[o.bar]; return box(b.x - o.dx - b.r - pad, b.y - o.dy - b.r - pad, b.x + o.dx + b.r + pad, b.y + o.dy + b.r + pad); }
    case 'lines': return ribbon(sag(o.x0, o.y0, o.x1, o.y1, o.slack), false, pen);
    case 'winds': return box(o.x0, o.y0, o.x1, o.y1);
    case 'searches': return ring(o.x, o.y, 0.05);
    case 'zips': return ribbon([[o.x0, o.y0], [o.x1, o.y1]], false, pen);
    case 'clocks': return ring(o.x, o.y, o.length + pad);
    case 'hooks': return ring(o.x, o.y, 0.03);
    case 'lifts': { const b = L.bars[o.bar]; return box(b.x - 0.06, b.y - o.drop, b.x + 0.06, b.y + b.r + pad); }
  }
}

const segment = (px: number, py: number, x0: number, y0: number, x1: number, y1: number) => {
  const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l)) : 0;
  return Math.hypot(px - x0 - t * dx, py - y0 - t * dy);
};
const inBox = (px: number, py: number, x0: number, y0: number, x1: number, y1: number) =>
  Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));

/** how far (x, y) is from a thing, on the wall */
function distance(L: Level, t: Thing, x: number, y: number): number {
  const o = L[t.kind][t.index] as any;
  switch (t.kind) {
    case 'bars': return Math.max(0, Math.hypot(x - o.x, y - o.y) - o.r);
    case 'rings': return Math.max(0, Math.hypot(x - o.x, y - o.y) - o.r) + 0.002;
    case 'buttons': return Math.max(0, Math.hypot(x - o[0], y - o[1]) - 0.026);
    case 'tips': return Math.abs(Math.hypot(x - o.x, y - o.y) - o.r) + 0.01;
    case 'shelves': return inBox(x, y, o.x0, o.y - 0.03, o.x1, o.y);
    case 'gates': return inBox(x, y, o.x0, o.y0, o.x1, o.y1);
    case 'hazards': return inBox(x, y, o.x0, o.y0, o.x1, o.y1) + 0.003;
    // inside a net, what is in front of it comes first
    case 'nets': return Math.max(0.012, inBox(x, y, o.x0, o.bottom, o.x1, o.top));
    case 'hangs': case 'pulls': return segment(x, y, o.x, o.top, o.x, o.top - o.length);
    case 'skeins': return inBox(x, y, o.x - 0.08, o.top - o.length, o.x + 0.08, o.top) + 0.005;
    case 'drapes': { const b = L.bars[o.bar]; return inBox(x, y, b.x - 0.035, b.y - o.length * Math.max(o.left, 1 - o.left), b.x + 0.035, b.y) + 0.008; }
    case 'lines': { const p = sag(o.x0, o.y0, o.x1, o.y1, o.slack); let d = Infinity; for (let i = 1; i < p.length; i++) d = Math.min(d, segment(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1])); return d; }
    case 'movers': return Infinity;
    case 'winds': return inBox(x, y, o.x0, o.y0, o.x1, o.y1) + 0.01;
    case 'searches': return Math.max(0, Math.hypot(x - o.x, y - o.y) - 0.05);
    case 'zips': return segment(x, y, o.x0, o.y0, o.x1, o.y1);
    case 'clocks': return Math.max(0, Math.hypot(x - o.x, y - o.y) - o.length) + 0.01;
    case 'hooks': return Math.max(0, Math.hypot(x - o.x, y - o.y) - 0.02);
    case 'lifts': { const b = L.bars[o.bar]; return inBox(x, y, b.x - 0.05, b.y - o.drop, b.x + 0.05, b.y) + 0.005; }
  }
}
