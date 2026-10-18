// Layout/accessibility checks over every scenario and sheet, at phone portrait, phone landscape and laptop,
// in Chromium headless shell and WebKit (browser emulation). Asserts: no horizontal overflow, visible text ≥ 13px,
// interactive targets ≥ 44×44 CSS px (icons ≥ 40), safe-area padding applied, text contrast ≥ 4.5:1 on its surface,
// no clipped primary buttons (fully inside the viewport when the dock is scrolled to them), and top-bar controls fully
// visible, unobstructed and ≥ 44 px at phone landscape (844×390, 667×375, 932×430, iPhone 13 landscape in WebKit).
//   node scripts/env.mjs node apps/web/src/ui/dev/layout-check.mjs [--webkit]   (vite on WEB_PORT, default 4401)
import { chromium, devices, webkit } from '@playwright/test';

const port = process.env.WEB_PORT ?? '4401';
const base = `http://127.0.0.1:${port}/src/ui/dev/index.html`;
const withWebkit = process.argv.includes('--webkit');
console.log('[scene] off');
const SCENARIOS = ['entry', 'lobby', 'role', 'night-wolf', 'night-seer', 'night-villager', 'witch', 'hunter', 'day', 'vote', 'defense', 'confirm', 'ghost', 'ended', 'moderator', 'moderator-day'];
const SHEETS = ['open-role', 'open-chat', 'open-help'];
const sizes = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
let fails = 0, total = 0;
const report = (tag, name, problems) => { total++; const ok = problems.length === 0; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${tag} ${name}${ok ? '' : '\n    ' + problems.slice(0, 6).join('\n    ')}`); };

const AUDIT = () => {
  const out = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) out.push(`horizontal overflow ${document.documentElement.scrollWidth}>${vw}`);
  for (const el of document.querySelectorAll('.dock, .lobby, .sheet-body, .entry')) if (el.scrollWidth > el.clientWidth + 1) out.push(`overflow in ${el.className.split(' ')[0]} ${el.scrollWidth}>${el.clientWidth}`);
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  // text size
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode; if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || seen.has(el) || !visible(el) || el.closest('[data-testid=devbar], .sr-only')) continue;
    seen.add(el);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 13) out.push(`text ${fs}px: "${n.textContent.trim().slice(0, 30)}"`);
  }
  // targets
  for (const el of document.querySelectorAll('button, [role=button], input, select, textarea, a[href], [role=tab]')) {
    if (!visible(el) || el.closest('[data-testid=devbar]')) continue;
    let r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.right < 0) continue; // offscreen helpers (e.g. PixiJS accessibility button)
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) r = el.closest('label').getBoundingClientRect(); // the label is the target
    const min = el.classList.contains('icon') || el.classList.contains('swatch') ? 40 : 44;
    const minW = min;
    if (r.height < min - 0.5 || r.width < minW - 0.5) out.push(`target ${Math.round(r.width)}×${Math.round(r.height)} <${min}: ${(el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24)}`);
  }
  // contrast (text vs nearest opaque-ish background)
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = (el) => { let bg = { r: 28, g: 43, b: 34, a: 1 }; const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e); for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) bg = blend(c, bg); } return bg; };
  for (const el of seen) {
    if (el.closest('.scene-host, .topbar, .overlay-announce, .toast')) continue; // over imagery: separate shadow treatment
    const fg = parse(getComputedStyle(el).color); if (!fg) continue;
    const bg = bgOf(el); const f = blend(fg, bg);
    const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const fs = parseFloat(getComputedStyle(el).fontSize); const bold = parseInt(getComputedStyle(el).fontWeight) >= 700;
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) out.push(`contrast ${ratio.toFixed(2)}<${need}: "${el.textContent.trim().slice(0, 24)}"`);
  }
  // safe area: dock / lobby bottom padding uses env(); in emulation env()=0, so check the max() floor ≥ 8px
  for (const el of document.querySelectorAll('.dock, .lobby, .sheet-body')) { const pb = parseFloat(getComputedStyle(el).paddingBottom); if (visible(el) && pb < 8) out.push(`bottom padding ${pb}px in ${el.className.split(' ')[0]}`); }
  return out;
};
// Top bar: every control fully inside the visible scene host (not clipped by its overflow), hit-testable at its centre
// (nothing on top), and ≥ min px. min = 44 at phone landscape sizes.
const TOPBAR = (min) => {
  const out = [];
  const host = document.querySelector('.topbar')?.closest('.scene-host'); if (!host) return out;
  const h = host.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  for (const el of document.querySelectorAll('.topbar button, .topbar [role=button]')) {
    const r = el.getBoundingClientRect(), name = (el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24);
    if (r.width === 0 || getComputedStyle(el).display === 'none') continue;
    if (r.left < Math.max(0, h.left) - 0.5 || r.right > Math.min(vw, h.right) + 0.5 || r.top < Math.max(0, h.top) - 0.5 || r.bottom > Math.min(vh, h.bottom) + 0.5) out.push(`top bar control clipped: ${name} [${Math.round(r.left)},${Math.round(r.right)}] host [${Math.round(h.left)},${Math.round(h.right)}]`);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !(el === hit || el.contains(hit))) out.push(`top bar control covered at its centre: ${name}`);
    if (r.width < min - 0.5 || r.height < min - 0.5) out.push(`top bar control ${Math.round(r.width)}×${Math.round(r.height)} <${min}: ${name}`);
  }
  return out;
};

async function run(browser, tag, ctxOpts, lang) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: lang === 'vi' ? 'vi-VN' : 'en-US', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'vi', sound: false, reducedMotion: 'on', modNarration: true, ambience: false, scene: false })); });
  const page = await ctx.newPage();
  for (const sc of SCENARIOS) {
    await page.goto(`${base}?scenario=${sc}&lang=${lang}&bar=0&sound=0`);
    await page.waitForSelector('[data-testid=app]');
    await page.waitForTimeout(250);
    report(tag, sc, await page.evaluate(AUDIT));
    if (await page.locator('.topbar').count()) report(tag, `${sc} top bar controls visible and tappable`, await page.evaluate(TOPBAR, tag.includes('landscape') ? 44 : 40));
    // primary button reachable: scroll the dock to the confirm button and check it's inside the viewport
    const confirm = page.locator('[data-testid=confirm], [data-testid=start], [data-testid=close-step], [data-testid=vote-yes], [data-testid=leave]').first();
    if (await confirm.count()) { await confirm.scrollIntoViewIfNeeded(); const b = await confirm.boundingBox(); const vp = page.viewportSize(); report(tag, `${sc} primary button inside viewport`, b && b.y >= 0 && b.y + b.height <= vp.height + 0.5 ? [] : [`button at y=${b?.y} h=${b?.height} vp=${vp.height}`]); }
    if (sc === 'day' || sc === 'role') {
      for (const tid of SHEETS) {
        if (!(await page.getByTestId(tid).count())) continue;
        await page.getByTestId(tid).click();
        await page.waitForTimeout(250);
        if (tid === 'open-role' && (await page.getByTestId('role-card').count())) await page.getByTestId('role-card').click();
        report(tag, `${sc} sheet ${tid}`, await page.evaluate(AUDIT));
        await page.keyboard.press('Escape');
      }
    }
  }
  await ctx.close();
}

const cr = await chromium.launch();
await run(cr, 'chromium/phone', sizes.phone, 'vi');
await run(cr, 'chromium/landscape', sizes.landscape, 'vi');
await run(cr, 'chromium/landscape-667', { ...sizes.landscape, viewport: { width: 667, height: 375 } }, 'vi');
await run(cr, 'chromium/landscape-932', { ...sizes.landscape, viewport: { width: 932, height: 430 } }, 'en');
await run(cr, 'chromium/laptop', sizes.laptop, 'en');
await cr.close();
if (withWebkit) {
  const wk = await webkit.launch();
  await run(wk, 'webkit/phone', { ...devices['iPhone 13'] }, 'vi');
  await run(wk, 'webkit/landscape', { ...devices['iPhone 13 landscape'] }, 'vi');
  await wk.close();
}
console.log(`${total - fails}/${total} layout checks pass${fails ? ` · ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);
