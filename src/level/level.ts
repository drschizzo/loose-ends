// What a level is made of. A level is a wall some metres high, seen from the
// side. Everything that stands still is a bar (a capsule from the wall to the
// glass), a shelf or a gate (boxes) or an eyelet (a ring of short capsules):
// exactly the static shapes the solver knows. Everything that moves is a
// cord: the lace, and the cords of the level (hanging, draped over a bar, a
// skein of yarn, a pull, a line strung between two hooks, a net or a rope
// ladder knotted together).
//
// The room is 20 cm deep, between the wall and an invisible pane of glass: the
// lace moves in a plane, but has room to cross over itself, and over and
// under the other cords.
//
// A level is plain data: the course is made of sections, each a level of
// its own, merged into the one that is built.

export type Mat = 'wood' | 'chrome' | 'rubber' | 'gold' | 'wall' | 'floor' | 'eyelet' | 'gate' | 'hook' | 'wire' | 'brass';

/**
 * What a surface is made of: its friction, how an end grips it (× the stamina
 * it costs; 0: it cannot), how it wears the lace sliding over it (×), how it looks
 */
export const MATS: Record<Mat, { mu: number; grip: number; wear: number; color: string; metalness: number; roughness: number }> = {
  wood: { mu: 0.45, grip: 1, wear: 1, color: '#b07a45', metalness: 0, roughness: 0.7 },
  chrome: { mu: 0.1, grip: 0, wear: 0.2, color: '#d8dde2', metalness: 1, roughness: 0.15 },
  rubber: { mu: 1.0, grip: 0.5, wear: 0.4, color: '#b8322a', metalness: 0, roughness: 0.9 },
  gold: { mu: 0.5, grip: 1, wear: 0.6, color: '#e2b13c', metalness: 0.8, roughness: 0.35 },
  wall: { mu: 0.05, grip: 0, wear: 0, color: '#000000', metalness: 0, roughness: 1 },
  floor: { mu: 0.5, grip: 0, wear: 0.5, color: '#8a5a33', metalness: 0, roughness: 0.8 },
  eyelet: { mu: 0.15, grip: 0, wear: 0.8, color: '#c7ccd2', metalness: 1, roughness: 0.25 },
  gate: { mu: 0.3, grip: 0, wear: 0.6, color: '#5a6b7c', metalness: 0.3, roughness: 0.5 },
  // a coat hook: black iron, rough enough that the lace hangs over it, nothing an end can grip
  hook: { mu: 0.7, grip: 0, wear: 0.5, color: '#8a7a68', metalness: 0.8, roughness: 0.4 },
  // the taut wire of a zip line: thin, slippery
  wire: { mu: 0.12, grip: 0, wear: 0.3, color: '#9aa0a6', metalness: 1, roughness: 0.3 },
  // the hand of a clock: it can be gripped, and carries what grips it round
  brass: { mu: 0.4, grip: 1, wear: 0.6, color: '#b8913a', metalness: 0.9, roughness: 0.35 },
};

/** half the width of the room, half its depth */
export const ROOM = { x: 0.85, z: 0.1 };

export type Vec2 = [number, number];
/** a bar across the room; a gold one is a post, where the lace saves its progress */
export interface Bar { x: number; y: number; r: number; mat: Mat }
export interface Shelf { x0: number; x1: number; y: number; mat?: Mat }
/** a cord hanging from a hook; `fragile`: a thread that snaps once it has borne the lace this long (s); `partner`: the other lace of the pair, waiting */
export interface Hang { x: number; top: number; length: number; fragile?: number; partner?: boolean }
/**
 * An eyelet the lace can be threaded through, a ring of radius r whose axis
 * turns `turn` (rad) from x towards z: 0, a hole facing sideways (seen edge on),
 * π/2 a hole facing us. Up, the axis is vertical (the hole faces up).
 */
