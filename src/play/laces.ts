// The laces the climb can be made with. The first is the one of the shoes
// by the door; the others are found climbing: each floor of the house
// reached for the first time (on any climb) gives one, as a keepsake.

import { FLOORS } from '../gen/floors';

export interface LaceLook { name: string; color: string; stripe: string; floor: number }

export const LACES: LaceLook[] = [
  { name: 'Le lacet de tous les jours', color: '#f6f1e7', stripe: '#2b2f3a', floor: 0 },
  { name: 'Le lacet du dimanche', color: '#2e2c30', stripe: '#a8a4ae', floor: 2 },
  { name: 'Le lacet de randonnée', color: '#3f7d4e', stripe: '#e8d9a8', floor: 4 },
  { name: 'Le fil rouge', color: '#a8323a', stripe: '#f0d8a8', floor: 7 },
  { name: 'Le lacet doré', color: '#e2c066', stripe: '#8a6a20', floor: 9 },
  { name: 'Le ruban bleu', color: '#9fc3e0', stripe: '#ffffff', floor: 10 },
];

/** the other lace of the pair: the one this one climbs to find, red as the thread that leads to it */
export const PARTNER = { color: '#d8574a', stripe: '#f6e0c8' };

const KEY = 'loose-ends:lace', HIGHEST = 'loose-ends:floor';

const read = (key: string) => { try { return Number(localStorage.getItem(key) ?? 0) || 0; } catch { return 0; } };
const write = (key: string, v: number) => { try { localStorage.setItem(key, String(v)); } catch { /* private window */ } };

/** the highest floor ever reached, on any climb */
export const highest = (): number => read(HIGHEST);

/** floor f reached: whether it is the first time ever (and a lace comes with it, if one does) */
export function reach(f: number): LaceLook | null {
  if (f <= highest()) return null;
  write(HIGHEST, f);
  return LACES.find((l) => l.floor === f) ?? null;
}

export const unlocked = (l: LaceLook): boolean => l.floor <= highest();

/** the lace chosen (the first, if the one chosen is not found yet) */
export function chosen(): LaceLook {
  const l = LACES[read(KEY)] ?? LACES[0];
  return unlocked(l) ? l : LACES[0];
}

export const choose = (k: number): void => write(KEY, k);

/** what it takes to find lace l */
export const clue = (l: LaceLook): string => `atteindre ${FLOORS[l.floor].name.toLowerCase()}`;
