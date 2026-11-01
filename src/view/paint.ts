// The decor, painted: everything on the walls of the house and in its sky is
// drawn once on a canvas, the first time a floor needs it, and kept. Nothing
// to load. Flat shapes, a little faded, a hand that writes the notes: an
// album more than a photograph.
//
// A thing is asked for by its name, and a variant after a colon (« frame:sea »,
// « carton:À DONNER »). It is drawn in centimetres, its size given with it.

import * as THREE from 'three';
import type { Motif, View } from './themes';

/** what is painted: its texture, its size (m), whether it stands on a floor, glows (the sky), is soft at the edges */
export interface Art { tex: THREE.CanvasTexture; w: number; h: number; ground: boolean; glow: boolean; soft: boolean }

type G = CanvasRenderingContext2D;
/** how it is drawn, in a box of w × h cm */
type Draw = (g: G, w: number, h: number, v: string, r: () => number) => void;
interface Kind { w: number; h: number; ground?: boolean; glow?: boolean; soft?: boolean; draw: Draw }

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
const write = (g: G, s: string, x: number, y: number, size: number, c: string, font = HAND, align: CanvasTextAlign = 'center') => {
  g.fillStyle = c; g.font = `${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
};
/** a wobbly crayon line, as a child draws */
const crayon = (g: G, c: string, pts: number[], r: () => number, close = false) => {
  const q = pts.map((p) => p + (r() - 0.5) * 0.5);
  stroke(g, c, 0.55, q, close);
};
/** a nail, and the string a frame hangs from */
const nail = (g: G, x: number, y: number) => disc(g, '#5a524a', x, y, 0.5);

/** a photo, faded, of what `scene` says, in a frame */
function photo(g: G, w: number, h: number, scene: string, r: () => number): void {
  const old = ['wedding', 'couple', 'dance', 'baby'].includes(scene);
  box(g, old ? '#3b2a1c' : '#c9a66b', 0, 0, w, h, 0.6);
  box(g, '#f2ead8', 1.4, 1.4, w - 2.8, h - 2.8);
  const x0 = 2.4, y0 = 2.4, W = w - 4.8, H = h - 4.8;
  g.save(); rr(g, x0, y0, W, H, 0); g.clip();
  const sky = old ? '#d8c3a0' : '#bcd3dc', ink = old ? '#5a4330' : '#5d6670';
  box(g, sky, x0, y0, W, H);
  const cx = x0 + W / 2, base = y0 + H;
  const person = (x: number, s: number, c: string, dress = false) => {
    disc(g, c, x, base - 13 * s, 2.4 * s);
    if (dress) fill(g, c, [x - 2 * s, base - 10.5 * s, x + 2 * s, base - 10.5 * s, x + 4.5 * s, base, x - 4.5 * s, base]);
    else box(g, c, x - 2.8 * s, base - 10.5 * s, 5.6 * s, 10.5 * s, 2 * s);
  };
  switch (scene) {
    case 'house':
      box(g, '#9fb88a', x0, base - H * 0.3, W, H * 0.3);
      box(g, '#e8d8c0', cx - 6, base - H * 0.3 - 7, 12, 9);
      fill(g, '#a8574a', [cx - 7.5, base - H * 0.3 - 7, cx + 7.5, base - H * 0.3 - 7, cx, base - H * 0.3 - 13]);
      box(g, '#6a5040', cx - 1.2, base - H * 0.3 - 4, 2.4, 6);
      disc(g, '#6f8f5a', x0 + W * 0.18, base - H * 0.3 - 5, 4, 5);
      break;
    case 'dog':
      box(g, '#c8b898', x0, base - 5, W, 5);
      disc(g, '#7a5a3a', cx, base - 7, 5, 4.5);
      disc(g, '#7a5a3a', cx + 3.5, base - 13, 3, 3);
      disc(g, '#5a4028', cx + 5.5, base - 12, 1.2, 2.2);
      break;
    case 'couple':
      person(cx - 4, 1.05, ink); person(cx + 3.5, 0.95, ink, true);
      break;
    case 'wedding':
      person(cx - 4, 1.05, '#3a2a1e');
      person(cx + 3.5, 0.95, '#f6efe2', true);
      fill(g, 'rgba(255,255,255,0.6)', [cx + 3.5, base - 15, cx + 9, base - 3, cx + 1, base - 9]);
      break;
    case 'dance':
      person(cx - 2.5, 1, ink); person(cx + 2.5, 0.92, ink, true);
      write(g, '♪', x0 + 3, y0 + 4, 4, ink); write(g, '♫', x0 + W - 3, y0 + 6, 4, ink);
      break;
    case 'baby':
      person(cx, 1.15, ink, true);
      disc(g, '#f6efe2', cx + 1.5, base - 9, 2.6, 2);
      break;
    case 'sea':
      box(g, '#6fa7c8', x0, y0 + H * 0.5, W, H * 0.25);
      box(g, '#e8d6a8', x0, y0 + H * 0.75, W, H * 0.25);
      fill(g, '#d26a5a', [cx - 5, y0 + H * 0.55, cx + 5, y0 + H * 0.55, cx, y0 + H * 0.4]);
      stroke(g, '#7a6a5a', 0.4, [cx, y0 + H * 0.55, cx, y0 + H * 0.85]);
      break;
    case 'bike':
      box(g, '#a8b898', x0, base - 3, W, 3);
      for (const dx of [-4, 4]) { g.strokeStyle = ink; g.lineWidth = 0.6; g.beginPath(); g.arc(cx + dx, base - 5, 2.6, 0, 7); g.stroke(); }
      stroke(g, '#c0504a', 0.7, [cx - 4, base - 5, cx, base - 9, cx + 4, base - 5]);
      disc(g, ink, cx, base - 15, 2); stroke(g, ink, 1.4, [cx, base - 13, cx, base - 9]);
      break;
  }
  g.restore();
  if (old || r() < 0.5) { g.fillStyle = 'rgba(120, 90, 50, 0.18)'; g.fillRect(x0, y0, W, H); }
}

// ------------------------------------------------------------- the things

const KINDS: Record<string, Kind> = {
  // L'entrée
  shoes: {
    w: 34, h: 12, ground: true, draw(g) {
      // a pair: the left one laced, the right one with no lace (it is climbing)
      for (const [x, laced] of [[1, true], [18, false]] as const) {
        fill(g, '#4a2e1c', [x, 11, x, 6, x + 4, 3, x + 9, 3, x + 11, 6, x + 15, 7.5, x + 15.5, 11]);
        box(g, '#2a1a10', x - 0.3, 10.4, 16.2, 1.6, 0.6);
        stroke(g, '#2a1a10', 0.4, [x + 4, 3.4, x + 6, 7, x + 10, 6]);
        for (let i = 0; i < 3; i++) disc(g, '#c9b48a', x + 6 + i * 1.4, 4.4 + i * 0.6, 0.35);
        if (laced) {
          stroke(g, '#f2ece0', 0.45, [x + 5.6, 4.2, x + 8.6, 5.6, x + 7, 4.8, x + 10, 6.1]);
          curve(g, '#f2ece0', 0.45, x + 6, 4.3, x + 3, 9, x + 1.5, 11.5);
        }
      }
    },
  },
  letters: {
    w: 24, h: 7, ground: true, draw(g, w, h, v, r) {
      for (let i = 0; i < 6; i++) {
        g.save(); g.translate(12 + (r() - 0.5) * 6, 6.2 - i * 0.9); g.rotate((r() - 0.5) * 0.3);
        box(g, ['#f3ead8', '#e8dcc6', '#f6f1e4', '#dfe6ea'][i % 4], -9, -1.2, 18, 2.2, 0.2);
        if (i % 2) box(g, '#c0504a', 6, -1, 1.6, 1.2);
        g.restore();
      }
    },
  },
  mirror: {
    w: 30, h: 40, draw(g) {
      nail(g, 15, 1.5);
      disc(g, '#b8963c', 15, 22, 12, 16.5);
      disc(g, '#9fb2ba', 15, 22, 10.5, 15);
      // under a sheet, as is done in a house of mourning
      fill(g, '#f4f1ea', [3, 6, 27, 6, 28.5, 30, 25, 38, 18, 36, 12, 39, 5, 36, 1.5, 30]);
      for (const x of [8, 14, 20]) stroke(g, 'rgba(160,150,140,0.45)', 0.4, [x, 8, x + 1.5, 24, x - 0.5, 36]);
      stroke(g, '#8a8070', 0.25, [15, 1.5, 4, 6.5]); stroke(g, '#8a8070', 0.25, [15, 1.5, 26, 6.5]);
    },
  },
  coat: {
    w: 30, h: 62, draw(g) {
      box(g, '#6a4a30', 3, 2, 24, 2.4, 1);
      disc(g, '#b8963c', 15, 3.2, 1);
      fill(g, '#5b5650', [10, 5, 20, 5, 25, 14, 26, 58, 4, 58, 5, 14]);
      stroke(g, '#3e3a36', 0.5, [15, 7, 15, 58]);
      fill(g, '#4a4640', [10, 5, 15, 13, 12, 22, 8, 12]); fill(g, '#4a4640', [20, 5, 15, 13, 18, 22, 22, 12]);
      for (const y of [26, 34, 42]) disc(g, '#2a2622', 16.5, y, 0.7);
      // the hat on the peg
      disc(g, '#3a3530', 15, 4.2, 9, 1.6); box(g, '#3a3530', 9.5, -1, 11, 5, 2);
    },
  },
  keys: {
    w: 15, h: 13, draw(g) {
      box(g, '#8a6a48', 0.5, 0.5, 14, 6, 1);
      write(g, 'CLÉS', 7.5, 3.5, 2.6, '#f0e2c8', MARKER);
      for (const [x, has] of [[3, true], [7.5, false], [12, true]] as const) {
        disc(g, '#c9a24a', x, 7.5, 0.5);
        if (!has) continue;
        g.strokeStyle = '#b0b4b8'; g.lineWidth = 0.6; g.beginPath(); g.arc(x, 9, 1.4, 0, 7); g.stroke();
        stroke(g, '#b0b4b8', 0.8, [x, 10.4, x, 12.6, x + 1, 12.6]);
      }
    },
  },
  umbrella: {
    w: 8, h: 50, draw(g) {
      g.strokeStyle = '#3a2a1e'; g.lineWidth = 1; g.beginPath(); g.arc(4, 4, 2.4, Math.PI, 0); g.stroke();
      stroke(g, '#3a2a1e', 1, [6.4, 4, 6.4, 10]);
      fill(g, '#2d3a4a', [6.4, 10, 8, 16, 7.4, 44, 6.4, 49, 5.4, 44, 4.8, 16]);
    },
  },
  'umbrella-stand': {
    w: 14, h: 34, ground: true, draw(g) {
      box(g, '#5a6a5a', 1, 18, 12, 16, 1.5);
      stroke(g, '#2d3a4a', 1.4, [5, 18, 4, 2]); g.strokeStyle = '#3a2a1e'; g.lineWidth = 0.8; g.beginPath(); g.arc(6, 2, 2, Math.PI, 0); g.stroke();
      stroke(g, '#7a3a3a', 1.4, [9, 18, 10, 5]);
    },
  },
  boots: {
    w: 22, h: 18, ground: true, draw(g) {
      for (const x of [1, 11.5]) {
        fill(g, '#3f5a3a', [x, 1, x + 6, 1, x + 6, 13, x + 9.5, 14.5, x + 9.5, 17.5, x, 17.5]);
        box(g, '#2c4028', x - 0.3, 0.5, 6.6, 1.6, 0.4);
      }
    },
  },
  // La penderie
  clothes: {
    w: 56, h: 52, draw(g, w, h, v, r) {
      box(g, '#8a6a48', 0, 1, 56, 1.6, 0.8);
      const colors = ['#7a7f8a', '#8a6e5a', '#6a7a6a', '#9a8a9e', '#5a5a6a', '#a8987a'];
      for (let i = 0; i < 4; i++) {
        const x = 8 + i * 13 + (r() - 0.5) * 3, c = colors[Math.floor(r() * colors.length)], long = r() < 0.5;
        stroke(g, '#c9a24a', 0.4, [x, 1.8, x, 4]);
        stroke(g, '#c9a24a', 0.5, [x - 5, 6.5, x, 4, x + 5, 6.5]);
        fill(g, c, [x - 5, 6.5, x + 5, 6.5, x + 6.5, long ? 48 : 30, x - 6.5, long ? 48 : 30]);
        stroke(g, 'rgba(0,0,0,0.15)', 0.4, [x, 6.5, x, long ? 48 : 30]);
      }
    },
  },
  'tie-rack': {
    w: 26, h: 30, draw(g, w, h, v, r) {
      box(g, '#6a4a30', 0, 0, 26, 2.2, 1);
      ['#7a3a3a', '#3a4a6a', '#6a6a3a', '#5a3a5a', '#3a5a4a'].forEach((c, i) => {
        const x = 3 + i * 5, l = 20 + r() * 7;
        fill(g, c, [x - 1, 2, x + 1, 2, x + 1.8, l, x, l + 2, x - 1.8, l]);
      });
    },
  },
  lavender: {
    w: 10, h: 26, draw(g, w, h, v, r) {
      for (let i = 0; i < 9; i++) {
        const x = 5 + (r() - 0.5) * 5;
        stroke(g, '#7a8a5a', 0.3, [5, 3, x, 15]);
        for (let j = 0; j < 5; j++) disc(g, '#8e7ab0', x + (r() - 0.5) * 0.8, 15 + j * 1.8, 0.7, 0.9);
      }
      box(g, '#b07aa0', 3.5, 3, 3, 2, 0.5);
      nail(g, 5, 1);
    },
  },
  carton: {
    w: 30, h: 24, ground: true, draw(g, w, h, v) {
      box(g, '#b8925e', 0, 2, 30, 22, 0.4);
      fill(g, '#a8824e', [0, 2, 12, 2, 9, 0, -1, 0]); fill(g, '#a8824e', [30, 2, 18, 2, 21, 0, 31, 0]);
      box(g, '#c8a878', 13, 2, 4, 22);
      box(g, '#f2ead8', 5, 9, 20, 8, 0.4);
      write(g, v || 'DIVERS', 15, 13.2, v.length > 9 ? 2.4 : 3.4, '#2a2a3a', MARKER);
    },
  },
  hatbox: {
    w: 22, h: 16, ground: true, draw(g) {
      box(g, '#c8a8a0', 1, 4, 20, 12, 1);
      box(g, '#b89890', 0, 2, 22, 4, 1);
      box(g, '#8a4a5a', 10, 2, 2, 14);
    },
  },
  // La chambre des petits
  drawing: {
    w: 22, h: 16, draw(g, w, h, v, r) {
      g.save(); g.translate(11, 8); g.rotate((r() - 0.5) * 0.12); g.translate(-11, -8);
      box(g, '#fbfaf6', 1, 1, 20, 14);
      box(g, 'rgba(220,210,170,0.7)', 0, 0, 4, 2); box(g, 'rgba(220,210,170,0.7)', 18, 0, 4, 2);
      const sun = () => { crayon(g, '#f2b630', [3, 4, 4.4, 2.6, 5.8, 4, 4.4, 5.4], r, true); for (let a = 0; a < 6; a++) crayon(g, '#f2b630', [4.4 + Math.cos(a) * 2, 4 + Math.sin(a) * 2, 4.4 + Math.cos(a) * 3, 4 + Math.sin(a) * 3], r); };
      const stick = (x: number, s: number, c: string, dress = false) => {
        crayon(g, c, [x, 8 - 2 * s, x + 1 * s, 7 - 2 * s, x, 6 - 2 * s, x - 1 * s, 7 - 2 * s], r, true);
        crayon(g, c, [x, 8 - 2 * s, x, 12], r);
        if (dress) crayon(g, c, [x, 9, x - 2, 12, x + 2, 12, x, 9], r);
        crayon(g, c, [x - 2, 10, x, 9.2, x + 2, 10], r);
        crayon(g, c, [x - 1.4, 14, x, 12, x + 1.4, 14], r);
      };
      sun();
      crayon(g, '#5ab04a', [1.5, 14.4, 20.5, 14.2], r);
      if (v === 'papi') { stick(9, 1.4, '#3a5ab0'); stick(14, 0.8, '#d04a4a'); write(g, 'POUR PAPI', 15, 3.4, 2.4, '#d04a4a', MARKER); crayon(g, '#3a5ab0', [7.4, 3.6, 10.6, 3.6], r); }
      else if (v === 'mamie') { stick(9, 1.3, '#a04ab0', true); stick(14, 0.8, '#d04a4a'); write(g, 'MAMIE ET MOI', 14, 3.4, 2.1, '#a04ab0', MARKER); for (const x of [17, 19]) crayon(g, '#e05a8a', [x, 13, x, 11], r); }
      else if (v === 'boat') { crayon(g, '#3a7ad0', [2, 12, 5, 11, 8, 12, 11, 11, 14, 12, 17, 11, 20, 12], r); crayon(g, '#a0602a', [7, 11, 15, 11, 14, 9, 8, 9], r, true); crayon(g, '#d04a4a', [11, 9, 11, 4, 15, 8], r, true); }
      else { crayon(g, '#c0502a', [8, 13.5, 8, 9, 11, 6.5, 14, 9, 14, 13.5], r); crayon(g, '#c0502a', [10, 13.5, 10, 11, 12, 11, 12, 13.5], r); }
      g.restore();
    },
  },
  teddy: {
    w: 14, h: 16, ground: true, draw(g) {
      disc(g, '#a8784a', 7, 11, 5, 5);
      disc(g, '#a8784a', 7, 5, 3.6);
      disc(g, '#a8784a', 4, 2.2, 1.4); disc(g, '#a8784a', 10, 2.2, 1.4);
      disc(g, '#d8b890', 7, 6, 1.6, 1.2);
      disc(g, '#2a2018', 5.8, 4.4, 0.4); disc(g, '#2a2018', 8.2, 4.4, 0.4); disc(g, '#2a2018', 7, 5.6, 0.5);
      disc(g, '#a8784a', 3, 15, 2, 1.4); disc(g, '#a8784a', 11, 15, 2, 1.4);
      box(g, '#c04a4a', 5, 8.6, 4, 1, 0.4);
    },
  },
  pennants: {
    w: 60, h: 12, draw(g) {
      curve(g, '#8a7a6a', 0.3, 0, 1, 30, 6, 60, 1);
      ['#e07a6a', '#f2c14e', '#6ab0d8', '#8ac07a', '#c08ad8', '#e07a6a', '#f2c14e'].forEach((c, i) => {
        const x = 5 + i * 8.3, y = 1 + 5 * (1 - ((x - 30) / 30) ** 2) * 0.9;
        fill(g, c, [x - 3, y, x + 3, y, x, y + 7]);
      });
    },
  },
  blocks: {
    w: 16, h: 16, ground: true, draw(g) {
      const b = (x: number, y: number, c: string, s: string) => { box(g, c, x, y, 7, 7, 0.6); write(g, s, x + 3.5, y + 3.8, 4.4, '#fff', MARKER); };
      b(1, 9, '#d8604a', 'A'); b(8.2, 9, '#4a8ad8', 'B'); b(4.6, 1.8, '#5ab05a', 'C');
    },
  },
  rocking: {
    w: 40, h: 32, ground: true, draw(g) {
      curve(g, '#7a4a2a', 1.4, 2, 26, 20, 34, 38, 26);
      stroke(g, '#8a5a3a', 1.2, [10, 28.5, 12, 18]); stroke(g, '#8a5a3a', 1.2, [30, 28.5, 27, 18]);
      fill(g, '#e8dcc8', [9, 18, 29, 18, 31, 12, 12, 12]);
      fill(g, '#e8dcc8', [27, 13, 31, 4, 37, 6, 35, 9, 31, 10, 30, 14]);
      for (let i = 0; i < 5; i++) stroke(g, '#8a5a3a', 0.8, [29 + i * 0.6, 4 - i * 0.1, 26 + i, 9 + i]);
      fill(g, '#c04a4a', [16, 12, 24, 12, 23, 9.5, 17, 9.5]);
      disc(g, '#2a2018', 34, 6.4, 0.5);
    },
  },
  // L'atelier
  knitting: {
    w: 30, h: 32, draw(g) {
      // the needles still in it, the row left half done
      stroke(g, '#c8b080', 0.7, [3, 4, 25, 12]); stroke(g, '#c8b080', 0.7, [27, 4, 6, 13]);
      disc(g, '#c8b080', 3, 4, 0.9); disc(g, '#c8b080', 27, 4, 0.9);
      box(g, '#a8323a', 7, 8, 16, 14, 0.4);
      for (let y = 9; y < 22; y += 1.6) for (let x = 7.6; x < 23; x += 1.8) stroke(g, '#8a2830', 0.25, [x, y, x + 0.9, y + 1.2, x + 1.8, y]);
      box(g, '#a8323a', 7, 6.5, 8, 2, 0.4);
      curve(g, '#a8323a', 0.35, 22, 22, 24, 27, 20, 28);
      disc(g, '#a8323a', 18, 28.5, 3.5, 3.2);
      stroke(g, '#8a2830', 0.3, [15.5, 27, 20.5, 30]); stroke(g, '#8a2830', 0.3, [15.2, 29, 19.5, 31.4]);
    },
  },
  calendar: {
    w: 18, h: 26, draw(g) {
      nail(g, 9, 1);
      box(g, '#f6f1e6', 0.5, 2, 17, 23.5, 0.3);
      box(g, '#b8484a', 0.5, 2, 17, 5);
      write(g, 'MARS', 9, 4.6, 3, '#fff', MARKER);
      write(g, '2009', 9, 8.6, 1.6, '#7a6a5a', MARKER);
      // the days crossed off, one by one; then not any more
      for (let d = 1; d <= 31; d++) {
        const c = (d + 5) % 7, row = Math.floor((d + 5) / 7), x = 2 + c * 2.15, y = 11.5 + row * 2.6;
        write(g, String(d), x + 0.6, y, 1.2, '#5a4a3a', 'sans-serif');
        if (d < 14) stroke(g, '#c0504a', 0.25, [x - 0.3, y - 0.8, x + 1.5, y + 0.8, x + 0.6, y, x + 1.5, y - 0.8, x - 0.3, y + 0.8]);
      }
    },
  },
  scissors: {
    w: 12, h: 26, draw(g) {
      nail(g, 6, 1);
      g.strokeStyle = '#3a3a40'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(3.5, 5, 2.4, 3.4, 0, 0, 7); g.stroke();
      g.beginPath(); g.ellipse(8.5, 5, 2.4, 3.4, 0, 0, 7); g.stroke();
      fill(g, '#9aa0a8', [4.5, 8, 6, 9, 7.8, 25, 6.6, 25.5]);
      fill(g, '#b8bec6', [7.5, 8, 6, 9, 4.2, 25, 5.4, 25.5]);
      disc(g, '#3a3a40', 6, 10.5, 0.6);
    },
  },
  spools: {
    w: 30, h: 22, draw(g, w, h, v, r) {
      box(g, '#8a6a48', 0, 20, 30, 2); box(g, '#8a6a48', 0, 9.5, 30, 1.6);
      const colors = ['#a8323a', '#3a6a9a', '#d8b040', '#4a8a5a', '#8a4a8a', '#e8e0d0', '#2a2a30'];
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
        const x = 3 + i * 7, y = row ? 12 : 1.5;
        box(g, '#c8a878', x, y, 5, 1.2); box(g, '#c8a878', x, y + 6.8, 5, 1.2);
        box(g, colors[Math.floor(r() * colors.length)], x + 0.6, y + 1.2, 3.8, 5.6);
      }
    },
  },
  tape: {
    w: 6, h: 52, draw(g) {
      nail(g, 3, 1);
      curve(g, '#e8c84a', 2, 3, 1.5, 0, 6, 3, 10);
      box(g, '#e8c84a', 2, 10, 2, 41);
      for (let y = 11; y < 51; y += 1) stroke(g, '#3a3020', 0.12, [2, y, (y % 5 ? 2.6 : 3.2), y]);
    },
  },
  pattern: {
    w: 24, h: 30, draw(g) {
      box(g, '#efe2c4', 0, 0, 24, 30, 0.2);
      g.setLineDash([0.8, 0.6]);
      stroke(g, '#5a4a6a', 0.25, [6, 3, 18, 3, 21, 9, 19, 27, 5, 27, 3, 9], true);
      g.setLineDash([]);
      write(g, 'Manche', 12, 13, 2.6, '#5a4a6a'); write(g, '× 2', 12, 17, 2.2, '#5a4a6a');
      disc(g, '#c0504a', 12, 1.5, 0.7); stroke(g, '#9aa0a8', 0.2, [12, 1.5, 14, 6]);
    },
  },
  sewing: {
    w: 32, h: 22, ground: true, draw(g) {
      box(g, '#2a2a2e', 2, 18, 28, 4, 0.6);
      box(g, '#2a2a2e', 4, 4, 6, 14, 1);
      box(g, '#2a2a2e', 4, 3, 24, 5, 2);
      box(g, '#2a2a2e', 24, 3, 4, 11, 1);
      write(g, 'Singer', 14, 5.6, 2, '#c9a24a');
      // under a cloth, half covered
      fill(g, '#d8cfc0', [12, 2, 30, 2, 31, 21, 26, 22, 20, 20.5, 14, 22]);
      for (const x of [17, 23, 28]) stroke(g, 'rgba(130,120,110,0.4)', 0.35, [x, 3, x + 0.8, 20]);
    },
  },
  basket: {
    w: 24, h: 16, ground: true, draw(g, w, h, v, r) {
      for (let i = 0; i < 4; i++) disc(g, ['#a8323a', '#e8e0d0', '#5a7aa8', '#d8a040'][i], 5 + i * 4.6, 6 + r(), 3.2);
      box(g, '#b8925a', 1, 7, 22, 9, 1.4);
      for (let x = 2; x < 23; x += 2) stroke(g, '#8a6a3a', 0.25, [x, 7, x, 16]);
      for (let y = 9; y < 16; y += 2) stroke(g, '#8a6a3a', 0.25, [1, y, 23, y]);
    },
  },
  // La buanderie
  laundry: {
    w: 70, h: 34, draw(g) {
      curve(g, '#d8d4c8', 0.35, 0, 2, 35, 5, 70, 2);
      const peg = (x: number, y: number) => box(g, '#c8a878', x - 0.5, y - 1.5, 1, 3, 0.3);
      // a shirt
      fill(g, '#f2efe8', [6, 3.6, 18, 3.6, 22, 8, 20, 10, 18, 8.5, 18, 26, 6, 26, 6, 8.5, 4, 10, 2, 8]);
      stroke(g, '#d8d2c6', 0.3, [12, 3.6, 12, 26]); peg(7, 3.5); peg(17, 3.6);
      // a dress, faded flowers
      fill(g, '#7a9ac8', [28, 4.4, 38, 4.4, 37, 10, 42, 31, 24, 31, 29, 10]);
      for (const [x, y] of [[31, 14], [35, 20], [30, 25], [37, 27], [33, 9]]) disc(g, '#f0e6e0', x, y, 0.8);
      peg(29, 4.3); peg(37, 4.4);
      // a child's shirt
      fill(g, '#f2c14e', [48, 4.3, 56, 4.2, 58, 7, 56, 8, 56, 17, 48, 17, 48, 8, 46, 7]);
      peg(49, 4.3); peg(55, 4.2);
      // a pair of socks
      fill(g, '#5a6a8a', [62, 3.2, 64, 3.1, 64, 10, 66, 12, 64, 13, 62, 11]);
      fill(g, '#5a6a8a', [66, 2.6, 68, 2.4, 68, 9, 70, 11, 68, 12, 66, 10]);
    },
  },
  sock: {
    w: 9, h: 16, draw(g) {
      stroke(g, '#d8d4c8', 0.3, [0, 1.5, 9, 1.5]);
      box(g, '#c8a878', 3.5, 0, 1.2, 3, 0.3);
      fill(g, '#a8323a', [2.5, 2, 6, 2, 6, 11, 8.5, 13, 7, 15.5, 2.5, 13]);
      box(g, '#e8e0d0', 2.5, 2, 3.5, 1.6);
    },
  },
  'shelf-jars': {
    w: 34, h: 18, draw(g) {
      box(g, '#a89878', 0, 15.5, 34, 2);
      box(g, '#e8f0f2', 2, 7, 7, 8.5, 1); box(g, '#5a8ac8', 2, 9, 7, 3); write(g, 'Savon', 5.5, 10.6, 1.6, '#fff', MARKER);
      box(g, '#c8d8b0', 12, 3, 5, 12.5, 1.5); box(g, '#f2f2f2', 13, 1.5, 3, 2, 0.4);
      box(g, 'rgba(200,220,230,0.7)', 20, 8, 10, 7.5, 1);
      for (let i = 0; i < 5; i++) box(g, '#c8a878', 21 + i * 1.7, 9.5, 1, 4, 0.3);
    },
  },
  washer: {
    w: 30, h: 34, ground: true, draw(g) {
      box(g, '#eceef0', 1, 1, 28, 33, 1.5);
      box(g, '#d8dcdf', 1, 1, 28, 6, 1.5);
      disc(g, '#b8bcc0', 23, 4, 1.6); box(g, '#8ab0c8', 4, 3, 8, 2, 0.5);
      disc(g, '#a8acb0', 15, 20, 9.5); disc(g, '#cfe0ea', 15, 20, 7.5);
      disc(g, 'rgba(255,255,255,0.5)', 12, 17, 2.5, 1.6);
    },
  },
  // Le salon
  clock: {
    w: 22, h: 76, ground: true, draw(g) {
      box(g, '#5a3420', 2, 18, 18, 56, 1);
      box(g, '#5a3420', 0, 2, 22, 18, 3);
      box(g, '#4a2a18', 0, 72, 22, 4, 0.5);
      disc(g, '#f2ead8', 11, 11, 7.4);
      g.strokeStyle = '#c9a24a'; g.lineWidth = 0.6; g.beginPath(); g.arc(11, 11, 7.4, 0, 7); g.stroke();
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; stroke(g, '#3a3020', 0.3, [11 + Math.sin(a) * 6, 11 - Math.cos(a) * 6, 11 + Math.sin(a) * 6.8, 11 - Math.cos(a) * 6.8]); }
      // stopped: ten past four
      stroke(g, '#2a2018', 0.6, [11, 11, 11 + Math.sin(4.08 / 12 * 6.283) * 3.8, 11 - Math.cos(4.08 / 12 * 6.283) * 3.8]);
      stroke(g, '#2a2018', 0.4, [11, 11, 11 + Math.sin(10 / 60 * 6.283) * 5.6, 11 - Math.cos(10 / 60 * 6.283) * 5.6]);
      box(g, '#3a2214', 6, 24, 10, 40, 1);
      stroke(g, '#c9a24a', 0.4, [11, 25, 11, 56]); disc(g, '#c9a24a', 11, 58, 2.6);
    },
  },
  glasses: {
    w: 18, h: 6, ground: true, draw(g) {
      fill(g, '#f2ead8', [0, 5.6, 9, 4.6, 18, 5.6, 17.4, 2.4, 9, 1.6, 0.6, 2.4]);
      fill(g, '#7a3a3a', [0, 6, 18, 6, 18, 5.4, 9, 4.6, 0, 5.4]);
      stroke(g, '#b8a888', 0.2, [9, 1.6, 9, 4.6]);
      g.strokeStyle = '#3a3020'; g.lineWidth = 0.35;
      for (const x of [6, 11.5]) { g.beginPath(); g.ellipse(x, 1.4, 2, 1.2, 0, 0, 7); g.stroke(); }
      stroke(g, '#3a3020', 0.35, [8, 1.3, 9.5, 1.3]);
    },
  },
  pale: {
    w: 20, h: 26, draw(g) {
      // where a picture hung: the paper, not faded there, and the nail
      box(g, 'rgba(255, 252, 240, 0.28)', 1, 2, 18, 23, 0.3);
      g.strokeStyle = 'rgba(90, 70, 50, 0.18)'; g.lineWidth = 0.4; rr(g, 1, 2, 18, 23, 0.3); g.stroke();
      nail(g, 10, 1);
    },
  },
  books: {
    w: 50, h: 30, draw(g, w, h, v, r) {
      for (const y of [14, 29]) box(g, '#6e4528', 0, y, 50, 1.6);
      for (const y0 of [14, 29]) {
        let x = 1;
        while (x < 47) {
          const bw = 1.6 + r() * 2.4, bh = 9 + r() * 4, c = ['#7a3a3a', '#3a4a6a', '#5a6a3a', '#8a6a3a', '#4a3a5a', '#c8b898', '#2a3a3a'][Math.floor(r() * 7)];
          if (r() < 0.08) { x += 3; continue; }
          box(g, c, x, y0 - bh, bw, bh, 0.2);
          stroke(g, '#c9a24a', 0.2, [x + 0.3, y0 - bh + 1.5, x + bw - 0.3, y0 - bh + 1.5]);
          x += bw + 0.15;
        }
      }
    },
  },
  armchair: {
    w: 42, h: 36, ground: true, draw(g) {
      // under a white sheet
      fill(g, '#efebe2', [4, 36, 3, 18, 5, 12, 8, 4, 21, 1, 34, 4, 37, 12, 39, 18, 38, 36]);
      fill(g, '#e2ddd2', [1, 36, 0, 20, 4, 17, 9, 22, 9, 36]); fill(g, '#e2ddd2', [33, 36, 33, 22, 38, 17, 42, 20, 41, 36]);
      for (const x of [14, 21, 28]) stroke(g, 'rgba(150,140,125,0.45)', 0.4, [x, 4, x - 1, 20, x + 1, 35]);
    },
  },
  radio: {
    w: 24, h: 18, ground: true, draw(g) {
      box(g, '#7a4a2a', 0, 2, 24, 16, 3);
      box(g, '#d8c8a0', 2.5, 5, 12, 10, 1);
      for (let x = 4; x < 14; x += 1.4) stroke(g, '#8a7a5a', 0.3, [x, 6, x, 14]);
      disc(g, '#3a2a1a', 19, 7.5, 2); disc(g, '#3a2a1a', 19, 13, 2);
    },
  },
  // La chambre
  bed: {
    w: 72, h: 34, ground: true, draw(g) {
      box(g, '#6e4a32', 0, 2, 4, 32, 1); box(g, '#6e4a32', 0, 2, 26, 4, 2);
      box(g, '#6e4a32', 68, 16, 4, 18, 1);
      box(g, '#f2ece2', 3, 16, 66, 10, 1.5);
      box(g, '#8a9ab0', 26, 17, 43, 9, 1);
      box(g, '#7a8aa0', 56, 17, 13, 9, 1);
      // the two pillows, side by side, smooth
      for (const x of [5, 15]) box(g, '#fbf8f2', x, 11, 9.5, 6, 3);
      box(g, '#5a3c28', 3, 26, 66, 3, 0.5);
      box(g, '#5a3c28', 4, 29, 3, 5); box(g, '#5a3c28', 65, 29, 3, 5);
    },
  },
  nightstand: {
    w: 20, h: 30, ground: true, draw(g) {
      box(g, '#6e4a32', 1, 14, 18, 16, 0.8);
      box(g, '#5a3c28', 2.5, 17, 15, 5, 0.5); disc(g, '#c9a24a', 10, 19.5, 0.6);
      box(g, '#c9a24a', 4, 12, 3, 2); stroke(g, '#3a3020', 0.4, [5.5, 12, 5.5, 5]);
      fill(g, '#efe2c4', [2, 6, 9, 6, 8, 1, 3, 1]);
      box(g, 'rgba(210,230,240,0.8)', 11, 9, 3, 5, 0.4);
      box(g, '#3a2a1c', 15, 9.5, 3.4, 4.5, 0.2); box(g, '#d8c3a0', 15.6, 10.1, 2.2, 3.3);
    },
  },
  slippers: {
    w: 20, h: 6, ground: true, draw(g) {
      for (const x of [1, 10.5]) {
        fill(g, '#7a3a44', [x, 6, x, 3.6, x + 2, 2, x + 6, 1.6, x + 8.5, 3.4, x + 8.5, 6]);
        box(g, '#5a2a34', x, 5.2, 8.6, 0.8, 0.3);
      }
    },
  },
  flowers: {
    w: 14, h: 28, ground: true, draw(g, w, h, v, r) {
      for (let i = 0; i < 6; i++) {
        const x = 7 + (r() - 0.5) * 10, y = 3 + r() * 6;
        curve(g, '#5a8a4a', 0.4, 7, 18, 7 + (x - 7) * 0.3, 12, x, y);
        disc(g, ['#e8a0b0', '#f2e6c0', '#d06a6a'][i % 3], x, y, 1.6, 2);
      }
      fill(g, '#9ab8c0', [4, 18, 10, 18, 11, 28, 3, 28]);
      disc(g, 'rgba(255,255,255,0.4)', 5.5, 22, 0.6, 2.5);
    },
  },
  robe: {
    w: 24, h: 50, draw(g) {
      disc(g, '#c9a24a', 12, 2, 1);
      fill(g, '#8a6a8a', [9, 3, 15, 3, 20, 10, 22, 48, 2, 48, 4, 10]);
      fill(g, '#7a5a7a', [9, 3, 12, 14, 9, 22, 7, 10]);
      box(g, '#6a4a6a', 3.5, 24, 17, 2, 0.6);
      stroke(g, '#6a4a6a', 0.6, [12, 26, 10, 33]); stroke(g, '#6a4a6a', 0.6, [12, 26, 14, 34]);
    },
  },
  // Le grenier
  cartons: {
    w: 50, h: 44, ground: true, draw(g) {
      const c = (x: number, y: number, w: number, h: number, s: string, size = 2.6) => {
        box(g, '#b8925e', x, y, w, h, 0.4); box(g, '#c8a878', x + w / 2 - 2, y, 4, h);
        box(g, '#f2ead8', x + 3, y + h / 2 - 3, w - 6, 6, 0.3); write(g, s, x + w / 2, y + h / 2 + 0.2, size, '#2a2a3a', MARKER);
      };
      c(0, 22, 28, 22, 'PHOTOS 62–80'); c(27, 26, 23, 18, 'JOUETS', 3); c(4, 2, 25, 20, 'LETTRES DE JEANNE', 1.9);
    },
  },
  dress: {
    w: 30, h: 66, draw(g) {
      stroke(g, '#9aa0a8', 0.5, [15, 1, 15, 4]); stroke(g, '#9aa0a8', 0.6, [9, 7, 15, 4, 21, 7]);
      fill(g, '#f8f4ec', [11, 7, 19, 7, 18, 20, 26, 60, 4, 60, 12, 20]);
      for (const x of [10, 15, 20]) stroke(g, 'rgba(200,190,170,0.6)', 0.3, [15, 22, x - 1, 59]);
      // the cover it is kept in
      g.fillStyle = 'rgba(220, 230, 240, 0.35)'; rr(g, 3, 5, 24, 60, 3); g.fill();
      stroke(g, 'rgba(255,255,255,0.6)', 0.3, [5, 8, 5, 62]);
    },
  },
  suitcase: {
    w: 34, h: 22, ground: true, draw(g) {
      box(g, '#8a5a3a', 0, 4, 34, 18, 1.5);
      box(g, '#5a3a24', 13, 1, 8, 4, 1.5); box(g, '#8a5a3a', 14.5, 2.2, 5, 2, 0.6);
      for (const x of [7, 25]) box(g, '#5a3a24', x, 4, 2, 18);
      box(g, '#e8c84a', 10, 9, 7, 5, 0.6); write(g, 'NICE', 13.5, 11.6, 1.8, '#3a3a6a', MARKER);
      disc(g, '#d86a5a', 24, 15, 3); write(g, 'ROMA', 24, 15.2, 1.5, '#fff', MARKER);
    },
  },
  cobweb: {
    w: 26, h: 26, soft: true, draw(g) {
      const o = [0, 0];
      g.strokeStyle = 'rgba(235, 230, 220, 0.55)'; g.lineWidth = 0.15;
      for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI / 2; path(g, [o[0], o[1], 26 * Math.cos(a), 26 * Math.sin(a)]); g.stroke(); }
      for (let rad = 4; rad < 26; rad += 3.5) {
        g.beginPath();
        for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI / 2, rr2 = rad * (k % 2 ? 0.92 : 1); k ? g.lineTo(rr2 * Math.cos(a), rr2 * Math.sin(a)) : g.moveTo(rr2, 0); }
        g.stroke();
      }
    },
  },
  stain: {
    w: 30, h: 36, soft: true, draw(g, w, h, v, r) {
      for (let i = 0; i < 4; i++) {
        const x = 15 + (r() - 0.5) * 10, y = 14 + i * 5, gr = g.createRadialGradient(x, y, 0, x, y, 9);
        gr.addColorStop(0, 'rgba(110, 80, 45, 0.22)'); gr.addColorStop(1, 'rgba(110, 80, 45, 0)');
        g.fillStyle = gr; g.fillRect(0, 0, 30, 36);
      }
    },
  },
  // Le toit, le ciel
  antenna: {
    w: 40, h: 60, draw(g) {
      stroke(g, '#5a5a62', 0.8, [20, 60, 20, 6]);
      for (let i = 0; i < 6; i++) stroke(g, '#5a5a62', 0.5, [20 - 14 + i * 1.6, 8 + i * 3, 20 + 14 - i * 1.6, 8 + i * 3]);
      stroke(g, '#5a5a62', 0.6, [6, 8, 34, 8]);
      curve(g, '#3a3a40', 0.3, 20, 30, 34, 42, 38, 60);
    },
  },
  moon: {
    w: 30, h: 30, glow: true, soft: true, draw(g) {
      const gr = g.createRadialGradient(15, 15, 4, 15, 15, 15);
      gr.addColorStop(0, 'rgba(255, 245, 210, 0.35)'); gr.addColorStop(1, 'rgba(255, 245, 210, 0)');
      g.fillStyle = gr; g.fillRect(0, 0, 30, 30);
      disc(g, '#fff4d0', 15, 15, 8);
      g.globalCompositeOperation = 'destination-out'; disc(g, '#000', 19, 12.5, 7.4); g.globalCompositeOperation = 'source-over';
    },
  },
  balloon: {
    w: 14, h: 54, glow: false, draw(g, w, h, v, r) {
      disc(g, ['#c8505a', '#e0b040', '#6a9ad0', '#e8e0d0'][Math.floor(r() * 4)], 7, 8, 6, 7.5);
      disc(g, 'rgba(255,255,255,0.35)', 4.8, 5.4, 1.4, 2.2);
      fill(g, '#a84048', [6, 15.3, 8, 15.3, 7, 16.6]);
      // its string, a loose end
      g.strokeStyle = '#d8d0c0'; g.lineWidth = 0.2; g.beginPath(); g.moveTo(7, 16.6);
      for (let y = 17; y < 54; y += 2) g.lineTo(7 + Math.sin(y * 0.35) * 1.5, y);
      g.stroke();
    },
  },
  kite: {
    w: 36, h: 90, draw(g) {
      fill(g, '#d8604a', [18, 1, 33, 14, 18, 36, 3, 14]);
      fill(g, '#f2c14e', [18, 1, 33, 14, 18, 14]); fill(g, '#f2c14e', [18, 14, 18, 36, 3, 14]);
      stroke(g, '#5a4030', 0.4, [18, 1, 18, 36]); stroke(g, '#5a4030', 0.4, [3, 14, 33, 14]);
      g.strokeStyle = '#d8d0c0'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(18, 36);
      for (let y = 36; y < 90; y += 2) g.lineTo(18 + Math.sin(y * 0.18) * 5, y);
      g.stroke();
      for (const y of [46, 58, 70]) { const x = 18 + Math.sin(y * 0.18) * 5; fill(g, '#6a9ad0', [x - 2.4, y - 1.4, x + 2.4, y + 1.4, x + 2.4, y - 1.4, x - 2.4, y + 1.4]); }
    },
  },
  cloud: {
    w: 70, h: 30, soft: true, glow: true, draw(g, w, h, v, r) {
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
  bird: {
    w: 8, h: 4, draw(g) { stroke(g, '#2a2a38', 0.6, [0.5, 1, 2.5, 1.2, 4, 2.6, 5.5, 1.2, 7.5, 1]); },
  },
  spider: {
    w: 6, h: 6, draw(g) {
      for (let k = 0; k < 4; k++) for (const s of [-1, 1]) stroke(g, '#1e1a18', 0.25, [3, 3.2, 3 + s * 1.6, 1.8 + k * 0.9, 3 + s * 2.8, 2.4 + k * 1.1]);
      disc(g, '#1e1a18', 3, 3.4, 1.1, 1.3); disc(g, '#1e1a18', 3, 2, 0.6);
    },
  },
  // the memories (rare rooms)
  postcard: {
    w: 20, h: 14, draw(g) {
      g.save(); g.translate(10, 7); g.rotate(-0.06); g.translate(-10, -7);
      box(g, '#fbf6ea', 0.5, 0.5, 19, 13);
      box(g, '#7fb8e8', 1.5, 1.5, 11, 6); box(g, '#4a8ab8', 1.5, 7.5, 11, 2.5); box(g, '#ecd8a8', 1.5, 10, 11, 2.5);
      write(g, 'Biarritz, été 71', 7, 4, 1.4, '#fff');
      box(g, '#c8505a', 15, 1.8, 3, 3.4); stroke(g, '#8a7a6a', 0.12, [13.6, 7, 18.4, 7]); stroke(g, '#8a7a6a', 0.12, [13.6, 9, 18.4, 9]);
      write(g, 'Je t\'embrasse', 16, 11, 1.2, '#3a4a8a');
      g.restore();
    },
  },
  shell: {
    w: 10, h: 7, ground: true, draw(g) {
      fill(g, '#f0d8c8', [1, 7, 9, 7, 9.5, 4, 5, 0.5, 0.5, 4]);
      for (let k = 0; k < 5; k++) stroke(g, '#d0a898', 0.25, [5, 6.8, 1.5 + k * 1.8, 2 + Math.abs(k - 2) * 0.8]);
    },
  },
  garland: {
    w: 60, h: 14, draw(g) {
      curve(g, '#4a7a4a', 1.6, 0, 1, 30, 14, 60, 1);
      for (let i = 1; i < 8; i++) { const x = i * 7.5, y = 1 + 9.5 * (1 - ((x - 30) / 30) ** 2); disc(g, ['#c8404a', '#e0b040', '#6a9ad0'][i % 3], x, y + 2.5, 1.5); }
    },
  },
  gramophone: {
    w: 30, h: 34, ground: true, draw(g) {
      box(g, '#6e4528', 0, 24, 22, 10, 1);
      disc(g, '#1e1e22', 11, 24, 9, 1.2);
      stroke(g, '#c9a24a', 0.8, [15, 23.5, 16, 15]);
      fill(g, '#c9a24a', [16, 16, 30, 2, 30, 14, 17, 18]);
      disc(g, '#a88a3a', 30, 8, 1.8, 6);
    },
  },
  notes: {
    w: 24, h: 18, draw(g) {
      write(g, '♪', 4, 13, 5, 'rgba(70, 50, 30, 0.6)', 'serif'); write(g, '♫', 12, 7, 6, 'rgba(70, 50, 30, 0.6)', 'serif'); write(g, '♪', 20, 12, 4, 'rgba(70, 50, 30, 0.5)', 'serif');
    },
  },
  hat: {
    w: 24, h: 12, draw(g) {
      disc(g, '#c9a24a', 12, 1.5, 0.8);
      disc(g, '#e2c88a', 12, 8.5, 11.5, 3);
      box(g, '#e2c88a', 6.5, 2, 11, 7, 3);
      box(g, '#7a9a6a', 6.5, 6, 11, 1.6);
    },
  },
};

/** a note on the wall, in a hand */
const NOTES: Record<string, string[]> = {
  entree: ['Clés chez', 'Mme Roux'],
  atelier: ['Ourlet Léa', 'mardi'],
  buanderie: ['Blanc à 40°', 'pas plus !'],
  chambre: ['Appeler les', 'enfants dim.'],
};
KINDS.note = {
  w: 9, h: 9, draw(g, w, h, v, r) {
    g.save(); g.translate(4.5, 4.5); g.rotate((r() - 0.5) * 0.2); g.translate(-4.5, -4.5);
    box(g, '#f4e48a', 0.3, 0.3, 8.4, 8.4);
    (NOTES[v] ?? ['']).forEach((s, i) => write(g, s, 4.5, 3.2 + i * 2.6, 1.5, '#2a3a6a'));
    g.restore();
  },
};
KINDS.frame = { w: 18, h: 22, draw: (g, w, h, v, r) => photo(g, w, h, v || 'house', r) };

// ---------------------------------------------------------------- painting

const cache = new Map<string, Art>();

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** numbers at random, the same for the same seed */
export function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seeded = (...a: (number | string)[]) => random(hash(a.join('|')));

/** the thing named (« kind:variant »), painted */
export function art(name: string): Art {
  let a = cache.get(name);
  if (a) return a;
  const [kind, v = ''] = name.split(':'), k = KINDS[kind] ?? KINDS.stain;
  const s = Math.min(PX, 1024 / Math.max(k.w, k.h));
  const c = document.createElement('canvas');
  c.width = Math.ceil(k.w * s); c.height = Math.ceil(k.h * s);
  const g = c.getContext('2d')!;
  g.scale(s, s);
  k.draw(g, k.w, k.h, v, seeded(name));
  a = { tex: texture(c), w: k.w / 100, h: k.h / 100, ground: !!k.ground, glow: !!k.glow, soft: !!k.soft };
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
  cache.set(key, { tex: t, w: TILE, h: TILE, ground: false, glow: false, soft: false });
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
  cache.set(key, { tex: t, w: 1, h: 1, ground: false, glow: true, soft: false });
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
  cache.set(key, { tex: t, w: 1, h: 1, ground: false, glow: true, soft: true });
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
