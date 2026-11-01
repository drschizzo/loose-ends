// the climb for the video, on the course with its posts' bars: goals by where they are, a few best ways each, back when stuck
const tick = () => new Promise((r) => setTimeout(r, 0));
P.setPerfect(0.6);
const g = P.game;
const near = (x, y) => { let best = -1, bd = 0.15; g.world.surfaces.forEach((s, i) => { const sh = s.shape; if (sh.kind !== 'capsule' || s.mat === 'wall') return; const d = Math.hypot(sh.ax - x, sh.ay - y); if (d < bd) { bd = d; best = i; } }); return best; };
const sidOf = (t) => (Array.isArray(t) ? near(t[0], t[1]) : t);
const lastK = () => P.plan.length ? (P.plan[P.plan.length - 1].k ?? 0) : 0;
const endOn = (sid) => g.lace.ends.findIndex((e) => e.grip?.kind === 'surface' && e.grip.surface === sid);
// a goal: ends `ks` ('any', 'other' than the last to move, 'held' the one on `on`), targets `to` (positions, sids, cords)
const ways = (goal, wide) => {
  if (goal.drape) {
    const post = sidOf(goal.drape), sh = g.world.surfaces[post].shape, px = sh.ax, py = sh.ay, k = endOn(post), side = goal.side, out = [];
    if (k < 0) return [];
    for (const a of [0.25, 0.15, 0, -0.1]) for (const b of [0.08, 0.15, 0.2]) for (const T of [0.8, 1.2, 1.6]) for (const h of [0.2, 0.5]) for (const dr of [[0.1, 0.1], [0.15, 0.15], [0.2, 0.3]])
      out.push({ a: 'drape', k, sid: post, prm: { pts: [[px + a * side, py + b], [px - 0.03 * side, py + 0.08], [px - dr[0] * side, py - dr[1]]], T, hold: h, settle: 3 } });
    return out;
  }
  if (goal.act) return [goal.act];
  const ks = goal.ks === 'any' ? [0, 1] : goal.ks === 'other' ? [1 - lastK()] : [goal.ks];
  const out = [];
  for (const k of ks) for (const t of goal.to) {
    const sid = typeof t === 'object' && !Array.isArray(t) ? t : sidOf(t);
    if (sid === -1) continue;
    let prms = [...P.G2, ...P.G2.map((p) => ({ ...p, top: true }))];
    if (wide) { const a = P.around(k, sid, { N: 5, T: [0.6, 1.0, 1.4] }); prms = [...prms, ...a, ...a.map((p) => ({ ...p, top: true }))]; }
    out.push(...P.moves(k, sid, prms));
  }
  return out;
};
const HEAD = await load('/src/dev/head13.json');
// (the hook of the drape, by where it is: the course's surfaces moved since)
HEAD[10] = { ...HEAD[10], sid: near(-0.549, 4.022) };
P.redo(HEAD);
const O = 'other', A = 'any';
const goals = [
  { ks: 1, to: [19, 20, 21, 22] }, { ks: 0, to: [22, 17] }, { ks: 1, to: [17, 23] }, { ks: 0, to: [23] },
  // the first post: gripped, the bar beside it, the lace laid over it, the hold beyond the trapdoor, the bar beyond
  { ks: O, to: [[0.025, 6.201]] }, { ks: O, to: [[0.3, 6.421]] }, { drape: [0.025, 6.201], side: 1 }, { ks: A, to: [[0.1, 6.691]] }, { ks: O, to: [[0.243, 6.851]] },
  // the wardrobe
  { ks: O, to: [[0.55, 7.201]] }, { ks: O, to: [{ c: 3, f: 0.95 }, { c: 2, f: 0.95 }] }, { ks: O, to: [{ c: 4, f: 0.95 }, { c: 4, f: 0.5 }] }, { ks: O, to: [[-0.5, 7.917], { c: 4, f: 0.5 }] },
  { ks: O, to: [[-0.5, 7.917], { c: 5, f: 0.65 }] }, { ks: O, to: [{ c: 5, f: 0.65 }, [0.416, 8.817]] }, { ks: O, to: [[0.416, 8.817], [0.5, 9.188]] }, { ks: O, to: [[0.5, 9.188], [0.254, 9.308]] },
  { ks: O, to: [[0.254, 9.308]] }, { ks: O, to: [[0.5, 10.364]] }, { ks: O, to: [[0.15, 10.757], [0.5, 11.15]] }, { ks: A, to: [[0.5, 11.15]] }, { ks: O, to: [[0.266, 11.27]] }, { ks: O, to: [[-0.236, 11.945]] },
  // the second post
  { ks: O, to: [[-0.04, 13.289], [0.4, 12.839]] }, { ks: O, to: [[-0.04, 13.289], [0.3, 13.509]] }, { ks: O, to: [[0.3, 13.509]] }, { drape: [-0.04, 13.289], side: 1 }, { ks: A, to: [[0.1, 13.779]] }, { ks: O, to: [[0.395, 13.939]] },
  { act: { a: 'ride', prm: { s: 2 } } },
];
const t0 = performance.now();
let deepest = 0, best = null;
const dfs = async (i) => {
  if (i > deepest) { deepest = i; best = P.plan.slice(); }
  if (i === goals.length) return true;
  let tries = P.ranked(ways(goals[i], false), 3);
  if (!tries.length && !goals[i].drape && !goals[i].act) tries = P.ranked(ways(goals[i], true), 3);
  console.log(`#${i} ${JSON.stringify(goals[i].to ?? goals[i].drape ?? 'ride')}: ${tries.map((t) => (t.perfect ? 'P' : '.') + t.steps).join(' ')}  t=${g.time.toFixed(1)} y=${g.lace.centre()[1].toFixed(2)}  ${((performance.now() - t0) / 1000).toFixed(0)}s`);
  await tick();
  for (const t of tries) {
    P.back(t.end); P.plan.push(t.x);
    if (await dfs(i + 1)) return true;
    console.log(`  back to #${i}`); await tick();
  }
  return false;
};
const ok = await dfs(0);
console.log('done', ok, P.plan.length, 'acts', P.log.length, 'steps');
return ok ? P.plan : best;
