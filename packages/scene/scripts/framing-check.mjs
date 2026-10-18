// Campfire framing in the real UI (game UI stub scenarios, chat row present): captures + measured camera scale,
// smallest on-screen name label and whether the seats' box clears the chat row and top bar. Browser EMULATION.
// Needs the browser lock. Starts apps/web vite on FRAMING_PORT (default 4210).
//   node scripts/env.mjs node packages/scene/scripts/framing-check.mjs --out docs/visual/framing/after [--engine webkit]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, webkit } from '@playwright/test';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(root, arg('--out', 'docs/visual/framing/after'));
const engine = arg('--engine', 'chromium') === 'webkit' ? webkit : chromium;
const port = Number(process.env.FRAMING_PORT ?? 4210);
mkdirSync(out, { recursive: true });

const VIEWS = {
  'phone-375x667': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'phone-390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'landscape-844x390': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'laptop-1440x900': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  'laptop-1280x720': { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
};
const SCENARIOS = (arg('--scenarios', 'day,vote,night-villager,night-wolf,ghost,ended')).split(',');

const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: join(root, 'apps/web'), stdio: ['ignore', 'pipe', 'pipe'] });
const ready = new Promise((ok, fail) => { vite.stdout.on('data', (d) => { if (String(d).includes('Local')) ok(); }); vite.on('exit', (c) => fail(new Error(`vite exited ${c}`))); });
const rows = [];
try {
  await ready;
  const browser = await engine.launch();
  for (const [tag, ctxOpts] of Object.entries(VIEWS)) {
    const ctx = await browser.newContext({ ...ctxOpts, locale: 'vi-VN' });
    await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'high'; globalThis.__MOONVEIL_SCENE_DEBUG = true; });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror', tag, e.message));
    for (const sc of SCENARIOS) {
      await page.goto(`http://127.0.0.1:${port}/src/ui/dev/index.html?scenario=${sc}&lang=vi&bar=0&sound=0`);
      await page.waitForSelector('[data-testid=app]');
      await page.waitForFunction(() => globalThis.__moonveilScene?.debugCamera?.(), null, { timeout: 15000 });
      await page.waitForTimeout(2500);   // camera settles (phase framing eases in)
      const m = await page.evaluate(() => {
        const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height ? { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom } : null; };
        const cam = globalThis.__moonveilScene.debugCamera();
        const slot = r('[data-testid=scene-slot]');
        const a = cam.avatars && slot ? { x0: cam.avatars.x0 + slot.x0, y0: cam.avatars.y0 + slot.y0, x1: cam.avatars.x1 + slot.x0, y1: cam.avatars.y1 + slot.y0 } : null;
        const chat = r('[data-testid=chat-recent]') ?? r('[data-testid=chat-overlay]');
        const top = r('.topbar') ?? r('[data-testid=topbar]');
        const hit = (p, q) => !!(p && q && p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1);
        return { scale: cam.scale, labelPx: cam.labelPx, slot, avatars: a, chat, top, overChat: hit(a, chat), overTop: hit(a, top), safeBottom: cam.safe.bottom };
      });
      await page.screenshot({ path: join(out, `${tag}-${sc}.png`) });
      rows.push({ view: tag, scenario: sc, ...m });
      console.log(`${tag} ${sc}: scale ${m.scale.toFixed(3)} label ${m.labelPx.toFixed(1)}px safeBottom ${m.safeBottom} seats-over-chat ${m.overChat} seats-over-topbar ${m.overTop}`);
    }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(join(out, 'framing.json'), JSON.stringify(rows, null, 1) + '\n');
} finally { vite.kill('SIGTERM'); }
