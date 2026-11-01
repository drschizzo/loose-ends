// Films the pilot's climb: plays the plan once to get its log, then again
// frame by frame (one solver step per frame, 60 fps), a screenshot of the
// whole page (HUD included) per frame, piped into ffmpeg.
//   node record.js <out.mp4> [frames|all] [--headed]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const plan = require('./plan.json');

const out = process.argv[2] || 'climb.mp4';
const limit = process.argv[3] && process.argv[3] !== 'all' ? Number(process.argv[3]) : Infinity;
const headed = process.argv.includes('--headed');
const URL = 'http://localhost:5180/?seed=7&at=0&autopilot&quality=0';
const LEAD = 50, TAIL = 70;

(async () => {
  const browser = await chromium.launch({ headless: !headed, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('page:', m.text()); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));

  // (no hot reload: an edit of the sources must not cut a long run short)
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: 'export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},send(){},invalidate(){},decline(){},data:{}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;export const ErrorOverlay=class{};' }));
  await page.goto(URL);
  await page.waitForFunction(() => window.pilot, null, { timeout: 30000 });
  const first = await page.evaluate((plan) => {
    const r = pilot.redo(plan);
    return { r, log: pilot.log, backend: pilot.game.stage.renderer.backend.constructor.name, end: pilot.game.lace.centre() };
  }, plan);
  console.log('backend', first.backend, 'steps', first.log.length, 'acts', first.r.acts, first.r.failed ? 'FAILED ' + JSON.stringify(first.r.failed) : 'ok', 'end', first.end);
  if (first.r.failed) { await browser.close(); process.exit(1); }

  await page.reload();
  await page.waitForFunction(() => window.pilot, null, { timeout: 30000 });
  await page.evaluate((log) => {
    const P = window.pilot, g = P.game;
    window.LOG = log;
    // an expert: no help, no cards, no first-time words
    Object.assign(window.game.progress.learned, { grip: 99, perfect: 3, throw: 99, rest: 99, slip: 99 });
    g.showHints = false;
    g.hud.showCards(false);
    // the player's hand: a ring where the pointer is, the colour of the end it leads, filled while a button is held
    const ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 0 8px rgba(0,0,0,.4);pointer-events:none;z-index:50;transition:none';
    document.body.appendChild(ring);
    const V = g.stage.camera.position.constructor;
    window.FRAME = (n) => {
      const i = n >= 0 && n < LOG.length ? LOG[n] : null;
      if (i) P.step(i);
      else if (n >= LOG.length) { const L = g.lace, l = L.leader(), q = l ? L.at(l.node) : [g.controls.pointer.x, g.controls.pointer.y]; P.step({ x: q[0], y: q[1] - 0.02, h0: !!L.ends[0].grip, h1: !!L.ends[1].grip }); }
      g.draw(P.DT);
      const p = g.controls.pointer, v = new V(p.x, p.y, 0).project(g.stage.camera), l = g.lace.leader(), k = l ? g.lace.ends.indexOf(l) : -1;
      ring.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
      const c = k === 0 ? '#ff8a3d' : k === 1 ? '#3d9bff' : '#ffffff', down = i && ((k === 0 && i.h0) || (k === 1 && i.h1));
      ring.style.borderColor = c;
      ring.style.background = down ? c + 'aa' : 'transparent';
      ring.style.opacity = n < 0 ? '0' : '1';
      // the panel of the post: read, then off again
      const post = document.getElementById('post');
      if (post && !post.classList.contains('hidden')) { window.POST = (window.POST ?? 0) + 1; if (window.POST > 100) document.getElementById('post-go').click(); }
      return g.lace.centre();
    };
  }, first.log);

  const total = Math.min(LEAD + first.log.length + TAIL, limit);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  let end;
  for (let f = 0; f < total; f++) {
    const c = await page.evaluate((n) => window.FRAME(n), f - LEAD);
    if (f - LEAD === first.log.length - 1) end = c;
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 120 === 0) console.log(`frame ${f}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log('end', end, '(first pass', first.end, ')');
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('written', out);
})();
