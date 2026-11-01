// The decor, painted: the papers of the walls, what is seen through the
// windows, the sky and what glows in it, the height gauge. Drawn once on a
// canvas, the first time a floor needs it, and kept. Nothing to load.
//
// The things that hung on the walls and stood on the floors (frames, keys,
// umbrellas, cartons) are gone: drawn flat, they never matched the lace and
// the bars, and the procedural climb showed them again and again. What is
// left glows, or is soft at the edges, or is too small to be looked at: a
// moon, clouds, a star, the bow the thread ends in, the spider of a web.
//
// A thing is asked for by its name. It is drawn in centimetres, its size
// given with it.

import * as THREE from 'three/webgpu';
import type { Motif, View } from './themes';

/** what is painted: its texture, its size (m), whether it glows (the sky), is soft at the edges */
export interface Art { tex: THREE.CanvasTexture; w: number; h: number; glow: boolean; soft: boolean }

type G = CanvasRenderingContext2D;
/** how it is drawn, in a box of w × h cm */
type Draw = (g: G, w: number, h: number, r: () => number) => void;
interface Kind { w: number; h: number; glow?: boolean; soft?: boolean; draw: Draw }

const HAND = '"Noteworthy", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';
const MARKER = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", sans-serif';
const PX = 6; // pixels per cm, at most 1024 a side

// ------------------------------------------------------------- the pen

