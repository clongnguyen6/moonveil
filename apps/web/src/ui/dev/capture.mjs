// Screenshots of every scenario at phone portrait / phone landscape / laptop, plus WebKit phone (grant b).
// All browser emulation. Run with vite up on WEB_PORT (default 4401):
//   node scripts/env.mjs node apps/web/src/ui/dev/capture.mjs [--webkit] [--only name]
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../../..');
const out = join(root, 'docs/ui/screens');
mkdirSync(out, { recursive: true });
const port = process.env.WEB_PORT ?? '4401';
const base = `http://127.0.0.1:${port}/src/ui/dev/index.html`;
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const withWebkit = args.includes('--webkit');

const SCENARIOS = ['entry', 'lobby', 'role', 'night-wolf', 'night-seer', 'night-guard', 'night-villager', 'witch', 'hunter', 'day', 'vote', 'defense', 'confirm', 'ghost', 'ended', 'moderator', 'moderator-day', 'stalemate'];
const SHEETS = { role: 'open-role', help: 'open-help', chat: 'open-chat' };

const sizes = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

async function shoot(browser, tag, ctxOpts, list, lang) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: lang === 'vi' ? 'vi-VN' : 'en-US', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const sc of list) {
    if (only && sc !== only) continue;
    await page.goto(`${base}?scenario=${sc}&lang=${lang}&bar=0&sound=0`);
    await page.waitForSelector('[data-testid=app]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, `${tag}-${sc}.png`) });
    if (sc === 'role') {
      await page.getByTestId('open-role').click();
      await page.getByTestId('role-card').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `${tag}-role-card.png`) });
      await page.keyboard.press('Escape');
    }
    if (sc === 'day' && tag.endsWith('phone')) {
      for (const [name, tid] of Object.entries(SHEETS)) {
        if (name === 'role') continue;
        await page.getByTestId(tid).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(out, `${tag}-day-${name}.png`) });
        await page.keyboard.press('Escape');
      }
      await page.evaluate(() => globalThis.__stub.simulateReconnect(4000));
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `${tag}-day-reconnecting.png`) });
    }
    if (sc === 'ghost' && tag.endsWith('phone')) {
      await page.getByTestId('open-chat').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `${tag}-ghost-chat.png`) });
      await page.keyboard.press('Escape');
    }
  }
  await ctx.close();
}

const cr = await chromium.launch();
await shoot(cr, 'phone', sizes.phone, SCENARIOS, 'vi');
await shoot(cr, 'laptop', sizes.laptop, SCENARIOS, 'en');
await shoot(cr, 'landscape', sizes.landscape, ['night-wolf', 'vote', 'moderator'], 'vi');
await cr.close();
if (withWebkit) {
  const wk = await webkit.launch();
  await shoot(wk, 'webkit-phone', { ...devices['iPhone 13'] }, ['lobby', 'night-seer', 'confirm'], 'vi');
  await wk.close();
}
console.log('captures written to', out);
