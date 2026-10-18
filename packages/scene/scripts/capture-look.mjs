// Before/after for: (1) appearance change after spawn, (2) labels at a shared spawn point. Playwright WebKit.
// Usage: node scripts/capture-look.mjs --out <dir> --tag before|after   (harness on :4200 from the branch under test)
import { webkit } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const args = process.argv.slice(2);
const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '../../docs/visual/look');
const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : 'after';
mkdirSync(outDir, { recursive: true });
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4200/';
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`${base}?scene=lobby&n=6&audio=0&panel=0&speak=0`);
await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
const waitSim = async (sec) => { const t0 = await page.evaluate(() => window.__moonveil.time()); await page.waitForFunction((t) => window.__moonveil.time() >= t, t0 + sec, { timeout: 60000, polling: 100 }); };
await waitSim(2);
await page.screenshot({ path: join(outDir, `${tag}-1-lobby.jpg`), type: 'jpeg', quality: 86 });
// seat s2 saves a new look: hat → bucket, jacket → sand; everyone should see it within a snapshot
await page.evaluate(() => window.__moonveil.setLook?.('s2', { hat: 'bucket', top: 'sand' }));
await waitSim(1.5);
await page.screenshot({ path: join(outDir, `${tag}-2-after-look-change.jpg`), type: 'jpeg', quality: 86 });
await browser.close();
console.log('captured', tag, 'in', outDir);
