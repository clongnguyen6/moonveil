// Leaving a room against the real server (scene off).
//   node scripts/env.mjs node apps/web/src/ui/dev/leave-check.mjs      (builds dist; real engine on LEAVE_PORT, default 4465)
// Proves: Leave → entry screen at "/" with a short note, resume token gone, socket ended, others unaffected; refresh and
// Back never rejoin; join/create work again; reload and a network drop still resume the SAME seat; the host leaving
// hands over; the moderator leaving goes home while the players get the involuntary "no longer in this room" + Back to start.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const port = Number(process.env.LEAVE_PORT ?? 4465), base = `http://127.0.0.1:${port}`;
const sh = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exit ${c}`)))); });
await sh('npm', ['run', 'build', '-w', '@moonveil/web']);
const server = spawn('node', ['apps/server/src/main.ts'], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'rules', MOONVEIL_PERSIST: '0' } });
process.on('exit', () => server.kill('SIGTERM'));
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
console.log('[scene] off');
let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
const browser = await chromium.launch();
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };
const LAPTOP = { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' };
const mk = async (n, phone) => {
  const ctx = await browser.newContext(phone ? PHONE : LAPTOP);
  await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: false })); });
  const page = await ctx.newPage();
  return { n, ctx, page, st: () => page.evaluate(() => { const s = globalThis.__moonveil.getState(); return { status: s.status, code: s.code, seat: s.view?.me.seat ?? null, players: s.view?.players.map((p) => p.name) ?? [] }; }) };
};
const path = (p) => new URL(p.page.url()).pathname;
const token = (p, code) => p.page.evaluate((c) => localStorage.getItem(`moonveil.seat.${c}`), code);
const inRoom = (p) => p.page.locator('[data-testid=room]').count();
const create = async (p, mode = 'automatic') => { await p.page.goto(`${base}/`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId(`create-${mode}`).click(); await p.page.waitForSelector('[data-testid=room-code]'); return (await p.page.getByTestId('room-code').textContent()).trim(); };
// joins through the invite link after a page at "/" so Back has somewhere to go
const join = async (p, code) => { await p.page.goto(`${base}/`); await p.page.goto(`${base}/r/${code}`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId('join').click(); await p.page.waitForSelector('[data-testid=room]'); };

const A = await mk('An', false), B = await mk('Binh', true), C = await mk('Chi', false);
const code = await create(A);
await join(B, code); await join(C, code);
ok('setup: 3 seats in the room', (await A.st()).players.length === 3);
const bToken = await token(B, code);

// 1. voluntary leave (phone)
await B.page.getByTestId('leave').click();
await B.page.waitForSelector('[data-testid=entry]', { timeout: 5000 }).catch(() => {});
const bs = await B.st();
ok('leave: entry screen, URL "/", no room, no ended overlay', path(B) === '/' && (await B.page.getByTestId('entry').count()) === 1 && (await inRoom(B)) === 0 && (await B.page.locator('[data-testid=conn][data-status=ended]').count()) === 0, JSON.stringify({ path: path(B), bs }));
ok('leave: short note names the room', new RegExp(code).test(await B.page.getByTestId('left-note').innerText()));
ok('leave: resume token removed, socket ended, no view', bToken !== null && (await token(B, code)) === null && bs.status === 'ended' && bs.seat === null);
ok('leave: create and join are usable on the entry screen (no invite lock to the old code)', (await B.page.getByTestId('create-automatic').isEnabled().catch(() => false)) && (await B.page.getByTestId('code').inputValue()) === '');
await A.page.waitForTimeout(400);
ok('others: An and Chi stay connected and see Binh gone', (await A.st()).status === 'open' && (await C.st()).status === 'open' && JSON.stringify((await A.st()).players) === JSON.stringify(['An', 'Chi']) && (await A.page.locator('[data-testid=error]').count()) === 0);

// 2. refresh never rejoins
await B.page.reload(); await B.page.waitForTimeout(1500);
ok('refresh: still the entry screen at "/", not in the room; the room still has 2 seats', path(B) === '/' && (await inRoom(B)) === 0 && (await A.st()).players.length === 2);

// 3. Back never rejoins silently
await B.page.goBack(); await B.page.waitForTimeout(1500);
const backPath = path(B);
ok(`back: lands on ${backPath}, not in the room, room still 2 seats`, (await inRoom(B)) === 0 && (await A.st()).players.length === 2 && !/^\/r\//.test(backPath));
// even the old invite URL opened by hand only offers Join (no token, no silent resume)
await B.page.goto(`${base}/r/${code}`); await B.page.waitForTimeout(1500);
ok('old invite URL: entry with the invite (Join button), not in the room', (await inRoom(B)) === 0 && (await B.page.getByTestId('invited').count()) === 1 && (await A.st()).players.length === 2);

// 4. join again and create from the entry screen
await B.page.getByTestId('name').fill('Binh'); await B.page.getByTestId('join').click(); await B.page.waitForSelector('[data-testid=room]');
ok('rejoin by choice: Binh is back in the room with a new seat', (await A.st()).players.includes('Binh') && path(B) === `/r/${code}`);
await B.page.getByTestId('leave').click(); await B.page.waitForSelector('[data-testid=entry]');
const code2 = await (async () => { await B.page.getByTestId('name').fill('Binh'); await B.page.getByTestId('create-automatic').click(); await B.page.waitForSelector('[data-testid=room-code]'); return (await B.page.getByTestId('room-code').textContent()).trim(); })();
ok('create from the entry screen after leaving: new room', code2 !== code && path(B) === `/r/${code2}`);

// 5. reconnect is unaffected: reload and a network drop resume the SAME seat
const cSeat = (await C.st()).seat;
await C.page.reload(); await C.page.waitForSelector('[data-testid=conn][data-status=open]', { timeout: 15000 });
ok('reload: Chi resumes the same seat', (await C.st()).seat === cSeat && path(C) === `/r/${code}`);
await C.page.evaluate(() => { globalThis.__seen = []; globalThis.__moonveil.subscribe(() => globalThis.__seen.push(globalThis.__moonveil.getState().status)); });
await C.ctx.setOffline(true); await C.page.waitForTimeout(1500);
await C.page.evaluate(() => dispatchEvent(new Event('online')));
await C.ctx.setOffline(false);
await C.page.waitForSelector('[data-testid=conn][data-status=open]', { timeout: 20000 }).catch(() => {});
const seen = await C.page.evaluate(() => globalThis.__seen);
ok('network drop: Chi went through reconnecting and is back on the same seat, still in the room (never sent home)', seen.includes('reconnecting') && (await C.st()).seat === cSeat && (await C.st()).status === 'open' && (await inRoom(C)) === 1 && path(C) === `/r/${code}`, JSON.stringify([...new Set(seen)]));

// 6. host leaves: goes home; the room hands over and stays
await A.page.getByTestId('leave').click(); await A.page.waitForSelector('[data-testid=entry]');
await C.page.waitForTimeout(500);
ok('host leave: An at "/" entry; Chi still in the room', path(A) === '/' && (await C.st()).status === 'open' && JSON.stringify((await C.st()).players) === JSON.stringify(['Chi']));

// 7. moderator leaves: moderator goes home; the player gets the involuntary overlay with a way out
const M = await mk('Mod', false), D = await mk('Dung', true);
const mcode = await create(M, 'moderator');
await join(D, mcode);
await M.page.getByTestId('leave').click(); await M.page.waitForSelector('[data-testid=entry]', { timeout: 5000 }).catch(() => {});
ok('moderator leave: moderator at "/" entry with the note', path(M) === '/' && (await M.page.getByTestId('left-note').count()) === 1);
await D.page.waitForSelector('[data-testid=conn][data-status=ended]', { timeout: 5000 }).catch(() => {});
ok('room closed for the player: involuntary message (not "you left") and Back to start', (await D.page.locator('[data-testid=conn][data-status=ended]').count()) === 1 && !/You left/.test(await D.page.getByTestId('conn').innerText()) && (await D.page.getByTestId('go-home').count()) === 1);
await D.page.getByTestId('go-home').click(); await D.page.waitForTimeout(300);
ok('Back to start: entry at "/", no note, no overlay', path(D) === '/' && (await D.page.getByTestId('entry').count()) === 1 && (await D.page.locator('[data-testid=left-note], [data-testid=conn][data-status=ended]').count()) === 0);

await browser.close(); server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
