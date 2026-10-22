// Chat overlay against the real server (HEAVY: the scene is ON for seat 0 = laptop and seat 1 = phone; needs the lock).
//   node scripts/env.mjs node apps/web/src/ui/dev/chat-check.mjs      (builds dist; real engine on CHAT_PORT, default 4463)
// Proves: a recent message appears automatically with sender + content, and its name, avatar and data-from all come
// from the seat that actually sent it; wolf text never reaches an unentitled seat (night, after reload: no item,
// badge, count or channel name); same box for wolf and non-wolf; history survives a reconnect; no overlap with the
// dock controls or the top bar (keyboard emulated); typing never moves the avatar; text contrast over the rendered
// scene by day and night; campfire seats + name labels clear of the box in discussion and vote (phone portrait and
// landscape, laptop), measured from the scene's own camera (recovered from its `tap` event) and seat layout.
// Runs at real speed (night 60 s, discussion ~165 s, vote 30 s): ~6 min.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { createMap } from '../../../../../packages/scene/src/map.ts';
const port = Number(process.env.CHAT_PORT ?? 4463), base = `http://127.0.0.1:${port}`;
const sh = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exit ${c}`)))); });
await sh('npm', ['run', 'build', '-w', '@moonveil/web']);
const server = spawn('node', ['apps/server/src/main.ts'], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'rules', MOONVEIL_PERSIST: '0' } });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
console.log('[scene] on (low) for seats 0 (laptop) and 1 (phone); off elsewhere');
let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
const browser = await chromium.launch();
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh', 'Minh'];
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };
const LAPTOP = { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' };
const ps = [];
for (const [i, n] of NAMES.entries()) {
  const phone = i % 2 === 1, scene = i < 2;
  const ctx = await browser.newContext(phone ? PHONE : LAPTOP);
  await ctx.addInitScript((on) => { globalThis.__MOONVEIL_SCENE = on ? 'low' : 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', scene: on })); }, scene);
  const page = await ctx.newPage(); const frames = [];
  page.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => frames.push(JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8')))));
  ps.push({ n, phone, scene, ctx, page, frames, state: () => page.evaluate(() => globalThis.__moonveil.getState()) });
}
const host = ps[0];
const seatOf = async (p) => (await p.state()).view.me.seat;
const until = (p, sel, timeout) => p.page.waitForSelector(sel, { timeout });
// Write a message: laptop = overlay input; phone (compact) = the overlay's chat button opens the sheet with the input.
const compactOf = async (p) => (await p.page.getByTestId('chat-overlay').getAttribute('data-compact')) === 'true';
const say = async (p, text) => {
  if (!(await compactOf(p))) { await p.page.getByTestId('chat-overlay-input').fill(text); await p.page.getByTestId('chat-overlay-send').click(); return; }
  await p.page.getByTestId('chat-history').click(); await p.page.getByTestId('chat-input').fill(text); await p.page.getByTestId('chat-send').click(); await p.page.keyboard.press('Escape');
};

// Every overlay item: name, avatar colour + initials and data-from agree with the page's own view of that seat;
// `expect` = { from, name } of the seat that really sent the last message (from the sender's own state).
const senderCheck = async (p, expect) => p.page.evaluate((exp) => {
  const view = globalThis.__moonveil.getState().view, bad = [];
  const items = [...document.querySelectorAll('[data-testid=chat-overlay] [data-testid=chat-item]')];
  for (const el of items) {
    const seat = view.players.find((x) => x.seat === el.dataset.from);
    const name = el.querySelector('.co-from')?.firstChild?.textContent?.trim();
    const av = el.querySelector('.avatar');
    if (!seat || name !== seat.name || !av?.classList.contains(`c-${seat.appearance.color}`) || !av.textContent.startsWith(seat.name.slice(0, 2).toUpperCase())) bad.push({ from: el.dataset.from, name, seat: seat?.name, av: av?.className });
  }
  const last = items.at(-1);
  const lastOk = !exp || (!!last && last.dataset.from === exp.from && last.querySelector('.co-from')?.firstChild?.textContent?.trim() === exp.name);
  return { n: items.length, bad, lastOk, last: last?.dataset.from };
}, expect);

// Contrast of the overlay's text colours over the scene actually rendered behind the box (overlay hidden for the
// capture, then its background composited over every pixel; worst = brightest composite).
const contrast = async (p) => {
  const ov = p.page.getByTestId('chat-overlay');
  const clip = await ov.boundingBox();
  await ov.evaluate((el) => { el.style.visibility = 'hidden'; });
  await p.page.waitForTimeout(600);
  const b64 = (await p.page.screenshot({ clip })).toString('base64');
  await ov.evaluate((el) => { el.style.visibility = ''; });
  return p.page.evaluate(async (data) => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const el = document.querySelector('[data-testid=chat-overlay]');
    const [br, bgc, bb, ba = 1] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number);
    let worst = 0, sceneMax = 0;
    for (let i = 0; i < d.length; i += 4) { sceneMax = Math.max(sceneMax, L(d[i], d[i + 1], d[i + 2])); worst = Math.max(worst, L(br * ba + d[i] * (1 - ba), bgc * ba + d[i + 1] * (1 - ba), bb * ba + d[i + 2] * (1 - ba))); }
    const out = { bgAlpha: ba, sceneMaxL: +sceneMax.toFixed(3) };
    for (const sel of ['.co-text', '.co-from', '.co-quiet']) {
      const t = el.querySelector(sel); if (!t) continue;
      const [r, g, b] = getComputedStyle(t).color.match(/[\d.]+/g).map(Number);
      out[sel] = +((L(r, g, b) + 0.05) / (worst + 0.05)).toFixed(2);
    }
    return out;
  }, b64);
};
const contrastOk = (c) => ['.co-text', '.co-from', '.co-quiet'].every((k) => c[k] === undefined || c[k] >= 4.5) && c.bgAlpha < 1;

// Campfire seats + labels vs the overlay, from the scene's camera: two synthetic taps on the scene surface give
// world coordinates (on('tap')), hence scale and offset; seats come from the scene's own createMap. Living seated
// players cannot walk, so the taps move nobody.
const seatsClear = async (p, label) => {
  // Wait for a settled camera: sample it every 600 ms (> 2 frames at the reduced-motion 4 fps) until two consecutive
  // samples agree (scale, offset, slot size); fail loudly with the samples after 15 s. A fixed wait measured a camera
  // that had not yet re-framed after a resize under heavy machine load.
  const read = () => p.page.evaluate(() => {
    const h = globalThis.__moonveilScene, slot = document.querySelector('[data-testid=scene-slot]');
    if (!h || !slot) return null;
    const r = slot.getBoundingClientRect(), hits = [];
    const off = h.on('tap', (t) => hits.push(t));
    const tap = (x, y) => { const o = { clientX: r.left + x, clientY: r.top + y, pointerId: 91, pointerType: 'mouse', bubbles: true, isPrimary: true }; slot.dispatchEvent(new PointerEvent('pointerdown', o)); window.dispatchEvent(new PointerEvent('pointerup', o)); };
    const pts = [[r.width * 0.2, r.height * 0.3], [r.width * 0.8, r.height * 0.7]];
    for (const [x, y] of pts) tap(x, y);
    off();
    const rel = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height }; };
    return { w: r.width, h: r.height, pts, hits, ov: rel('[data-testid=chat-overlay]'), bar: rel('.topbar'), safeBottom: Number(slot.dataset.safeBottom ?? 0), n: globalThis.__moonveil.getState().view.players.length };
  });
  const camOf = (g) => { const [[x1, y1], [x2]] = g.pts, [w1, w2] = g.hits; const sc = (x2 - x1) / (w2.x - w1.x); return { sc, cx: x1 - w1.x * sc, cy: y1 - w1.y * sc }; };
  const key = (g) => { const c = camOf(g); return `${c.sc.toFixed(4)}|${c.cx.toFixed(1)}|${c.cy.toFixed(1)}|${Math.round(g.w)}x${Math.round(g.h)}|${g.safeBottom}`; };
  const samples = []; let geo = null, prev = null;
  for (const t0 = Date.now(); Date.now() - t0 < 15000;) {
    await p.page.waitForTimeout(600);
    const g = await read();
    if (!g || g.hits.length !== 2) return ok(`${label}: campfire seats clear of the chat box`, false, `no scene camera ${JSON.stringify(g)}`);
    const k = key(g); samples.push(k);
    if (k === prev) { geo = g; break; }
    prev = k;
  }
  if (!geo) return ok(`${label}: camera settled before measuring (two equal samples within 15 s)`, false, JSON.stringify(samples));
  const { sc, cx, cy } = camOf(geo);
  const label16 = 16;   // label box ≈ 16 CSS px on screen; allow one lift (layoutLabels max 1) above the base
  const bad = [];
  for (const s of createMap(geo.n).seats) {
    const r = { x: cx + (s.sit.x - 26) * sc, y: cy + (s.sit.y - 80) * sc - 2 * label16, w: 52 * sc, h: 86 * sc + 2 * label16 };
    const hit = (b) => !!b && r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h;
    const inside = r.x >= -2 && r.x + r.w <= geo.w + 2 && r.y + r.h <= geo.h + 2;
    if (hit(geo.ov) || !inside) bad.push({ seat: s.sit, r: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }, ov: hit(geo.ov) });
  }
  ok(`${label}: all ${geo.n} campfire seats + labels visible, clear of the chat box (scale ${sc.toFixed(3)}, safe bottom ${geo.safeBottom})`, bad.length === 0, JSON.stringify({ bad, ov: geo.ov, slot: [geo.w, geo.h] }));
};
const hit = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const overlap = async (p, label) => { const box = (sel) => p.page.locator(sel).first().boundingBox().catch(() => null); const ov = await box('[data-testid=chat-overlay]'); const others = { dock: await box('.dock'), topbar: await box('.topbar'), tools: await box('.topbar .tools'), control: await box('[data-testid=confirm], [data-testid=vote-yes], [data-testid=vote-skip], [data-testid=close-step]'), mic: await box('[data-testid=voice-bar], [data-testid=voice], [data-testid=mic-toggle]') }; const bad = Object.entries(others).filter(([, b]) => hit(ov, b)).map(([k]) => k); ok(`${label}: overlay clear of the dock controls, the top bar and the mic`, ov && bad.length === 0, JSON.stringify({ ov, bad, others })); };

// ---- lobby
await host.page.goto(`${base}/`); await host.page.getByTestId('name').fill('An'); await host.page.getByTestId('create-automatic').click(); await host.page.waitForSelector('[data-testid=room-code]');
const code = (await host.page.getByTestId('room-code').textContent()).trim();
for (const p of ps.slice(1)) { await p.page.goto(`${base}/r/${code}`); await p.page.getByTestId('name').fill(p.n); await p.page.getByTestId('join').click(); await p.page.waitForSelector('[data-testid=room]'); }
for (const p of ps) ok(`${p.n}: overlay present in the lobby (${p.phone ? 'compact' : 'full'})`, (await p.page.locator('[data-testid=chat-overlay]').count()) === 1 && (await p.page.getByTestId('chat-overlay').getAttribute('data-compact')) === String(p.phone));
const chi = ps[2], chiSeat = await seatOf(chi);
await say(chi, 'hello camp from Chi');
await ps[0].page.waitForTimeout(800);
for (const p of ps) {
  const last = p.page.locator('[data-testid=chat-overlay] [data-testid=chat-item]').last();
  const sc = await senderCheck(p, { from: chiSeat, name: 'Chi' });
  ok(`${p.n}: sees Chi's message automatically; name, avatar and seat all Chi's`, /hello camp from Chi/.test(await last.locator('.co-text').innerText()) && sc.lastOk && sc.bad.length === 0, JSON.stringify(sc));
}
ok('wire: the chat frame carries Chi\'s seat and name', ps[5].frames.some((f) => f.t === 'chat' && f.msg.from === chiSeat && f.msg.name === 'Chi' && f.msg.text === 'hello camp from Chi'));
ok('lobby phone (scene on): text contrast ≥ 4.5 over the rendered day scene', contrastOk(await contrast(ps[1])), JSON.stringify(await contrast(ps[1])));
for (const p of ps) await p.page.getByTestId('ready').click();
await host.page.getByTestId('start').click();
for (const p of ps) await until(p, '[data-testid=room][data-step="night.main"]', 15000);

// ---- night
const roles = new Map(); for (const p of ps) roles.set(p, (await p.state()).view.game.me.role);
const wolves = ps.filter((p) => roles.get(p) === 'wolf'); const others = ps.filter((p) => roles.get(p) !== 'wolf');
const v0 = others[0];   // reloaded below
console.log(`roles: ${ps.map((p) => `${p.n}${p.phone ? '/phone' : ''}=${roles.get(p)}`).join(' ')}`);
await say(wolves[0], 'grr pack secret');
await wolves[0].page.waitForTimeout(800);
const w0 = { from: await seatOf(wolves[0]), name: wolves[0].n };
const wsc = await senderCheck(wolves[1], w0);
ok('night: the other wolf sees the pack message with the Wolves label; name, avatar and seat are the sending wolf\'s', (await wolves[1].page.locator('[data-testid=chat-overlay] [data-testid=chat-item][data-channel=wolves]').count()) >= 1 && /Wolves/.test(await wolves[1].page.locator('[data-testid=chat-overlay] .co-ch').last().innerText()) && wsc.lastOk && wsc.bad.length === 0, JSON.stringify(wsc));
for (const p of others) {
  const html = await p.page.locator('[data-testid=chat-overlay]').innerHTML();
  ok(`${p.n} (not a wolf): no wolves item, label, badge or count; no wolves frame on the wire`, (await p.page.locator('[data-testid=chat-overlay] [data-testid=chat-item][data-channel=wolves]').count()) === 0 && !/grr pack secret|Wolves|wolves/.test(html) && (await p.page.getByTestId('chat-overlay').getAttribute('data-channels')) === '' && !p.frames.some((f) => (f.t === 'chat' || f.t === 'chatlog') && f.channel === 'wolves'));
}
// same box for a wolf and a non-wolf at the same viewport (pack message present on the wolf's side); two pages
// without the scene are resized so the comparison never depends on the deal
const boxOf = async (p) => { const b = await p.page.getByTestId('chat-overlay').boundingBox(); return b && [b.x, b.y, b.width, b.height].map(Math.round).join(','); };
{
  const w = wolves.find((p) => !p.scene) ?? wolves[0], o = others.find((p) => !p.scene && p !== v0) ?? others[0];
  for (const vp of [PHONE.viewport, LAPTOP.viewport, { width: 844, height: 390 }]) {
    await w.page.setViewportSize(vp); await o.page.setViewportSize(vp); await w.page.waitForTimeout(300);
    const bw = await boxOf(w), bo = await boxOf(o);
    ok(`night ${vp.width}×${vp.height}: wolf ${w.n} and non-wolf ${o.n} have the identical overlay box`, !!bw && bw === bo, JSON.stringify({ bw, bo }));
  }
  for (const p of [w, o]) await p.page.setViewportSize(p.phone ? PHONE.viewport : LAPTOP.viewport);
}
for (const p of ps.slice(0, 2)) { const c = await contrast(p); ok(`night ${p.phone ? 'phone' : 'laptop'} (scene on): text contrast ≥ 4.5 over the rendered night scene`, contrastOk(c), JSON.stringify(c)); }
// reconnect: a wolf reload keeps the history; a non-wolf reload still gets nothing
await wolves[1].page.reload(); await until(wolves[1], '[data-testid=conn][data-status=open]', 15000); await wolves[1].page.waitForTimeout(800);
ok('reconnect: the wolf still has the pack message after a reload (chatlog), sender intact', /grr pack secret/.test(await wolves[1].page.getByTestId('chat-overlay').innerText()) && (await senderCheck(wolves[1], w0)).lastOk);
const v = v0; v.frames.length = 0;
await v.page.reload(); await until(v, '[data-testid=conn][data-status=open]', 15000); await v.page.waitForTimeout(800);
ok('reconnect: a non-wolf still sees nothing of the wolves channel after a reload', (await v.page.locator('[data-testid=chat-overlay] [data-testid=chat-item]').count()) === 0 && !v.frames.some((f) => (f.t === 'chat' || f.t === 'chatlog') && f.channel === 'wolves') && !/grr pack secret/.test(await v.page.content()));
await overlap(ps[0], 'laptop night'); await overlap(ps[1], 'phone night');
await ps[3].page.setViewportSize({ width: 390, height: 500 }); await ps[3].page.waitForTimeout(300);
await overlap(ps[3], 'phone night, keyboard open (viewport 500px)');
await ps[3].page.setViewportSize({ width: 390, height: 844 });
// ---- day
await Promise.all(ps.map((p) => until(p, '[data-testid=room][data-step="day.discussion"], [data-testid=room][data-step="ended"]', 150000)));
const alive = []; for (const p of ps) if ((await p.state()).view.game.me.alive) alive.push(p);
// typing never moves the avatar: each scene-on living seat types WASD (laptop: overlay input; phone: sheet input)
const typeIn = async (p, text) => {
  if (await compactOf(p)) { await p.page.getByTestId('chat-history').click(); await p.page.getByTestId('chat-input').focus(); } else await p.page.getByTestId('chat-overlay-input').focus();
  const a = await p.page.evaluate(() => globalThis.__moonveilScene?.localPose?.() ?? null);
  await p.page.keyboard.type(text); await p.page.waitForTimeout(600);
  const b = await p.page.evaluate(() => globalThis.__moonveilScene?.localPose?.() ?? null);
  const field = (await compactOf(p)) ? 'chat-input' : 'chat-overlay-input';
  ok(`${p.n} (${p.phone ? 'phone, sheet input' : 'laptop, overlay input'}): typing WASD moves nobody and every key reaches the field`, !!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && (await p.page.getByTestId(field).inputValue()) === text, JSON.stringify({ a, b }));
  await p.page.keyboard.press('Enter'); await p.page.waitForTimeout(800);
  if (await compactOf(p)) await p.page.keyboard.press('Escape');
};
const typers = alive.filter((p) => p.scene);
if (!typers.length) console.log('SKIP  typing: both scene-on seats died at night this deal');
let speaker = alive[0];
for (const [i, p] of typers.entries()) { await typeIn(p, `wasd morning everyone ${i}`); speaker = p; }
if (!typers.length) await say(speaker, 'wasd morning everyone 0');
const last = `wasd morning everyone ${Math.max(0, typers.length - 1)}`;
const sp = { from: await seatOf(speaker), name: speaker.n };
for (const p of alive.filter((x) => x !== speaker)) { const sc = await senderCheck(p, sp); ok(`${p.n}: day message appears automatically; name, avatar and seat are ${speaker.n}'s`, (await p.page.locator('[data-testid=chat-overlay] .co-text').last().innerText()).includes(last) && sc.lastOk && sc.bad.length === 0, JSON.stringify(sc)); }
for (const p of ps.slice(0, 2)) { const c = await contrast(p); ok(`day ${p.phone ? 'phone' : 'laptop'} (scene on): text contrast ≥ 4.5 over the rendered day scene`, contrastOk(c), JSON.stringify(c)); }
await overlap(ps[0], 'laptop day'); await overlap(ps[1], 'phone day');
// campfire seats in discussion: phone portrait, phone landscape, laptop 1440×900, 1280×720 and 1366×768
await seatsClear(ps[1], 'discussion, phone 390×844');
await ps[1].page.setViewportSize({ width: 844, height: 390 }); await seatsClear(ps[1], 'discussion, phone landscape 844×390');
await ps[1].page.setViewportSize({ width: 375, height: 667 }); await seatsClear(ps[1], 'discussion, phone 375×667');
await ps[1].page.setViewportSize({ width: 390, height: 844 });
await seatsClear(ps[0], 'discussion, laptop 1440×900');
await ps[0].page.setViewportSize({ width: 1280, height: 720 }); await seatsClear(ps[0], 'discussion, laptop 1280×720');
await ps[0].page.setViewportSize({ width: 1366, height: 768 }); await seatsClear(ps[0], 'discussion, laptop 1366×768');
await ps[0].page.setViewportSize({ width: 1440, height: 900 });
// vote
await Promise.all(ps.map((p) => until(p, '[data-testid=room][data-step="day.vote"], [data-testid=room][data-step="ended"]', 260000)));
await seatsClear(ps[1], 'vote, phone 390×844');
await ps[1].page.setViewportSize({ width: 375, height: 667 }); await seatsClear(ps[1], 'vote, phone 375×667');
await ps[1].page.setViewportSize({ width: 844, height: 390 }); await seatsClear(ps[1], 'vote, phone landscape 844×390');
await ps[1].page.setViewportSize({ width: 390, height: 844 });
await seatsClear(ps[0], 'vote, laptop 1440×900');
await overlap(ps[1], 'phone vote'); await overlap(ps[0], 'laptop vote');
await browser.close(); server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
