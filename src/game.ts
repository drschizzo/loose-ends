// The game: a climb played in a world, drawn on a stage. Each frame it steps
// the solver (the lace led by the controls), applies the level's rules, and
// draws. When the lace saves on a post, the climb's window moves up, and the
// world is built again around the lace; so it is when the lace, worn through
// somewhere (blades, flames, rubbing, jolts), breaks there (a post makes it
// whole and new again).

import type { Event as LaceEvent, Lace } from './play/lace';
import { advice } from './play/advice';
import { Controls } from './play/controls';
import { Rules, type RuleEvent } from './play/rules';
import type { Climb } from './play/climb';
import type { Level } from './level/level';
import { LACE_NODES, regrown } from './sim/cords';
import { World } from './sim/world';
import { sfx, wake } from './sound';
import { CordsView } from './view/cordsView';
import { Hud } from './view/hud';
import { Overlay } from './view/overlay';
import { Scenery } from './view/scenery';
import { Stage } from './view/stage';

const END_NAMES = ['La tête', 'La queue'];

export class Game {
  readonly stage = new Stage();
  readonly hud = new Hud();
  readonly rules = new Rules();
  readonly controls: Controls;
  world!: World;
  state: 'title' | 'play' = 'title';
  /** seconds played (from the first grip) */
  clock = 0;
  /** seconds the world has run: what moves, moves with it */
  private time = 0;
  private started = false;
  private showHints = true;
  /** seconds the lace has lain against other cords, gripping none */
  private tangled = 0;
  private frame = 0;
  /** where the lace was when play began: where it goes back to with no post saved */
  private startPos: Float64Array | null = null;
  private overlay: Overlay;
  private cords!: CordsView;
  private scenery!: Scenery;

  constructor(readonly climb: Climb) {
    this.overlay = new Overlay(this.stage.scene);
    this.build(climb.level(), climb.lace());
    this.rules.save = climb.resumed();
    this.controls = new Controls(this.stage.renderer.domElement, this.stage.camera, {
      hold: (k, on) => this.hold(k, on),
      slip: (on) => {
        const was = this.lace.slipping;
        this.lace.slipping = on && this.state === 'play';
        if (this.lace.slipping && !was) this.hud.toast('L\'aiguillette se faufile : le bout passe devant ou derrière les cordes', 1.4);
      },
      respawn: () => { if (this.state === 'play') this.respawn(); },
      toggleHints: () => { this.showHints = !this.showHints; },
      enter: () => { if (this.state === 'title') this.begin(); },
      wake,
    });
    const [cx, cy] = this.lace.centre();
    this.stage.jump(cx, cy);
    let acc = 0, last = performance.now();
    this.stage.renderer.setAnimationLoop((now) => {
      const real = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += real;
      let steps = 0;
      while (acc >= this.world.sim.P.dt && steps < 3) { this.tick(); acc -= this.world.sim.P.dt; steps++; }
      if (steps === 3) acc = 0;
      this.draw(real);
    });
  }

  get lace(): Lace { return this.world.lace; }

  /** the play begins (the cords have settled while the title showed) */
  begin(): void {
    wake();
    if (this.state === 'title') this.startPos = this.lace.save();
    this.state = 'play';
    this.hud.hideTitle();
  }

  /** end k's button held or let go (the clock starts with the first grip) */
  hold(k: number, on: boolean): void {
    if (on && this.state === 'play') this.started = true;
    this.lace.ends[k].held = on && this.state === 'play';
  }

  /** the lace back on the post it saved on, or where it started (whole again, if it was cut) */
  respawn(): void {
    const save = this.rules.save, pos = save ? save.pos : this.startPos ?? this.lace.save();
    if (pos.length !== 3 * this.lace.count) this.build(this.world.level, pos);
    else this.lace.restore(pos);
    this.climb.track(this.lace.centre()[1], this.clock);
    const [cx, cy] = this.lace.centre();
    this.stage.jump(cx, cy);
    this.hud.toast(save ? 'Retour au dernier poteau' : 'Retour au départ', 1);
  }

  /** (for testing) the world of the course around section k, the lace hanging from the hold it starts from */
  warp(k: number): void {
    const from = this.climb.course.section(Math.max(0, k - 1)).exit, p: number[] = [];
    for (let i = 0; i < this.lace.count; i++) p.push(from.x, from.y - 0.03 - 0.02 * i, 0);
    this.build(this.climb.course.window(Math.max(0, k - 1)), p);
    this.stage.jump(from.x, from.y);
  }

  /** a world for level L, the lace where `lace` says (as worn as `wear` says), the cords of the world before kept where they lay */
  private build(L: Level, lace: ArrayLike<number> | null, wear?: ArrayLike<number>): void {
    const previous = this.world;
    this.cords?.dispose();
    this.scenery?.dispose();
    this.world = new World(L, lace, 11 + this.climb.look, previous, wear);
    this.rules.attach(this.world);
    this.cords = new CordsView(this.stage.scene, this.world);
    this.scenery = new Scenery(this.stage.scene, L, this.climb.look);
  }

