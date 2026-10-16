// Captures screenshots and one motion video with Playwright (headless Chromium, browser emulation only).
// Usage: node scripts/capture.mjs [--out ../docs/visual/preview] [--no-video]
import { chromium, devices } from '@playwright/test';
import { mkdirSync, existsSync, readdirSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '../docs/visual/preview');
const noVideo = args.includes('--no-video');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;   // substring filter on shot names
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4200/';
const raw = resolve('captures-raw');
mkdirSync(outDir, { recursive: true }); mkdirSync(raw, { recursive: true });

// Full Chromium in new headless mode: uses the real GPU (ANGLE Metal on macOS) -> 60 fps.
// The headless shell falls back to SwiftShader at 2-5 fps, which slows simulated time.
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist'] });
// Wait in simulated seconds (robust if the renderer is slower than real time).
async function waitSim(page, sec) {
  const t0 = await page.evaluate(() => window.__moonveil.time());
  await page.waitForFunction((target) => window.__moonveil.time() >= target, t0 + sec, { timeout: 120000, polling: 100 });
}

const laptop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const phone = { ...devices['iPhone 13'], deviceScaleFactor: 2 };                       // 390x844 portrait, touch
const phoneLand = { ...devices['iPhone 13 landscape'], deviceScaleFactor: 2 };         // 844x390
const url = (scene, extra = '') => `${base}?scene=${scene}&audio=0${extra}`;

async function shot(ctxOpts, scene, name, waitMs, extra = '', before) {
  if (only && !name.includes(only)) return;
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(url(scene, extra));
  await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 20000 });
  if (before) await before(page);
  await waitSim(page, waitMs / 1000);
  await page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 88 });
  await ctx.close();
  console.log('shot', name);
}

// laptop 1440x900
await shot(laptop, 'lobby', 'laptop-day-lobby', 4200);
await shot(laptop, 'seating', 'laptop-campfire-seating', 6500);
await shot(laptop, 'night', 'laptop-night-transition', 3600);
await shot(laptop, 'night', 'laptop-night', 12500);
await shot(laptop, 'day', 'laptop-dawn', 3800);
await shot(laptop, 'ghost', 'laptop-ghost-view', 4000);
await shot(laptop, 'ghost', 'laptop-living-view-same-moment', 4000, '', (p) => p.evaluate(() => window.__moonveil.setView('living')));
await shot(laptop, 'seating', 'laptop-16-players-seating', 7000, '&n=16');
// phone portrait (mobile emulation: iPhone 13 viewport, touch, DPR 2)
await shot(phone, 'lobby', 'phone-portrait-day-lobby-fit', 4200, '&cam=fit');
await shot(phone, 'lobby', 'phone-portrait-day-lobby-tight', 4200);
await shot(phone, 'seating', 'phone-portrait-campfire-seating', 6500);
await shot(phone, 'night', 'phone-portrait-night', 12500);
await shot(phone, 'ghost', 'phone-portrait-ghost-view', 4000);
// phone landscape
await shot(phoneLand, 'lobby', 'phone-landscape-day-lobby', 4200);
await shot(phoneLand, 'night', 'phone-landscape-night', 12500);

if (!noVideo && !only) {
  const size = { width: 1280, height: 720 };
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: raw, size } });
  const page = await ctx.newPage();
  await page.goto(url('lobby', '&panel=0'));
  await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 20000 });
  const mv = (fn) => page.evaluate(fn);
  const wait = (ms) => waitSim(page, ms / 1000);
  await wait(1500);
  await mv(() => window.__moonveil.walk(560, 980)); await wait(2600);
  await mv(() => window.__moonveil.walk(1120, 900)); await wait(3200);
  await mv(() => { window.__moonveil.emote('👋'); window.__moonveil.setSpeak(true); }); await wait(2200);
  await mv(() => window.__moonveil.setSpeak(false));
  await mv(() => window.__moonveil.setScene('seating')); await wait(7000);
  await mv(() => window.__moonveil.setScene('night')); await wait(11000);
  await mv(() => window.__moonveil.setScene('day')); await wait(8500);
  await mv(() => window.__moonveil.setScene('ghost')); await wait(1500);
  await mv(() => window.__moonveil.walk(980, 420)); await wait(3200);
  await mv(() => window.__moonveil.walk(1400, 760)); await wait(3000);
  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  const mp4 = join(outDir, 'motion.mp4');
  if (existsSync(mp4)) unlinkSync(mp4);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'scale=960:-2,fps=24', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
  console.log('video', mp4, Math.round(statSync(mp4).size / 1024), 'KB');
  for (const f of readdirSync(raw)) if (f.endsWith('.webm')) unlinkSync(join(raw, f));
}
await browser.close();
