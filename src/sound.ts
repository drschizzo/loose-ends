// The sounds, all synthesised: no file to load. The context starts on the
// first click (browsers keep it silent until then).
//
// Three kinds:
//   - a few notes when something happens (a grip, a post, a button...);
//   - the lace itself, heard from what the solver says every frame: a rustle
//     as it slides over a surface (louder the faster), a creak as a grip
//     strains (rising with its load), the air as it swings and falls;
//   - the music of each floor: a slow pad on its own scale, a bass, and a
//     music box that plays more the higher the lace is in the floor.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

/** the lace's own sounds, and the music, once the context runs */
let body: Body | null = null;
let music: Music | null = null;

export function wake(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      body = new Body(ctx, master);
      music = new Music(ctx, master);
    }
  } catch { ctx = null; }
}

/** silence, or not */
export function mute(on: boolean): void {
  muted = on;
  if (ctx && master) master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.05);
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 1, delay = 0, out: AudioNode | null = master): void {
  if (!ctx || !out) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** a short burst of filtered noise: a tap, a swish */
function hiss(freq: number, dur: number, gain: number, q = 1): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise(ctx);
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur);
}

let white: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (white) return white;
  white = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = white.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return white;
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** what an end grips, as it sounds when it takes hold: wood knocks, chrome rings, rubber squeaks, a cord thrums */
export type Touch = 'wood' | 'chrome' | 'rubber' | 'gold' | 'brass' | 'cord';

export const sfx = {
  grip: (on: Touch = 'wood') => {
    if (on === 'rubber') { tone(620, 0.09, 'sine', 0.05, 1.5); hiss(2400, 0.05, 0.03, 3); }
    else if (on === 'gold' || on === 'brass') { tone(1480, 0.35, 'sine', 0.035); tone(2220, 0.25, 'sine', 0.015); }
    else if (on === 'cord') { tone(180, 0.18, 'triangle', 0.06, 0.92); hiss(900, 0.06, 0.03, 2); }
    else { tone(240, 0.08, 'triangle', 0.08, 0.7); hiss(1800, 0.04, 0.05, 2); }
  },
  miss: () => tone(160, 0.08, 'sine', 0.04, 0.8),
  slip: () => tone(500, 0.35, 'sawtooth', 0.035, 0.3),
  /** a button taken: a bright coin of a note, higher with the élan */
  button: (flow = 0) => { tone(1320 * 2 ** (flow / 12), 0.12, 'sine', 0.06); tone(1760 * 2 ** (flow / 12), 0.2, 'sine', 0.05, 1, 0.06); },
  save: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.45, 'triangle', 0.06, 1, k * 0.08)),
  /** a new floor: a slow chord, soft */
  floor: () => [262, 330, 392, 523].forEach((f, k) => tone(f, 2.2, 'sine', 0.035, 1, k * 0.18)),
  /** a memory: a few notes of a music box */
  memory: () => [1047, 1319, 1568, 1319, 1175, 1047].forEach((f, k) => tone(f, 0.9, 'sine', 0.025, 1, k * 0.32)),
  /** the end whipped up: a short swish */
  whip: () => { tone(700, 0.12, 'triangle', 0.03, 2.2); hiss(3000, 0.12, 0.04, 0.7); },
  /** a thread snaps: a dry twang */
  snap: () => { tone(1800, 0.06, 'square', 0.04, 0.3); tone(320, 0.25, 'triangle', 0.05, 0.5, 0.02); },
  /** stuck in a web: a soft, low stretch */
  stick: () => tone(140, 0.4, 'sine', 0.05, 1.4),
  /** caught in a beam: a low, uneasy hum */
  seen: () => { tone(98, 0.9, 'sawtooth', 0.02, 1.02); tone(104, 0.9, 'sawtooth', 0.016, 0.98); },
  /** a lift's catch lets go: a clunk, the pulley whirs */
  lift: () => { tone(110, 0.12, 'square', 0.05, 0.6); tone(600, 0.8, 'triangle', 0.02, 1.6, 0.1); },
  /** a clean catch, at the top of a swing: a chime that climbs with the élan */
  perfect: (flow = 0) => [0, 4, 7].forEach((s, k) => tone(midi(76 + s + flow), 0.5, 'sine', 0.045, 1, k * 0.05)),
  /** the élan lost */
  drop: () => tone(330, 0.4, 'triangle', 0.035, 0.5),
  /** a patch or a second wind used: a breath of air, a lift */
  rescue: () => { hiss(1200, 0.4, 0.04, 0.6); [67, 71, 74].forEach((n, k) => tone(midi(n), 0.4, 'triangle', 0.04, 1, k * 0.07)); },
  /** something bought */
  buy: () => [72, 79, 84].forEach((n, k) => tone(midi(n), 0.25, 'triangle', 0.05, 1, k * 0.06)),
  /** a challenge met */
  win: () => [392, 523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.5, 'triangle', 0.06, 1, k * 0.1)),
  /** the pair, together at last */
  reunion: () => [60, 64, 67, 72, 76, 79, 84].forEach((n, k) => { tone(midi(n), 3.5, 'sine', 0.04, 1, k * 0.35); tone(midi(n + 12), 2.5, 'sine', 0.012, 1, k * 0.35 + 0.1); }),
};

