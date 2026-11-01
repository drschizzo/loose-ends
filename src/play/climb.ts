// A climb: the course of a seed, played from post to post for as long as the
// lace holds, and kept between visits (where the lace was last saved, the
// best height, the time played, when each floor was reached: what the pace
// of the floors is tuned by, see STORY in tuning.ts).

import CATALOG from '../gen/catalog.json';
import { Course, type Forced, type Storey } from '../gen/course';
import type { Catalog } from '../gen/layout';
import { placeKey, type Level } from '../level/level';
import { PLAY, STORY } from '../tuning';
import type { Save } from './rules';

/** what is kept of a climb between two visits */
interface Kept { seed: number; section: number; pos: number[]; best: number; time: number; floors?: number[] }

// the course is laid out by floors since v2: a climb kept before would not find its post again
const KEY = 'loose-ends:climb:2';

export class Climb {
  readonly course: Course;
  /** the section whose post the lace last saved on (0: the start) */
  private section = 0;
  private pos: Float64Array | null = null;
  private highest = 0;
  /** seconds played before this visit, and when it was last kept */
  private before = 0;
  private keptAt = 0;
  /** the seconds played when each floor was first reached */
  private floors: number[] = [0];

  /** the climb left last time, if any */
  static kept(): Kept | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  }

  /**
   * A climb of course `seed`, from the start or (`kept`) from where it was
   * left. A trial (opened from the level editor: `force` chooses the parts of
   * some sections) is never kept: the climb left last time stays as it was.
   */
  constructor(seed: number, kept: Kept | null = null, private trial?: { force: Record<number, Forced> }) {
    this.course = new Course(seed, CATALOG as unknown as Catalog, { force: trial?.force });
    if (kept) {
      this.section = kept.section;
      this.pos = kept.pos.length ? Float64Array.from(kept.pos) : null;
      this.highest = kept.best;
      this.before = kept.time;
      this.floors = kept.floors ?? [0];
    }
  }

  /** the highest it has been (m) */
  get best(): number { return this.highest; }

  /** what the decor needs of the sections of level L */
  storeys(L: Level): Storey[] { return this.course.storeys(L.bottom, L.top); }

  /**
   * How fast the grips tire at height y (× PLAY.drain): gently at first,
   * then faster as the course goes on, by the time a good player would have
   * taken to get there; the same at the sky as tuned, harder above
   */
  tiring(y: number): number {
    const t = this.course.section(this.course.at(Math.max(0, y))).pace / STORY.skyAfter;
    return t <= 1 ? PLAY.easy + (1 - PLAY.easy) * t : Math.min(PLAY.hardest, 1 + PLAY.harder * (t - 1));
  }

  /** floor f reached after `time` seconds of play this visit: whether it is the first time on this climb */
  reached(f: number, time: number): boolean {
    if (this.floors[f] != null) return false;
    this.floors[f] = Math.round(this.before + time);
    this.keep(time);
    return true;
  }

  /** when each floor was reached (min), for tuning the pace */
  get pace(): string {
    return this.floors.map((t, f) => (t == null ? '' : `${f}: ${(t / 60).toFixed(1)} min`)).filter(Boolean).join(', ');
  }

  /** what tells it from other climbs: the jitter of its skeins */
  get look(): number { return 2 + this.course.seed; }

  /** the level to build now: the window of the course around the last post */
  level(): Level { return this.course.window(this.section); }

  /** where the lace is in it (null: lying at the start) */
  lace(): Float64Array | null { return this.pos; }

  /** the save it goes on from (left on a post, last time), if any */
  resumed(): Save | null {
    if (!this.pos) return null;
    const post = this.course.section(this.section).level.bars.find((b) => b.mat === 'gold');
    return post ? { post: placeKey(post.x, post.y), pos: this.pos } : null;
  }

  /** the lace saved on a post: whether the window moved (up to the next post), and the world must be built again */
  saved(save: Save): boolean {
    let k = this.section;
    for (let i = this.section + 1; i <= this.course.nextPost(this.section + 1); i++) {
      if (this.course.section(i).level.bars.some((b) => b.mat === 'gold' && placeKey(b.x, b.y) === save.post)) k = i;
    }
    if (k === this.section) return false;
    this.section = k;
    this.pos = save.pos;
    this.keep(this.keptAt);
    return true;
  }

  /** the lace at height y after `time` seconds of play this visit: the best height, kept every few seconds of play */
  track(y: number, time: number): void {
    this.highest = Math.max(this.highest, y);
    if (time - this.keptAt >= 3) this.keep(time);
  }

  /** the progress shown at the top */
  shown(y: number, time: number): { time: string; height: string } {
    return { time: clock(this.before + time), height: `${Math.max(0, y).toFixed(1)} m (max ${this.highest.toFixed(0)})` };
  }

  /** what is kept for next time, `time` seconds into this visit */
  private keep(time: number): void {
    this.keptAt = time;
    if (this.trial) return;
    const kept: Kept = { seed: this.course.seed, section: this.section, pos: this.pos ? Array.from(this.pos) : [], best: this.highest, time: this.before + time, floors: this.floors };
    try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch { /* private window */ }
  }
}

const clock = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
