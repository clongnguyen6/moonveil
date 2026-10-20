// Frame-time measurement in Playwright WebKit (GPU-backed; on macOS it writes only its three ~/Library/…org.webkit.Playwright paths outside the repo). WebKit has no CPU-throttling control,
// so these are unthrottled numbers on the dev machine: emulation, not a device. Uses the production build
// served by `vite preview` on :4201. Prints a markdown table.
import { webkit, devices } from '@playwright/test';

const args = process.argv.slice(2);
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://127.0.0.1:4201/';
const browser = await webkit.launch();
const phone = { ...devices['iPhone 13'], deviceScaleFactor: 2 };
const phone3x = { ...devices['iPhone 13'], deviceScaleFactor: 3 };
const laptop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

async function run(label, ctxOpts, scene, n, seconds = 5) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(`${base}?scene=${scene}&n=${n}&audio=0&panel=0&perf=1`);
  await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__moonveil.perfReset());
  await page.waitForTimeout(seconds * 1000);
  const r = await page.evaluate(() => window.__moonveil.perf());
  await ctx.close();
  const row = `| ${label} | ${scene} | ${n} | ${r.frame.avg} | ${r.frame.p95} | ${r.update.avg} | ${r.lightmap.avg} | ${r.render.avg} |`;
  console.log(row);
}
console.log('| emulation (WebKit, unthrottled) | scene | avatars | frame avg ms | frame p95 ms | update js ms | lightmap js ms | pixi render js ms |');
console.log('|---|---|---|---|---|---|---|---|');
for (const n of [10, 16]) { await run('phone 390×844 @2x', phone, 'lobby', n); await run('phone 390×844 @2x', phone, 'night', n); }
await run('phone 390×844 @3x', phone3x, 'lobby', 16);
await run('laptop 1440×900 @1x', laptop, 'lobby', 16);
await run('laptop 1440×900 @1x', laptop, 'night', 16);
await browser.close();
