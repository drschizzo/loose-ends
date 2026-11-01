// Runs a search script in the game page (headless): node drive.js <script.js> <out.json>
// The script is the body of an async function with `P` (the pilot) and `load(path)`;
// what it logs is printed here; what it returns (a plan) is written to out.json.
const { chromium } = require('playwright');
const fs = require('fs');

const [, , scriptPath, outPath] = process.argv;
const body = fs.readFileSync(scriptPath, 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--js-flags=--max-old-space-size=8192'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  page.on('console', (m) => { if (m.type() === 'log') console.log(new Date().toISOString().slice(11, 19), m.text()); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  // (no hot reload: an edit of the sources must not cut a long run short)
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: 'export const createHotContext=()=>({accept(){},acceptExports(){},dispose(){},prune(){},on(){},off(){},send(){},invalidate(){},decline(){},data:{}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;export const ErrorOverlay=class{};' }));
  await page.goto('http://localhost:5180/?seed=7&at=0&autopilot&quality=6');
  await page.waitForFunction(() => window.pilot, null, { timeout: 60000 });
  page.setDefaultTimeout(0);
  const plan = await page.evaluate(async (body) => {
    const P = window.pilot;
    const load = async (p) => (await import(p)).default;
    const f = new Function('P', 'load', `return (async () => { ${body} })();`);
    try { return await f(P, load); } catch (e) { console.log('error ' + e.message + '\n' + e.stack); return P.plan; }
  }, body);
  fs.writeFileSync(outPath, JSON.stringify(plan));
  console.log('written', outPath, plan.length, 'acts');
  await browser.close();
})();
