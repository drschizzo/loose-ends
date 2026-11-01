// How each floor looks (the floors are in gen/floors.ts, in the same order):
// its wallpaper, its wood, its light, what is seen through its windows, what
// hangs on its walls and stands on its floors, what drifts in its air.
//
// What can be gripped keeps its look from floor to floor, so that the climb
// stays readable: wood is always warm and matte (darker, paler, a crayon in
// the children's room), chrome always cold and shining, rubber always red,
// posts always gold. Only the rest changes: the decor is on the wall behind,
// paler than what is played with.

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
  /** the light that casts shadows */
  sun: string;
  sunI: number;
}

export interface Theme {
  paper: { motif: Motif; colors: [string, string, string] };
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
  /** the sky behind (no walls): from its top to its bottom */
  backdrop?: { top: string; bottom: string; stars?: number };
  air: Air;
  /** spiders hang on the wall, birds fly by, stars shoot, memories float */
  life?: ('spider' | 'birds' | 'shooting' | 'memories')[];
  /** the red thread up the wall: red in the house, light beyond */
  thread: 'red' | 'light' | 'none';
  /** what tells the floor's story, in its first section (once) */
  story: string[];
  /** what fills the walls, at random */
  wall: string[];
  /** what stands on its floors and shelves, at random */
  ground: string[];
}

const DAY: Mood = { bg: '#2a211b', sky: '#fff4e0', ground: '#5a4636', ambient: 1.4, sun: '#fff1dc', sunI: 2.4 };

