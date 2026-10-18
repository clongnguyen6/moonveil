// Picker screenshots (stub, scene ON: the own avatar previews the draft; needs the lock).
//   node scripts/env.mjs node apps/web/src/ui/dev/capture-picker.mjs      (vite on WEB_PORT, default 4401)
// → docs/ui/screens-picker/{phone,laptop}-{entry,editor-camper,editor-shark,editor-duck}.png (browser emulation)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
const port = process.env.WEB_PORT ?? '4401';
const base = `http://127.0.0.1:${port}/src/ui/dev/index.html`;
const out = join(process.cwd(), process.env.CAPTURE_DIR ?? 'docs/ui/screens-picker');
mkdirSync(out, { recursive: true });
console.log('[scene] on (captures; needs the lock)');
const sizes = { phone: [{ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'vi'], laptop: [{ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, 'en'] };
const browser = await chromium.launch();
for (const [tag, [opts, lang]] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const go = async (sc) => { await page.goto(`${base}?scenario=${sc}&lang=${lang}&bar=0&sound=0`); await page.waitForSelector('[data-testid=app]'); await page.waitForTimeout(1000); };
  const shot = async (name, el) => { await page.waitForTimeout(1000); await (el ? page.locator(el) : page).screenshot({ path: join(out, `${tag}-${name}.png`) }); };
  await go('entry');
  await page.getByTestId('name').fill('Linh'); await page.getByTestId('outfit-bowCat').click();
  await shot('entry');
  await go('lobby');
  await page.getByTestId('edit-profile').click();
  // the editor sits in the dock; scroll it into view so the picker and the scene preview are both on screen
  await page.getByTestId('look-picker').scrollIntoViewIfNeeded();
  await shot('editor-camper');
  await page.getByTestId('outfit-fish').click(); await page.getByTestId('variant-shark').click(); await page.getByTestId('color-slate').click(); await page.getByTestId('back').selectOption('finPouch');
  await page.getByTestId('look-picker').scrollIntoViewIfNeeded();
  await shot('editor-shark');
  await page.getByTestId('outfit-duck').click(); await page.getByTestId('variant-ring').click();
  await page.getByTestId('look-picker').scrollIntoViewIfNeeded();
  await shot('editor-duck');
  await ctx.close();
}
await browser.close();
console.log('captures written to', out);
