// Short WebKit check of a costume: lobby walking both facings, seated squash, ghost; high and low quality. Harness on :4200.
// Usage: node scripts/check-costume.mjs <outfit> [--out <dir>] [--q "variant=ring&hat=duckCap"]
import { webkit } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const args = process.argv.slice(2);
const outfit = args[0] ?? 'placeholder';
const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '../../docs/visual/costumes');
const extra = args.includes('--q') ? '&' + args[args.indexOf('--q') + 1] : '';
mkdirSync(outDir, { recursive: true });
const browser = await webkit.launch();
const shot = async (page, name) => page.screenshot({ path: join(outDir, `${outfit}-${name}.jpg`), type: 'jpeg', quality: 86, clip: { x: 300, y: 150, width: 680, height: 460 } });
for (const quality of ['high', 'low']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  const go = async (scene) => { await page.goto(`http://127.0.0.1:4200/?scene=${scene}&n=6&audio=0&panel=0&quality=${quality}&outfit=${outfit}${extra}`); await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 }); };
  const waitSim = async (sec) => { const t0 = await page.evaluate(() => window.__moonveil.time()); await page.waitForFunction((t) => window.__moonveil.time() >= t, t0 + sec, { timeout: 60000, polling: 100 }); };
  await go('lobby'); await waitSim(1.5);
  await page.evaluate(() => window.__moonveil.walk(1000, 960)); await waitSim(0.8); await shot(page, `${quality}-walk-right`);   // walking, facing right
  await page.evaluate(() => window.__moonveil.walk(500, 960)); await waitSim(0.8); await shot(page, `${quality}-walk-left`);     // walking, facing left
  await waitSim(2.5); await page.evaluate(() => window.__moonveil.setSpeak(true)); await waitSim(0.6); await shot(page, `${quality}-idle-speaking`);
  await go('seating'); await waitSim(6.5); await shot(page, `${quality}-seated`);
  await go('ghost'); await waitSim(2); await page.evaluate(() => window.__moonveil.walk(600, 950)); await waitSim(2); await shot(page, `${quality}-ghost`);
  await page.close();
  console.log('done', quality);
}
await browser.close();
