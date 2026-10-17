// Main-thread long tasks of a page mounting the scene, under headless Chromium (software WebGL, as the test
// harnesses see it) and under WebKit (GPU-backed, emulation). Light-weight: PerformanceObserver('longtask') +
// rAF interval stats, 20 s per configuration. Usage: node scripts/longtask-probe.mjs [chromium|webkit|both] [seconds] [configs...]
// A config is a harness query fragment, e.g. "quality=low" or "quality=low&x=aa0,fps15,lmc,rip0".
import { chromium, webkit } from '@playwright/test';
const which = process.argv[2] ?? 'both';
const seconds = parseInt(process.argv[3] ?? '20', 10);
const configs = process.argv.slice(4).length ? process.argv.slice(4) : ['quality=low', 'quality=low&x=aa0', 'quality=low&x=fps15', 'quality=low&x=lmc', 'quality=low&x=rip0', 'quality=low&x=aa0,fps15,lmc,rip0'];
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4200/';
const browsers = which === 'both' ? ['chromium', 'webkit'] : [which];
console.log('| browser | config | frames | fps | long tasks | long ms total | busy % | max task ms | p95 frame gap ms |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const name of browsers) {
  const browser = name === 'webkit' ? await webkit.launch() : await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const cfg of configs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => {
      window.__lt = { count: 0, total: 0, max: 0, gaps: [], last: 0 };
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt.count++; window.__lt.total += e.duration; window.__lt.max = Math.max(window.__lt.max, e.duration); } }).observe({ entryTypes: ['longtask'] }); } catch {}
      const tick = (t) => { if (window.__lt.last) window.__lt.gaps.push(t - window.__lt.last); window.__lt.last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    });
    await page.goto(`${base}?scene=night&n=10&audio=0&panel=0&${cfg}`);
    await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => { window.__lt.count = 0; window.__lt.total = 0; window.__lt.max = 0; window.__lt.gaps = []; });
    const t0 = Date.now();
    await page.waitForTimeout(seconds * 1000);
    const wall = Date.now() - t0;
    const r = await page.evaluate(() => { const g = [...window.__lt.gaps].sort((a, b) => a - b); return { ...window.__lt, frames: g.length, p95: g[Math.floor(g.length * 0.95)] ?? 0 }; });
    console.log(`| ${name} | ${cfg} | ${r.frames} | ${(r.frames / (wall / 1000)).toFixed(1)} | ${r.count} | ${Math.round(r.total)} | ${(100 * r.total / wall).toFixed(1)} | ${Math.round(r.max)} | ${Math.round(r.p95)} |`);
    await page.close();
  }
  await browser.close();
}