export interface Ring { x: number; y: number; r: number; turn?: number; up?: boolean }
/**
 * A gate (a box), a trapdoor in a floor. It opens when all its rings hold the
 * lace at once, or all its pulls are pulled at once, or its post (a bar) has
 * saved the lace. `held`: it shuts again as soon as its pulls are let go.
 * `period`: it opens and shuts by itself, open half the time (s).
 */
export interface Gate { x0: number; x1: number; y0: number; y1: number; rings?: number[]; pulls?: number[]; post?: number; held?: boolean; period?: number }
/** a bar that moves back and forth: by (dx, dy) either way from where it is, over `period` seconds; `orbit`: round an ellipse of radii (dx, dy) instead (a wheel) */
export interface Mover { bar: number; dx: number; dy: number; period: number; phase: number; orbit?: boolean }
/**
 * Something that harms the lace where it touches it, a box from (x0, y0) to
 * (x1, y1): a blade cuts it at once, a flame burns it if it stays, water
 * soaks it (shorter and heavier until it dries).
 */
export interface Hazard { kind: 'blade' | 'flame' | 'water'; x0: number; y0: number; x1: number; y1: number; move?: { dx: number; dy: number; period: number; phase: number } }
/** a pull: a cord hanging from a switch, which clicks when something hangs on it */
export interface Pull { x: number; top: number; length: number }
/** a skein of yarn: `count` strands hanging from one hook, crossing over one another */
export interface Skein { x: number; top: number; length: number; count: number; color: string }
/** loose cords draped over a bar, `left` of them on its left (the rest on the right) */
export interface Drape { bar: number; length: number; left: number; color: string }
/** a line strung between two hooks, `slack` (m) longer than the gap between them: it sags, more under a load */
export interface Line { x0: number; y0: number; x1: number; y1: number; slack: number; color?: string }
/**
 * A net hanging from its top edge: `cols` cords down, `rows` across, knotted
 * where they cross (a strap round the two nodes there), `tied` at the bottom
 * too or hanging free. With two cols and `ladder`, a rope ladder: the rungs
 * span the rails, and are stiff.
 */
export interface Net { x0: number; x1: number; top: number; bottom: number; cols: number; rows: number; tied?: boolean; color?: string; ladder?: boolean; sticky?: boolean }
/**
 * Air on the move in a box from (x0, y0) to (x1, y1), at (vx, vy) m/s: the
 * warm air over a radiator rises, a vent blows across. `period`: it comes
 * in gusts, blowing half the time (always, if not said).
 */
export interface Wind { x0: number; y0: number; x1: number; y1: number; vx: number; vy: number; period?: number; phase?: number }
/**
 * A lamp at (x, y) that sweeps the room: its beam turns `arc` (rad) either
 * way of straight down, there and back in `period` s. The lace in its light
 * (not in the shadow of a bar or a shelf) heats: its grips tire fast.
 */
export interface Search { x: number; y: number; arc: number; period: number; phase: number }
/** a zip line: a taut wire from (x0, y0) down to (x1, y1), a spool on it that runs down with what hangs from it */
export interface Zip { x0: number; y0: number; x1: number; y1: number }
/** a clock: its hand, `length` long, turns round (x, y) once in |period| s (negative: backwards), from `phase` (rad); `arms`: hands evenly round (a fan's blades) */
export interface Clock { x: number; y: number; length: number; period: number; phase: number; arms?: number }
/** a coat hook sticking out of the wall at (x, y), its tip turned up: nothing grips it, the lace hangs over it */
export interface Hook { x: number; y: number }
/**
 * A lift: a cord over a pulley (bar `bar`, chrome), a lead weight at one
 * end, `weight` × the lace's weight, held up by a catch; a wooden handle at
 * the other end, hanging `drop` below the pulley on side `side` (1 right, −1
 * left). Gripping the handle lets the catch go: the weight falls and hoists
 * the lace, faster and faster, until the handle knocks against the pulley.
 */
