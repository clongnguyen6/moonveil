// Costume picker against the real server (scene off unless CAPTURE=1, which turns it on for seat B only and saves
// "a saved costume as others see it" to docs/ui/screens-picker/; CAPTURE needs the lock).
//   node scripts/env.mjs node apps/web/src/ui/dev/picker-check.mjs      (builds dist; real engine on PICKER_PORT, default 4464)
// Proves: pick → Save reaches every seat in canonical form; Cancel restores the saved look and sends nothing; the
// look survives a reload and the editor reopens on it; invalid input is refused (raw message and a UI save the server
// refuses → notice, saved look shown); no look change mid-match (no editor, server refuses).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const port = Number(process.env.PICKER_PORT ?? 4464), base = `http://127.0.0.1:${port}`;
const CAPTURE = process.env.CAPTURE === '1';
const sh = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exit ${c}`)))); });
await sh('npm', ['run', 'build', '-w', '@moonveil/web']);
const server = spawn('node', ['apps/server/src/main.ts'], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'rules', MOONVEIL_PERSIST: '0' } });
process.on('exit', () => server.kill('SIGTERM'));
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
console.log(`[scene] ${CAPTURE ? 'on (low) for seat B only, capture' : 'off'}`);
let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
const browser = await chromium.launch();
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh'];
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };
const LAPTOP = { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' };
const ps = [];
for (const [i, n] of NAMES.entries()) {
  const scene = CAPTURE && i === 1;
  const ctx = await browser.newContext(i % 2 ? PHONE : LAPTOP);
  await ctx.addInitScript((on) => { globalThis.__MOONVEIL_SCENE = on ? 'low' : 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: on })); }, scene);
  const page = await ctx.newPage(); const got = [], sent = [];
  page.on('websocket', (ws) => { ws.on('framereceived', ({ payload }) => got.push(JSON.parse(String(payload)))); ws.on('framesent', ({ payload }) => sent.push(JSON.parse(String(payload)))); });
  ps.push({ n, page, got, sent, state: () => page.evaluate(() => globalThis.__moonveil.getState()) });
}
const [A, B, C] = ps;
const seatOf = async (p) => (await p.state()).view.me.seat;
const lookIn = async (p, seat) => (await p.state()).view.players.find((x) => x.seat === seat)?.appearance;
const profilesSent = (p) => p.sent.filter((m) => m.t === 'profile');

await A.page.goto(`${base}/`); await A.page.getByTestId('name').fill('An'); await A.page.getByTestId('create-automatic').click(); await A.page.waitForSelector('[data-testid=room-code]');
const code = (await A.page.getByTestId('room-code').textContent()).trim();
for (const p of ps.slice(1)) { await p.page.goto(`${base}/r/${code}`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId('join').click(); await p.page.waitForSelector('[data-testid=room]'); }
const aSeat = await seatOf(A), bSeat = await seatOf(B), cSeat = await seatOf(C);

// 1. pick → Save: canonical costume on the wire, every seat receives it
const want = { outfit: 'duck', variant: 'plain', color: 'clay', hat: 'none', front: 'none', back: 'none' };
await A.page.getByTestId('edit-profile').click();
await A.page.getByTestId('outfit-duck').click(); await A.page.getByTestId('variant-plain').click(); await A.page.getByTestId('color-clay').click(); await A.page.getByTestId('hat').selectOption('none');
ok('pick: preview on the You card before Save, nothing sent yet', (await A.page.getByTestId('you-look').getAttribute('data-outfit')) === 'duck' && profilesSent(A).length === 0);
await A.page.getByTestId('save-profile').click();
await A.page.waitForTimeout(800);
const sentA = profilesSent(A).at(-1)?.profile?.appearance;
ok('save: one profile message in the canonical costume form', profilesSent(A).length === 1 && JSON.stringify(sentA) === JSON.stringify(want), JSON.stringify(sentA));
for (const p of ps) { const a = await lookIn(p, aSeat); ok(`${p.n}: receives An's saved outfit`, !!a && Object.entries(want).every(([k, v]) => a[k] === v), JSON.stringify(a)); }

