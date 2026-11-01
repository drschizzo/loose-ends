// A climb: the course of a seed, played from post to post for as long as the
// lace holds, and kept between visits (where the lace was last saved, the
// best height, the time played, when each floor was reached: what the pace
// of the floors is tuned by, see STORY in tuning.ts).

import CATALOG from '../gen/catalog.json';
import { Course, type Forced, type Storey } from '../gen/course';
import type { Catalog } from '../gen/layout';
import { placeKey, type Level } from '../level/level';
import { regrown } from '../sim/cords';
import { PLAY, STORY } from '../tuning';
import { keep as keepProgress, progress } from './progress';
import type { Save } from './rules';

/** what is kept of a climb between two visits */
interface Kept { seed: number; section: number; pos: number[]; best: number; time: number; floors?: number[]; choices?: Record<number, number> }

// a floor a stretch since v3, with a choice at each post: a climb kept before would not find its post again
const KEY = 'loose-ends:climb:3';

/** today, as the daily climb is named (the same for everyone, all day) */
export const today = (): string => new Date().toISOString().slice(0, 10);
/** the seed of the daily climb of day d */
export const dailySeed = (d: string): number => { let h = 7; for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) % 999983; return 1 + h; };

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

  /** the climb left last time, if any (the daily climb of day `daily`'s, if asked) */
  static kept(daily?: string): Kept | null {
    try { return JSON.parse(localStorage.getItem(daily ? `loose-ends:daily:${daily}` : KEY) ?? 'null'); } catch { return null; }
  }

  /** the day of the daily climb this is (none: a climb of its own) */
  readonly daily: string | null;
  private choices: Record<number, number>;

  /**
   * A climb of course `seed`, from the start or (`kept`) from where it was
   * left. A trial (opened from the level editor: `force` chooses the parts of
   * some sections) is never kept: the climb left last time stays as it was.
   */
  constructor(seed: number, kept: Kept | null = null, private trial?: { force: Record<number, Forced> }, daily?: string) {
    this.daily = daily ?? null;
    this.choices = { ...(kept?.choices ?? {}) };
    this.course = new Course(seed, CATALOG as unknown as Catalog, { force: trial?.force, choices: this.choices });
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

  /** where the lace is in it (null: lying at the start), as long as the lace worn now */
  lace(): Float64Array | null { return this.pos && Float64Array.from(regrown(this.pos)); }

  /** the section of the post the lace last saved on */
  get post(): number { return this.section; }

  /** the stretch above the last post chosen twisted (1) or plain (0): the level to build again if it changed */
  pick(c: number): boolean {
    if ((this.choices[this.section] ?? 0) === c) return false;
    this.course.pick(this.section, c);
    this.keep(this.keptAt);
    return true;
  }

  /** the save it goes on from (left on a post, last time), if any */
  resumed(): Save | null {
    const pos = this.lace();
    if (!pos) return null;
    const post = this.course.section(this.section).level.bars.find((b) => b.mat === 'gold');
    return post ? { post: placeKey(post.x, post.y), pos } : null;
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
  shown(y: number, time: number): { time: string; height: string; best: string } {
    return { time: clock(this.before + time), height: `${Math.max(0, y).toFixed(1)} m`, best: `max ${this.highest.toFixed(0)}` };
  }

  /** how long this climb has been played (min) */
  get minutes(): number { return (this.before + this.keptAt) / 60; }

  /** what is kept for next time, `time` seconds into this visit */
  private keep(time: number): void {
    this.keptAt = time;
    if (this.trial) return;
    const kept: Kept = { seed: this.course.seed, section: this.section, pos: this.pos ? Array.from(this.pos) : [], best: this.highest, time: this.before + time, floors: this.floors, choices: this.choices };
    try { localStorage.setItem(this.daily ? `loose-ends:daily:${this.daily}` : KEY, JSON.stringify(kept)); } catch { /* private window */ }
    if (this.daily) {
      const d = (progress.daily[this.daily] ??= { best: 0, time: 0 });
      if (this.highest > d.best) { d.best = this.highest; d.time = this.before + time; keepProgress(); }
    }
  }
}

const clock = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