const rr = (g: G, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const box = (g: G, c: string, x: number, y: number, w: number, h: number, r = 0) => { g.fillStyle = c; rr(g, x, y, w, h, r); g.fill(); };
const disc = (g: G, c: string, x: number, y: number, rx: number, ry = rx) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const path = (g: G, pts: number[], close = false) => {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
};
const fill = (g: G, c: string, pts: number[]) => { g.fillStyle = c; path(g, pts, true); g.fill(); };
const stroke = (g: G, c: string, width: number, pts: number[], close = false) => {
  g.strokeStyle = c; g.lineWidth = width; g.lineCap = g.lineJoin = 'round'; path(g, pts, close); g.stroke();
};
const curve = (g: G, c: string, width: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => {
  g.strokeStyle = c; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
};

// ------------------------------------------------------------- the things

const KINDS: Record<string, Kind> = {
  // the sky
  moon: {
    w: 30, h: 30, glow: true, soft: true, draw(g) {
      const gr = g.createRadialGradient(15, 15, 4, 15, 15, 15);
      gr.addColorStop(0, 'rgba(255, 245, 210, 0.35)'); gr.addColorStop(1, 'rgba(255, 245, 210, 0)');
      g.fillStyle = gr; g.fillRect(0, 0, 30, 30);
      disc(g, '#fff4d0', 15, 15, 8);
      g.globalCompositeOperation = 'destination-out'; disc(g, '#000', 19, 12.5, 7.4); g.globalCompositeOperation = 'source-over';
    },
  },
  cloud: {
    w: 70, h: 30, soft: true, glow: true, draw(g, w, h, r) {
      for (let i = 0; i < 9; i++) {
        const x = 12 + r() * 46, y = 13 + (r() - 0.3) * 8, s = 7 + r() * 8, gr = g.createRadialGradient(x, y, 0, x, y, s);
        gr.addColorStop(0, 'rgba(255, 255, 255, 0.55)'); gr.addColorStop(0.6, 'rgba(255, 255, 255, 0.35)'); gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = gr; g.fillRect(0, 0, 70, 30);
      }
    },
  },
  star: {
    w: 10, h: 10, glow: true, soft: true, draw(g) {
      const gr = g.createRadialGradient(5, 5, 0, 5, 5, 5);
      gr.addColorStop(0, 'rgba(255, 240, 200, 1)'); gr.addColorStop(0.25, 'rgba(255, 220, 150, 0.6)'); gr.addColorStop(1, 'rgba(255, 220, 150, 0)');
      g.fillStyle = gr; g.fillRect(0, 0, 10, 10);
      fill(g, '#fff8e0', [5, 0.5, 5.5, 4.5, 9.5, 5, 5.5, 5.5, 5, 9.5, 4.5, 5.5, 0.5, 5, 4.5, 4.5]);
    },
  },
  bow: {
    w: 12, h: 9, glow: true, draw(g) {
      // where the thread ends: tied in a bow
      g.strokeStyle = '#ffd98a'; g.lineWidth = 0.45; g.lineCap = 'round';
      g.beginPath(); g.ellipse(3.3, 3.6, 3, 1.8, -0.35, 0, 7); g.stroke();
      g.beginPath(); g.ellipse(8.7, 3.6, 3, 1.8, 0.35, 0, 7); g.stroke();
      disc(g, '#ffd98a', 6, 4.2, 0.9);
      curve(g, '#ffd98a', 0.45, 6, 4.6, 4, 6.5, 3, 8.8); curve(g, '#ffd98a', 0.45, 6, 4.6, 8, 6.5, 9.4, 8.4);
    },
  },
  // the sticky web's
  spider: {
    w: 6, h: 6, draw(g) {
      for (let k = 0; k < 4; k++) for (const s of [-1, 1]) stroke(g, '#1e1a18', 0.25, [3, 3.2, 3 + s * 1.6, 1.8 + k * 0.9, 3 + s * 2.8, 2.4 + k * 1.1]);
      disc(g, '#1e1a18', 3, 3.4, 1.1, 1.3); disc(g, '#1e1a18', 3, 2, 0.6);
    },
  },
};

// ---------------------------------------------------------------- painting

const cache = new Map<string, Art>();

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** numbers at random, the same for the same seed */
export function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seeded = (...a: (number | string)[]) => random(hash(a.join('|')));

/** the thing named, painted */
export function art(name: string): Art {
  let a = cache.get(name);
  if (a) return a;
  const k = KINDS[name];
  if (!k) throw new Error(`Rien à peindre sous le nom « ${name} »`);
  const s = Math.min(PX, 1024 / Math.max(k.w, k.h));
  const c = document.createElement('canvas');
  c.width = Math.ceil(k.w * s); c.height = Math.ceil(k.h * s);
  const g = c.getContext('2d')!;
  g.scale(s, s);
  k.draw(g, k.w, k.h, seeded(name));
  a = { tex: texture(c), w: k.w / 100, h: k.h / 100, glow: !!k.glow, soft: !!k.soft };
  cache.set(name, a);
  return a;
}

function texture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// -------------------------------------------------------------- the walls

const reliefs = new Map<THREE.Texture, THREE.CanvasTexture>();
/**
 * The relief of a painted texture, as a normal map: what is darker is pressed
 * in (the motif of a paper embossed, the mortar between bricks, the grain of
 * beams), so that a light grazing the wall picks it out.
 */
export function relief(tex: THREE.CanvasTexture, depth = 2): THREE.CanvasTexture {
  let n = reliefs.get(tex);
  if (n) return n;
  const src = tex.image as HTMLCanvasElement, w = src.width, h = src.height;
  const px = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const lum = (x: number, y: number) => { const i = 4 * (((y + h) % h) * w + ((x + w) % w)); return (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255; };
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!, out = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (lum(x + 1, y) - lum(x - 1, y)) * depth, dy = (lum(x, y + 1) - lum(x, y - 1)) * depth;
    const l = Math.hypot(dx, dy, 1), i = 4 * (y * w + x);
    // (the canvas's rows go down, the texture's v up)
    out.data[i] = 255 * (0.5 - 0.5 * dx / l); out.data[i + 1] = 255 * (0.5 + 0.5 * dy / l); out.data[i + 2] = 255 * (0.5 + 0.5 / l); out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  n = new THREE.CanvasTexture(cv);
  n.wrapS = tex.wrapS; n.wrapT = tex.wrapT; n.anisotropy = 4;
  reliefs.set(tex, n);
  return n;
}

/** the side of a tile of wallpaper (m) */
export const TILE = 0.32;

/** a tile of wallpaper of `motif` in `colors` (ground, figure, accent) */
export function wallpaper(motif: Motif, [a, b, c]: [string, string, string]): THREE.CanvasTexture {
  const key = `paper ${motif} ${a}`;
  const hit = cache.get(key);
  if (hit) return hit.tex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!, r = seeded(key);
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  switch (motif) {
    case 'stripes':
      g.fillStyle = b; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 26, 256);
      g.fillStyle = c; for (let x = 30; x < 256; x += 64) g.fillRect(x, 0, 3, 256);
      break;
    case 'stars':
      g.fillStyle = b; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 26, 256);
      g.fillStyle = c;
      for (const [x, y] of [[45, 40], [109, 150], [173, 70], [237, 200], [45, 230]]) {
        g.beginPath();
        for (let q = 0; q < 10; q++) { const rad = q % 2 ? 4 : 10, an = (Math.PI * q) / 5 - Math.PI / 2; g.lineTo(x + rad * Math.cos(an), y + rad * Math.sin(an)); }
        g.fill();
      }
      break;
    case 'damask':
      // a trellis: diamonds of fine lines, a small flower where they cross, a dot in each
      g.strokeStyle = b; g.lineWidth = 3;
      for (let k = -256; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke(); g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); }
      for (let x = 0; x <= 256; x += 64) for (let y = 0; y <= 256; y += 64) {
        g.fillStyle = c;
        for (let q = 0; q < 4; q++) { g.beginPath(); g.ellipse(x + Math.cos(q * Math.PI / 2) * 6, y + Math.sin(q * Math.PI / 2) * 6, 5, 3, q * Math.PI / 2, 0, 7); g.fill(); }
        g.fillStyle = b; g.beginPath(); g.arc(x + 32, y + 32, 3, 0, 7); g.fill();
      }
      break;
    case 'flowers':
      for (let i = 0; i < 14; i++) {
        const x = r() * 256, y = r() * 256;
        for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
          g.fillStyle = c; g.beginPath(); g.ellipse(x + dx + 7, y + dy + 6, 5, 2.5, 0.6, 0, 7); g.fill();
          g.fillStyle = b; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + dx + Math.cos(k * 1.256) * 4, y + dy + Math.sin(k * 1.256) * 4, 3.2, 0, 7); g.fill(); }
          g.fillStyle = a; g.beginPath(); g.arc(x + dx, y + dy, 1.8, 0, 7); g.fill();
        }
      }
      break;
    case 'tiles':
      g.fillStyle = b; for (let k = 0; k < 256; k += 64) { g.fillRect(k, 0, 3, 256); g.fillRect(0, k, 256, 3); }
      g.fillStyle = c; for (let k = 0; k < 4; k++) g.fillRect(Math.floor(r() * 4) * 64 + 3, Math.floor(r() * 4) * 64 + 3, 61, 61);
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = 0; x < 256; x += 64) for (let y = 0; y < 256; y += 64) g.fillRect(x + 8, y + 8, 14, 4);
      break;
    case 'beams':
      for (let x = 0; x < 256; x += 32) {
        g.fillStyle = r() < 0.5 ? a : b; g.fillRect(x, 0, 32, 256);
        g.fillStyle = c; g.fillRect(x, 0, 2, 256);
        g.strokeStyle = 'rgba(30, 20, 10, 0.25)'; g.lineWidth = 1;
        for (let k = 0; k < 3; k++) { const gx = x + 6 + r() * 20; g.beginPath(); g.moveTo(gx, 0); g.bezierCurveTo(gx + 4, 80, gx - 4, 170, gx + 2, 256); g.stroke(); }
      }
      break;
    case 'bricks':
      g.fillStyle = c; g.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 8; row++) for (let k = -1; k < 5; k++) {
        g.fillStyle = r() < 0.5 ? a : b;
        g.fillRect(k * 64 + (row % 2) * 32 + 2, row * 32 + 2, 60, 28);
      }
      break;
    case 'none': break;
  }
  const t = texture(cv, true);
  cache.set(key, { tex: t, w: TILE, h: TILE, glow: false, soft: false });
  return t;
}

