// the post with its bar beside it and its hold beyond the trapdoor: station → post → bar beside → the lace laid over the post, all let go → hold beyond → bar beyond; then each act measured
const g = P.game, w0 = () => g.world;
const near = (x, y) => w0().surfaces.findIndex((s) => s.shape.kind === 'capsule' && Math.hypot(s.shape.ax - x, s.shape.ay - y) < 0.02);
const [hx, hy] = new URLSearchParams(location.search).get('hang').split(',').map(Number);
const L = w0().level, gate = L.gates.find((q) => q.post !== undefined), pb = L.bars[gate.post], F = gate.y1, side = Math.sign(hx);
const hold = near(hx, hy), post = near(pb.x, pb.y), helper = near(side * 0.3, F - 0.13);
const out = { phases: [] };
const say = (what, r) => { out.phases.push(`${what}:${r ? r.steps : 'NONE'}`); console.log(`${what}: ${r ? `${r.steps} steps${r.perfect ? ' P' : ''}` : 'NONE'}`); };
const wide = (k, sid) => [...P.G2, ...P.around(k, sid, { N: 5, T: [0.6, 1.0, 1.4] })];
const done = () => { const plan = P.plan.slice(); P.back(P.start0); out.rows = P.measure(plan); for (const q of out.rows) console.log(`row ${q.i} ${q.a} ${q.what} y=${q.y} broad=${q.broad} jitter=${q.jitter}`); console.log('summary ' + JSON.stringify(out.phases)); return plan; };
let r = P.best(P.moves(0, hold, [{ T: 0.05, ay: 0 }])); say('grip', r);
r = P.best(P.moves(1, post, wide(1, post))); say('post', r); if (!r) return done();
r = P.best(P.moves(0, helper, wide(0, helper))); say('helper', r); if (!r) return done();
const px = pb.x, py = pb.y, drapes = [];
for (const a of [0.25, 0.15, 0, -0.1]) for (const b of [0.08, 0.15, 0.2]) for (const T of [0.8, 1.2, 1.6]) for (const h of [0.2, 0.5]) for (const dr of [[0.1, 0.1], [0.15, 0.15], [0.2, 0.3]])
  drapes.push({ a: 'drape', k: 1, sid: post, prm: { pts: [[px + a * side, py + b], [px - 0.03 * side, py + 0.08], [px - dr[0] * side, py - dr[1]]], T, hold: h, settle: 3 } });
r = P.best(drapes); say('drape', r); if (!r) return done();
const exitHold = near(side * 0.1, F + 0.14), beyond = w0().surfaces.findIndex((s) => s.shape.kind === 'capsule' && Math.abs(s.shape.ay - (F + 0.3)) < 0.02 && s.mat === 'wood');
r = P.best([0, 1].flatMap((k) => P.moves(k, exitHold, wide(k, exitHold)))); say('exit', r); if (!r) return done();
const k2 = 1 - P.plan[P.plan.length - 1].k;
r = P.best(P.moves(k2, beyond, wide(k2, beyond))); say('beyond', r);
return done();