export const THEMES: Theme[] = [
  // L'entrée
  {
    paper: { motif: 'damask', colors: ['#e9dcc3', '#dccbaa', '#c4ab80'] },
    wood: { color: '#7a4e2c', sides: 24 }, plank: '#6b4428', side: '#efe6d6',
    mood: DAY, outside: { top: '#8fbfea', bottom: '#e6f1f8', view: 'garden' }, windows: 0.3,
    air: 'dust', thread: 'red',
    story: ['shoes', 'letters', 'mirror', 'coat'],
    wall: ['frame:house', 'keys', 'frame:dog', 'note:entree', 'umbrella', 'frame:couple'],
    ground: ['letters', 'umbrella-stand', 'boots'],
  },
  // La penderie
  {
    paper: { motif: 'stripes', colors: ['#e4dde8', '#d6cde0', '#b9aac9'] },
    wood: { color: '#c49a62', sides: 24 }, plank: '#9a7448', side: '#ece6ef',
    mood: { bg: '#241d18', sky: '#f7e6c8', ground: '#4a3a2e', ambient: 1.2, sun: '#ffe2b8', sunI: 2.0 },
    windows: 0, air: 'dust', life: ['spider'], thread: 'red',
    story: ['clothes', 'carton:À DONNER', 'carton:À GARDER'],
    wall: ['tie-rack', 'lavender', 'frame:couple', 'clothes', 'hat'],
    ground: ['hatbox', 'carton:À DONNER', 'carton:À GARDER', 'boots'],
  },
  // La chambre des petits
  {
    paper: { motif: 'stars', colors: ['#dde8ef', '#cfdde7', '#a9c2d4'] },
    wood: { color: '#d9a441', sides: 6 }, plank: '#b8875a', side: '#eef3f6',
    mood: { bg: '#232530', sky: '#f4f1ff', ground: '#4e4a5e', ambient: 1.4, sun: '#fff4e6', sunI: 2.3 },
    outside: { top: '#9cc0e8', bottom: '#f6e6c8', view: 'garden' }, windows: 0.35,
    air: 'dust', thread: 'red',
    story: ['drawing:papi', 'drawing:mamie', 'teddy'],
    wall: ['drawing:sun', 'drawing:boat', 'pennants', 'frame:bike', 'drawing:papi'],
    ground: ['teddy', 'blocks', 'rocking'],
  },
  // L'atelier
  {
    paper: { motif: 'flowers', colors: ['#f0e6d6', '#c2525a', '#8aa070'] },
    wood: { color: '#b98a58', sides: 24 }, plank: '#8f6a44', side: '#f3ece0',
    mood: { bg: '#2a2418', sky: '#fff2cc', ground: '#5c4a30', ambient: 1.35, sun: '#ffe9b0', sunI: 2.5 },
    outside: { top: '#a0b8e0', bottom: '#f8dcb0', view: 'roofs' }, windows: 0.3,
    air: 'lint', thread: 'red',
    story: ['knitting', 'calendar', 'scissors'],
    wall: ['spools', 'tape', 'pattern', 'scissors', 'frame:wedding', 'note:atelier'],
    ground: ['sewing', 'basket'],
  },
  // La buanderie
  {
    paper: { motif: 'tiles', colors: ['#eef3f4', '#c8d3d6', '#9ec3cf'] },
    wood: { color: '#d8b98a', sides: 24 }, plank: '#a89878', side: '#f2f6f7',
    mood: { bg: '#1d2428', sky: '#e8f4ff', ground: '#3e4e58', ambient: 1.5, sun: '#eef6ff', sunI: 2.2 },
    outside: { top: '#b8cce0', bottom: '#e8eef2', view: 'roofs' }, windows: 0.3,
    air: 'bubbles', thread: 'red',
    story: ['laundry', 'sock'],
    wall: ['laundry', 'sock', 'note:buanderie', 'shelf-jars'],
    ground: ['washer', 'basket'],
  },
  // Le salon
  {
    paper: { motif: 'damask', colors: ['#d9dcc4', '#c9cdb0', '#a2a77e'] },
    wood: { color: '#8a5a33', sides: 24 }, plank: '#6e4528', side: '#e8e6d6',
    mood: { bg: '#2b1f16', sky: '#ffe4bf', ground: '#5a3e2a', ambient: 1.25, sun: '#ffcf8a', sunI: 2.6 },
    outside: { top: '#e8b070', bottom: '#f8e0b0', view: 'roofs' }, windows: 0.4, shaft: true,
    air: 'dust', thread: 'red',
    story: ['clock', 'glasses', 'pale', 'pale'],
    wall: ['books', 'pale', 'frame:wedding', 'frame:sea', 'frame:baby', 'pale'],
    ground: ['armchair', 'clock', 'glasses', 'radio'],
  },
  // La chambre
  {
    paper: { motif: 'flowers', colors: ['#efe0e4', '#d6a9b6', '#9db08a'] },
    wood: { color: '#6e4a32', sides: 24 }, plank: '#5a3c28', side: '#f1e6e8',
    mood: { bg: '#2a1c22', sky: '#ffd9cc', ground: '#5a3a44', ambient: 1.1, sun: '#ffb38a', sunI: 2.2 },
    outside: { top: '#6a6aa8', bottom: '#f0a080', view: 'roofs' }, windows: 0.4, shaft: true,
    air: 'dust', thread: 'red',
    story: ['bed', 'nightstand', 'slippers'],
    wall: ['frame:couple', 'robe', 'frame:wedding', 'note:chambre', 'frame:baby'],
    ground: ['flowers', 'slippers', 'nightstand'],
  },
  // Le grenier
  {
    paper: { motif: 'beams', colors: ['#6b5642', '#5a4736', '#3e3125'] },
    wood: { color: '#7d6650', sides: 7 }, plank: '#5e4c3a', side: '#4a3c2e',
    mood: { bg: '#17130f', sky: '#cfc2b0', ground: '#3a3028', ambient: 0.85, sun: '#ffe8c0', sunI: 2.8 },
    outside: { top: '#3a4a80', bottom: '#d88a70', view: 'clouds' }, windows: 0.45, shaft: true,
    air: 'dust', life: ['spider'], thread: 'red',
    story: ['cartons', 'dress', 'rocking'],
    wall: ['cobweb', 'dress', 'frame:sea', 'cobweb', 'stain'],
    ground: ['cartons', 'suitcase', 'rocking', 'carton:NOËL', 'carton:PHOTOS'],
  },
  // Le toit
  {
    paper: { motif: 'bricks', colors: ['#9a5b44', '#7d4434', '#c9b8a8'] },
    wood: { color: '#8c8270', sides: 24 }, plank: '#6e6658', side: '#86503c',
    mood: { bg: '#1b2340', sky: '#9fb2e8', ground: '#3a3048', ambient: 0.95, sun: '#ff9f6b', sunI: 1.6 },
    backdrop: { top: '#141c3a', bottom: '#d9805a', stars: 40 }, windows: 0,
    air: 'none', life: ['birds'], thread: 'light',
    story: ['antenna'],
    wall: ['antenna', 'stain'],
    ground: [],
  },
  // La nuit
  {
    paper: { motif: 'none', colors: ['#000', '#000', '#000'] },
    wood: { color: '#b8a07a', sides: 24 }, plank: '#9a8664', side: '#000',
    mood: { bg: '#070b1c', sky: '#8fa4e0', ground: '#1a1a30', ambient: 0.8, sun: '#c8d6ff', sunI: 1.3 },
    backdrop: { top: '#03050f', bottom: '#1a2550', stars: 260 }, windows: 0,
    air: 'sparkles', life: ['shooting', 'memories'], thread: 'light',
    story: ['moon'], wall: ['balloon', 'kite', 'cloud'], ground: [],
  },
  // L'aube
  {
    paper: { motif: 'none', colors: ['#000', '#000', '#000'] },
    wood: { color: '#b8a07a', sides: 24 }, plank: '#9a8664', side: '#000',
    mood: { bg: '#2a2440', sky: '#ffd6c0', ground: '#6a5a8a', ambient: 1.3, sun: '#ffc48a', sunI: 2.4 },
    backdrop: { top: '#3a3a7a', bottom: '#ffb38a', stars: 60 }, windows: 0,
    air: 'sparkles', life: ['birds', 'memories'], thread: 'light',
    story: ['kite'], wall: ['cloud', 'balloon', 'cloud'], ground: [],
  },
  // Les nuages
  {
    paper: { motif: 'none', colors: ['#000', '#000', '#000'] },
    wood: { color: '#b8a07a', sides: 24 }, plank: '#c8b48e', side: '#000',
    mood: { bg: '#6f93c4', sky: '#ffffff', ground: '#9fb4d0', ambient: 1.6, sun: '#fff6e8', sunI: 2.2 },
    backdrop: { top: '#5f8fd0', bottom: '#d6e6f5' }, windows: 0,
    air: 'none', life: ['memories', 'birds'], thread: 'none',
    story: [], wall: ['cloud', 'cloud', 'balloon'], ground: [],
  },
  // Le grand ciel
  {
    paper: { motif: 'none', colors: ['#000', '#000', '#000'] },
    wood: { color: '#b8a07a', sides: 24 }, plank: '#c8b48e', side: '#000',
    mood: { bg: '#3d78c8', sky: '#eaf4ff', ground: '#7f9cc8', ambient: 1.6, sun: '#ffffff', sunI: 2.4 },
    backdrop: { top: '#2a62c0', bottom: '#9cc8f2' }, windows: 0,
    air: 'none', life: ['memories', 'birds'], thread: 'none',
    story: [], wall: ['cloud', 'kite', 'cloud'], ground: [],
  },
  // Les étoiles
  {
    paper: { motif: 'none', colors: ['#000', '#000', '#000'] },
    wood: { color: '#b8a07a', sides: 24 }, plank: '#9a8664', side: '#000',
    mood: { bg: '#05081a', sky: '#8090d0', ground: '#141428', ambient: 0.75, sun: '#d0dcff', sunI: 1.2 },
    backdrop: { top: '#02040f', bottom: '#101a40', stars: 320 }, windows: 0,
    air: 'sparkles', life: ['shooting', 'memories'], thread: 'none',
    story: [], wall: ['balloon', 'cloud'], ground: [],
  },
  // Le matin
  {
    paper: { motif: 'none', colors: ['#000', '#000', '#000'] },
    wood: { color: '#b8a07a', sides: 24 }, plank: '#c8b48e', side: '#000',
    mood: { bg: '#c89a8a', sky: '#fff0dc', ground: '#c89a8a', ambient: 1.4, sun: '#ffd9a8', sunI: 2.3 },
    backdrop: { top: '#8fb0e0', bottom: '#ffd4b0' }, windows: 0,
    air: 'petals', life: ['birds', 'memories'], thread: 'none',
    story: [], wall: ['cloud', 'kite', 'balloon'], ground: [],
  },
];

/**
 * The rare rooms: now and then a section of the house keeps a memory, a
 * little scene of its own (and a few notes of a music box as the lace comes
 * in). What is in it, and what its window shows.
 */
export const MEMORIES: { name: string; props: string[]; outside?: { top: string; bottom: string; view: View | 'sea' | 'snow' } }[] = [
  { name: 'la mer', props: ['postcard', 'frame:sea', 'shell'], outside: { top: '#7fb8e8', bottom: '#f4e6c8', view: 'sea' } },
  { name: 'Noël', props: ['garland', 'carton:NOËL', 'frame:baby'], outside: { top: '#2a3050', bottom: '#8090b0', view: 'snow' } },
  { name: 'le bal', props: ['gramophone', 'frame:dance', 'notes'] },
  { name: 'le jardin', props: ['hat', 'flowers', 'frame:house'], outside: { top: '#8fc8f0', bottom: '#f0f6e0', view: 'garden' } },
];
