// Frame-time measurement under Chromium CPU throttling (stand-in for a mid-range phone; this is emulation,
// not a device). Uses the production build served by `vite preview` on :4201. Writes a markdown table to stdout.
// Usage: node scripts/perf.mjs [--url http://127.0.0.1:4201/]
import { chromium, devices } from '@playwright/test';

const args = process.argv.slice(2);
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://127.0.0.1:4201/';
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist'] });

const phone = { ...devices['iPhone 13'], deviceScaleFactor: 2 };          // 390x844 @2x = 780x1688 px
const phone3x = { ...devices['iPhone 13'], deviceScaleFactor: 3 };        // fill-rate stress
const laptop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

async function run(label, ctxOpts, scene, n, cpu, seconds = 5) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`${base}?scene=${scene}&n=${n}&audio=0&panel=0&perf=1`);
  await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
  await page.waitForTimeout(2500);                                        // warm-up: textures baked, scene settled
  await page.evaluate(() => window.__moonveil.perfReset());
  await page.waitForTimeout(seconds * 1000);
  const r = await page.evaluate(() => window.__moonveil.perf());
  await ctx.close();
  const row = `| ${label} | ${scene} | ${n} | ${cpu}x | ${r.frame.avg} | ${r.frame.p95} | ${r.update.avg} | ${r.lightmap.avg} | ${r.render.avg} |`;
  console.log(row);
  return row;
}

console.log('| device emulation | scene | avatars | CPU throttle | frame avg ms | frame p95 ms | update js ms | lightmap js ms | pixi render js ms |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const cpu of [1, 4, 6]) {
  for (const n of [10, 16]) {
    await run('phone 390×844 @2x', phone, 'lobby', n, cpu);
    await run('phone 390×844 @2x', phone, 'night', n, cpu);
  }
}
await run('phone 390×844 @3x', phone3x, 'lobby', 16, 4);
await run('phone 390×844 @3x', phone3x, 'night', 16, 4);
await run('laptop 1440×900 @1x', laptop, 'lobby', 16, 1);
await run('laptop 1440×900 @1x', laptop, 'night', 16, 4);
await browser.close();