/** what the lace is doing, as the sounds follow it each frame */
export interface Heard {
  /** how fast it slides over surfaces (m/s, summed along it) */
  slide: number;
  /** how hard the hardest-working grip works (× the weight of the lace) */
  strain: number;
  /** how fast the lace moves (m/s) */
  speed: number;
  /** the floor it is on, and how far up that floor (0 to 1) */
  floor: number;
  up: number;
  /** playing, or on the title screen */
  playing: boolean;
}

export function hear(h: Heard, dt: number): void {
  body?.update(h, dt);
  music?.update(h);
}

/** the lace's own sounds: noise and an oscillator, always running, their gains following the solver */
class Body {
  private rustle: GainNode;
  private rustleF: BiquadFilterNode;
  private air: GainNode;
  private airF: BiquadFilterNode;
  private creak: GainNode;
  private creakO: OscillatorNode;
  private t = 0;

  constructor(private c: AudioContext, out: AudioNode) {
    const loop = () => { const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true; s.start(0, Math.random() * 2); return s; };
    this.rustleF = c.createBiquadFilter(); this.rustleF.type = 'bandpass'; this.rustleF.frequency.value = 2200; this.rustleF.Q.value = 0.7;
    this.rustle = c.createGain(); this.rustle.gain.value = 0;
    loop().connect(this.rustleF).connect(this.rustle).connect(out);
    this.airF = c.createBiquadFilter(); this.airF.type = 'lowpass'; this.airF.frequency.value = 500;
    this.air = c.createGain(); this.air.gain.value = 0;
    loop().connect(this.airF).connect(this.air).connect(out);
    this.creakO = c.createOscillator(); this.creakO.type = 'sawtooth'; this.creakO.frequency.value = 62;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 9;
    this.creak = c.createGain(); this.creak.gain.value = 0;
    this.creakO.connect(f).connect(this.creak).connect(out);
    this.creakO.start();
  }

  update(h: Heard, dt: number): void {
    const now = this.c.currentTime, k = 0.06;
    this.t += dt;
    const on = h.playing ? 1 : 0;
    this.rustle.gain.setTargetAtTime(on * Math.min(0.09, h.slide * 0.035), now, k);
    this.rustleF.frequency.setTargetAtTime(1600 + 900 * Math.min(1, h.slide), now, k);
    this.air.gain.setTargetAtTime(on * Math.min(0.08, Math.max(0, h.speed - 0.5) * 0.03), now, 0.1);
    this.airF.frequency.setTargetAtTime(300 + 500 * Math.min(1, h.speed / 3), now, 0.1);
    // a creak that comes in as a grip strains past its rest, wavering as fibres give
    const strain = Math.max(0, h.strain - 0.55);
    this.creak.gain.setTargetAtTime(on * Math.min(0.03, strain * 0.035) * (0.6 + 0.4 * Math.sin(this.t * 23) * Math.sin(this.t * 7)), now, 0.03);
    this.creakO.frequency.setTargetAtTime(55 + 40 * Math.min(1.5, strain), now, 0.1);
  }
}

