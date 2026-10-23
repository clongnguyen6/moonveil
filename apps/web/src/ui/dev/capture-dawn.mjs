// Dawn presentation captures (stub, scene ON at `high`; needs the lock). Dawn with 2 deaths (wolves' victim + Witch
// poison), watched by a survivor and by the poisoned player, phone + laptop, Normal + Halloween: the overlay at +500 ms
// and the panel (recap) after it ends. JPEG, browser emulation.
//   CAPTURE_TAG=before|after node scripts/env.mjs node apps/web/src/ui/dev/capture-dawn.mjs     (vite on WEB_PORT, 4401)
// → docs/ui/screens-dawn/<tag>-<phone|laptop>-<normal|halloween>-<survivor|victim>-<1-overlay|2-recap>.jpg
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const base = `http://127.0.0.1:${process.env.WEB_PORT ?? '4401'}/src/ui/dev/index.html`;
const tag = process.env.CAPTURE_TAG ?? 'after';
const out = 'docs/ui/screens-dawn';
mkdirSync(out, { recursive: true });
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const browser = await chromium.launch();
console.log(`[scene] on (high) · ${tag}`);
for (const [dev, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'no-preference', locale: 'en-US' });
  await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'high'; });
  const page = await ctx.newPage();
  const stub = (fn, ...a) => page.evaluate(([f, x]) => new Function('r', 'a', `return (${f})(r, ...a)`)(globalThis.__stub, x), [fn.toString(), a]);
  for (const theme of ['normal', 'halloween']) {
    for (const who of ['survivor', 'victim']) {
      await page.goto(`${base}?scenario=witch&lang=en&bar=0&sound=0&theme=${theme}`);
      await page.waitForSelector('[data-testid=app]');
      if (theme === 'halloween') await page.waitForFunction(() => document.documentElement.dataset.theme === 'halloween', null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await stub((r, w) => {
        const g = r.game, seats = g.match.seats, idOf = (i) => g.seatIds[i];
        const witch = seats.find((s) => s.role === 'witch').seat, victim = g.match.nightRec.victim;
        const poisoned = seats.find((s) => s.alive && ![witch, victim].includes(s.seat) && !['wolf', 'hunter'].includes(s.role)).seat;
        const survivor = seats.find((s) => s.alive && ![witch, victim, poisoned].includes(s.seat) && s.role !== 'hunter').seat;
        r.drive({ type: 'witch.heal', seat: witch, use: false });
        r.drive({ type: 'witch.poison', seat: witch, target: poisoned });
        r.setViewer(idOf(w === 'victim' ? poisoned : survivor));
      }, who);
      await page.waitForTimeout(800);
      await stub((r) => r.closeStep());
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${tag}-${dev}-${theme}-${who}-1-overlay.jpg`, type: 'jpeg', quality: 76 });
      await page.waitForTimeout(7000);
      await page.screenshot({ path: `${out}/${tag}-${dev}-${theme}-${who}-2-recap.jpg`, type: 'jpeg', quality: 76 });
      console.log(`${dev} ${theme} ${who}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log('done');
