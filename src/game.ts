// The game: a climb played in a world, drawn on a stage. Each frame it steps
// the solver (the lace led by the controls), applies the level's rules, and
// draws. When the lace saves on a post, the climb's window moves up, and the
// world is built again around the lace; so it is when the lace, worn through
// somewhere (blades, flames, rubbing, jolts), breaks there (a post makes it
// whole and new again). As the lace comes into a floor of the house (or of
// the sky) for the first time, its card shows; a rare room plays its tune.
//
// Around the climb, what makes it worth climbing again:
//   - the élan: grips that follow one another, a clean catch at the top of
//     a swing, build it up; it eases the grips, and pays buttons at its height;
//   - the buttons, taken on the way (twice as many on a twisted stretch),
//     spent on the posts (patches, second winds, a longer aglet, a firmer
//     grip, laces of other kinds);
//   - each stretch's challenge (no fall, against the clock, few grips...);
//   - the time from post to post against the best, and the ghost of that run;
//   - at dawn, on its post, the other lace: the pair, knotted, climbs on.

import { Vector3 } from 'three/webgpu';
import type { Event as LaceEvent, Lace } from './play/lace';
import { FLOORS } from './gen/floors';
import { DAWN } from './gen/course';
import { advice } from './play/advice';
import { chosen, reach } from './play/laces';
import { Controls } from './play/controls';
import { BEAM, Rules, type RuleEvent } from './play/rules';
import type { Climb } from './play/climb';
import { chooseKind, earn, fitKind, ghostOf, keepGhost, keep, knows, laceKind, learn, progress, split, use } from './play/progress';
import type { Level } from './level/level';
import { laceNodes, regrown } from './sim/cords';
import { World } from './sim/world';
import { PLAY } from './tuning';
import { hear, mute, sfx, wake, type Touch } from './sound';
import { CordsView } from './view/cordsView';
import { GhostRecorder, GhostView } from './view/ghost';
import { clockOf, Hud } from './view/hud';
import { END_COLORS, Overlay } from './view/overlay';
import type { Decor } from './view/decor';
import { Scenery } from './view/scenery';
import { Stage } from './view/stage';

const END_NAMES = ['La tête', 'La queue'];

/** a challenge of a stretch: what it asks, what it pays, whether it is lost (and at the post, whether it is met) */
interface Challenge { id: string; text: string; reward: number; lost: boolean; met: () => boolean }

