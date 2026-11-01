// How each floor looks (the floors are in gen/floors.ts, in the same order):
// its cloth (or, with ?papier, its wallpaper), its wood, its light, what is
// seen through its windows, what drifts in its air.
//
// What can be gripped keeps its look from floor to floor, so that the climb
// stays readable: wood is always warm and matte (darker, paler, a crayon in
// the children's room), chrome always cold and shining, rubber always red,
// posts always gold. Only the rest changes: the decor is on the wall behind,
// duller than what is played with.
//
// The lace climbs alone, through the house and on into the sky, to find its
// pair: the red thread up the walls (the thread said to tie two who belong
// together) leads it. Nothing hangs on the walls or stands on the floors any
// more: a floor is told by its material, its colour and its light, which a
// climb generated for an hour can repeat without wearing them out.

export type Motif = 'stripes' | 'stars' | 'damask' | 'flowers' | 'tiles' | 'beams' | 'bricks' | 'none';
export type Air = 'dust' | 'lint' | 'bubbles' | 'sparkles' | 'petals' | 'none';
export type View = 'garden' | 'roofs' | 'clouds';

export interface Mood {
  /** what is seen beyond the room, and the haze of the distance */
  bg: string;
  /** the light of the room: from above, from below, how strong */
  sky: string;
  ground: string;
  ambient: number;
  /** the key light: it fills the room, and casts the shadows of a floor without lamps */
  sun: string;
  sunI: number;
  /** how thick the air is in the shafts of that light (0: no shafts; only where it casts the shadows) */
  rays?: number;
}

/**
 * The lamps of a floor, the pools of light the climb goes from one to the
 * next through the dark: a shaded lamp on the wall, a bare bulb on its flex,
 * a candle in its holder, a night light low on the wall. `power`: how bright
 * (candela), `every`: how far apart (m). A floor with lamps has their shadows
 * alone.
 */
export interface Lamp { kind: 'sconce' | 'bulb' | 'candle' | 'nightlight'; color: string; power: number; every: number }

/**
 * A wall of cloth: how it is woven, its colour, the
 * colour between its threads and in its folds, a thread of another colour now
 * and then; how wide a thread (m); how deep its folds (0: stretched flat).
 */
export interface Cloth {
  weave: 'plain' | 'twill' | 'knit' | 'felt' | 'velvet';
  colors: [string, string, string];
  pitch: number;
  folds: number;
}

export interface Theme {
  paper: { motif: Motif; colors: [string, string, string] };
  /** its wall of cloth (the paper is shown instead with ?papier) */
  cloth?: Cloth;
  /** the bars of wood: their colour, how many sides (6: a crayon) */
  wood: { color: string; sides: number };
  /** floors and shelves of wood, the sides of the room */
  plank: string;
  side: string;
  mood: Mood;
  /** through the windows: the sky from its top to the horizon, what stands there */
  outside?: { top: string; bottom: string; view: View; moon?: boolean };
  /** how likely a section has a window */
  windows: number;
  /** a shaft of light falls from the windows */
  shaft?: boolean;
  /** its lamps (none: the key light casts the shadows) */
  lamp?: Lamp;
  /** the sky behind (no walls): from its top to its bottom */
  backdrop?: { top: string; bottom: string; stars?: number };
  /** in the sky: the moon over its first section, how many clouds drift by a section */
  moon?: boolean;
  clouds?: number;
  air: Air;
  /** now and then, a shooting star */
  shooting?: boolean;
  /** the red thread up the wall: red in the house, light beyond */
  thread: 'red' | 'light' | 'none';
}

const DAY: Mood = { bg: '#120d0a', sky: '#c9b8a0', ground: '#2a1f18', ambient: 0.42, sun: '#a9c0e0', sunI: 1.1 };
const NOWALL: Theme['paper'] = { motif: 'none', colors: ['#000', '#000', '#000'] };

