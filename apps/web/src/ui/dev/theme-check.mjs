// Theme setting in the real app (built dist on the real server; scene ON for 3 seats: phone high, laptop high, laptop low).
//   node scripts/env.mjs node apps/web/src/ui/dev/theme-check.mjs      (builds dist; server on THEME_PORT, default 4467)
//   ... --base=<url>   LIVE MODE: own fresh room only, no build/server, no voice, no match (see below)
// Proves: default Normal with no Halloween file requested; Settings → Halloween applies UI + scene together, Normal
// removes both, at day and at night; persisted across a reload; low profile static; a failed scene-overlay download
// keeps BOTH Normal (setting back to Normal, note shown) and a retry works; night header identical for wolf and non-wolf
// with the theme on. Captures → docs/ui/screens-halloween/toggle/*.jpg (browser emulation).
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// ---------------------------------------------------------------------------------------------------------------------
// LIVE MODE (post-deploy proof):  node scripts/env.mjs node apps/web/src/ui/dev/theme-check.mjs --base=https://www.moonveil.id.vn
// Read-only towards everyone else: creates ONE fresh automatic room, 3 pages of its own (laptop high, phone high, a fresh
// low page for the failure case), never joins voice, never starts a match, every page leaves (the room closes when its
// last seat leaves) and the browser closes. Captures go to .cache/theme-live/ (not committed). Exits 1 on any failure;
// stops at once with "Settings has no Theme row" on a build without the theme.
const BASE = process.argv.find((a) => a.startsWith('--base='))?.slice('--base='.length).replace(/\/$/, '');
if (BASE) {
  const out = `.cache/theme-live/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  mkdirSync(out, { recursive: true });
  let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
  console.log(`[live] ${BASE} · captures → ${out} · scene on (high, high, low) · no voice`);
  const browser = await chromium.launch();
  const pages = [];
  const tag = `T${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const mk = async (name, dev, q) => {
    const ctx = await browser.newContext({ ...dev, reducedMotion: 'reduce', locale: 'en-US' });
    // first load only: a reload must keep the player's saved choice (the persistence check)
    await ctx.addInitScript((qq) => { globalThis.__MOONVEIL_SCENE = qq; globalThis.__MOONVEIL_SCENE_DEBUG = true; if (!localStorage.getItem('moonveil.ui.settings')) localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: true })); }, q);
    const page = await ctx.newPage(); const reqs = [];
    page.on('request', (r) => { if (/halloween/i.test(r.url())) reqs.push(r.url().split('/').pop()); });
    const p = { name, q, phone: !!dev.isMobile, ctx, page, reqs, st: () => page.evaluate(() => ({ ui: document.documentElement.dataset.theme ?? 'normal', link: !!document.getElementById('moonveil-theme-halloween'), setting: JSON.parse(localStorage.getItem('moonveil.ui.settings') ?? '{}').theme ?? 'normal', scene: globalThis.__moonveilScene?.debugTheme?.() ?? null, note: !!document.querySelector('[data-testid=theme-note]') })) };
    pages.push(p); return p;
  };
  const sceneTheme = (s) => s.scene?.theme ?? null;
  // wait for the applied theme; `orNote` also accepts the failure note (only for the deliberately blocked attempt; a note
  // still showing from that attempt must not end the retry's wait early)
  const settle = (p, theme, orNote = false) => p.page.waitForFunction(([t, n]) => (document.documentElement.dataset.theme ?? 'normal') === t || (n && !!document.querySelector('[data-testid=theme-note]')), [theme, orNote], { timeout: 30000 }).catch(() => {});
  const pick = async (p, theme, orNote = false) => { await p.page.getByTestId('open-settings').click(); await p.page.getByTestId('set-theme').selectOption(theme); await p.page.keyboard.press('Escape'); await settle(p, theme, orNote); await p.page.waitForTimeout(800); };
  const shot = (p, name) => p.page.screenshot({ path: `${out}/${p.phone ? 'phone' : 'laptop'}-${name}-${p.q}.jpg`, type: 'jpeg', quality: 75 });
  // block only the scene overlay chunk: any halloween-*.js whose body defines the overlay (works without knowing the build's file names)
  const blockOverlay = async (route) => { const r = await route.fetch(); const body = await r.text(); if (body.includes('HalloweenOverlay') && !body.includes('createRoot')) return route.abort(); return route.fulfill({ response: r, body }); };
  let code = null;
  try {
    const L = await mk(`${tag}-An`, { viewport: { width: 1440, height: 900 } }, 'high');
    await L.page.goto(`${BASE}/`); await L.page.getByTestId('name').fill(`${tag}-An`); await L.page.getByTestId('create-automatic').click(); await L.page.waitForSelector('[data-testid=room-code]', { timeout: 30000 });
    code = (await L.page.getByTestId('room-code').textContent()).trim();
    console.log(`[live] own room ${code}`);
    const P = await mk(`${tag}-Binh`, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'high');
    await P.page.goto(`${BASE}/r/${code}`); await P.page.getByTestId('name').fill(`${tag}-Binh`); await P.page.getByTestId('join').click(); await P.page.waitForSelector('[data-testid=room]', { timeout: 30000 });
    await L.page.waitForTimeout(2500);
    // precheck: a build with the theme has the Settings row
    await L.page.getByTestId('open-settings').click();
    const hasRow = (await L.page.getByTestId('set-theme').count()) === 1;
    await L.page.keyboard.press('Escape');
    if (!hasRow) { ok('Settings has no Theme row', false, 'this deploy does not contain the Halloween theme (Settings → Theme missing)'); throw new Error('no-theme-row'); }
    for (const p of [L, P]) { const s = await p.st(); ok(`${p.name}: default Normal (UI, setting, scene) and no Halloween chunk or CSS requested`, s.ui === 'normal' && !s.link && s.setting === 'normal' && sceneTheme(s) === null && p.reqs.length === 0, JSON.stringify({ s, reqs: p.reqs })); }
    for (const p of [L, P]) {
      await shot(p, '1-normal');
      await pick(p, 'halloween'); const on = await p.st();
      ok(`${p.name}: Settings → Halloween shows the UI theme AND the scene overlay`, on.ui === 'halloween' && on.link && sceneTheme(on) === 'halloween' && on.scene.counts?.pumpkins > 0, JSON.stringify(on));
      await shot(p, '2-halloween');
    }
    await P.page.reload(); await P.page.waitForSelector('[data-testid=room]', { timeout: 30000 }); await settle(P, 'halloween'); await P.page.waitForTimeout(800);
    const re = await P.st();
    ok('reload: the choice persists; UI + scene Halloween again', re.setting === 'halloween' && re.ui === 'halloween' && sceneTheme(re) === 'halloween', JSON.stringify(re));
    for (const p of [L, P]) {
      await pick(p, 'normal'); const off = await p.st();
      ok(`${p.name}: Settings → Normal removes both (no stylesheet, no overlay)`, off.ui === 'normal' && !off.link && sceneTheme(off) === null && off.setting === 'normal', JSON.stringify(off));
      await shot(p, '3-normal-again');
    }
    // fresh isolated page that never loaded the overlay: block the overlay chunk → both stay Normal + note; retry works
    const F = await mk(`${tag}-Fay`, { viewport: { width: 1280, height: 800 } }, 'low');
    await F.page.goto(`${BASE}/r/${code}`); await F.page.getByTestId('name').fill(`${tag}-Fay`); await F.page.getByTestId('join').click(); await F.page.waitForSelector('[data-testid=room]', { timeout: 30000 });
    await F.page.waitForTimeout(2500);
    await F.page.route(/halloween-[^/]*\.js(\?|$)/, blockOverlay);
    await pick(F, 'halloween', true); const failed = await F.st();
    ok('blocked overlay chunk (fresh page): UI stays Normal too, setting back to Normal, note shown', failed.ui === 'normal' && !failed.link && sceneTheme(failed) === null && failed.setting === 'normal' && failed.note, JSON.stringify(failed));
    await shot(F, '4-failed-note');
    await F.page.unroute(/halloween-[^/]*\.js(\?|$)/, blockOverlay);
    await pick(F, 'halloween'); const retry = await F.st();
    ok('retry after the failure: UI + scene Halloween', retry.ui === 'halloween' && sceneTheme(retry) === 'halloween' && !retry.note, JSON.stringify(retry));
    await pick(F, 'normal');
  } catch (e) {
    if (e.message !== 'no-theme-row') { fails++; console.log(`FAIL  live run aborted: ${e.message}`); }
  } finally {
    // leave the room from every page (host last), then close everything
    for (const p of [...pages].reverse()) await p.page.getByTestId('leave').click({ timeout: 5000 }).then(() => p.page.waitForSelector('[data-testid=entry]', { timeout: 10000 })).catch(() => {});
    if (code) { const left = await Promise.all(pages.map((p) => p.page.locator('[data-testid=room]').count().catch(() => 0))); console.log(`[live] left room ${code}: ${left.every((n) => n === 0) ? 'all pages out' : 'NOT all pages left ' + JSON.stringify(left)}`); }
    await browser.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
}
// ---------------------------------------------------------------------------------------------------------------------
const port = Number(process.env.THEME_PORT ?? 4467), base = `http://127.0.0.1:${port}`;
const out = 'docs/ui/screens-halloween/toggle';
mkdirSync(out, { recursive: true });
const sh = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exit ${c}`)))); });
await sh('npm', ['run', 'build', '-w', '@moonveil/web']);
const assets = readdirSync('apps/web/dist/assets');
const sceneChunk = assets.find((f) => f.endsWith('.js') && readFileSync(`apps/web/dist/assets/${f}`, 'utf8').includes('HalloweenOverlay') && !readFileSync(`apps/web/dist/assets/${f}`, 'utf8').includes('createRoot'));
const cssChunk = assets.find((f) => /^halloween-.*\.css$/.test(f));
const entry = readFileSync('apps/web/dist/index.html', 'utf8');
const server = spawn('node', ['apps/server/src/main.ts'], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'rules', MOONVEIL_PERSIST: '0' } });
process.on('exit', () => server.kill('SIGTERM'));
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
ok(`build: overlay chunk ${sceneChunk} and stylesheet ${cssChunk} exist and index.html references neither`, !!sceneChunk && !!cssChunk && !entry.includes('halloween'));
const browser = await chromium.launch();
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LAPTOP = { viewport: { width: 1440, height: 900 } };
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh', 'Minh', 'Fay'];
// Fay: a fresh scene that has never loaded the overlay, used only for the failed-download case
const SCENE = { 0: ['high', LAPTOP], 1: ['high', PHONE], 2: ['low', LAPTOP], 8: ['low', LAPTOP] };
const ps = [];
for (const [i, n] of NAMES.entries()) {
  const [q, dev] = SCENE[i] ?? ['off', i % 2 ? PHONE : LAPTOP];
  const ctx = await browser.newContext({ ...dev, reducedMotion: 'reduce', locale: 'en-US' });
  await ctx.addInitScript((qq) => { globalThis.__MOONVEIL_SCENE = qq; globalThis.__MOONVEIL_SCENE_DEBUG = true; if (!localStorage.getItem('moonveil.ui.settings')) localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: qq !== 'off' })); }, q);
  const page = await ctx.newPage(); const reqs = [];
  page.on('request', (r) => { if (/halloween/i.test(r.url())) reqs.push(r.url().split('/').pop()); });
  ps.push({ n, q, phone: dev === PHONE, ctx, page, reqs, st: () => page.evaluate(() => ({ ui: document.documentElement.dataset.theme ?? 'normal', link: !!document.getElementById('moonveil-theme-halloween'), setting: JSON.parse(localStorage.getItem('moonveil.ui.settings') ?? '{}').theme ?? 'normal', scene: globalThis.__moonveilScene?.debugTheme?.() ?? null, note: !!document.querySelector('[data-testid=theme-note]'), role: globalThis.__moonveil.getState().view?.game?.me?.role ?? null })) });
}
const [L, P, LOW] = ps; const FAY = ps[8];
// choose in Settings, then wait for the result (applied, or the failure note): the first Halloween choice downloads and
// builds the scene overlay, which takes a few seconds under load
const pick = async (p, theme) => {
  await p.page.getByTestId('open-settings').click(); await p.page.getByTestId('set-theme').selectOption(theme); await p.page.keyboard.press('Escape');
  await p.page.waitForFunction((t) => (document.documentElement.dataset.theme ?? 'normal') === t || !!document.querySelector('[data-testid=theme-note]'), theme, { timeout: 20000 }).catch(() => {});
  await p.page.waitForTimeout(800);
};
const shot = (p, name) => p.page.screenshot({ path: `${out}/${p.phone ? 'phone' : 'laptop'}-${name}-${p.q}.jpg`, type: 'jpeg', quality: 78 });
const sceneTheme = (s) => s.scene?.theme ?? null;

// Moderated room: night and day last until the moderator closes them, so every night/day toggle and capture happens
// in that state (an automatic 60 s night ran out during the overlay downloads).
const M = await (async () => { const ctx = await browser.newContext({ ...LAPTOP, reducedMotion: 'reduce' }); await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: false })); }); return { page: await ctx.newPage() }; })();
await M.page.goto(`${base}/`); await M.page.getByTestId('name').fill('Mod'); await M.page.getByTestId('create-moderator').click(); await M.page.waitForSelector('[data-testid=room-code]');
const code = (await M.page.getByTestId('room-code').textContent()).trim();
for (const p of ps) { await p.page.goto(`${base}/r/${code}`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId('join').click(); await p.page.waitForSelector('[data-testid=room]'); }
await L.page.waitForTimeout(1500);
for (const p of [L, P, LOW, FAY]) { const s = await p.st(); ok(`${p.n} (${p.q}): default Normal (UI, setting, scene) and no Halloween file requested`, s.ui === 'normal' && !s.link && s.setting === 'normal' && sceneTheme(s) === null && p.reqs.length === 0, JSON.stringify({ s, reqs: p.reqs })); }
// lobby: persistence across a reload (phone)
await pick(P, 'halloween'); await P.page.reload(); await P.page.waitForSelector('[data-testid=room]');
await P.page.waitForFunction(() => document.documentElement.dataset.theme === 'halloween', null, { timeout: 20000 }).catch(() => {}); await P.page.waitForTimeout(500);
const re = await P.st();
ok('reload: the choice persists and UI + scene are Halloween again', re.setting === 'halloween' && re.ui === 'halloween' && sceneTheme(re) === 'halloween', JSON.stringify(re));
await pick(P, 'normal');
// lobby: failed scene-overlay download on a scene that never loaded it (stylesheet allowed, overlay chunk blocked)
const blockOverlay = (u) => u.pathname.endsWith(`/${sceneChunk}`);
await FAY.page.route(blockOverlay, (r) => r.abort());
await pick(FAY, 'halloween'); const failed = await FAY.st();
ok('scene overlay fails to load: UI stays Normal too, setting back to Normal, note shown', failed.ui === 'normal' && !failed.link && sceneTheme(failed) === null && failed.setting === 'normal' && failed.note && FAY.reqs.some((r) => r === sceneChunk), JSON.stringify({ failed, reqs: FAY.reqs }));
await FAY.page.unroute(blockOverlay);
await pick(FAY, 'halloween'); const retry = await FAY.st();
ok('retry after the failure: UI + scene Halloween', retry.ui === 'halloween' && sceneTheme(retry) === 'halloween' && !retry.note, JSON.stringify(retry));
await pick(FAY, 'normal');
// start: night lasts until the moderator closes it
for (const p of ps) await p.page.getByTestId('ready').click();
await M.page.getByTestId('start').click();
for (const p of ps) await p.page.waitForSelector('[data-testid=room][data-step="night.main"]', { timeout: 15000 });
await L.page.waitForTimeout(9000);   // night walk to the tents
// night uniformity with the theme on: a wolf and a non-wolf on the same device type
const roles = await Promise.all(ps.slice(3).map(async (p) => ({ p, role: (await p.st()).role })));
for (const phone of [false, true]) {
  const w = roles.find((x) => x.role === 'wolf' && x.p.phone === phone), o = roles.find((x) => x.role !== 'wolf' && x.p.phone === phone);
  if (!w || !o) { console.log(`SKIP  night uniformity ${phone ? 'phone' : 'laptop'}: no wolf/non-wolf pair this deal`); continue; }
  for (const x of [w, o]) await pick(x.p, 'halloween');
  const head = (p) => p.page.evaluate(() => { const t = document.querySelector('.dock .panel-title'); const r = t.getBoundingClientRect(); return { step: document.querySelector('[data-testid=room]').dataset.step, before: getComputedStyle(t, '::before').content, surface: getComputedStyle(t).getPropertyValue('--surface').trim(), box: [Math.round(r.width), Math.round(r.height)] }; });
  const hw = await head(w.p), ho = await head(o.p);
  ok(`night uniformity (${phone ? 'phone' : 'laptop'}), theme on: wolf ${w.p.n} and ${o.p.n} have the same header, 🦇 and night panel tokens`, hw.step === 'night.main' && JSON.stringify(hw) === JSON.stringify(ho) && /🦇/.test(hw.before), JSON.stringify({ hw, ho }));
  for (const x of [w, o]) await pick(x.p, 'normal');
}
// night: Normal → Halloween → Normal (phone + laptop high), one low capture
const step = (p) => p.page.evaluate(() => document.querySelector('[data-testid=room]').dataset.step);
const cycle = async (p, phase) => {
  await shot(p, `${phase}-1-normal`);
  await pick(p, 'halloween'); const on = await p.st();
  ok(`${p.n} ${phase} (${await step(p)}): Settings → Halloween shows UI accents AND the scene overlay`, on.ui === 'halloween' && on.link && sceneTheme(on) === 'halloween' && on.scene.counts?.pumpkins > 0, JSON.stringify(on));
  await shot(p, `${phase}-2-halloween`);
  await pick(p, 'normal'); const off = await p.st();
  ok(`${p.n} ${phase}: Settings → Normal removes both (no stylesheet, no overlay)`, off.ui === 'normal' && !off.link && sceneTheme(off) === null && off.setting === 'normal', JSON.stringify(off));
  await shot(p, `${phase}-3-normal-again`);
};
for (const p of [L, P]) await cycle(p, 'night');
await pick(LOW, 'halloween'); const low = await LOW.st();
ok(`low profile at night (${await step(LOW)}): overlay shown and static (no animation)`, low.ui === 'halloween' && sceneTheme(low) === 'halloween' && low.scene.animate === false, JSON.stringify(low));
await shot(LOW, 'night-2-halloween');
await pick(LOW, 'normal');
ok('still night for every night capture', (await step(L)) === 'night.main' && (await step(P)) === 'night.main');
// day: the moderator closes the night steps; Normal → Halloween → Normal in the day discussion
for (let i = 0; i < 4 && (await step(L)) !== 'day.discussion'; i++) { await M.page.getByTestId('close-step').click(); await M.page.locator('[role=alertdialog] .btn').nth(1).click(); await M.page.waitForTimeout(800); }
await L.page.waitForSelector('[data-testid=room][data-step="day.discussion"]', { timeout: 15000 });
await L.page.waitForTimeout(9000);   // dawn: walk back to the seats
for (const p of [L, P]) await cycle(p, 'day');
ok('still day discussion for every day capture', (await step(L)) === 'day.discussion' && (await step(P)) === 'day.discussion');
await browser.close(); server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
