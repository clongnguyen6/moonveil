// Light check of the cost modes in WebKit: canvas presence, resolved quality, frames over 2 s.
import { webkit } from '@playwright/test';
const browser = await webkit.launch();
for (const q of ['off', 'low', 'high']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:4200/?scene=night&audio=0&perf=1&quality=${q}`);
  await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__moonveil.perfReset?.());
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, quality: window.__moonveil.quality, perf: window.__moonveil.perf() }));
  console.log(q, '→ resolved', r.quality, 'canvases', r.canvases, 'frames/2s', r.perf?.n ?? 0, 'frame avg', r.perf?.frame.avg ?? '-', errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await page.close();
}
// page override: harness init script sets globalThis.__MOONVEIL_SCENE = 'off' with quality=auto
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; });
await page.goto('http://127.0.0.1:4200/?scene=night&audio=0&quality=auto');
await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
console.log('override off via init script → resolved', await page.evaluate(() => window.__moonveil.quality), 'canvases', await page.evaluate(() => document.querySelectorAll('canvas').length));
await browser.close();
