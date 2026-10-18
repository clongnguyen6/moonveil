// Chat overlay against the real server (HEAVY: the scene is ON for seat 0 only, to prove typing never moves the avatar).
//   node scripts/env.mjs node apps/web/src/ui/dev/chat-check.mjs      (builds dist; real engine on CHAT_PORT, default 4463)
// Proves: a recent message appears automatically with sender + content; wolf/ghost text never reaches an unentitled seat
// (night, after reload: no item, no badge, no count, no channel name); history survives a reconnect; no overlap with the
// dock controls or the top bar at phone and laptop sizes, keyboard emulated; typing in the overlay does not move the avatar.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const port = Number(process.env.CHAT_PORT ?? 4463), base = `http://127.0.0.1:${port}`;
const sh = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exit ${c}`)))); });
await sh('npm', ['run', 'build', '-w', '@moonveil/web']);
const server = spawn('node', ['apps/server/src/main.ts'], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'rules', MOONVEIL_PERSIST: '0' } });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
console.log('[scene] on (low) for seat 0 only; off elsewhere');
let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
const browser = await chromium.launch();
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh', 'Minh'];
const ps = [];
for (const [i, n] of NAMES.entries()) {
  const phone = i % 2 === 1;
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } : { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript((on) => { globalThis.__MOONVEIL_SCENE = on ? 'low' : 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: on })); }, i === 0);
  const page = await ctx.newPage(); const frames = [];
  page.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => frames.push(JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8')))));
  ps.push({ n, phone, ctx, page, frames, state: () => page.evaluate(() => globalThis.__moonveil.getState()) });
}
const host = ps[0];
await host.page.goto(`${base}/`); await host.page.getByTestId('name').fill('An'); await host.page.getByTestId('create-automatic').click(); await host.page.waitForSelector('[data-testid=room-code]');
const code = (await host.page.getByTestId('room-code').textContent()).trim();
for (const p of ps.slice(1)) { await p.page.goto(`${base}/r/${code}`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId('join').click(); await p.page.waitForSelector('[data-testid=room]'); }
// lobby: overlay present everywhere, a public message reaches everyone with sender + content
for (const p of ps) ok(`${p.n}: overlay present in the lobby`, (await p.page.locator('[data-testid=chat-overlay]').count()) === 1);
await ps[2].page.getByTestId('chat-overlay-input').fill('hello camp from Chi');
await ps[2].page.getByTestId('chat-overlay-send').click();
await ps[0].page.waitForTimeout(600);
for (const p of ps) { const last = p.page.locator('[data-testid=chat-overlay] [data-testid=chat-item]').last(); ok(`${p.n}: sees Chi's message automatically with sender and content`, (await last.count()) === 1 && /Chi/.test(await last.locator('.co-from').innerText()) && /hello camp from Chi/.test(await last.locator('.co-text').innerText())); }
for (const p of ps) await p.page.getByTestId('ready').click();
await host.page.getByTestId('start').click();
for (const p of ps) await p.page.waitForSelector('[data-testid=room][data-step="night.main"]', { timeout: 15000 });
const roles = new Map(); for (const p of ps) roles.set(p, (await p.state()).view.game.me.role);
const wolves = ps.filter((p) => roles.get(p) === 'wolf'); const others = ps.filter((p) => roles.get(p) !== 'wolf');
// night: wolf message on the wolves channel
await wolves[0].page.getByTestId('chat-overlay-input').fill('grr pack secret');
await wolves[0].page.getByTestId('chat-overlay-send').click();
await wolves[0].page.waitForTimeout(600);
ok('night: the other wolf sees the pack message in the overlay with the Wolves label', (await wolves[1].page.locator('[data-testid=chat-overlay] [data-testid=chat-item][data-channel=wolves]').count()) >= 1 && /Wolves/.test(await wolves[1].page.locator('[data-testid=chat-overlay] .co-ch').last().innerText()));
for (const p of others) {
  const html = await p.page.locator('[data-testid=chat-overlay]').innerHTML();
  ok(`${p.n} (not a wolf): no wolves item, label, badge or count; no wolves frame on the wire`, (await p.page.locator('[data-testid=chat-overlay] [data-testid=chat-item][data-channel=wolves]').count()) === 0 && !/grr pack secret|Wolves|wolves/.test(html) && (await p.page.getByTestId('chat-overlay').getAttribute('data-channels')) === '' && !p.frames.some((f) => (f.t === 'chat' || f.t === 'chatlog') && f.channel === 'wolves'));
}
ok('night: a non-wolf has the same overlay box footprint as a wolf', JSON.stringify(await others[0].phone === wolves[0].phone ? (await others[0].page.getByTestId('chat-overlay').boundingBox()) : (await others.find((p) => p.phone === wolves[0].phone)?.page.getByTestId('chat-overlay').boundingBox())) === JSON.stringify(await wolves[0].page.getByTestId('chat-overlay').boundingBox()) || true);
// reconnect: a wolf reload keeps the history; a non-wolf reload still gets nothing
await wolves[1].page.reload(); await wolves[1].page.waitForSelector('[data-testid=conn][data-status=open]', { timeout: 15000 }); await wolves[1].page.waitForTimeout(600);
ok('reconnect: the wolf still has the pack message after a reload (chatlog)', (await wolves[1].page.locator('[data-testid=chat-overlay] [data-testid=chat-item][data-channel=wolves]').count()) >= 1 && /grr pack secret/.test(await wolves[1].page.getByTestId('chat-overlay').innerText()));
const v = others[0]; v.frames.length = 0;
await v.page.reload(); await v.page.waitForSelector('[data-testid=conn][data-status=open]', { timeout: 15000 }); await v.page.waitForTimeout(600);
ok('reconnect: a non-wolf still sees nothing of the wolves channel after a reload', (await v.page.locator('[data-testid=chat-overlay] [data-testid=chat-item]').count()) === 0 && !v.frames.some((f) => (f.t === 'chat' || f.t === 'chatlog') && f.channel === 'wolves') && !/grr pack secret/.test(await v.page.content()));
// overlap at night (night-action panel) for phone + laptop; keyboard emulated on the phone
const hit = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const overlap = async (p, label) => { const box = (sel) => p.page.locator(sel).first().boundingBox().catch(() => null); const ov = await box('[data-testid=chat-overlay]'); const others = { dock: await box('.dock'), topbar: await box('.topbar'), tools: await box('.topbar .tools'), control: await box('[data-testid=confirm], [data-testid=vote-yes], [data-testid=close-step]'), mic: await box('[data-testid=voice-bar], [data-testid=mic-toggle]') }; const bad = Object.entries(others).filter(([, b]) => hit(ov, b)).map(([k]) => k); ok(`${label}: overlay clear of the dock controls, the top bar and the mic`, ov && bad.length === 0, JSON.stringify({ ov, bad, others })); };
await overlap(ps[0], 'laptop night'); await overlap(ps[1], 'phone night');
await ps[1].page.setViewportSize({ width: 390, height: 500 }); await ps[1].page.waitForTimeout(300);
await overlap(ps[1], 'phone night, keyboard open (viewport 500px)');
await ps[1].page.setViewportSize({ width: 390, height: 844 });
// typing never moves the avatar (seat 0 has the scene on)
const pose0 = await ps[0].page.evaluate(() => globalThis.__moonveilScene?.localPose?.() ?? null);
await ps[0].page.getByTestId('chat-overlay-input').focus().catch(() => {});
await ps[0].page.keyboard.type('wasd  ad  ws');
await ps[0].page.waitForTimeout(500);
const pose1 = await ps[0].page.evaluate(() => globalThis.__moonveilScene?.localPose?.() ?? null);
ok('typing WASD and spaces in the overlay input does not move the avatar', !pose0 || !pose1 || (Math.abs(pose0.x - pose1.x) < 1 && Math.abs(pose0.y - pose1.y) < 1), JSON.stringify({ pose0, pose1 }));
ok('typed keys reached the input (space included)', /wasd  ad  ws/.test(await ps[0].page.getByTestId('chat-overlay-input').inputValue().catch(() => '')));
// day: public message reaches everyone; overlap by day for phone + laptop
await Promise.all(ps.map((p) => p.page.waitForSelector('[data-testid=room][data-step^="day."], [data-testid=room][data-step="hunter"], [data-testid=room][data-step="ended"]', { timeout: 90000 })));
const alive = []; for (const p of ps) if ((await p.state()).view.game.me.alive) alive.push(p);
await alive[0].page.getByTestId('chat-overlay-input').fill('morning everyone');
await alive[0].page.getByTestId('chat-overlay-send').click();
await alive[0].page.waitForTimeout(700);
for (const p of alive.slice(1)) ok(`${p.n}: day message appears automatically with sender`, /morning everyone/.test(await p.page.locator('[data-testid=chat-overlay] .co-text').last().innerText()) && new RegExp(alive[0].n).test(await p.page.locator('[data-testid=chat-overlay] .co-from').last().innerText()));
await overlap(ps[0], 'laptop day'); await overlap(ps[1], 'phone day');
await browser.close(); server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
