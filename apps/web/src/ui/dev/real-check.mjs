// Real-server browser check (Chromium headless shell = browser emulation, no devices): builds the web app, starts
// apps/server with the REAL rules engine on a game-ui port, and drives isolated browser contexts through the UI.
//   node scripts/env.mjs node apps/web/src/ui/dev/real-check.mjs        (port REAL_PORT, default 4460)
// Asserts on the wire (every WS frame per context) and on the DOM: role/pack/night isolation, wolf chat isolation,
// dawn announcement, ghost view, reconnect, and a full moderator-mode match to the end reveal.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../../..');
const port = Number(process.env.REAL_PORT ?? 4460);
const base = `http://127.0.0.1:${port}`;
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); if (!cond) fails++; };
const sh = (cmd, args, env = {}) => new Promise((res, rej) => { const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${args.join(' ')} exit ${c}`)))); });

await sh('npm', ['run', 'build', '-w', '@moonveil/web']);
const server = spawn('node', ['apps/server/src/main.ts'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'rules', MOONVEIL_PERSIST: '0' } });
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => process.stderr.write(d));
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }

const browser = await chromium.launch();
class P {
  constructor(name, ctx, page) { this.name = name; this.ctx = ctx; this.page = page; this.frames = []; page.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => this.frames.push(JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'))))); }
  view() { for (let i = this.frames.length - 1; i >= 0; i--) if (this.frames[i].t === 'state') return this.frames[i].view; throw new Error(`${this.name}: no state`); }
  game() { return this.view().game; }
  get seat() { return this.view().me.seat; }
  async step() { return this.page.locator('[data-testid=room]').getAttribute('data-step'); }
  async waitStep(kind, ms = 90_000) { await this.page.waitForSelector(`[data-testid=room][data-step="${kind}"]`, { timeout: ms }); }
  async fill(name) { await this.page.getByTestId('name').fill(name); }
  async create(mode) { await this.page.goto(`${base}/`); await this.fill(this.name); await this.page.getByTestId(`create-${mode}`).click(); await this.page.waitForSelector('[data-testid=room-code]'); return (await this.page.getByTestId('room-code').textContent()).trim(); }
  async join(code) { await this.page.goto(`${base}/r/${code}`); await this.fill(this.name); await this.page.getByTestId('join').click(); await this.page.waitForSelector('[data-testid=room]'); }
  async ready() { await this.page.getByTestId('ready').click(); }
  async pickFirst() { const c = this.page.getByTestId('confirm'); if (!(await c.count())) return false; const b = this.page.locator('.seat-grid button[aria-pressed]:not([disabled])').first(); if (!(await b.count())) return false; await b.click(); if (!(await c.isEnabled())) return false; await c.click(); return true; }
}
// Scene canvas off: 15 software-rendered WebGL contexts starve the page in headless Chromium; the scene has its own checks (packages/scene).
const mk = async (name, opts = {}) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', ...opts }); await ctx.addInitScript(() => localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', modNarration: false, ambience: false, scene: false }))); const page = await ctx.newPage(); return new P(name, ctx, page); };
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh', 'Minh'];

// ---------- automatic mode: lobby -> night 1 -> dawn/day (real timers) ----------
{
  const ps = [];
  for (const n of NAMES) ps.push(await mk(n));
  const code = await ps[0].create('automatic');
  for (const p of ps.slice(1)) await p.join(code);
  for (const p of ps) await p.ready();
  await ps[0].page.getByTestId('start').click();
  for (const p of ps) await p.waitStep('night.main', 15_000);
  ok('automatic: 8 players reach night.main through the UI', true);
  const t0 = Date.now();
  const roles = new Map(ps.map((p) => [p.seat, p.game().me.role]));
  const wolves = ps.filter((p) => roles.get(p.seat) === 'wolf');
  ok('automatic: role counts match the public roleCounts', [...roles.values()].filter((r) => r === 'wolf').length === ps[0].game().roleCounts.wolf);
  // wire isolation during night.main
  for (const p of ps) {
    const states = p.frames.filter((f) => f.t === 'state').map((f) => f.view.game).filter(Boolean);
    const otherRoles = states.flatMap((g) => g.seats.filter((s) => s.seat !== g.me.seat && s.role !== null));
    const isWolf = roles.get(p.seat) === 'wolf';
    ok(`${p.name}: no other seat's role on the wire (except pack for wolves)`, otherRoles.every((s) => isWolf && roles.get(g0(p).seatIds[s.seat]) === 'wolf'));
    ok(`${p.name}: no moderator projection on the wire`, states.every((g) => g.moderator === null));
    ok(`${p.name}: pack picks only for wolves`, states.every((g) => (g.pack?.picks ?? null) === null || isWolf));
  }
  function g0(p) { return p.game(); }
  // act through the UI
  let acted = 0;
  for (const p of ps) if (await p.pickFirst()) acted++;
  ok('automatic: wolves/seer/guard submitted via the UI', acted >= 3, String(acted));
  // seer sees the result inline
  const seer = ps.find((p) => roles.get(p.seat) === 'seer');
  if (seer) { const shown = await seer.page.locator('[data-testid=seer-result]').waitFor({ timeout: 5000 }).then(() => true, () => false); ok('seer: result shown from facts after the server round trip', shown); }
  // wolf chat: private
  const w = wolves[0];
  await w.page.getByTestId('open-chat').click();
  const tabs = w.page.locator('.tabs .tab');
  if (await tabs.count()) await tabs.filter({ hasText: /Wolves|Sói/ }).click();
  await w.page.getByTestId('chat-input').fill('grr');
  await w.page.getByTestId('chat-send').click();
  await w.page.waitForTimeout(600);
  ok('wolf: own chat message delivered on the wolves channel', /grr/.test(await w.page.getByTestId('chat-log').innerText()));
  ok('other wolf received the wolves chat frame', wolves[1].frames.some((f) => f.t === 'chat' && f.channel === 'wolves' && f.msg.text === 'grr'));
  for (const p of ps.filter((x) => !wolves.includes(x))) {
    ok(`${p.name} (not a wolf): no wolves chat/chatlog frame on the wire`, !p.frames.some((f) => (f.t === 'chat' || f.t === 'chatlog') && f.channel === 'wolves'));
    ok(`${p.name}: no wolves tab in the DOM`, !/grr/.test(await p.page.content()));
  }
  await w.page.keyboard.press('Escape');
  // same top bar for everyone at night
  const counts = new Set();
  for (const p of ps) counts.add(await p.page.locator('.topbar .tools .btn').count());
  ok('night: identical top-bar button count on every seat', counts.size === 1);
  // wait for night.witch (fixed 40 s) then dawn (20 s)
  for (const p of ps) await p.waitStep('night.witch', 60_000);
  const witch = ps.find((p) => roles.get(p.seat) === 'witch');
  if (witch) { await witch.page.getByTestId('heal-no').click().catch(() => {}); ok('witch: panel rendered with heal controls', (await witch.page.locator('[data-testid=night-witch]').count()) === 1); }
  for (const p of ps) await p.page.waitForSelector('[data-testid=room][data-step^="day."], [data-testid=room][data-step="hunter"], [data-testid=room][data-step="ended"]', { timeout: 60_000 });
  const nightMs = Date.now() - t0;
  ok(`night lasted the fixed length (~60 s, measured ${Math.round(nightMs / 1000)} s)`, nightMs > 55_000 && nightMs < 75_000);
  const dead = ps.filter((p) => !p.game().me.alive);
  ok('dawn: public log has a dawn entry on every client', ps.every((p) => p.game().publicLog.some((e) => e.t === 'dawn')));
  if (dead.length) {
    ok('dead seat shows the ghost bar', (await dead[0].page.locator('[data-testid=ghost-bar]').count()) === 1);
    const alive = ps.find((p) => p.game().me.alive);
    ok('living seat sees no ghosts chat frames', !alive.frames.some((f) => (f.t === 'chat' || f.t === 'chatlog') && f.channel === 'ghosts'));
  } else console.log('INFO  nobody died on night 1 (guard/witch), ghost checks skipped');
  // reconnect: reload keeps the seat and the step
  const r = ps[3];
  const stepBefore = await r.step();
  await r.page.reload();
  await r.page.waitForSelector('[data-testid=conn][data-status=open]', { timeout: 15_000 });
  await r.page.waitForSelector('[data-testid=room]');
  ok('reconnect (reload): same seat, same step rendered', r.seat === r.view().me.seat && (await r.step()) === stepBefore);
  ok('reconnect: no secret gained (own role unchanged, others still null)', r.game().me.role === roles.get(r.seat) && r.game().seats.every((s) => s.seat === r.game().me.seat || s.role === null || s.role === 'hunter'));
  for (const p of ps) await p.ctx.close();
}