/**
 * The music of the floors: each its root and its scale. A pad of three
 * notes changes chord every few seconds; a bass under it; a music box over
 * it, its notes coming more often the higher the lace is in its floor.
 */
const SCALES: { root: number; steps: number[] }[] = [
  { root: 60, steps: [0, 2, 4, 7, 9] },        // l'entrée: C pentatonic, warm
  { root: 57, steps: [0, 3, 5, 7, 10] },       // la penderie: A minor
  { root: 65, steps: [0, 2, 4, 5, 7, 9] },     // la chambre des petits: F, a music box
  { root: 62, steps: [0, 2, 3, 5, 7, 9, 10] }, // l'atelier: D dorian
  { root: 64, steps: [0, 3, 5, 7, 10] },       // la buanderie: E minor
  { root: 55, steps: [0, 2, 4, 7, 9] },        // le salon: G
  { root: 58, steps: [0, 2, 4, 6, 7, 9] },     // la chambre: B♭ lydian, dreaming
  { root: 62, steps: [0, 3, 5, 7, 8] },        // le grenier: D minor
  { root: 57, steps: [0, 2, 3, 5, 7, 9] },     // le toit: A dorian
  { root: 52, steps: [0, 3, 7, 10] },          // la nuit: E minor, sparse
  { root: 60, steps: [0, 2, 4, 6, 7, 11] },    // l'aube: C lydian
  { root: 65, steps: [0, 2, 4, 7, 9] },        // les nuages
  { root: 62, steps: [0, 2, 4, 7, 9, 11] },    // le grand ciel
  { root: 56, steps: [0, 3, 5, 7, 10] },       // les étoiles
  { root: 60, steps: [0, 2, 4, 5, 7, 9, 11] }, // le matin
];

class Music {
  private bus: GainNode;
  private next = 0;
  private chord = 0;
  private beat = 0;

  constructor(private c: AudioContext, out: AudioNode) {
    this.bus = c.createGain();
    this.bus.gain.value = 0.55;
    // a long soft echo: the room
    const delay = c.createDelay(1), back = c.createGain(), wet = c.createGain();
    delay.delayTime.value = 0.42; back.gain.value = 0.38; wet.gain.value = 0.3;
    this.bus.connect(out);
    this.bus.connect(delay).connect(back).connect(delay);
    delay.connect(wet).connect(out);
  }

  update(h: Heard): void {
    const now = this.c.currentTime;
    this.bus.gain.setTargetAtTime(h.playing ? 0.55 : 0.3, now, 1);
    if (now < this.next - 0.1) return;
    const sc = SCALES[Math.min(h.floor, SCALES.length - 1)], note = (deg: number, oct = 0) => midi(sc.root + 12 * (oct + Math.floor(deg / sc.steps.length)) + sc.steps[((deg % sc.steps.length) + sc.steps.length) % sc.steps.length]);
    const t = Math.max(now, this.next), beat = 0.75;
    this.beat++;
    // every eight beats, a new chord: the pad and the bass
    if (this.beat % 8 === 1) {
      this.chord = [0, 3, 1, 4, 2][Math.floor(Math.random() * 5)];
      for (const d of [0, 2, 4]) this.pad(note(this.chord + d, -1), t, beat * 8);
      this.pad(note(this.chord, -2), t, beat * 8, 0.05, 'triangle');
    }
    // the music box: the higher in its floor, the more it plays
    if (Math.random() < 0.12 + 0.45 * h.up) this.pluck(note(this.chord + Math.floor(Math.random() * 6), 1), t + (Math.random() < 0.3 ? beat / 2 : 0));
    this.next = t + beat;
  }

  private pad(f: number, t: number, dur: number, gain = 0.022, type: OscillatorType = 'sine'): void {
    const o = this.c.createOscillator(), g = this.c.createGain();
    o.type = type; o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private pluck(f: number, t: number): void {
    for (const [mul, gain] of [[1, 0.028], [2, 0.008], [3, 0.004]]) {
      const o = this.c.createOscillator(), g = this.c.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 / mul);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + 1.5);
    }
  }
}
