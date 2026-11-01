// why drapes on the post fail: for each, the head's highest point while led, then after letting go: turns round the post, speed, height, whether it saved
const g = P.game, w0 = () => g.world;
const near = (x, y) => w0().surfaces.findIndex((s) => s.shape.kind === 'capsule' && Math.hypot(s.shape.ax - x, s.shape.ay - y) < 0.02);
const [hx, hy] = new URLSearchParams(location.search).get('hang').split(',').map(Number);
const L = w0().level, gate = L.gates.find((q) => q.post !== undefined), pb = L.bars[gate.post];
const hold = near(hx, hy), post = near(pb.x, pb.y), px = pb.x, py = pb.y;
P.best(P.moves(0, hold, [{ T: 0.05, ay: 0 }]));
// (from the station: the head holds it, the tail hangs, and goes over the post)
for (let i = 0; i < 60; i++) P.step({ x: hx, y: hy - 0.5, h0: true, h1: false });
const b = P.mark(), lace = () => g.lace;
const cats = { notOver: 0, slid: 0, notStill: 0, saved: 0, other: 0 }, samples = [];
for (const wx of [0.3, 0.15, 0, -0.15, -0.3]) for (const wy of [-0.6, -0.4, -0.2, 0, 0.15]) for (const side of [1, -1]) for (const T of [1.0, 1.6]) {
  const pts = [[px + wx, py + wy], [px + 0.005 * side, py + 0.1], [px - 0.17 * side, py - 0.15]];
  // led over, held a moment: the highest the head got, and how many turns round the post before letting go
  let top = -9; const n0 = P.log.length; const e = lace().ends[1];
  const nT = Math.round(T / P.DT), q0 = lace().at(e.node);
  for (let i = 0; i <= nT; i++) { const s = i / nT; const k = Math.min(2, Math.floor(s * 3)); const f = s * 3 - k; const a = k === 0 ? [q0[0], q0[1]] : pts[k - 1], c = pts[k]; P.step({ x: a[0] + (c[0] - a[0]) * f, y: a[1] + (c[1] - a[1]) * f, h0: true, h1: false }); top = Math.max(top, lace().at(e.node)[1]); }
  for (let i = 0; i < 24; i++) P.step({ x: pts[2][0], y: pts[2][1], h0: true, h1: false });
  const turnsHeld = lace().turns(px, py, 0.06);
  let maxT = 0, saved = false, minSp = 9;
  for (let i = 0; i < 180; i++) { P.step({ x: pts[2][0], y: pts[2][1], h0: false, h1: false }); if (g.rules.save) { saved = true; break; } maxT = Math.max(maxT, lace().turns(px, py, 0.06)); if (i > 60) minSp = Math.min(minSp, lace().speed(px, py, 0.06)); }
  const endT = lace().turns(px, py, 0.06), cy = lace().centre()[1];
  const cat = saved ? 'saved' : top < py + 0.03 ? 'notOver' : endT < 0.4 ? 'slid' : 'notStill';
  cats[cat]++;
  if (samples.length < 12) samples.push(`${cat} top=${(top - py).toFixed(2)} held=${turnsHeld.toFixed(2)} end=${endT.toFixed(2)} minSpeed=${minSp.toFixed(3)} cy=${(cy - py).toFixed(2)}`);
  P.back(b);
}
console.log(JSON.stringify(cats));
for (const s of samples) console.log(s);
return [];
