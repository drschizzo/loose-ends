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
  /** stiffness of a grip (× M/h² of the solver's reference substep) */
  gripK: 4,
  /** how close to a surface an end grabs it (m, from its surface to the lace's): it snaps onto it */
  gripReach: 0.035,
  /** stamina lost per second by a grip working as hard as the lace weighs (× effort^drainPow): the other end reaching, a pull beyond the lace's weight */
  drain: 0.4,
  drainPow: 1.2,
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
};

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
