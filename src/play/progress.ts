// What lasts from one climb to the next, in the browser: the buttons saved
// up (spent on the posts), what they bought (for good: a longer aglet, a
// firmer grip, the laces of other kinds; or carried: patches, second winds),
// what the player has shown they know (the help says it no more), the best
// time from each post to the next and the ghost of that run, the settings.

import { LACE } from '../tuning';

interface Store {
  wallet: number;
  /** bought for good */
  upgrades: Record<string, boolean>;
  /** carried, used up: patches (a tear about to break is mended), second winds (a grip about to let go gets its strength back) */
  items: { patch: number; breath: number };
  /** the kinds of lace bought (the shoelace always), the one climbed with */
  kinds: string[];
  kind: string;
  /** how many times each gesture was made: the help about it goes once it is known */
  learned: Record<string, number>;
  /** best time (s) from post to post, by seed and section */
  splits: Record<string, number>;
  /** the ghost of each best run, the latest last (only so many kept) */
  ghosts: Record<string, string>;
  ghostOrder: string[];
  /** the daily climbs: their best height and how long they took */
  daily: Record<string, { best: number; time: number }>;
  oneButton: boolean;
  muted: boolean;
  /** the pair found, at dawn, on some climb */
  reunited: boolean;
}

const KEY = 'loose-ends:progress';
const GHOSTS_KEPT = 24;

const fresh = (): Store => ({
  wallet: 0, upgrades: {}, items: { patch: 0, breath: 0 }, kinds: ['lacet'], kind: 'lacet', learned: {}, splits: {}, ghosts: {}, ghostOrder: [], daily: {},
  oneButton: false, muted: false, reunited: false,
});

function load(): Store {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return fresh(); }
}

export const progress: Store = load();

/** what has changed, kept */
export function keep(): void {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* a private window: nothing lasts */ }
}

// ------------------------------------------------------------ the shop

export interface Ware {
  id: string;
  name: string;
  what: string;
  price: number;
  /** carried (bought again and again, up to `most`), or for good */
  kind: 'item' | 'upgrade' | 'lace';
  most?: number;
}

export const WARES: Ware[] = [
  { id: 'patch', name: 'Rustine', what: 'Quand le lacet va casser, elle le répare là, une fois.', price: 3, kind: 'item', most: 3 },
  { id: 'breath', name: 'Second souffle', what: 'Quand une prise va lâcher, elle lui rend la moitié de ses forces, une fois.', price: 4, kind: 'item', most: 2 },
  { id: 'aglet', name: 'Aiguillette longue', what: 'L\'aiguillette se faufile sur 12 cm au lieu de 8.', price: 15, kind: 'upgrade' },
  { id: 'grip', name: 'Prise ferme', what: 'Les prises fatiguent 10 % moins vite, pour toujours.', price: 20, kind: 'upgrade' },
  { id: 'fil', name: 'Le fil', what: 'Fin, long et léger : il va loin, s\'enroule serré, mais s\'use vite.', price: 25, kind: 'lace' },
  { id: 'cordon', name: 'Le cordon', what: 'Épais et court : solide, il fatigue moins les prises, mais passe mal dans les œillets.', price: 25, kind: 'lace' },
  { id: 'tuyau', name: 'Le tuyau', what: 'Raide : il tient à l\'horizontale et fait pont entre deux barres, mais se drape mal.', price: 40, kind: 'lace' },
];

/** how many of ware w the player has (items), or whether they have it (1 or 0) */
export function owned(w: Ware): number {
  if (w.kind === 'item') return progress.items[w.id as 'patch' | 'breath'];
  if (w.kind === 'lace') return progress.kinds.includes(w.id) ? 1 : 0;
  return progress.upgrades[w.id] ? 1 : 0;
}

export function canBuy(w: Ware): boolean {
  return progress.wallet >= w.price && owned(w) < (w.most ?? 1);
}