export const THEMES: Theme[] = [
  // L'entrée: lin écru
  {
    paper: { motif: 'damask', colors: ['#e9dcc3', '#dccbaa', '#c4ab80'] },
    cloth: { weave: 'plain', colors: ['#cdb894', '#8a7454', '#c0463c'], pitch: 0.008, folds: 0.25 },
    wood: { color: '#7a4e2c', sides: 24 }, plank: '#6b4428', side: '#efe6d6',
    mood: DAY, outside: { top: '#8fbfea', bottom: '#e6f1f8', view: 'garden' }, windows: 0.3,
    lamp: { kind: 'sconce', color: '#ffb46b', power: 1.2, every: 1.6 },
    air: 'dust', thread: 'red',
  },
  // La penderie: feutre lavande
  {
    paper: { motif: 'stripes', colors: ['#e4dde8', '#d6cde0', '#b9aac9'] },
    cloth: { weave: 'felt', colors: ['#a898c6', '#62557e', '#ecd496'], pitch: 0.01, folds: 0.7 },
    wood: { color: '#c49a62', sides: 24 }, plank: '#9a7448', side: '#ece6ef',
    mood: { bg: '#0d0a08', sky: '#b0a088', ground: '#1e1712', ambient: 0.3, sun: '#8899aa', sunI: 0.7 },
    lamp: { kind: 'bulb', color: '#ffc27a', power: 1.1, every: 1.5 },
    windows: 0, air: 'dust', thread: 'red',
  },
  // La chambre des petits: tricot bleu ciel, une rayure jaune de temps en temps
  {
    paper: { motif: 'stars', colors: ['#dde8ef', '#cfdde7', '#a9c2d4'] },
    cloth: { weave: 'knit', colors: ['#a8bfd0', '#6a849c', '#f4cf66'], pitch: 0.016, folds: 0.15 },
    wood: { color: '#d9a441', sides: 6 }, plank: '#b8875a', side: '#eef3f6',
    mood: { bg: '#0b0c14', sky: '#a8b0d8', ground: '#1c1a28', ambient: 0.34, sun: '#8ea6ff', sunI: 0.9 },
    lamp: { kind: 'nightlight', color: '#ffd59a', power: 0.5, every: 1.3 },
    outside: { top: '#9cc0e8', bottom: '#f6e6c8', view: 'garden' }, windows: 0.35,
    air: 'dust', thread: 'red',
  },
  // L'atelier: sergé bleu pétrole
  {
    paper: { motif: 'flowers', colors: ['#f0e6d6', '#c2525a', '#8aa070'] },
    cloth: { weave: 'twill', colors: ['#6fa0a6', '#3a6268', '#ecc882'], pitch: 0.008, folds: 0.3 },
    wood: { color: '#b98a58', sides: 24 }, plank: '#8f6a44', side: '#f3ece0',
    mood: { bg: '#100c07', sky: '#c8b898', ground: '#241c12', ambient: 0.34, sun: '#9fb0c8', sunI: 0.6 },
    lamp: { kind: 'sconce', color: '#ffd9a0', power: 1.3, every: 1.7 },
    outside: { top: '#a0b8e0', bottom: '#f8dcb0', view: 'roofs' }, windows: 0.3,
    air: 'lint', thread: 'red',
  },
  // La buanderie: coton blanc, des draps
  {
    paper: { motif: 'tiles', colors: ['#eef3f4', '#c8d3d6', '#9ec3cf'] },
    cloth: { weave: 'plain', colors: ['#d4e0e4', '#8ea4ae', '#5aa0c8'], pitch: 0.005, folds: 0.9 },
    wood: { color: '#d8b98a', sides: 24 }, plank: '#a89878', side: '#f2f6f7',
    mood: { bg: '#0a0f12', sky: '#a8c0cc', ground: '#18222a', ambient: 0.4, sun: '#c8e4ff', sunI: 0.8 },
    lamp: { kind: 'bulb', color: '#d8eeff', power: 1.2, every: 1.6 },
    outside: { top: '#b8cce0', bottom: '#e8eef2', view: 'roofs' }, windows: 0.3,
    air: 'bubbles', thread: 'red',
  },
  // Le salon: velours vert
  {
    paper: { motif: 'damask', colors: ['#d9dcc4', '#c9cdb0', '#a2a77e'] },
    cloth: { weave: 'velvet', colors: ['#7aa070', '#3a5434', '#e0b866'], pitch: 0.01, folds: 0.8 },
    wood: { color: '#8a5a33', sides: 24 }, plank: '#6e4528', side: '#e8e6d6',
    mood: { bg: '#120b06', sky: '#c8a888', ground: '#2a1a10', ambient: 0.32, sun: '#ff9a5a', sunI: 1.0 },
    lamp: { kind: 'sconce', color: '#ffb066', power: 1.2, every: 1.5 },
    outside: { top: '#e8b070', bottom: '#f8e0b0', view: 'roofs' }, windows: 0.4, shaft: true,
    air: 'dust', thread: 'red',
  },
  // La chambre: velours rose
  {
    paper: { motif: 'flowers', colors: ['#efe0e4', '#d6a9b6', '#9db08a'] },
    cloth: { weave: 'velvet', colors: ['#c8a4ac', '#7a5862', '#f4d8c0'], pitch: 0.01, folds: 0.6 },
    wood: { color: '#6e4a32', sides: 24 }, plank: '#5a3c28', side: '#f1e6e8',
    mood: { bg: '#100a0d', sky: '#b89aa8', ground: '#22161c', ambient: 0.3, sun: '#ff8f7a', sunI: 0.85 },
    lamp: { kind: 'candle', color: '#ffa850', power: 0.55, every: 1.4 },
    outside: { top: '#6a6aa8', bottom: '#f0a080', view: 'roofs' }, windows: 0.4, shaft: true,
    air: 'dust', thread: 'red',
  },
  // Le grenier: toile brute, la lumière des lucarnes
  {
    paper: { motif: 'beams', colors: ['#6b5642', '#5a4736', '#3e3125'] },
    cloth: { weave: 'plain', colors: ['#c4aa80', '#7a6444', '#e0c48a'], pitch: 0.012, folds: 0.15 },
    wood: { color: '#7d6650', sides: 7 }, plank: '#5e4c3a', side: '#4a3c2e',
    mood: { bg: '#080605', sky: '#a09080', ground: '#16110c', ambient: 0.24, sun: '#ffe2b0', sunI: 1.7, rays: 1.0 },
    outside: { top: '#3a4a80', bottom: '#d88a70', view: 'clouds' }, windows: 0.45, shaft: true,
    air: 'dust', thread: 'red',
  },
  // Le toit
  {
    paper: { motif: 'bricks', colors: ['#9a5b44', '#7d4434', '#c9b8a8'] },
    wood: { color: '#8c8270', sides: 24 }, plank: '#6e6658', side: '#86503c',
    mood: { bg: '#0e1428', sky: '#7f92c8', ground: '#22203a', ambient: 0.5, sun: '#ff9f6b', sunI: 1.2, rays: 0.25 },
    backdrop: { top: '#141c3a', bottom: '#d9805a', stars: 40 }, windows: 0,
    air: 'none', thread: 'light',
  },
  // La nuit
  {
    paper: NOWALL,
    wood: { color: '#b8a07a', sides: 24 }, plank: '#9a8664', side: '#000',
    mood: { bg: '#070b1c', sky: '#8fa4e0', ground: '#1a1a30', ambient: 0.8, sun: '#c8d6ff', sunI: 1.3 },
    backdrop: { top: '#03050f', bottom: '#1a2550', stars: 260 }, windows: 0,
    moon: true, clouds: 1, air: 'sparkles', shooting: true, thread: 'light',
  },
  // L'aube
  {
    paper: NOWALL,
    wood: { color: '#b8a07a', sides: 24 }, plank: '#9a8664', side: '#000',
    mood: { bg: '#2a2440', sky: '#ffd6c0', ground: '#6a5a8a', ambient: 1.3, sun: '#ffc48a', sunI: 2.4 },
    backdrop: { top: '#3a3a7a', bottom: '#ffb38a', stars: 60 }, windows: 0,
    clouds: 2, air: 'sparkles', thread: 'light',
  },
  // Les nuages
  {
    paper: NOWALL,
    wood: { color: '#b8a07a', sides: 24 }, plank: '#c8b48e', side: '#000',
    mood: { bg: '#6f93c4', sky: '#ffffff', ground: '#9fb4d0', ambient: 1.6, sun: '#fff6e8', sunI: 2.2 },
    backdrop: { top: '#5f8fd0', bottom: '#d6e6f5' }, windows: 0,
    clouds: 3, air: 'none', thread: 'none',
  },
  // Le grand ciel
  {
    paper: NOWALL,
    wood: { color: '#b8a07a', sides: 24 }, plank: '#c8b48e', side: '#000',
    mood: { bg: '#3d78c8', sky: '#eaf4ff', ground: '#7f9cc8', ambient: 1.6, sun: '#ffffff', sunI: 2.4 },
    backdrop: { top: '#2a62c0', bottom: '#9cc8f2' }, windows: 0,
    clouds: 2, air: 'none', thread: 'none',
  },
  // Les étoiles
  {
    paper: NOWALL,
    wood: { color: '#b8a07a', sides: 24 }, plank: '#9a8664', side: '#000',
    mood: { bg: '#05081a', sky: '#8090d0', ground: '#141428', ambient: 0.75, sun: '#d0dcff', sunI: 1.2 },
    backdrop: { top: '#02040f', bottom: '#101a40', stars: 320 }, windows: 0,
    clouds: 1, air: 'sparkles', shooting: true, thread: 'none',
  },
  // Le matin
  {
    paper: NOWALL,
    wood: { color: '#b8a07a', sides: 24 }, plank: '#c8b48e', side: '#000',
    mood: { bg: '#c89a8a', sky: '#fff0dc', ground: '#c89a8a', ambient: 1.4, sun: '#ffd9a8', sunI: 2.3 },
    backdrop: { top: '#8fb0e0', bottom: '#ffd4b0' }, windows: 0,
    clouds: 2, air: 'petals', thread: 'none',
  },
];

/**
 * The rare rooms: now and then a section of the house opens a window on
 * somewhere else (and a few notes of a music box as the lace comes in).
 */
export const MEMORIES: { name: string; outside: { top: string; bottom: string; view: View | 'sea' | 'snow' } }[] = [
  { name: 'la mer', outside: { top: '#7fb8e8', bottom: '#f4e6c8', view: 'sea' } },
  { name: 'la neige', outside: { top: '#2a3050', bottom: '#8090b0', view: 'snow' } },
  { name: 'le jardin', outside: { top: '#8fc8f0', bottom: '#f0f6e0', view: 'garden' } },
];