/** what a window shows: the sky from `top` to `bottom`, and what stands at the horizon */
export function outside(o: { top: string; bottom: string; view: View | 'sea' | 'snow'; moon?: boolean }): THREE.CanvasTexture {
  const key = `outside ${o.top} ${o.view}`;
  const hit = cache.get(key);
  if (hit) return hit.tex;
  const cv = document.createElement('canvas');
  cv.width = 192; cv.height = 256;
  const g = cv.getContext('2d')!, r = seeded(key), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, o.top); gr.addColorStop(1, o.bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 192, 256);
  const dark = 'rgba(40, 50, 60, 0.55)';
  if (o.view === 'garden') {
    g.fillStyle = '#7a9a6a'; g.fillRect(0, 200, 192, 56);
    for (let i = 0; i < 4; i++) { const x = r() * 192; g.fillStyle = '#5a7a4a'; g.beginPath(); g.ellipse(x, 180, 22, 34, 0, 0, 7); g.fill(); g.fillRect(x - 3, 190, 6, 30); }
    g.fillStyle = '#e8e0d0'; for (let x = 0; x < 192; x += 14) g.fillRect(x, 212, 8, 24);
  } else if (o.view === 'roofs') {
    g.fillStyle = dark;
    let x = -10;
    while (x < 200) { const w = 30 + r() * 40, h = 40 + r() * 60; g.beginPath(); g.moveTo(x, 256); g.lineTo(x, 256 - h); g.lineTo(x + w / 2, 256 - h - 20); g.lineTo(x + w, 256 - h); g.lineTo(x + w, 256); g.fill(); x += w; }
  } else if (o.view === 'clouds' || o.view === 'snow') {
    for (let i = 0; i < 6; i++) { const cx = r() * 192, cy = 120 + r() * 120; const c = g.createRadialGradient(cx, cy, 0, cx, cy, 50); c.addColorStop(0, 'rgba(255,255,255,0.5)'); c.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = c; g.fillRect(0, 0, 192, 256); }
    if (o.view === 'snow') { g.fillStyle = '#f2f4f8'; g.fillRect(0, 214, 192, 42); g.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(r() * 192, r() * 256, 1 + r() * 1.5, 0, 7); g.fill(); } }
  } else if (o.view === 'sea') {
    g.fillStyle = '#4a8ab8'; g.fillRect(0, 160, 192, 50);
    g.fillStyle = '#ecd8a8'; g.fillRect(0, 210, 192, 46);
    g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 12; i++) g.fillRect(r() * 192, 165 + r() * 40, 10, 1.5);
  }
  if (o.moon) { g.fillStyle = '#fff4d0'; g.beginPath(); g.arc(140, 60, 14, 0, 7); g.fill(); }
  const t = texture(cv);
  cache.set(key, { tex: t, w: 1, h: 1, glow: true, soft: false });
  return t;
}