/** what the stretch under way has been like so far */
interface Stretch {
  /** the post it starts from (its section), when (s of play), how high */
  from: number;
  at: number;
  y: number;
  grips: number;
  taken: number;
  fell: boolean;
  /** the lowest a grip got (stamina), the worst the lace got (wear), the most élan */
  low: number;
  worn: number;
  flow: number;
  /** its buttons, its par (s), its sections */
  buttons: number;
  par: number;
  twisted: boolean;
}

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
  /** seconds the lace has lain against other cords or itself, gripping none */
  private tangled = 0;
  /** how frayed the lace has been said to be: 0 not, 1 past half worn, 2 nearly through */
  private frayed = 0;
  private frame = 0;
  /** where the lace was when play began: where it goes back to with no post saved */
  private startPos: Float64Array | null = null;
  private overlay: Overlay;
  private cords!: CordsView;
  private scenery!: Scenery;
  /** the floor the lace is on (−1: not said yet), the rare rooms it has heard */
  private floor = -1;
  private heard = new Set<number>();
  /** where the image is sharpest: the lace */
  private subject = new Vector3();
  /** the élan: its level, when the last grip was (s of the world's time), the grips made at its height */
  private flow = 0;
  private lastGrip = -99;
  private atMost = 0;
  private stretch!: Stretch;
  private challenge: Challenge | null = null;
  private recorder = new GhostRecorder();
  private ghost: GhostView;
  /** looking up the climb; how far out the camera has drawn (×); how dark it is (a blackout) */
  private looking = false;
  private zoom = 1;
  private dark = 0;
  /** the cursor drawn as the colour of the end the pointer leads */
  private cursorFor = -2;
  /** stamina of each end while it rested, to know when a rest was learned */
  private rested = [1, 1];
  private slipSaid = 0;
  /** what is to happen in a while (s of frames drawn): timers of the page stall in a hidden tab, the frames do not */
  private soon: { t: number; f: () => void }[] = [];

  constructor(readonly climb: Climb) {
    this.overlay = new Overlay(this.stage.scene);
    this.ghost = new GhostView(this.stage.scene);
    this.build(climb.level(), climb.lace());
    this.rules.save = climb.resumed();
    this.controls = new Controls(this.stage.renderer.domElement, this.stage.camera, {
      hold: (k, on) => this.hold(k, on),
      slip: (on) => {
        const was = this.lace.slipping;
        this.lace.slipping = on && this.state === 'play';
        if (this.lace.slipping && !was) {
          if (this.tangled > 1) learn('slip');
          if (this.slipSaid++ < 2 && !knows('slip', 3)) this.hud.toast('L\'aiguillette se faufile : le bout passe devant ou derrière les cordes', 1.4);
        }
      },
      respawn: () => { if (this.state === 'play') this.respawn(); },
      toggleHints: () => { this.showHints = !this.showHints; this.hud.showCards(this.showHints && !knows('grip', 12)); },
      enter: () => { if (this.state === 'title') this.begin(); },
      look: (on) => { this.looking = on && this.state === 'play'; },
      mute: () => { progress.muted = !progress.muted; keep(); mute(progress.muted); this.hud.toast(progress.muted ? 'Son coupé (M)' : 'Son rétabli', 1); },
      swap: () => this.swap(),
      drop: () => { if (this.state === 'play') for (const e of this.lace.ends) e.held = false; },
      wake,
    });
    this.controls.oneButton = progress.oneButton;
    mute(progress.muted);
    this.lace.rescue = () => {
      if (!use('breath')) return false;
      sfx.rescue();
      this.hud.toast('Second souffle ! La prise tient encore', 1.6);
      this.hud.items();
      return true;
    };
    const [cx, cy] = this.lace.centre();
    this.stage.jump(cx, cy);
    this.newStretch(cy);
    this.hud.items();
    this.hud.showCards(!knows('grip', 12));
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

  /** the decor of the world built (for testing) */
  get decor(): Decor { return this.scenery.decor; }

  /** the play begins (the cords have settled while the title showed) */
  begin(): void {
    wake();
    if (this.state === 'title') this.startPos = this.lace.save();
    this.state = 'play';
    this.hud.hideTitle();
    // the card of the floor it starts on, whether or not it was seen before
    const f = this.scenery.decor.floorAt(this.lace.centre()[1]);
    this.hud.card(FLOORS[f].name, this.climb.daily ? `Montée du jour, ${this.climb.daily}` : FLOORS[f].line);
  }

  /** the lace chosen on the title screen: the same lace, its new colours */
  relace(): void {
    const look = chosen();
    this.world.cords[0].color = look.color;
    this.cords.dispose();
    this.cords = new CordsView(this.stage.scene, this.world);
  }

  /** the lace made again as the kind now worn (chosen on the title screen or a post), where it lies */
  reknit(): void {
    const k = fitKind();
    PLAY.aglet = progress.upgrades.aglet ? 6 : 4;
    this.build(this.world.level, regrown(this.lace.save()));
    this.lace.wearScale = k.wear;
    if (this.rules.save) this.rules.save.pos = this.lace.save();
  }

  /** end k's button held or let go (the clock starts with the first grip) */
  hold(k: number, on: boolean): void {
    if (on && this.state === 'play') this.started = true;
    this.lace.ends[k].held = on && this.state === 'play';
  }

  /** one button: the free end grips (if it can) and the other lets go */
  private swap(): void {
    if (this.state !== 'play') return;
    this.started = true;
    const lace = this.lace, a = lace.leader() ?? lace.ends[0], b = lace.ends[1 - lace.ends.indexOf(a)];
    if (!lace.ends.some((e) => e.grip)) { a.held = true; return; }
    if (!lace.holdFor(a)) { sfx.miss(); return; }
    a.held = true;
    // the other lets go once this one holds (next step)
    this.later(0.03, () => { if (a.grip) b.held = false; });
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
    this.stretch.fell = true;
    this.lose('fell');
    this.loseFlow();
    // the run starts over: its time and its ghost too
    this.stretch.at = this.clock;
    this.recorder.start(this.stretch.y);
  }

  /** (for testing) the world of the course around section k, the lace hanging from the hold it starts from */
  warp(k: number): void {
    const from = this.climb.course.section(Math.max(0, k - 1)).exit, p: number[] = [];
    for (let i = 0; i < laceNodes(); i++) p.push(from.x, from.y - 0.03 - 0.02 * i, 0);
    this.build(this.climb.course.window(Math.max(0, k - 1)), p);
    this.stage.jump(from.x, from.y);
  }

  /** a world for level L, the lace where `lace` says (as worn as `wear` says), the cords of the world before kept where they lay */
  private build(L: Level, lace: ArrayLike<number> | null, wear?: ArrayLike<number>): void {
    const previous = this.world, rescue = previous?.lace.rescue ?? null;
    this.cords?.dispose();
    this.scenery?.dispose();
    this.world = new World(L, lace, 11 + this.climb.look, previous, wear);
    this.world.lace.rescue = rescue;
    this.world.lace.wearScale = laceKind().wear;
    this.rules.attach(this.world);
    this.cords = new CordsView(this.stage.scene, this.world);
    this.scenery = new Scenery(this.stage.scene, L, this.climb.storeys(L), this.climb.course.seed, this.climb.best);
  }

  // ------------------------------------------------------------ stretches

  /** a stretch begins, from the post the climb last saved on (at height y): its challenge, its ghost */
  private newStretch(y: number): void {
    const course = this.climb.course, from = this.climb.post, to = course.nextPost(from + 1);
    let buttons = 0;
    for (let i = from + 1; i <= to; i++) buttons += course.section(i).level.buttons.length;
    const par = (course.section(to).pace - course.section(from).pace) * 1.3;
    this.stretch = { from, at: this.clock, y, grips: 0, taken: 0, fell: false, low: 1, worn: 0, flow: 0, buttons, par, twisted: course.twisted(from) };
    this.challenge = this.pickChallenge(from, to - from, buttons, par);
    this.recorder.start(y);
    this.ghost.load(ghostOf(course.seed, from));
    this.showChallenge();
  }

  /** the challenge of the stretch above the post at `from` (none on the first) */
  private pickChallenge(from: number, sections: number, buttons: number, par: number): Challenge | null {
    if (from === 0 && !this.climb.daily) return null;
    const st = () => this.stretch, mul = this.climb.course.twisted(from) ? 1.5 : 1;
    const most = 7 * sections;
    const all: Omit<Challenge, 'lost'>[] = [
      { id: 'fell', text: 'sans tomber', reward: 6, met: () => !st().fell },
      { id: 'clock', text: `en moins de ${clockOf(par)}`, reward: 8, met: () => this.clock - st().at <= par },
      { id: 'grips', text: `en ${most} prises au plus`, reward: 6, met: () => st().grips <= most },
      { id: 'fresh', text: 'sans qu\'une prise passe sous 25 %', reward: 6, met: () => st().low >= 0.25 },
      { id: 'whole', text: 'sans user le lacet de moitié', reward: 5, met: () => st().worn < 0.5 },
      { id: 'flow', text: 'l\'élan au plus haut, une fois', reward: 6, met: () => st().flow >= PLAY.flowMost },
      ...(buttons >= 2 ? [{ id: 'all', text: `les ${buttons} boutons`, reward: 8, met: () => st().taken >= buttons }] : []),
    ];
    let h = (this.climb.course.seed * 31 + from * 977) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
    const c = all[h % all.length];
    return { ...c, reward: Math.round(c.reward * mul), lost: false };
  }

  /** the challenge, lost by what just happened (if it is the one that asks otherwise) */
  private lose(what: string): void {
    const c = this.challenge;
    if (!c || c.lost || c.id !== what) return;
    c.lost = true;
    this.showChallenge();
  }

  private showChallenge(): void {
    const c = this.challenge;
    this.hud.challenge(c ? `${c.text} · +${c.reward}` : null, c?.lost ? 'failed' : 'on');
  }

  /** while the stretch goes on: what can already be told lost */
  private watchChallenge(): void {
    const c = this.challenge, st = this.stretch;
    if (!c || c.lost) return;
    if ((c.id === 'clock' && this.clock - st.at > st.par) || (c.id === 'grips' && !c.met()) || (c.id === 'fresh' && !c.met()) || (c.id === 'whole' && !c.met())) { c.lost = true; this.showChallenge(); }
  }

  // ------------------------------------------------------------ the élan

  private gripped(perfect: boolean): void {
    const now = this.time, chained = now - this.lastGrip < PLAY.flowGap;
    this.flow = Math.min(PLAY.flowMost, (chained ? this.flow : 0) + (chained ? 1 : 0) + (perfect ? 1 : 0));
    this.lastGrip = now;
    this.stretch.flow = Math.max(this.stretch.flow, this.flow);
    if (this.flow >= PLAY.flowMost && ++this.atMost % 3 === 0) {
      earn(1);
      const [x, y] = this.lace.centre();
      this.overlay.pop('élan +1', x, y + 0.05, '#ffd36a');
      sfx.button(this.flow);
    }
  }

  private loseFlow(): void {
    if (this.flow >= 2) sfx.drop();
    this.flow = 0;
    this.atMost = 0;
  }

  // ------------------------------------------------------------ a step

  /** one step of the solver */
  tick(): void {
    const lace = this.lace, p = this.controls.pointer, dt = this.world.sim.P.dt;
    if (this.state === 'play') for (const ev of this.lace.control(p.x, p.y)) this.handled(ev);
    else { const l = lace.leader(); if (l) { const q = lace.at(l.node); lace.control(q[0], q[1]); } }
    this.time += dt;
    this.world.update(this.time, dt);
    this.world.sim.step();
    for (const ev of lace.wear(dt)) {
      if (ev.what === 'worn out') { sfx.slip(); this.hud.toast(`${END_NAMES[lace.ends.indexOf(ev.end)]} n'en peut plus et lâche !`, 1.4); this.loseFlow(); }
    }
    if (++this.frame % 6 === 0) this.tangled = !lace.slipping && !lace.ends.some((e) => e.grip?.kind === 'cord') && (lace.againstCords() || lace.againstItself()) ? this.tangled + 6 * dt : 0;
    if (this.state !== 'play') return;
    if (this.started) this.clock += dt;
    this.climb.track(lace.centre()[1], this.clock);
    this.recorder.step(lace, dt);
    // the élan fades without grips
    if (this.flow > 0 && this.time - this.lastGrip > PLAY.flowGap * 1.5) this.loseFlow();
    for (const ev of this.rules.step(dt, this.time)) this.happened(ev);
    lace.rub(dt);
    // what the stretch is like: the lowest grip, the worst wear; a rest learned
    lace.ends.forEach((e, k) => {
      if (e.grip) this.stretch.low = Math.min(this.stretch.low, e.stamina);
      if (e.grip && e.load < PLAY.restLoad) { if (this.rested[k] < 0.7 && e.stamina > 0.95) learn('rest'); this.rested[k] = Math.min(this.rested[k], e.stamina); }
      else this.rested[k] = e.stamina;
    });
    if (this.frame % 12 === 0) { this.stretch.worn = Math.max(this.stretch.worn, lace.damage.reduce((m, d) => Math.max(m, d), 0)); this.watchChallenge(); }
    const torn = lace.broken();
    if (torn >= 0) this.broke(torn);
    else this.fraying();
    // fallen below the world (below the post, on the endless course): back to the post
    if (lace.centre()[1] < this.world.level.bottom - 0.4) { this.respawn(); this.hud.toast('Tombé ! Retour au dernier poteau', 1.8); }
  }

  /** the floor the lace is in: how fast its grips tire there; its name at the top; the first time, its card (and a lace found, now and then); a rare room's tune */
  private storey(y: number): void {
    const decor = this.scenery.decor, f = decor.floorAt(y);
    // in a searching lamp's beam, the grips tire faster; the élan, a firmer grip and the kind of lace ease them or not
    this.lace.tiring = this.climb.tiring(y) * (1 + PLAY.dazzle * this.rules.dazzle) * (1 - PLAY.flowEase * this.flow) * (progress.upgrades.grip ? 0.9 : 1) * laceKind().drain;
    if (f !== this.floor) {
      this.floor = f;
      this.hud.storey(FLOORS[f].name);
      if (this.climb.reached(f, this.clock)) {
        this.hud.card(FLOORS[f].name, FLOORS[f].line);
        sfx.floor();
        const found = reach(f);
        if (found) this.later(4, () => this.hud.toast(`Trouvé : ${found.name.toLowerCase()} (à choisir au début)`, 3));
      }
    }
    const m = decor.memoryAt(y);
    if (m >= 0 && !this.heard.has(m)) { this.heard.add(m); sfx.memory(); }
  }

  /** a word when the lace's worst spot wears past half, then past four fifths (once each, until a post makes it new) */
  private fraying(): void {
    const worst = this.lace.damage.reduce((m, d) => Math.max(m, d), 0), stage = worst >= 0.8 ? 2 : worst >= 0.5 ? 1 : 0;
    if (stage > this.frayed) {
      sfx.slip();
      this.hud.toast(stage === 2 ? 'Le lacet ne tient plus qu\'à un fil ! Trouve un poteau' : 'Le lacet s\'effiloche : là où il rougit, il cassera', 2);
    }
    this.frayed = stage;
  }

  /** the lace worn through at node `at` breaks there (unless a patch mends it): the piece an end grips goes on (it lets go), the other falls */
  private broke(at: number): void {
    if (use('patch')) {
      this.lace.mend(at);
      sfx.rescue();
      this.hud.toast('Rustine ! Le lacet tient encore', 1.6);
      this.hud.items();
      return;
    }
    const kept = this.world.broken(at);
    sfx.slip();
    this.stretch.fell = true;
    this.lose('fell');
    this.loseFlow();
    if (!kept) { this.respawn(); this.hud.toast('Le lacet casse, trop court pour grimper : retour au poteau, neuf', 2.4); return; }
    this.build(this.world.level, kept.pos, kept.wear);
    this.hud.toast('Le lacet casse ! Il lâche tout, plus court. Un poteau le rendra neuf', 2.4);
  }

  /** what the ends did */
  private handled(ev: LaceEvent): void {
    const k = this.lace.ends.indexOf(ev.end);
    if (ev.what === 'took') {
      const a = this.lace.anchor(ev.end)!, g = ev.end.grip;
      sfx.grip(g?.kind === 'cord' ? 'cord' : (this.world.surfaces[g!.surface].mat as Touch));
      this.overlay.burst(a[0], a[1], k, ev.perfect);
      this.stretch.grips++;
      learn('grip');
      if (knows('grip', 12)) this.hud.showCards(false);
      if (ev.perfect) {
        learn('perfect');
        this.overlay.pop('Parfait !', a[0], a[1]);
        sfx.perfect(this.flow);
        if ((progress.learned.perfect ?? 0) <= 2) this.hud.toast('Saisi au sommet du balancement : la prise reprend des forces', 2);
      }
      this.gripped(ev.perfect);
    } else if (ev.what === 'thrown') {
      sfx.whip();
      learn('throw');
    } else if (ev.what === 'jolt') {
      if (ev.torn) { sfx.slip(); this.hud.toast(`Trop vite ! ${END_NAMES[k]} n'a pas pu te rattraper`, 1.6); this.loseFlow(); this.stretch.fell = true; this.lose('fell'); }
      else this.hud.toast(`Choc ! ${END_NAMES[k]} y laisse ${Math.round(ev.cost * 100)} % de ses forces`, 1.4);
    }
  }

  private happened(ev: RuleEvent): void {
    switch (ev.what) {
      case 'button': {
        const n = this.stretch.twisted ? 2 : 1, [x, y] = this.lace.centre();
        earn(n);
        this.stretch.taken++;
        this.overlay.pop(`+${n}`, x, y + 0.04, '#ffd36a');
        sfx.button(this.flow);
        break;
      }
      case 'threaded': sfx.button(); break;
      case 'opened': if (!this.world.level.gates[ev.gate].period) { sfx.save(); this.hud.toast('La trappe s\'ouvre !', 1.8); } break;
      case 'shut': break;
      case 'holding': if (!knows('save', 2)) this.hud.toast('Ça tient ?', 1.2); break;
      case 'saved': this.saved(); break;
      case 'cut': sfx.slip(); this.hud.toast('Coupé ! Encore un coup et il casse', 1.8); break;
      case 'burnt': sfx.slip(); this.hud.toast('Ça brûle ! Sors de la flamme', 1.4); break;
      case 'soaked': this.world.soak(); this.hud.toast('Trempé ! Plus lourd, le temps de sécher', 2); break;
      case 'snapped': sfx.snap(); this.hud.toast('Le fil a cédé !', 1.6); break;
      case 'stuck': sfx.stick(); this.hud.toast('Collé à la toile : tire d\'un coup sec pour t\'en arracher', 1.8); break;
      case 'torn free': break;
      case 'bitten': sfx.slip(); this.hud.toast('L\'araignée a mordu le lacet !', 1.6); break;
      case 'seen': sfx.seen(); this.hud.toast('Dans la lumière ! Cache-toi derrière une barre', 1.4); break;
      case 'lift': sfx.lift(); break;
    }
  }

  /**
   * The lace saved on a post: the time of the run (and its ghost, if the
   * best), the challenge paid, the window moved up and the world built again,
   * a new stretch, and the panel of the post: the stretch above to choose,
   * the shop. At dawn, the other lace was waiting there.
   */
  private saved(): void {
    sfx.save();
    learn('save');
    const save = this.rules.save!, whole = save.pos.length === 3 * laceNodes(), st = this.stretch, c = this.challenge;
    // a post makes the lace whole and new again
    if (!whole) save.pos = Float64Array.from(regrown(save.pos));
    const time = this.clock - st.at, seed = this.climb.course.seed, from = st.from;
    const moved = this.climb.saved(save);
    if (!moved) {
      // (the post below, saved on again: nothing more to it)
      if (!whole) this.build(this.world.level, save.pos);
      else this.lace.damage.fill(0);
      this.hud.toast('Ça tient ! Retour ici avec R', 1.6);
      return;
    }
    const { best, beaten } = split(seed, from, time);
    if (beaten) keepGhost(seed, from, this.recorder.data());
    const met = !!c && !c.lost && c.met();
    if (met) { earn(c!.reward); sfx.win(); }
    this.build(this.climb.level(), save.pos);
    const post = this.climb.post, floor = this.climb.course.section(post).floor;
    // the other lace, at dawn
    if (floor === DAWN && !progress.reunited) { this.reunite(); return; }
    this.newStretch(this.lace.centre()[1]);
    const alt = this.climb.course.alternative(post);
    this.hud.post({
      time, best, taken: st.taken,
      challenge: c ? { text: c.text, met, reward: c.reward } : null,
      twist: alt ? { name: alt.name, pays: 'boutons ×2, défi ×1,5' } : null,
      twisted: this.climb.course.twisted(post),
      pick: (t) => {
        if (!this.climb.pick(t ? 1 : 0)) return;
        this.build(this.climb.level(), this.lace.save());
        this.newStretch(this.lace.centre()[1]);
      },
      wear: (kind) => { chooseKind(kind); this.reknit(); },
      go: () => {},
    });
  }

  /** the pair, found: the ending, then the climb goes on with both, knotted */
  private reunite(): void {
    progress.reunited = true;
    if (!progress.kinds.includes('paire')) progress.kinds.push('paire');
    keep();
    sfx.reunion();
    const minutes = Math.round(this.climb.minutes);
    // (after the card of the dawn, which the floor shows as the lace comes into it)
    this.later(0.5, () => this.hud.card('L\'aube', 'Le voilà.', 6));
    this.later(3, () => this.hud.ending(`${minutes} minutes de montée, ${this.climb.best.toFixed(0)} mètres.`, () => {
      chooseKind('paire');
      this.reknit();
      this.newStretch(this.lace.centre()[1]);
    }));
  }

  /** f, in t seconds */
  private later(t: number, f: () => void): void {
    this.soon.push({ t, f });
  }

  // ------------------------------------------------------------ drawing

  /** the frame drawn, dt seconds after the last */
  draw(dt: number): void {
    const playing = this.state === 'play', [cx, cy] = this.lace.centre(), p = this.controls.pointer, L = this.world.level;
    const leader = this.lace.leader();
    for (const q of [...this.soon]) if ((q.t -= dt) <= 0) { this.soon.splice(this.soon.indexOf(q), 1); q.f(); }
    if (playing) {
      const at = leader ? this.lace.at(leader.node) : [cx, cy];
      this.controls.poll({ x: at[0], y: at[1] });
    }
    this.cords.update();
    this.overlay.draw(this.world, this.cords, playing, p, this.showHints, dt);
    this.scenery.update(this.rules, this.world, this.time, dt);
    this.scenery.decor.update(performance.now() / 1000, dt, this.stage.y);
    // the lights go out now and then (a blackout): the lace's glow alone
    this.dark += (this.world.darkness(cy, this.time) - this.dark) * Math.min(1, dt * 4);
    this.stage.dark = this.dark;
    this.stage.mood(this.scenery.decor.lightAt(this.stage.y));
    this.stage.lights(this.scenery.decor.fixtures, performance.now() / 1000, this.subject.set(cx, cy, 0));
    // the searching lamp nearest the lace lights the room for real (its shadows are where the lace hides)
    let near = -1;
    L.searches.forEach((q, k) => { if (Math.abs(q.y - cy) < 1.6 && (near < 0 || Math.abs(q.y - cy) < Math.abs(L.searches[near].y - cy))) near = k; });
    this.stage.search(near < 0 ? null : { x: L.searches[near].x, y: L.searches[near].y, angle: this.rules.beams[near] ?? 0, half: BEAM.half });
    this.cords.strain(this.world, this.rules);
    if (playing) this.storey(cy);
    // the camera follows the lace, a little ahead towards the pointer; it draws back while the lace rests, and looks up the climb when asked
    const resting = this.lace.ends.some((e) => e.grip && e.load < PLAY.restLoad) && this.lace.speedOf() < 0.2;
    const want = this.looking ? 1.45 : resting ? 1.18 : 1;
    this.zoom += (want - this.zoom) * Math.min(1, dt * (this.looking ? 3 : 0.8));
    const lookUp = (this.zoom - 1) * (this.looking ? 2.2 : 0.6);
    this.stage.follow(playing ? cx * 0.8 + p.x * 0.2 : cx, (playing ? cy * 0.8 + p.y * 0.2 : cy) + 0.1 + lookUp, Math.max(0.75, L.bottom + 0.75), L.top - 0.7 + lookUp, dt, this.zoom);
    if (playing) this.ghost.show(this.clock - this.stretch.at); else this.ghost.hide();
    const shown = this.climb.shown(cy, this.clock);
    this.hud.stats(shown.time, progress.wallet, shown.height, shown.best);
    this.hud.flow(this.flow, PLAY.flowMost);
    this.hud.cards(this.lace, this.controls.oneButton);
    this.hud.hint(playing && this.showHints ? advice({ lace: this.lace, level: L, tangled: this.tangled, isOpen: (k) => this.rules.isOpen(k) }) : '');
    this.hud.update(dt);
    this.cursor(playing ? leader : null);
    hear({
      slide: this.lace.sliding, strain: Math.max(...this.lace.ends.map((e) => (e.grip ? e.load : 0)), this.lace.reach * 0.6), speed: this.lace.speedOf(),
      floor: this.scenery.decor.floorAt(cy), up: this.upInFloor(cy), playing,
    }, dt);
    // sharp round the lace, the rest of the room softening away from it
    this.stage.render(this.subject.set(cx, cy, 0));
  }

  /** how far up its floor the height y is (0 to 1): the music plays more as the lace climbs it */
  private upInFloor(y: number): number {
    const b = this.scenery.decor.band(y), lo = Math.max(b.y0, this.world.level.bottom), hi = Math.min(b.y1, this.world.level.top);
    return Math.max(0, Math.min(1, (y - lo) / Math.max(0.5, hi - lo)));
  }

  /** the pointer as a ring of the colour of the end it leads (none: the plain arrow) */
  private cursor(leader: Lace['ends'][number] | null): void {
    const k = leader ? this.lace.ends.indexOf(leader) : -1;
    if (k === this.cursorFor) return;
    this.cursorFor = k;
    const canvas = this.stage.renderer.domElement;
    if (k < 0) { canvas.style.cursor = ''; return; }
    const c = `#${END_COLORS[k].getHexString()}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="8" fill="none" stroke="${c}" stroke-width="3.5"/><circle cx="14" cy="14" r="8" fill="none" stroke="white" stroke-width="1" opacity="0.7"/><circle cx="14" cy="14" r="2" fill="${c}"/></svg>`;
    canvas.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 14 14, crosshair`;
  }
}
