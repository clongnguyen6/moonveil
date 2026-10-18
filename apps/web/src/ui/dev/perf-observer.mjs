// Observer-page cost over one night step: main-thread busy time (CDP Performance.getMetrics TaskDuration delta),
// script/layout/style counters, and long tasks, for seat 0 with the scene on at low fps while 7 other seats run
// scene-off. Run against a real server built from a given SHA; compare two servers (ports) for A/B.
//   node scripts/env.mjs node apps/web/src/ui/dev/perf-observer.mjs <baseUrl> [label] [--seconds 40]
// HEAVY: renders the scene on one page; needs the lock.
import { chromium } from '@playwright/test';
const base = process.argv[2]; const label = process.argv[3] ?? base; const secs = Number(process.argv[process.argv.indexOf('--seconds') + 1] || 40);
if (!base) { console.error('usage: perf-observer.mjs <baseUrl> [label] [--seconds N]'); process.exit(2); }
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh', 'Minh'];
const browser = await chromium.launch();
const pages = [];
for (const [i, n] of NAMES.entries()) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript((obs) => { globalThis.__MOONVEIL_SCENE = obs ? 'low' : 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: obs })); }, i === 0);
  const page = await ctx.newPage();
  pages.push({ n, ctx, page });
}
const host = pages[0].page;
await host.goto(`${base}/`); await host.getByTestId('name').fill('An'); await host.getByTestId('create-automatic').click(); await host.waitForSelector('[data-testid=room-code]');
const code = (await host.getByTestId('room-code').textContent()).trim();
for (const p of pages.slice(1)) { await p.page.goto(`${base}/r/${code}`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId('join').click(); await p.page.waitForSelector('[data-testid=room]'); }
for (const p of pages) await p.page.getByTestId('ready').click();
const cdp = await host.context().newCDPSession(host);
await cdp.send('Performance.enable');
await host.evaluate(() => { globalThis.__longTasks = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) globalThis.__longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: true }); });
await host.getByTestId('start').click();
await host.waitForSelector('[data-testid=room][data-step="night.main"]', { timeout: 15000 });
const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const t0 = Date.now();
// Observer behaviour like the strict suite: click a seat in the grid every 1.5 s and measure how long the click takes.
const clickMs = [];
while (Date.now() - t0 < secs * 1000) {
  const b = host.locator('.seat-grid button[aria-pressed]:not([disabled])').first();
  const c0 = performance.now();
  if (await b.count()) await b.click({ timeout: 1500 }).catch(() => clickMs.push(-1));
  if (clickMs.at(-1) !== -1) clickMs.push(performance.now() - c0);
  await host.waitForTimeout(1500);
}
const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const long = await host.evaluate(() => globalThis.__longTasks);
const d = (k) => +(m1[k] - m0[k]).toFixed(3);
const wall = (Date.now() - t0) / 1000;
const misses = clickMs.filter((x) => x === -1).length;
const okClicks = clickMs.filter((x) => x >= 0);
console.log(JSON.stringify({ label, step: 'night.main', wallSec: +wall.toFixed(1), taskDurationSec: d('TaskDuration'), busyPct: +((d('TaskDuration') / wall) * 100).toFixed(1), scriptSec: d('ScriptDuration'), layoutSec: d('LayoutDuration'), styleSec: d('RecalcStyleDuration'), layoutCount: d('LayoutCount'), styleCount: d('RecalcStyleCount'), longTasks: long.length, longTaskMaxMs: +(Math.max(0, ...long)).toFixed(0), clicks: clickMs.length, clickMisses: misses, clickP95Ms: +(okClicks.sort((a, b) => a - b)[Math.floor(okClicks.length * 0.95)] ?? 0).toFixed(0) }));
await browser.close();
