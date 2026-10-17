// Before/after captures for the label layout fix (Playwright WebKit, browser emulation). Needs the harness on :4200.
// Usage: node scripts/capture-labels.mjs [--out ../../docs/visual/labels]
import { webkit, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const args = process.argv.slice(2);
const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '../../docs/visual/labels');
mkdirSync(outDir, { recursive: true });
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4200/';
const browser = await webkit.launch();
const laptop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const phone = { ...devices['iPhone 13'], deviceScaleFactor: 2 };
const phoneLand = { ...devices['iPhone 13 landscape'], deviceScaleFactor: 2 };
async function waitSim(page, sec) { const t0 = await page.evaluate(() => window.__moonveil.time()); await page.waitForFunction((t) => window.__moonveil.time() >= t, t0 + sec, { timeout: 120000, polling: 100 }); }
async function shot(ctxOpts, name, query, sec) {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', name, e.message));
  await page.goto(`${base}?${query}&audio=0&panel=0`);
  await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
  await waitSim(page, sec);
  await page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 86 });
  await ctx.close(); console.log('shot', name);
}
// pass 1 (visual-8): before = no layout, after = v1. pass 2 (visual-9): before = v1, after = v2 (default). Select with --pass 2.
const pass2 = args.includes('--pass') && args[args.indexOf('--pass') + 1] === '2';
for (const [tag, labels] of pass2 ? [['v1-before', '1'], ['v2-after', '2']] : [['before', '0'], ['after', '1']]) {
  await shot(laptop, `${tag}-laptop-seating-15`, `scene=seating&n=15&labels=${labels}`, 7);
  await shot(phone, `${tag}-phone-portrait-seating-15`, `scene=seating&n=15&labels=${labels}`, 7);
  await shot(phone, `${tag}-phone-portrait-lobby-edge`, `scene=lobby&n=15&labels=${labels}&cam=fit`, 5);
  await shot(phoneLand, `${tag}-phone-landscape-seating-15`, `scene=seating&n=15&labels=${labels}`, 7);
  await shot(phone, `${tag}-phone-portrait-low-ghost`, `scene=ghost&n=15&labels=${labels}&quality=low`, 5);
}
await browser.close();
