// Everything a prototype gets tuned by, in one place. Any number of PLAY can
// be overridden from the address: ?muscle=2&drain=0.3

import type { SimParams } from '@drschizzo/avbd-cables';

/** the shoelace: 1.1 m, 16 mm thick (thicker than a real one, to be seen), aglets at both ends */
export const LACE = { length: 1.1, segment: 0.02, radius: 0.008, mass: 0.0025, endMass: 0.008, bend: 0.6 };

/** the cords that hang in the level (vines, a curtain): grabbed, pushed through */
export const VINE = { radius: 0.006, mass: 0.002, bend: 0.4, segment: 0.02 };

/**
 * The solver: 12 substeps, so that a hand weighs what it holds (`targetPull`
 * converges: see the README of avbd-cables); a node every 2 cm, so that the
 * lace wraps round a bar of 3 cm without corners.
 */
export const PARAMS: Partial<SimParams> = {
  substeps: 12, iterations: 6, margin: 0.003, marginCap: 0.03, strapK: 3, muCable: 0.35,
  // the room's walls are metres high: filed in 25 cm cells rather than 5, a world is built (or a gate opens) at once
  staticCell: 0.25,
};

export const PLAY = {
  /** how hard the free end pulls towards the pointer while the other end grips, × the weight of the lace */
  muscle: 0.85,
  /** the same while the other end grips nothing: enough to raise the end to a low bar, never the whole lace */
  muscleLoose: 0.45,
  /** how long the free end takes to catch up with the pointer (s): the lace is not weightless */
  inertia: 0.12,
  /** the leash of that pull (m): beyond, it pulls no harder */
  lead: 0.03,
  /**
   * catching the lace as it moves jolts the hand: above catchSpeed (m/s, of
   * the lace as a whole), each m/s more costs catchCost of stamina; more than
   * the hand has left, and it is torn off (a fall of 0.8 m does it, fresh)
   */
  catchSpeed: 1.2,
  catchCost: 0.45,
  /**
   * A clean catch, at the top of a swing: the lace moved faster than
   * perfectAfter (m/s) within the last half second, and slower than
   * perfectAt as the end takes hold. The hand wins perfectGain of stamina.
   */
  perfectAfter: 0.85,
  perfectAt: 0.5,
  perfectGain: 0.15,
  /**
   * Élan: grips one after the other, each within `flowGap` s of the last,
   * build it up (a clean catch twice), up to `flowMost`; each level makes
   * the grips tire `flowEase` less. A fall, a grip torn off or worn out, or
   * `flowGap` s × 1.5 without a grip, and it is lost.
   */
  flowGap: 2.6,
  flowMost: 5,
  flowEase: 0.06,
  /** stiffness of a grip (× M/h² of the solver's reference substep) */
  gripK: 4,
  /** how close to a surface an end grabs it (m, from its surface to the lace's): it snaps onto it */
  gripReach: 0.035,
  /** stamina lost per second by a grip working as hard as the lace weighs (× effort^drainPow): the other end reaching, a pull beyond the lace's weight */
  drain: 0.4,
  drainPow: 1.2,
  /**
   * How fast grips tire goes with the climb (× drain, and hanging from a
   * cord): `easy` at the start, rising with the time a good player would
   * have taken (see STORY) to 1 at the sky; above, `harder` more for each
   * as long again, up to `hardest`
   */
  easy: 0.45,
  harder: 0.3,
  hardest: 1.4,
  /** a grip working less than this (× the weight) rests: hanging still, the lace draped by it */
  restLoad: 0.35,
  /** stamina won back per second, gripping at rest / not gripping */
  recover: 0.3,
  recoverFree: 0.45,
  /** an end that let go, worn out, cannot grip again for this long (s) */
  cooldown: 0.8,
  /** stamina lost per second hanging from a cord */
  vineDrain: 0.12,
  /**
   * a post saves the lace hanging on it by itself: no grip, at least this many
   * turns touching it (draped over it: half a turn), what touches it still for
   * saveTime (s), slower than saveSpeed (m/s)
   */
  saveTurns: 0.4,
  saveTime: 1.0,
  saveSpeed: 0.06,
  /** a pull clicks when it holds this much more than itself (× the weight of the lace), for pullTime (s) */
  pullLoad: 0.35,
  pullTime: 0.3,
  /** the aglet: the nodes at the tip of the end the pointer leads that slip through the cords while Space is held */
  aglet: 4,
  /**
   * Caught in a knot, the aglet can be forced: with Space held and the end
   * pulling harder than `forceLoad` × the lace's weight while it hardly
   * moves (slower than `forceStuck` m/s: it is caught), the stretch that
   * slips through grows by `forceRate` nodes a second, up to `forceMost`;
   * what slips beyond the aglet is squeezed through and frays (`forceWear`
   * a second). Let go of Space, it is the aglet again.
   */
  /**
   * Lying on something with nothing holding it, the lace can throw its free
   * end, as a rope is whipped up: a flick of the pointer faster than
   * `throwFlick` (m/s), towards where it goes, sends the last `throwNodes`
   * of the end off at up to `throwSpeed` (m/s), less inward, and for
   * `throwTime` s the end pulls `throwMuscle` × the lace's weight. Once every
   * `throwRest` s. The button held as it flies, the end grips what it
   * touches at the top of its flight.
   */
  throwFlick: 1.6,
  throwSpeed: 5.5,
  throwNodes: 26,
  throwRest: 0.9,
  throwTime: 0.2,
  throwMuscle: 2,
  forceLoad: 0.55,
  forceStuck: 0.15,
  forceRate: 6,
  forceMost: 16,
  forceWear: 0.12,
  /**
   * Wear of the lace, node by node, 0 new to 1 torn through (it breaks
   * there): a blade's touch, a flame each second it stays, each metre the
   * lace slides over a surface (× the surface's `wear`), each m/s of a
   * jolt at the end that catches. A post makes it new.
   */
  bladeWear: 0.55,
  flameWear: 1.1,
  rubWear: 1.5,
  joltWear: 0.5,
  /** the lace cannot get shorter than this (m): broken shorter, it goes back to its post */
  shortest: 0.55,
  /** soaked, the lace shrinks by this much and weighs this much more; it dries in dryTime (s) */
  shrink: 0.08,
  soak: 0.6,
  dryTime: 8,
  /** how fast a wind drags the lace's nodes to its speed (/s), blowing full */
  windDrag: 9,
  /** a thread gives way once it has borne the lace this long (s), if its part does not say */
  thread: 2.5,
  /** the lace stuck to a cobweb tears free when the end the pointer leads pulls this hard (× its weight), or a stuck node is pulled this far from the web (m) */
  webPull: 0.6,
  webStretch: 0.02,
  /** how long the lace may stay stuck to a web before its spider comes down to it (s), and how much a bite wears the lace */
  spiderAfter: 4,
  spiderBite: 0.35,
  /** in the beam of a searching lamp: the grips tire this much faster, the lace burns this much a second */
  dazzle: 2.5,
  beamWear: 0.08,
};

/**
 * A lift: how much of its weight the friction of the pulley takes (× the
 * lace's weight), the top speed of the handle going up (m/s); let go of
 * this long (s), it goes back down at `back` m/s
 */
export const LIFT = { friction: 1.35, top: 1.1, wait: 2.5, back: 0.5 };

/** the spool of a zip line: its top speed and drag (m/s, /s) on the way down; let go of this long (s), it is pulled back up at `back` m/s */
export const ZIP = { top: 1.4, drag: 1.6, wait: 1.5, back: 0.25 };

/**
 * How long the house lasts. The course reckons the time a good player takes
 * (no fall) for each section, `base` + `effort` × its effort (0 to 6) +
 * `metre` × how high it climbs (s); the floors of the house share
 * `skyAfter` seconds of it, and the sky comes at the first post after.
 */
export const STORY = { skyAfter: 50 * 60, pace: { base: 22, effort: 14, metre: 9 } };

const query = new URLSearchParams(location.search);
for (const key of Object.keys(PLAY) as (keyof typeof PLAY)[]) {
  const v = Number(query.get(key));
  if (query.has(key) && Number.isFinite(v)) PLAY[key] = v;
}
