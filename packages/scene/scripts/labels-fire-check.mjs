// Name labels vs campfire effects: 7 seated players (front seat's label sits over the flames), day, laptop + phone,
// high + low. Captures a crop around the fire and asserts via the gated debug read that every name label is in the
// label layer, above every effect layer. Browser EMULATION; needs the browser lock. Starts the scene dev page on PORT.
//   node scripts/env.mjs node packages/scene/scripts/labels-fire-check.mjs --out docs/visual/labels-fire/after
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, webkit } from '@playwright/test';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const pkg = resolve(import.meta.dirname, '..');
const out = resolve(pkg, '../..', arg('--out', 'docs/visual/labels-fire/after'));
const engine = arg('--engine', 'chromium') === 'webkit' ? webkit : chromium;
const port = Number(process.env.LABELS_PORT ?? 4220);
mkdirSync(out, { recursive: true });
const VIEWS = {
  'laptop-1440x900': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  'phone-390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: pkg, stdio: ['ignore', 'pipe', 'pipe'] });
const ready = new Promise((ok, fail) => { vite.stdout.on('data', (d) => { if (String(d).includes('Local')) ok(); }); vite.on('exit', (c) => fail(new Error(`vite exited ${c}`))); });
const rows = []; let failed = false;
try {
  await ready;
  const browser = await engine.launch();
  for (const [tag, ctxOpts] of Object.entries(VIEWS)) for (const quality of ['high', 'low']) {
    const page = await browser.newPage(ctxOpts);
    page.on('pageerror', (e) => { failed = true; console.error('pageerror', tag, quality, e.message); });
    await page.goto(`http://127.0.0.1:${port}/?scene=day&n=7&audio=0&panel=0&speak=0&quality=${quality}`);
    await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
    await page.waitForTimeout(4000);   // seated, fire running
    const m = await page.evaluate(() => ({ labels: window.__moonveil.debugLabels?.() ?? null, cam: window.__moonveil.debugCamera?.() ?? null }));
    // crop: fire at world (800, 760); the camera puts it at cam.x + 800*scale (debugCamera gives scale; derive from the full frame otherwise)
    const shot = join(out, `${tag}-${quality}.png`);
    await page.screenshot({ path: shot });
    const ok = m.labels ? m.labels.aboveEffects && m.labels.inLabelLayer === m.labels.labels && m.labels.labels === 7 : null;
    if (ok === false) failed = true;
    rows.push({ view: tag, quality, ...m });
    console.log(`${tag} ${quality}: labels-above-effects ${m.labels ? m.labels.aboveEffects : 'n/a'} in-layer ${m.labels ? `${m.labels.inLabelLayer}/${m.labels.labels}` : 'n/a'} order ${m.labels ? m.labels.order.join('>') : 'n/a'} ${ok === false ? 'FAIL' : ''}`);
    await page.close();
  }
  await browser.close();
  writeFileSync(join(out, 'labels-fire.json'), JSON.stringify(rows, null, 1) + '\n');
} finally { vite.kill('SIGTERM'); }
process.exit(failed ? 1 : 0);
