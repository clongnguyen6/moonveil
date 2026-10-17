// N concurrent headless-Chromium (SwiftShader) pages mounting the scene: per-page fps and long tasks under contention.
// Usage: node scripts/longtask-contention.mjs <pages> <seconds> <config...>
import { chromium } from '@playwright/test';
const pages = parseInt(process.argv[2] ?? '4', 10), seconds = parseInt(process.argv[3] ?? '15', 10);
const configs = process.argv.slice(4).length ? process.argv.slice(4) : ['quality=low', 'quality=low&x=aa0,fps15,lmc,rip0'];
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4200/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
console.log(`| pages | config | fps/page (min..max) | long tasks/page | busy %/page (max) | max task ms |`);
console.log('|---|---|---|---|---|---|');
for (const cfg of configs) {
  const ps = [];
  for (let i = 0; i < pages; i++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => {
      window.__lt = { count: 0, total: 0, max: 0, frames: 0 };
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt.count++; window.__lt.total += e.duration; window.__lt.max = Math.max(window.__lt.max, e.duration); } }).observe({ entryTypes: ['longtask'] }); } catch {}
      const tick = () => { window.__lt.frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    });
    await page.goto(`${base}?scene=night&n=10&audio=0&panel=0&${cfg}`);
    ps.push(page);
  }
  await Promise.all(ps.map((p) => p.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 120000 })));
  await new Promise((r) => setTimeout(r, 3000));
  await Promise.all(ps.map((p) => p.evaluate(() => { window.__lt.count = 0; window.__lt.total = 0; window.__lt.max = 0; window.__lt.frames = 0; })));
  const t0 = Date.now(); await new Promise((r) => setTimeout(r, seconds * 1000)); const wall = Date.now() - t0;
  const rs = await Promise.all(ps.map((p) => p.evaluate(() => window.__lt)));
  const fps = rs.map((r) => r.frames / (wall / 1000));
  console.log(`| ${pages} | ${cfg} | ${Math.min(...fps).toFixed(1)}..${Math.max(...fps).toFixed(1)} | ${(rs.reduce((a, r) => a + r.count, 0) / pages).toFixed(1)} | ${Math.max(...rs.map((r) => 100 * r.total / wall)).toFixed(1)} | ${Math.round(Math.max(...rs.map((r) => r.max)))} |`);
  await Promise.all(ps.map((p) => p.close()));
}
await browser.close();