/** the sky behind, from `top` to `bottom`, fading out at both ends where the next sky takes over */
export function sky(top: string, bottom: string): THREE.CanvasTexture {
  const key = `sky ${top} ${bottom}`;
  const hit = cache.get(key);
  if (hit) return hit.tex;
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 512;
  const g = cv.getContext('2d')!, gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, 512);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.15, 'rgba(0,0,0,1)'); fade.addColorStop(0.85, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade; g.fillRect(0, 0, 4, 512);
  const t = texture(cv);
  cache.set(key, { tex: t, w: 1, h: 1, glow: true, soft: true });
  return t;
}

/** a soft dot (dust, a star, a spark) and a ring (a bubble), for what drifts in the air */
export const DOT = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
export const RING = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(22, 22, 6, 3, -0.7, 0, 7); g.fill();
  return new THREE.CanvasTexture(cv);
})();

/**
 * The height gauge on the wall, from y0 to y1 (m): a mark every 10 cm, the
 * metres written. In the hall, the children were measured on it (and Papi,
 * for fun); a pencil line where the lace got highest before.
 */
export function gauge(y0: number, y1: number, best: number): { tex: THREE.CanvasTexture; w: number } {
  const W = 0.22, per = Math.min(500, 4000 / (y1 - y0));
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * per); cv.height = Math.round((y1 - y0) * per);
  const g = cv.getContext('2d')!;
  const Y = (y: number) => (y1 - y) * per, S = per / 100;
  g.fillStyle = '#d8c09a'; g.fillRect(0, 0, 0.06 * per, cv.height);
  g.fillStyle = 'rgba(90, 60, 30, 0.35)'; g.fillRect(0.06 * per - 1, 0, 1, cv.height);
  for (let k = Math.ceil(y0 * 20); k <= y1 * 20; k++) {
    const y = Y(k / 20), m = k % 20 === 0, d = k % 2 === 0;
    g.fillStyle = '#4a3420'; g.fillRect(0, y - 0.5, (m ? 3.6 : d ? 2.4 : 1.4) * S, Math.max(1, 0.18 * S));
    if (m && k > 0) { g.font = `bold ${1.9 * S}px ${MARKER}`; g.textBaseline = 'middle'; g.fillText(String(k / 20), 3.9 * S, y); }
  }
  const mark = (y: number, s: string, c = '#3a3a4a') => {
    if (y < y0 || y > y1) return;
    g.fillStyle = c; g.fillRect(0, Y(y) - 0.5, 9 * S, Math.max(1, 0.15 * S));
    g.font = `${1.6 * S}px ${HAND}`; g.textBaseline = 'bottom'; g.fillText(s, 6.4 * S, Y(y) - 0.2 * S);
  };
  [[0.92, 'Léa 3 ans'], [1.02, 'Tom 4 ans'], [1.16, 'Léa 6 ans'], [1.29, 'Tom 8 ans'], [1.41, 'Léa 10 ans'], [1.76, 'Papi !']].forEach(([y, s]) => mark(y as number, s as string));
  if (best > 2) mark(best, 'record', '#a8323a');
  return { tex: texture(cv), w: W };
}
