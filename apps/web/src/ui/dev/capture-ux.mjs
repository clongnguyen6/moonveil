// Before/after captures for UX audits (scene off = light run). Usage: node scripts/env.mjs node apps/web/src/ui/dev/capture-ux.mjs <before|after>
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../../..');
const tag = process.argv[2] ?? 'before';
const out = join(root, 'docs/ui/screens-ux', tag);
mkdirSync(out, { recursive: true });
const port = process.env.WEB_PORT ?? '4401';
const base = `http://127.0.0.1:${port}/src/ui/dev/index.html`;
console.log('[scene] off');
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const cr = await chromium.launch();
for (const [size, opts] of Object.entries(sizes)) {
  for (const lang of ['vi', 'en']) {
    const ctx = await cr.newContext({ ...opts, locale: lang === 'vi' ? 'vi-VN' : 'en-US', reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; });
    const page = await ctx.newPage();
    const shot = (name) => page.screenshot({ path: join(out, `${size}-${lang}-${name}.png`), fullPage: size === 'phone' });
    await page.goto(`${base}?scenario=entry&lang=${lang}&bar=0&sound=0`); await page.waitForSelector('[data-testid=entry]'); await shot('entry');
    await page.goto(`${base}?scenario=lobby&lang=${lang}&bar=0&sound=0`); await page.waitForSelector('[data-testid=lobby]'); await shot('lobby-host');
    // the dock scrolls internally: capture the rest of the lobby in viewport-sized steps
    for (let i = 2; i <= 4; i++) { const more = await page.evaluate(() => { const d = document.querySelector('.dock'); if (!d) return false; const before = d.scrollTop; d.scrollTop += d.clientHeight - 40; return d.scrollTop > before; }); if (!more) break; await page.waitForTimeout(120); await shot(`lobby-host-${i}`); }
    const settingsBtn = page.locator('[data-testid=open-settings]');
    if (await settingsBtn.count()) { await settingsBtn.click(); await page.waitForTimeout(200); await shot('settings'); await page.keyboard.press('Escape'); }
    await page.goto(`${base}?scenario=day&lang=${lang}&bar=0&sound=0`); await page.waitForSelector('[data-testid=match]');
    await page.locator('.topbar .tools .btn').last().click(); await page.waitForTimeout(200); await shot('settings-match'); await page.keyboard.press('Escape');
    await page.evaluate(() => globalThis.__stub.setViewer(globalThis.__stub.players[1].id)); await page.goto(`${base}?scenario=lobby&lang=${lang}&bar=0&sound=0`); await page.waitForSelector('[data-testid=lobby]');
    await page.evaluate(() => globalThis.__stub.setViewer(globalThis.__stub.players[1].id)); await page.waitForTimeout(150); await shot('lobby-player');
    for (let i = 2; i <= 3; i++) { const more = await page.evaluate(() => { const d = document.querySelector('.dock'); if (!d) return false; const before = d.scrollTop; d.scrollTop += d.clientHeight - 40; return d.scrollTop > before; }); if (!more) break; await page.waitForTimeout(120); await shot(`lobby-player-${i}`); }
    await ctx.close();
  }
}
await cr.close();
console.log('written', out);
