// A few sounds, synthesised: no file to load. The context starts on the
// first click (browsers keep it silent until then).

let ctx: AudioContext | null = null;

export function wake(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { ctx = null; }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 1, delay = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  grip: () => { tone(900, 0.05, 'square', 0.05, 0.5); tone(240, 0.08, 'triangle', 0.08, 0.7); },
  miss: () => tone(160, 0.08, 'sine', 0.04, 0.8),
  slip: () => tone(500, 0.35, 'sawtooth', 0.04, 0.3),
  button: () => { tone(1320, 0.12, 'sine', 0.06); tone(1760, 0.18, 'sine', 0.05, 1, 0.06); },
  save: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.4, 'triangle', 0.06, 1, k * 0.08)),
  /** a new floor: a slow chord, soft */
  floor: () => [262, 330, 392, 523].forEach((f, k) => tone(f, 2.2, 'sine', 0.035, 1, k * 0.18)),
  /** a memory: a few notes of a music box */
  memory: () => [1047, 1319, 1568, 1319, 1175, 1047].forEach((f, k) => tone(f, 0.9, 'sine', 0.025, 1, k * 0.32)),
  win: () => [392, 523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.5, 'triangle', 0.07, 1, k * 0.1)),
};