export function buy(w: Ware): boolean {
  if (!canBuy(w)) return false;
  progress.wallet -= w.price;
  if (w.kind === 'item') progress.items[w.id as 'patch' | 'breath']++;
  else if (w.kind === 'lace') progress.kinds.push(w.id);
  else progress.upgrades[w.id] = true;
  keep();
  return true;
}

export function earn(n: number): void {
  progress.wallet += n;
  keep();
}

/** an item used up, if there is one */
export function use(item: 'patch' | 'breath'): boolean {
  if (progress.items[item] <= 0) return false;
  progress.items[item]--;
  keep();
  return true;
}

// ------------------------------------------------------------ the kinds of lace

/**
 * A kind of lace: how long, thick, heavy and stiff it is (as the solver
 * takes it), how hard its grips tire (×), how fast it wears (×). The same
 * course plays otherwise with each.
 */
export interface LaceKind { id: string; name: string; length: number; radius: number; mass: number; endMass: number; bend: number; drain: number; wear: number }

export const LACE_KINDS: LaceKind[] = [
  { id: 'lacet', name: 'Le lacet', length: 1.1, radius: 0.008, mass: 0.0025, endMass: 0.008, bend: 0.6, drain: 1, wear: 1 },
  { id: 'fil', name: 'Le fil', length: 1.42, radius: 0.0058, mass: 0.0017, endMass: 0.006, bend: 0.3, drain: 1.1, wear: 1.6 },
  { id: 'cordon', name: 'Le cordon', length: 0.92, radius: 0.0105, mass: 0.0032, endMass: 0.009, bend: 1.4, drain: 0.85, wear: 0.5 },
  { id: 'tuyau', name: 'Le tuyau', length: 1.0, radius: 0.0095, mass: 0.003, endMass: 0.008, bend: 26, drain: 1, wear: 0.8 },
  // the two laces of the pair knotted together, once they have found each other
  { id: 'paire', name: 'La paire', length: 2.0, radius: 0.008, mass: 0.0025, endMass: 0.008, bend: 0.6, drain: 1.05, wear: 1 },
];

export const laceKind = (id = progress.kind): LaceKind => LACE_KINDS.find((k) => k.id === id) ?? LACE_KINDS[0];

/** the lace of kind `id` is the one the solver builds now (LACE is read by everything that makes or measures it) */
export function fitKind(id = progress.kind): LaceKind {
  const k = laceKind(id);
  Object.assign(LACE, { length: k.length, radius: k.radius, mass: k.mass, endMass: k.endMass, bend: k.bend });
  return k;
}

export function chooseKind(id: string): void {
  if (!progress.kinds.includes(id)) return;
  progress.kind = id;
  keep();
  fitKind(id);
}

// ------------------------------------------------------------ what the player knows

/** gesture g made once more */
export function learn(g: string): void {
  progress.learned[g] = (progress.learned[g] ?? 0) + 1;
  if (progress.learned[g] <= 40) keep();
}

/** gesture g made at least n times */
export const knows = (g: string, n: number): boolean => (progress.learned[g] ?? 0) >= n;

// ------------------------------------------------------------ splits and ghosts

const splitKey = (seed: number, section: number) => `${seed}:${section}`;

/** the time (s) from the post at `from` to the next, on course `seed`: the best before it, and whether it beats it (kept, then) */
export function split(seed: number, from: number, time: number): { best: number | null; beaten: boolean } {
  const k = splitKey(seed, from), best = progress.splits[k] ?? null, beaten = best === null || time < best;
  if (beaten) { progress.splits[k] = time; keep(); }
  return { best, beaten };
}

export function ghostOf(seed: number, from: number): string | null {
  return progress.ghosts[splitKey(seed, from)] ?? null;
}

export function keepGhost(seed: number, from: number, data: string): void {
  const k = splitKey(seed, from);
  progress.ghosts[k] = data;
  progress.ghostOrder = [...progress.ghostOrder.filter((q) => q !== k), k];
  while (progress.ghostOrder.length > GHOSTS_KEPT) delete progress.ghosts[progress.ghostOrder.shift()!];
  keep();
}
