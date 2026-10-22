// Halloween preview captures (stub, scene ON at `high`; needs the lock). Before = default theme, after = ?theme=halloween
// (dev-only UI accents + the scene's dev-only overlay). JPEG, browser emulation.
//   node scripts/env.mjs node apps/web/src/ui/dev/capture-halloween.mjs     (vite on WEB_PORT, default 4401)
// → docs/ui/screens-halloween/{before,after}-{phone,laptop}-{lobby,day,night}.jpg
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const base = `http://127.0.0.1:${process.env.WEB_PORT ?? '4401'}/src/ui/dev/index.html`;
const out = 'docs/ui/screens-halloween';
mkdirSync(out, { recursive: true });
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const shots = { lobby: 'lobby', day: 'day', night: 'night-wolf' };
console.log('[scene] on (high), reduced motion');
const browser = await chromium.launch();
let fails = 0;
for (const [tag, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce', locale: 'en-US' });
  await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'high'; });
  const page = await ctx.newPage();
  for (const [when, q] of [['before', ''], ['after', '&theme=halloween']]) {
    for (const [name, sc] of Object.entries(shots)) {
      await page.goto(`${base}?scenario=${sc}&lang=en&bar=0&sound=0${q}`);
      await page.waitForSelector('[data-testid=app]');
      await page.waitForTimeout(1800);   // scene bakes and settles (reduced motion = 4 fps)
      const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'default');
      const want = q ? 'halloween' : 'default';
      if (theme !== want) { fails++; console.log(`FAIL  ${when}-${tag}-${name}: theme ${theme}, want ${want}`); }
      await page.screenshot({ path: `${out}/${when}-${tag}-${name}.jpg`, type: 'jpeg', quality: 80 });
      console.log(`${out}/${when}-${tag}-${name}.jpg (theme ${theme})`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
