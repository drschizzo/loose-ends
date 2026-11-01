// The parts the endless course is assembled from. A section of course is
// three of them, chosen apart from one another:
//
//   an ascent    takes the lace from the hold it is on up to a station (a
//                bar): bars, cords to swing across, a rope, lines, a net...
//   an obstacle  stands above the station, from which the lace gets past it
//                to the hold the next section starts from: nothing, a floor
//                with a slot, an overhang, chicanes, a ceiling to traverse
//                under, or a trapdoor;
//   a key        opens the trapdoor: eyelets, pulls, a post.
//
// Each part only knows the holds it starts from and ends on: any ascent
// leads to any obstacle, any key opens any trapdoor, and a new part of any
// kind makes new sections with all the others. The layouts come from the
// hand-made levels, where they were played: between two holds, the lace never
// climbs more than about half a metre, nor crosses more than 60 cm.
//
// The parts are data, in catalog.json (the level editor, editor.html, edits
// it): their steps are laid out by layout.ts. `k` is the side the station is
// on (1 right, −1 left): a part is laid out from it, mirrored. The twist of a
// stretch of course (between two posts) turns the same parts harder or softer.

import type { Gate } from '../level/level';
import { lay, made, pushBar, type AscentData, type Catalog, type Ctx, type Hold, type KeyData, type ObstacleData } from './layout';

export { pushBar, type Ctx, type Hold, type Twist } from './layout';

export interface Ascent extends AscentData { lay(c: Ctx, from: Hold, to: Hold): void }
export interface Obstacle extends ObstacleData {
  /** lays it out above the station (and the key, if locked); returns the hold at its top */
  lay(c: Ctx, k: number, st: Hold, key?: Key): Hold;
}
export interface Key extends KeyData {
  /** lays out what is under the floor at F; returns what opens the trapdoor */
  lay(c: Ctx, k: number, st: Hold, F: number): Pick<Gate, 'rings' | 'pulls' | 'post' | 'held'>;
}

/** the parts of a catalog, ready to be laid out */
export function parts(cat: Catalog): { ascents: Ascent[]; obstacles: Obstacle[]; keys: Key[] } {
  return {
    ascents: cat.ascents.map((a) => ({ ...a, lay: (c, from, to) => { lay(c, a, { from, to }); } })),
    keys: cat.keys.map((q) => ({ ...q, lay: (c, k, st, F) => lay(c, q, { st, k, F }).opens ?? {} })),
    obstacles: cat.obstacles.map((o) => ({
      ...o,
      lay: (c, k, st, key) => lay(c, o, {
        st, k, key,
        layKey: key && ((F) => made(c, { part: key.name, path: '' }, () => key.lay(c, k, st, F))),
      }).exit ?? st,
    })),
  };
}

/** the floor the course starts from, and two low bars */
export function start(c: Ctx): Hold {
  const s = c.rnd() < 0.5 ? 1 : -1;
  pushBar(c, -0.35 * s, 0.33);
  pushBar(c, 0.38 * s, 0.58);
  return { x: 0.38 * s, y: 0.58 };
}
