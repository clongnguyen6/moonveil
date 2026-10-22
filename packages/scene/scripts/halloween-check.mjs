// "Cute Halloween" preview evidence on the scene dev page (?theme=halloween). Browser EMULATION.
// Needs the browser lock. Starts the scene dev page on HALLOWEEN_PORT (default 4230). PNGs to --out (keep out of git;
// convert a JPEG subset for docs). Also: theme on/off perf (?perf=1), reduced motion static check, label layer check.
//   node scripts/env.mjs node packages/scene/scripts/halloween-check.mjs --out .cache/halloween
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, webkit } from '@playwright/test';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const pkg = resolve(import.meta.dirname, '..');
const out = resolve(pkg, '../..', arg('--out', '.cache/halloween'));
const port = Number(process.env.HALLOWEEN_PORT ?? 4230);
mkdirSync(out, { recursive: true });
const VIEWS = {
  'phone-390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'laptop-1440x900': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const SCENES = { lobby: 'lobby', 'campfire-day': 'day', 'campfire-night': 'night' };
const url = (o) => `http://127.0.0.1:${port}/?${new URLSearchParams({ n: '8', audio: '0', panel: '0', speak: '0', ...o })}`;
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: pkg, stdio: ['ignore', 'pipe', 'pipe'] });
const ready = new Promise((ok, fail) => { vite.stdout.on('data', (d) => { if (String(d).includes('Local')) ok(); }); vite.on('exit', (c) => fail(new Error(`vite exited ${c}`))); });
const report = { shots: [], perf: [], reducedMotion: null, ghosts: null }; let failed = false;
const open = async (page, o, settle = 3000) => {
  await page.goto(url(o)); await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 }); await page.waitForTimeout(settle);
  return page.evaluate(() => ({ theme: window.__moonveil.debugTheme(), labels: window.__moonveil.debugLabels() }));
};
try {
  await ready;
  const cr = await chromium.launch();
  for (const [tag, ctxOpts] of Object.entries(VIEWS)) for (const quality of ['high', 'low']) {
    const page = await cr.newPage(ctxOpts);
    page.on('pageerror', (e) => { failed = true; console.error('pageerror', tag, quality, e.message); });
    for (const [name, scene] of Object.entries(SCENES)) for (const theme of ['', 'halloween']) {
      const m = await open(page, { scene, quality, ...(theme ? { theme } : {}) }, scene === 'night' ? 6000 : 5000);   // phase banners have faded
      const file = `${tag}-${name}-${quality}-${theme ? 'halloween' : 'before'}.png`;
      await page.screenshot({ path: join(out, file) });
      const ok = m.labels.aboveEffects && (!theme || (m.theme.theme === 'halloween' && m.theme.animate === (quality === 'high')));
      if (!ok) failed = true;
      report.shots.push({ file, ...m, ok });
      console.log(`${file}: theme ${m.theme.theme} animate ${m.theme.animate} counts ${JSON.stringify(m.theme.counts)} labels-on-top ${m.labels.aboveEffects} ${ok ? '' : 'FAIL'}`);
    }
    await page.close();
  }
  // decorative vs real ghosts: ghost scene (viewer + one seat dead), kept into the night
  {
    const page = await cr.newPage(VIEWS['laptop-1440x900']);
    await open(page, { scene: 'ghost', quality: 'high', theme: 'halloween' });
    await page.screenshot({ path: join(out, 'laptop-1440x900-ghosts-day-high-halloween.png') });
    await page.evaluate(() => window.__moonveil.setScene('night', window.__moonveil.dead()));
    await page.waitForTimeout(9000);
    await page.screenshot({ path: join(out, 'laptop-1440x900-ghosts-night-high-halloween.png') });
    report.ghosts = 'laptop-1440x900-ghosts-{day,night}-high-halloween.png';
    await page.close();
  }
  // reduced motion: overlay must not animate (static even at high)
  {
    const ctx = await cr.newContext({ ...VIEWS['laptop-1440x900'], reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const m = await open(page, { scene: 'night', quality: 'high', theme: 'halloween' }, 4500);
    report.reducedMotion = m.theme;
    if (m.theme.animate !== false) failed = true;
    console.log(`reduced motion: animate ${m.theme.animate}`);
    await page.screenshot({ path: join(out, 'laptop-1440x900-campfire-night-high-reduced-motion-halloween.png') });
    await ctx.close();
  }
  // perf: theme off/on per quality, night campfire, laptop, 2.5 s warm-up then 5 s
  for (const quality of ['low', 'high']) for (const theme of ['', 'halloween']) {
    const page = await cr.newPage(VIEWS['laptop-1440x900']);
    await open(page, { scene: 'night', quality, perf: '1', ...(theme ? { theme } : {}) }, 2500);
    await page.evaluate(() => window.__moonveil.perfReset());
    await page.waitForTimeout(5000);
    const p = await page.evaluate(() => window.__moonveil.perf());
    report.perf.push({ quality, theme: theme || 'none', ...p });
    console.log(`perf ${quality} ${theme || 'none'}: ${JSON.stringify(p)}`);
    await page.close();
  }
  await cr.close();
  // WebKit subset: phone night high + low, lobby high
  const wk = await webkit.launch();
  for (const [name, scene, quality] of [['campfire-night', 'night', 'high'], ['campfire-night', 'night', 'low'], ['lobby', 'lobby', 'high']]) {
    const page = await wk.newPage(VIEWS['phone-390x844']);
    page.on('pageerror', (e) => { failed = true; console.error('pageerror webkit', e.message); });
    const m = await open(page, { scene, quality, theme: 'halloween' }, scene === 'night' ? 4500 : 3000);
    await page.screenshot({ path: join(out, `webkit-phone-390x844-${name}-${quality}-halloween.png`) });
    console.log(`webkit ${name} ${quality}: animate ${m.theme.animate} labels-on-top ${m.labels.aboveEffects}`);
    await page.close();
  }
  await wk.close();
  writeFileSync(join(out, 'halloween-check.json'), JSON.stringify(report, null, 1) + '\n');
} finally { vite.kill('SIGTERM'); }
process.exit(failed ? 1 : 0);
