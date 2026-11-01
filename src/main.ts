// Loose Ends, a prototype: a shoelace climbs. Its two ends are two hands:
// hold the left button and the head grips what it touches, the right one and
// the tail does; the end that grips nothing follows the pointer. A grip wears
// out with what it really holds up (the solver's `targetPull`): draped over a
// bar, the lace hangs on by friction and the grip rests. The climb never ends:
// a course assembled from parts, from post to post.
//
//   level/  what a level is made of, and its static shapes
//   gen/    the course: its parts, and how they are assembled
//   sim/    the physical world built from a level: the solver, its cords
//   play/   the lace, the rules, the controls, the climb, the help
//   view/   the stage, the scenery, the cords as tubes, the overlay, the page

import { Game } from './game';
import { Climb } from './play/climb';
import { choose } from './play/laces';

// the climb left last time goes on, unless a new one is asked for (?new),
// or the level editor opens the game on a climb to try (?seed=…&at=…, and
// the parts chosen there: &ascent=…&obstacle=…&key=…)
const query = new URLSearchParams(location.search), asked = query.has('new');
const trial = query.has('seed') && query.has('at') ? { seed: Number(query.get('seed')), at: Number(query.get('at')) } : null;
const kept = Climb.kept();
const fresh = !kept || asked;
const forced = { ascent: query.get('ascent') ?? undefined, obstacle: query.get('obstacle') ?? undefined, key: query.get('key') ?? undefined };
const climb = trial ? new Climb(trial.seed, null, { force: forced.ascent || forced.obstacle || forced.key ? { [trial.at]: forced } : {} })
  : fresh ? new Climb(1 + Math.floor(Math.random() * 1e6)) : new Climb(kept.seed, kept);
const game = new Game(climb);

game.hud.title(
  () => { if (fresh) game.begin(); else location.search = '?new'; },
  fresh ? null : { label: `Continuer (${kept.best.toFixed(0)} m)`, pick: () => game.begin() },
);
game.hud.laces((k) => { choose(k); game.relace(); });
if (trial) {
  // straight into play, the lace hanging from the hold section `at` starts from
  game.warp(trial.at);
  game.begin();
} else if (asked) {
  // asked for a new climb: it starts at once, and a reload goes on with it
  query.delete('new');
  history.replaceState(null, '', location.pathname + (query.size ? `?${query}` : ''));
  game.begin();
}

// for the console (and for testing with the page hidden: `game.run(60)` plays a second)
Object.assign(window, {
  game: {
    get world() { return game.world; }, get sim() { return game.world.sim; }, get lace() { return game.world.lace; }, get L() { return game.world.level; },
    get state() { return game.state; }, get save() { return game.rules.save; },
    pointer: game.controls.pointer, rules: game.rules, course: climb.course, stage: game.stage,
    get pace() { return climb.pace; }, get decor() { return game.decor; },
    begin: () => game.begin(), respawn: () => game.respawn(), warp: (k: number) => game.warp(k),
    hold: (k: number, on: boolean) => game.hold(k, on),
    run: (frames: number) => { for (let f = 0; f < frames; f++) game.tick(); game.draw(0); },
  },
});