// ---------- moderator mode: full match, moderator closes steps via the UI ----------
{
  const mod = await mk('Mod', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
  const code = await mod.create('moderator');
  const ps = [];
  for (const n of NAMES.slice(0, 7)) { const p = await mk(n); await p.join(code); await p.ready(); ps.push(p); }
  await mod.page.getByTestId('start').click();
  await mod.page.waitForSelector('[data-testid=mod-console]', { timeout: 15_000 });
  ok('moderator: console rendered, no timer', (await mod.page.locator('[data-testid=timer]').count()) === 0);
  ok('moderator: cannot speak (grant-driven: no chat input)', true); // asserted below when chat opens
  await mod.page.getByTestId('open-chat').click();
  ok('moderator: chat is listen-only', (await mod.page.locator('[data-testid=chat-listen-only]').count()) === 1 && (await mod.page.locator('[data-testid=chat-input]').count()) === 0);
  await mod.page.keyboard.press('Escape');
  const closeStep = async () => { await mod.page.getByTestId('close-step').click(); await mod.page.locator('[role=alertdialog] .btn').nth(1).click(); await mod.page.waitForTimeout(250); };
  let guard = 0;
  while (guard++ < 60) {
    const step = await mod.step();
    if (step === 'ended') break;
    if (step === 'night.main' || step === 'night.witch' || step === 'hunter') { for (const p of ps) await p.pickFirst().catch(() => {}); if (step === 'night.witch') { const w = ps.find((p) => p.game().me.role === 'witch' && p.game().me.alive); if (w) await w.page.getByTestId('heal-no').click().catch(() => {}); } }
    if (step === 'day.vote') { const alive = ps.filter((p) => p.game().me.alive); const target = alive[0]; for (const p of alive) { if (p === target) continue; const b = p.page.locator(`[data-testid=seat-${target.game().me.seat}]`); if (await b.count()) { await b.click(); await p.page.getByTestId('confirm').click(); } } await mod.page.waitForTimeout(300);
      ok('open ballots: a voter sees the live ballot list on day.vote', (await alive[1].page.locator('[data-testid=ballots]').count()) === 1); }
    if (step === 'day.confirm') { for (const p of ps.filter((p) => p.game().me.alive)) await p.page.getByTestId('vote-yes').click().catch(() => {}); await mod.page.waitForTimeout(300); }
    await closeStep();
    await mod.page.waitForTimeout(150);
  }
  ok('moderator mode: match reached ended via UI-driven steps', (await mod.step()) === 'ended');
  if ((await mod.step()) === 'ended') {
    const reveal = ps[0].game().reveal.roles.join(',');
    ok('end reveal identical on every client and shown with 7 role tags', ps.every((p) => p.game().reveal.roles.join(',') === reveal) && (await ps[0].page.locator('[data-testid=ended] .seat-chip .tag').count()) === 7);
  }
  for (const p of [mod, ...ps]) await p.ctx.close();
}

await browser.close();
server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
