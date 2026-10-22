// Theme setting in the real app (built dist on the real server; scene ON for 3 seats: phone high, laptop high, laptop low).
//   node scripts/env.mjs node apps/web/src/ui/dev/theme-check.mjs      (builds dist; server on THEME_PORT, default 4467)
// Proves: default Normal with no Halloween file requested; Settings → Cute Halloween applies UI + scene together, Normal
// removes both, at day and at night; persisted across a reload; low profile static; a failed scene-overlay download
// keeps BOTH Normal (setting back to Normal, note shown) and a retry works; night header identical for wolf and non-wolf
// with the theme on. Captures → docs/ui/screens-halloween/toggle/*.jpg (browser emulation).
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
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
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh', 'Minh'];
const SCENE = { 0: ['high', LAPTOP], 1: ['high', PHONE], 2: ['low', LAPTOP] };
const ps = [];
for (const [i, n] of NAMES.entries()) {
  const [q, dev] = SCENE[i] ?? ['off', i % 2 ? PHONE : LAPTOP];
  const ctx = await browser.newContext({ ...dev, reducedMotion: 'reduce', locale: 'en-US' });
  await ctx.addInitScript((qq) => { globalThis.__MOONVEIL_SCENE = qq; globalThis.__MOONVEIL_SCENE_DEBUG = true; if (!localStorage.getItem('moonveil.ui.settings')) localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: qq !== 'off' })); }, q);
  const page = await ctx.newPage(); const reqs = [];
  page.on('request', (r) => { if (/halloween/i.test(r.url())) reqs.push(r.url().split('/').pop()); });
  ps.push({ n, q, phone: dev === PHONE, ctx, page, reqs, st: () => page.evaluate(() => ({ ui: document.documentElement.dataset.theme ?? 'normal', link: !!document.getElementById('moonveil-theme-halloween'), setting: JSON.parse(localStorage.getItem('moonveil.ui.settings') ?? '{}').theme ?? 'normal', scene: globalThis.__moonveilScene?.debugTheme?.() ?? null, note: !!document.querySelector('[data-testid=theme-note]'), role: globalThis.__moonveil.getState().view?.game?.me?.role ?? null })) });
}
const [L, P, LOW] = ps;
const pick = async (p, theme) => { await p.page.getByTestId('open-settings').click(); await p.page.getByTestId('set-theme').selectOption(theme); await p.page.keyboard.press('Escape'); await p.page.waitForTimeout(1500); };
const shot = (p, name) => p.page.screenshot({ path: `${out}/${p.phone ? 'phone' : 'laptop'}-${name}-${p.q}.jpg`, type: 'jpeg', quality: 78 });
const sceneTheme = (s) => s.scene?.theme ?? null;