export interface Lift { bar: number; drop: number; weight: number; side: number }
/** a stretch of height where the lights go out now and then (`period` s, dark a third of it): only the lace's own glow is left */
export interface Blackout { y0: number; y1: number; period: number; phase: number }
/** words of help, shown while the lace is within r of (x, y) (and its gate, if any, is shut) */
export interface Tip { x: number; y: number; r: number; text: string; gate?: number }

export interface Level {
  /** the height it spans (m): the room's walls go from bottom to top */
  bottom: number;
  top: number;
  bars: Bar[];
  shelves: Shelf[];
  hangs: Hang[];
  rings: Ring[];
  gates: Gate[];
  pulls: Pull[];
  skeins: Skein[];
  drapes: Drape[];
  lines: Line[];
  nets: Net[];
  movers: Mover[];
  hazards: Hazard[];
  winds: Wind[];
  searches: Search[];
  zips: Zip[];
  clocks: Clock[];
  hooks: Hook[];
  lifts: Lift[];
  blackouts: Blackout[];
  buttons: Vec2[];
  tips: Tip[];
  /** where the lace starts: lying on the floor */
  start: { x0: number; x1: number; y: number };
}

export const bar = (x: number, y: number, mat: Mat = 'wood', r = 0.016): Bar => ({ x, y, r, mat });

/** a level with nothing in it yet */
export function emptyLevel(bottom = 0, top = 0): Level {
  return {
    bottom, top,
    bars: [], shelves: [], hangs: [], rings: [], gates: [], pulls: [], skeins: [], drapes: [], lines: [], nets: [], movers: [], hazards: [],
    winds: [], searches: [], zips: [], clocks: [], hooks: [], lifts: [], blackouts: [],
    buttons: [], tips: [],
    start: { x0: -0.55, x1: 0.55, y: 0.01 },
  };
}

/**
 * Levels one above the other made one: their elements together, what refers
 * to an element by its index (a drape to its bar, a gate to its rings, pulls
 * and post, a tip to its gate) shifted to where it lands.
 */
export function merge(parts: Level[]): Level {
  const L = emptyLevel(Math.min(...parts.map((p) => p.bottom)), Math.max(...parts.map((p) => p.top)));
  for (const p of parts) {
    const bars = L.bars.length, rings = L.rings.length, pulls = L.pulls.length, gates = L.gates.length;
    L.bars.push(...p.bars);
    L.shelves.push(...p.shelves);
    L.hangs.push(...p.hangs);
    L.rings.push(...p.rings);
    L.pulls.push(...p.pulls);
    L.skeins.push(...p.skeins);
    L.lines.push(...p.lines);
    L.nets.push(...p.nets);
    L.buttons.push(...p.buttons);
    L.hazards.push(...p.hazards);
    L.winds.push(...p.winds);
    L.searches.push(...p.searches);
    L.zips.push(...p.zips);
    L.clocks.push(...p.clocks);
    L.hooks.push(...p.hooks);
    L.blackouts.push(...p.blackouts);
    L.lifts.push(...p.lifts.map((l) => ({ ...l, bar: l.bar + bars })));
    L.drapes.push(...p.drapes.map((d) => ({ ...d, bar: d.bar + bars })));
    L.movers.push(...p.movers.map((m) => ({ ...m, bar: m.bar + bars })));
    L.gates.push(...p.gates.map((g) => ({
      ...g,
      rings: g.rings?.map((r) => r + rings),
      pulls: g.pulls?.map((q) => q + pulls),
      post: g.post === undefined ? undefined : g.post + bars,
    })));
    L.tips.push(...p.tips.map((t) => ({ ...t, gate: t.gate === undefined ? undefined : t.gate + gates })));
  }
  const first = parts.find((p) => p.bottom === L.bottom);
  if (first) L.start = first.start;
  return L;
}

/**
 * What tells an element from the others, from one build of the level to the
 * next: where it is. The endless course builds the same element again at the
 * same place, so what happened to it (a gate opened, a button taken) holds.
 */
export const placeKey = (x: number, y: number): string => `${x.toFixed(3)},${y.toFixed(3)}`;