// 2. Cancel: back to the saved look, nothing sent, nobody sees the draft
const bBefore = await lookIn(B, bSeat);
await B.page.getByTestId('edit-profile').click();
await B.page.getByTestId('outfit-frog').click(); await B.page.getByTestId('color-moss').click();
ok('cancel: draft previews locally first', (await B.page.getByTestId('you-look').getAttribute('data-outfit')) === 'frog');
await B.page.getByTestId('cancel-profile').click(); await B.page.waitForTimeout(500);
ok('cancel: You card back to the saved look, draft cleared, no profile sent', (await B.page.getByTestId('you-look').getAttribute('data-outfit')) === bBefore.outfit && (await B.page.evaluate(() => globalThis.__moonveilLook.get().draft)) === null && profilesSent(B).length === 0);
ok('cancel: other seats still see the saved look', JSON.stringify(await lookIn(A, bSeat)) === JSON.stringify(bBefore));

// 3. reconnect: the look survives and the editor reopens on it (not on defaults)
await A.page.reload(); await A.page.waitForSelector('[data-testid=conn][data-status=open]', { timeout: 15000 }); await A.page.waitForTimeout(500);
const aAfter = await lookIn(A, aSeat);
ok('reconnect: An keeps the saved outfit', !!aAfter && Object.entries(want).every(([k, v]) => aAfter[k] === v), JSON.stringify(aAfter));
await A.page.getByTestId('edit-profile').click();
ok('reconnect: the editor opens on the saved outfit, variant and colour', (await A.page.getByTestId('look-picker').getAttribute('data-outfit')) === 'duck' && (await A.page.getByTestId('look-picker').getAttribute('data-variant')) === 'plain' && (await A.page.locator('[data-testid=color-clay][aria-checked=true]').count()) === 1);
await A.page.getByTestId('cancel-profile').click();

// 4. invalid input refused: raw messages, and a UI save the server refuses
const cBefore = await lookIn(C, cSeat);
for (const bad of [{ outfit: 'duck', color: 'ember' }, { outfit: 'dragon' }, { outfit: 'fish', variant: 'whale' }]) {
  C.got.length = 0;
  await C.page.evaluate((a) => globalThis.__moonveil.send({ t: 'profile', profile: { name: 'Chi', appearance: a } }), bad);
  await C.page.waitForTimeout(400);
  ok(`invalid ${JSON.stringify(bad)}: refused with invalid-appearance, look unchanged everywhere`, C.got.some((f) => f.t === 'error' && f.code === 'invalid-appearance') && JSON.stringify(await lookIn(A, cSeat)) === JSON.stringify(cBefore));
}
await C.page.getByTestId('edit-profile').click();
await C.page.getByTestId('outfit-mushroom').click();
await C.page.evaluate(() => { const c = globalThis.__moonveil, send = c.send.bind(c); c.send = (m) => send(m.t === 'profile' ? { ...m, profile: { ...m.profile, appearance: { ...m.profile.appearance, color: 'ember' } } } : m); });
await C.page.getByTestId('save-profile').click();
await C.page.waitForSelector('[data-testid=look-not-saved]', { timeout: 8000 }).catch(() => {});
ok('UI save refused: notice shown, editor closed, saved look shown, nothing changed for others', (await C.page.locator('[data-testid=look-not-saved]').count()) === 1 && (await C.page.locator('[data-testid=edit-look]').count()) === 0 && (await C.page.getByTestId('you-look').getAttribute('data-outfit')) === cBefore.outfit && JSON.stringify(await lookIn(A, cSeat)) === JSON.stringify(cBefore));

if (CAPTURE) {
  mkdirSync('docs/ui/screens-picker', { recursive: true });
  await B.page.waitForTimeout(1500);
  await B.page.screenshot({ path: 'docs/ui/screens-picker/others-see-saved-costume-phone.png' });
  console.log('captured docs/ui/screens-picker/others-see-saved-costume-phone.png (seat B sees An in the saved outfit)');
}

// 5. no change mid-match: no editor in the match UI, server refuses a raw profile
for (const p of ps) await p.page.getByTestId('ready').click();
await A.page.getByTestId('start').click();
for (const p of ps) await p.page.waitForSelector('[data-testid=room][data-step="night.main"]', { timeout: 15000 });
ok('match: no look editor anywhere', (await Promise.all(ps.map((p) => p.page.locator('[data-testid=edit-profile], [data-testid=look-picker]').count()))).every((n) => n === 0));
A.got.length = 0;
await A.page.evaluate(() => globalThis.__moonveil.send({ t: 'profile', profile: { name: 'An', appearance: { outfit: 'frog' } } }));
await A.page.waitForTimeout(400);
ok('match: a profile change is refused (not-allowed) and the look stays', A.got.some((f) => f.t === 'error' && f.code === 'not-allowed') && (await lookIn(B, aSeat))?.outfit === 'duck');

await browser.close(); server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