await L.page.goto(`${base}/`); await L.page.getByTestId('name').fill('An'); await L.page.getByTestId('create-automatic').click(); await L.page.waitForSelector('[data-testid=room-code]');
const code = (await L.page.getByTestId('room-code').textContent()).trim();
for (const p of ps.slice(1)) { await p.page.goto(`${base}/r/${code}`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId('join').click(); await p.page.waitForSelector('[data-testid=room]'); }
await L.page.waitForTimeout(1500);
for (const p of [L, P, LOW]) { const s = await p.st(); ok(`${p.n} (${p.q}): default Normal (UI, setting, scene) and no Halloween file requested`, s.ui === 'normal' && !s.link && s.setting === 'normal' && sceneTheme(s) === null && p.reqs.length === 0, JSON.stringify({ s, reqs: p.reqs })); }
// lobby (day): Normal → Halloween → Normal via Settings
for (const p of [L, P]) {
  await shot(p, 'day-1-normal');
  await pick(p, 'halloween'); const on = await p.st();
  ok(`${p.n} day: Settings → Cute Halloween shows UI accents AND the scene overlay`, on.ui === 'halloween' && on.link && sceneTheme(on) === 'halloween' && on.scene.counts?.pumpkins > 0, JSON.stringify(on));
  await shot(p, 'day-2-halloween');
  await pick(p, 'normal'); const off = await p.st();
  ok(`${p.n} day: Settings → Normal removes both (no stylesheet, no overlay)`, off.ui === 'normal' && !off.link && sceneTheme(off) === null && off.setting === 'normal', JSON.stringify(off));
  await shot(p, 'day-3-normal-again');
}
await pick(LOW, 'halloween'); const low = await LOW.st();
ok('low profile: overlay shown and static (no animation)', low.ui === 'halloween' && sceneTheme(low) === 'halloween' && low.scene.animate === false, JSON.stringify(low));
await shot(LOW, 'day-2-halloween');
await pick(LOW, 'normal');
// persistence across a reload
await pick(P, 'halloween'); await P.page.reload(); await P.page.waitForSelector('[data-testid=room]'); await P.page.waitForTimeout(2500);
const re = await P.st();
ok('reload: the choice persists and UI + scene are Halloween again', re.setting === 'halloween' && re.ui === 'halloween' && sceneTheme(re) === 'halloween', JSON.stringify(re));
await pick(P, 'normal');
// failed scene-overlay download: stylesheet allowed, overlay chunk blocked → both stay Normal, setting back, note; retry works
await L.page.route((u) => u.pathname.endsWith(`/${sceneChunk}`), (r) => r.abort());
await pick(L, 'halloween'); const failed = await L.st();
ok('scene overlay fails to load: UI stays Normal too, setting back to Normal, note shown', failed.ui === 'normal' && !failed.link && sceneTheme(failed) === null && failed.setting === 'normal' && failed.note, JSON.stringify(failed));
await L.page.unroute((u) => u.pathname.endsWith(`/${sceneChunk}`));
await pick(L, 'halloween'); const retry = await L.st();
ok('retry after the failure: UI + scene Halloween', retry.ui === 'halloween' && sceneTheme(retry) === 'halloween' && !retry.note, JSON.stringify(retry));
await pick(L, 'normal');
// night: start the match, toggle at night on phone + laptop
for (const p of ps) await p.page.getByTestId('ready').click();
await L.page.getByTestId('start').click();
for (const p of ps) await p.page.waitForSelector('[data-testid=room][data-step="night.main"]', { timeout: 15000 });
await L.page.waitForTimeout(8000);   // night walk to the tents
for (const p of [L, P]) {
  await shot(p, 'night-1-normal');
  await pick(p, 'halloween'); const on = await p.st();
  ok(`${p.n} night: Cute Halloween applies UI + scene during the match`, on.ui === 'halloween' && sceneTheme(on) === 'halloween', JSON.stringify(on));
  await shot(p, 'night-2-halloween');
  await pick(p, 'normal'); const off = await p.st();
  ok(`${p.n} night: Normal removes both`, off.ui === 'normal' && sceneTheme(off) === null, JSON.stringify(off));
  await shot(p, 'night-3-normal-again');
}
// night uniformity with the theme on: a wolf and a non-wolf on the same device type, scene off
const roles = await Promise.all(ps.slice(3).map(async (p) => ({ p, role: (await p.st()).role })));
for (const phone of [false, true]) {
  const w = roles.find((x) => x.role === 'wolf' && x.p.phone === phone), o = roles.find((x) => x.role !== 'wolf' && x.p.phone === phone);
  if (!w || !o) { console.log(`SKIP  night uniformity ${phone ? 'phone' : 'laptop'}: no wolf/non-wolf pair among scene-off seats this deal`); continue; }
  for (const x of [w, o]) await pick(x.p, 'halloween');
  const head = (p) => p.page.evaluate(() => { const t = document.querySelector('.dock .panel-title'); const r = t.getBoundingClientRect(); return { before: getComputedStyle(t, '::before').content, surface: getComputedStyle(t).getPropertyValue('--surface').trim(), box: [Math.round(r.width), Math.round(r.height)] }; });
  const hw = await head(w.p), ho = await head(o.p);
  ok(`night uniformity (${phone ? 'phone' : 'laptop'}), theme on: wolf ${w.p.n} and ${o.p.n} have the same header, flourish and panel tokens`, JSON.stringify(hw) === JSON.stringify(ho) && /🦇/.test(hw.before), JSON.stringify({ hw, ho }));
}
await browser.close(); server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