  /** one step of the solver */
  tick(): void {
    const lace = this.lace, p = this.controls.pointer, dt = this.world.sim.P.dt;
    if (this.state === 'play') for (const ev of this.lace.control(p.x, p.y)) this.handled(ev);
    else { const l = lace.leader(); if (l) { const q = lace.at(l.node); lace.control(q[0], q[1]); } }
    this.time += dt;
    this.world.update(this.time, dt);
    this.world.sim.step();
    for (const ev of lace.wear(dt)) if (ev.what === 'worn out') { sfx.slip(); this.hud.toast(`${END_NAMES[lace.ends.indexOf(ev.end)]} n'en peut plus et lâche !`, 1.4); }
    if (++this.frame % 6 === 0) this.tangled = !lace.slipping && !lace.ends.some((e) => e.grip?.kind === 'cord') && lace.againstCords() ? this.tangled + 6 * dt : 0;
    if (this.state !== 'play') return;
    if (this.started) this.clock += dt;
    this.climb.track(lace.centre()[1], this.clock);
    for (const ev of this.rules.step(dt, this.time)) this.happened(ev);
    lace.rub(dt);
    const torn = lace.broken();
    if (torn >= 0) this.broke(torn);
    // fallen below the world (below the post, on the endless course): back to the post
    if (lace.centre()[1] < this.world.level.bottom - 0.4) { this.respawn(); this.hud.toast('Tombé ! Retour au dernier poteau', 1.8); }
  }

  /** the lace worn through at node `at` breaks there: the piece an end grips goes on (it lets go), the other falls */
  private broke(at: number): void {
    const kept = this.world.broken(at);
    sfx.slip();
    if (!kept) { this.respawn(); this.hud.toast('Le lacet casse, trop court pour grimper : retour au poteau, neuf', 2.4); return; }
    this.build(this.world.level, kept.pos, kept.wear);
    this.hud.toast('Le lacet casse ! Il lâche tout, plus court. Un poteau le rendra neuf', 2.4);
  }

  /** what the ends did */
  private handled(ev: LaceEvent): void {
    const k = this.lace.ends.indexOf(ev.end);
    if (ev.what === 'took') {
      const a = this.lace.anchor(ev.end)!;
      sfx.grip();
      this.overlay.burst(a[0], a[1], k);
    } else if (ev.what === 'jolt') {
      if (ev.torn) { sfx.slip(); this.hud.toast(`Trop vite ! ${END_NAMES[k]} n'a pas pu te rattraper`, 1.6); }
      else this.hud.toast(`Choc ! ${END_NAMES[k]} y laisse ${Math.round(ev.cost * 100)} % de ses forces`, 1.4);
    }
  }

  private happened(ev: RuleEvent): void {
    switch (ev.what) {
      case 'button': case 'threaded': sfx.button(); break;
      case 'opened': if (!this.world.level.gates[ev.gate].period) { sfx.save(); this.hud.toast('La trappe s\'ouvre !', 1.8); } break;
      case 'shut': break;
      case 'holding': this.hud.toast('Ça tient ?', 1.2); break;
      case 'saved':
        sfx.save();
        this.hud.toast('Ça tient ! Progression sauvegardée (R pour y revenir)', 2.4);
        {
          // a post makes the lace whole and new again
          const save = this.rules.save!, whole = save.pos.length === 3 * LACE_NODES;
          if (!whole) save.pos = Float64Array.from(regrown(save.pos));
          if (this.climb.saved(save)) this.build(this.climb.level(), save.pos);
          else if (!whole) this.build(this.world.level, save.pos);
          else this.lace.damage.fill(0);
        }
        break;
      case 'cut': sfx.slip(); this.hud.toast('Coupé ! Les fibres lâchent : encore un coup et il casse', 1.8); break;
      case 'burnt': sfx.slip(); this.hud.toast('Ça brûle ! Sors de la flamme', 1.4); break;
      case 'soaked': this.world.soak(); this.hud.toast('Trempé ! Le lacet rétrécit et s\'alourdit, le temps de sécher', 2); break;
    }
  }

  /** the frame drawn, dt seconds after the last */
  draw(dt: number): void {
    const playing = this.state === 'play', [cx, cy] = this.lace.centre(), p = this.controls.pointer, L = this.world.level;
    this.cords.update();
    this.overlay.draw(this.world, this.cords, playing, p, this.showHints, dt);
    this.scenery.update(this.rules, this.world, this.time, dt);
    // the camera follows the lace, a little ahead towards the pointer
    this.stage.follow(playing ? cx * 0.8 + p.x * 0.2 : cx, (playing ? cy * 0.8 + p.y * 0.2 : cy) + 0.1, Math.max(0.75, L.bottom + 0.75), L.top - 0.7, dt);
    const taken = this.rules.taken.size, shown = this.climb.shown(cy, this.clock);
    this.hud.stats(shown.time, `${taken} bouton${taken > 1 ? 's' : ''}`, shown.height);
    this.hud.cards(this.lace);
    this.hud.hint(playing && this.showHints ? advice({ lace: this.lace, level: L, tangled: this.tangled, isOpen: (k) => this.rules.isOpen(k) }) : '');
    this.hud.update(dt);
    this.stage.render();
  }
}
