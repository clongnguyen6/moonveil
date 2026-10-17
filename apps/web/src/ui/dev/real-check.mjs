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

console.log('[scene] off');
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
const mk = async (name, opts = {}) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', ...opts }); await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; localStorage.setItem('moonveil.ui.settings', JSON.stringify({ lang: 'en', sound: false, reducedMotion: 'on', modNarration: true, ambience: false, scene: false })); }); const page = await ctx.newPage(); return new P(name, ctx, page); };
const NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Ha', 'Khoa', 'Linh', 'Minh'];

// ---------- automatic mode: lobby -> night 1 -> dawn/day (real timers) ----------
{
  const ps = [];
  for (const n of NAMES) ps.push(await mk(n));
  // Built dist served by the real server (not vite): the new shell renders, the old shell is gone.
  await ps[0].page.goto(`${base}/`);
  ok('dist: production entry renders GameApp (entry + app roots present)', (await ps[0].page.locator('[data-testid=app] [data-testid=entry]').count()) === 1);
  ok('dist: old shell markup absent (.shell/.roomhead)', (await ps[0].page.locator('.shell, .roomhead, .provisional').count()) === 0);
  ok('dist: title and lang from the UI', /Moonveil/.test(await ps[0].page.title()) && /^(vi|en)$/.test(await ps[0].page.locator('html').getAttribute('lang')));
  ok('create: "Where are you playing?" choice present, online by default', (await ps[0].page.locator('[data-testid=create-card] input[type=radio]').count()) === 2 && (await ps[0].page.getByTestId('where-online').isChecked()));
  const code = await ps[0].create('automatic');
  for (const p of ps.slice(1)) await p.join(code);
  ok('lobby: grouped cards (invite, room settings for the host, you, start)', (await ps[0].page.locator('[data-testid=invite], [data-testid=room-settings][data-host=true], [data-testid=you-card], [data-testid=start-card]').count()) === 4);
  ok('lobby: guest sees the read-only Room summary and no host controls', (await ps[1].page.locator('[data-testid=room-settings][data-host=false] [data-testid=room-voice-mode]').count()) === 1 && (await ps[1].page.locator('[data-testid=start-card], [data-testid=voice-mode]').count()) === 0);
  await ps[1].page.getByTestId('open-settings').click();
  await ps[1].page.waitForTimeout(250);
  ok('settings sheet: personal group with switches, no moderator group for a player, opaque sheet', (await ps[1].page.locator('[data-testid=settings-personal] input[role=switch]').count()) === 3 && (await ps[1].page.locator('[data-testid=settings-moderator]').count()) === 0 && (await ps[1].page.evaluate(() => { const c = getComputedStyle(document.querySelector('.sheet')).backgroundColor; return !/rgba\(.*,\s*0?\.\d+\)$/.test(c); })));
  await ps[1].page.keyboard.press('Escape');
  await ps[1].page.waitForTimeout(150);
  ok('settings sheet: Escape closes it', (await ps[1].page.locator('[data-testid=settings-sheet]').count()) === 0);
  // Host deck (P12): default shown; invalid custom deck -> error + start blocked; reset -> default again.
  const host = ps[0];
  ok('deck: lobby shows the engine default deck', (await host.page.locator('[data-testid=deck][data-custom=false]').count()) === 1 && (await host.page.locator('[data-testid=deck-counts] [data-role=wolf]').getAttribute('data-count')) !== '0');
  await host.page.getByTestId('deck-edit').click();
  await host.page.locator('[data-role=wolf] button[aria-label^="-"]').click();
  await host.page.locator('[data-role=wolf] button[aria-label^="-"]').click();
  await host.page.getByTestId('deck-apply').click();
  await host.page.waitForTimeout(400);
  const deckErr = (await host.page.locator('[data-testid=deck-error], [data-testid=error]').count()) > 0;
  ok('deck: an invalid custom deck is rejected (engine error shown)', deckErr);
  if ((await host.page.locator('[data-testid=deck-reset]').count()) > 0) await host.page.getByTestId('deck-reset').click();
  await host.page.waitForTimeout(300);
  ok('deck: back to default', (await host.page.locator('[data-testid=deck][data-custom=false]').count()) === 1);
  ok('deck: non-host sees the deck but no controls', (await ps[1].page.locator('[data-testid=deck]').count()) === 1 && (await ps[1].page.locator('[data-testid=deck-edit]').count()) === 0);
  // D1 QR (host only), D2 Join voice (nothing joined until the tap), D5 host voice-mode switch seen by everyone.
  ok('D1: host lobby shows the invite QR; guest does not', (await host.page.locator('[data-testid=qr] svg path').count()) === 1 && (await ps[1].page.locator('[data-testid=qr]').count()) === 0);
  ok('D2: remote room starts not joined (Join voice offered, no mic prompt)', (await ps[1].page.locator('[data-testid=mic][data-status=notJoined] [data-testid=voice-join]').count()) === 1 && ps[1].view().voiceMode === 'remote');
  await ps[1].page.getByTestId('voice-join').click();
  await ps[1].page.waitForTimeout(400);
  ok('D2: Join voice flips the client state (voiceJoined) and shows Leave voice', (await ps[1].page.evaluate(() => globalThis.__moonveil.getState().voiceJoined === true)) && (await ps[1].page.getByTestId('voice-leave').count()) === 1);
  await ps[1].page.getByTestId('voice-leave').click();
  await ps[1].page.waitForTimeout(300);
  ok('D2: Leave voice returns to not joined', (await ps[1].page.locator('[data-testid=mic][data-status=notJoined]').count()) === 1);
  ok('D5: host sees the voice-mode switch; guest does not', (await host.page.locator('[data-testid=voice-mode-inperson]').count()) === 1 && (await ps[1].page.locator('[data-testid=voice-mode]').count()) === 0);
  await host.page.getByTestId('voice-mode-inperson').click();
  await ps[1].page.waitForTimeout(500);
  ok('D5: every seat follows the server to in person (guest mic card says in person, no Join voice)', ps[1].view().voiceMode === 'inPerson' && (await ps[1].page.locator('[data-testid=mic][data-status=inPerson]').count()) === 1 && (await ps[1].page.locator('[data-testid=voice-join]').count()) === 0);
  await host.page.getByTestId('voice-mode-remote').click();
  await ps[1].page.waitForTimeout(500);
  ok('D5: back to remote restores Join voice for the guest', ps[1].view().voiceMode === 'remote' && (await ps[1].page.locator('[data-testid=voice-join]').count()) === 1);
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
  // Deterministic death: every wolf picks the same legal target (first enabled in wolf #1's grid); the guard protects
  // someone else; the witch does not heal. So the victim dies at dawn whatever the dealt roles.
  const victimTid = await wolves[0].page.locator('.seat-grid button[aria-pressed]:not([disabled])').first().getAttribute('data-testid');
  let acted = 0;
  for (const p of ps) {
    const role = roles.get(p.seat);
    if (role === 'wolf') { await p.page.getByTestId(victimTid).click(); await p.page.getByTestId('confirm').click(); acted++; }
    else if (role === 'guard') { const alt = p.page.locator(`.seat-grid button[aria-pressed]:not([disabled]):not([data-testid="${victimTid}"])`).first(); await alt.click(); await p.page.getByTestId('confirm').click(); acted++; }
    else if (await p.pickFirst()) acted++;
  }
  ok('automatic: wolves/seer/guard submitted via the UI', acted >= 3, String(acted));
  const victimSeat = ps[0].game().seatIds[Number(victimTid.replace('seat-', ''))];
  // seer sees the result inline
  const seer = ps.find((p) => roles.get(p.seat) === 'seer');
  if (seer) { const shown = await seer.page.locator('[data-testid=seer-result]').waitFor({ timeout: 5000 }).then(() => true, () => false); ok('seer: result shown from facts after the server round trip', shown); }
  // wolf chat: private
  const w = wolves[0];
  await w.page.getByTestId('open-chat').click();
  const tabs = w.page.locator('[data-testid=chat-tab]');
  if (await tabs.count()) await w.page.locator('[data-testid=chat-tab][data-channel=wolves]').click();
  ok('chat-tab hook present with data-channel', (await tabs.count()) === 0 || (await w.page.locator('[data-testid=chat-tab][data-channel=wolves]').count()) === 1);
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
  ok('voice bar reports a mic state hook (data-mic) on every seat', (await Promise.all(ps.map((p) => p.page.locator('[data-testid=voice][data-mic]').count()))).every((n) => n === 1));
  ok('voice: no second VoiceClient; UI reads the client\'s instance (null without a voice backend)', (await ps[0].page.evaluate(() => (globalThis.__moonveil?.voice ?? null) === null || typeof globalThis.__moonveil.voice.getSnapshot === 'function')));
  // wait for night.witch (fixed 40 s) then dawn (20 s)
  for (const p of ps) await p.waitStep('night.witch', 60_000);
  const witch = ps.find((p) => roles.get(p.seat) === 'witch');
  if (witch) { await witch.page.getByTestId('heal-no').click().catch(() => {}); await witch.page.waitForTimeout(300); ok('witch: panel rendered with heal controls', (await witch.page.locator('[data-testid=night-witch]').count()) === 1); }
  for (const p of ps) await p.page.waitForSelector('[data-testid=room][data-step^="day."], [data-testid=room][data-step="hunter"], [data-testid=room][data-step="ended"]', { timeout: 60_000 });
  const nightMs = Date.now() - t0;
  ok(`night lasted the fixed length (~60 s, measured ${Math.round(nightMs / 1000)} s)`, nightMs > 55_000 && nightMs < 75_000);
  const dead = ps.filter((p) => !p.game().me.alive);
  ok('dawn: public log has a dawn entry on every client', ps.every((p) => p.game().publicLog.some((e) => e.t === 'dawn')));
  ok('dawn: the chosen victim died (deterministic ghost path)', dead.some((p) => p.seat === victimSeat), dead.map((p) => p.name).join(',') || 'nobody');
  const ghost = dead.find((p) => p.seat === victimSeat) ?? dead[0];
  if (ghost) {
    if ((await ghost.step()) === 'hunter') { await ghost.pickFirst().catch(() => {}); for (const p of ps) await p.page.waitForSelector('[data-testid=room][data-step^="day."], [data-testid=room][data-step="ended"]', { timeout: 30_000 }); }
    ok('ghost: dead seat shows the ghost bar', (await ghost.page.locator('[data-testid=ghost-bar]').count()) === 1);
    ok('ghost: skin switched to ghost', (await ghost.page.locator('[data-testid=app]').getAttribute('data-phase')) === 'ghost');
    await ghost.page.getByTestId('open-chat').click();
    const ghostTabs = await ghost.page.locator('.tabs .tab').allInnerTexts();
    ok('ghost: chat offers the Ghosts channel (listen+speak) and public (listen)', ghostTabs.some((x) => /Ghosts|Ma/.test(x)));
    await ghost.page.locator('[data-testid=chat-tab][data-channel=ghosts]').click();
    await ghost.page.getByTestId('chat-input').fill('boo');
    await ghost.page.getByTestId('chat-send').click();
    await ghost.page.waitForTimeout(500);
    ok('ghost: own ghost-chat message shown', /boo/.test(await ghost.page.getByTestId('chat-log').innerText()));
    await ghost.page.keyboard.press('Escape');
    for (const p of ps.filter((x) => x.game().me.alive)) {
      ok(`${p.name} (living): no ghosts chat/chatlog frame on the wire`, !p.frames.some((f) => (f.t === 'chat' || f.t === 'chatlog') && f.channel === 'ghosts'));
      ok(`${p.name} (living): 'boo' never reaches the DOM`, !/boo/.test(await p.page.content()));
    }
    ok('ghost: no night action offered (no actions in projection)', ghost.game().me.actions.length === 0);
    ok('ghost: no action panel/hooks in the DOM (automatic mode)', (await ghost.page.locator('[data-testid=ghost-panel]').count()) === 1 && (await ghost.page.locator('[data-testid=confirm], [data-testid=vote-skip], [data-testid=vote-yes], [data-testid=vote-no]').count()) === 0);
  }
  // reconnect: reload keeps the seat and the step
  const r = ps[3];
  const stepBefore = await r.step();
  await r.page.reload();
  await r.page.waitForSelector('[data-testid=conn][data-status=open]', { timeout: 15_000 });
  await r.page.waitForSelector('[data-testid=room]');
  ok('reconnect (reload): same seat, same step rendered', r.seat === r.view().me.seat && (await r.step()) === stepBefore);
  {
    const g = r.game();
    const revealed = new Set(g.publicLog.filter((e) => e.t === 'roleRevealed').map((e) => e.seat));
    const isWolf = roles.get(r.seat) === 'wolf';
    const legit = g.seats.every((s) => s.seat === g.me.seat || s.role === null || revealed.has(s.seat) || (isWolf && s.role === 'wolf' && roles.get(g.seatIds[s.seat]) === 'wolf'));
    ok('reconnect: no secret gained (own role unchanged; others only pack-for-wolves or publicly revealed)', g.me.role === roles.get(r.seat) && legit);
  }
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
  ok('D6: narration cue shown by default (approved N1 line + M1 cue)', /Night 1\. Everyone close your eyes\./.test(await mod.page.getByTestId('mod-say').innerText()) && /Close this step/.test(await mod.page.getByTestId('mod-cue').innerText()));
  ok('moderator: cannot speak (grant-driven: no chat input)', true); // asserted below when chat opens
  await mod.page.getByTestId('open-chat').click();
  ok('moderator: chat is listen-only', (await mod.page.locator('[data-testid=chat-listen-only]').count()) === 1 && (await mod.page.locator('[data-testid=chat-input]').count()) === 0);
  await mod.page.keyboard.press('Escape');
  const closeStep = async () => { await mod.page.getByTestId('close-step').click(); await mod.page.locator('[role=alertdialog] .btn').nth(1).click(); await mod.page.waitForTimeout(250); };
  // Approved: end-match control exists only for the separate moderator; misclicks never end the match.
  ok('moderator: end-match control present, closed', (await mod.page.locator('[data-testid=end-match][data-open=false]').count()) === 1);
  ok('players: no end-match control', (await ps[0].page.locator('[data-testid=end-match], [data-testid=end-match-open]').count()) === 0);
  await mod.page.getByTestId('end-match-open').click();
  await mod.page.getByTestId('end-match-input').fill('nope');
  ok('misclick: open + wrong word keeps confirm disabled and the match running', (await mod.page.locator('[data-testid=end-match-confirm]').isDisabled()) && (await mod.step()) !== 'ended');
  await mod.page.getByTestId('end-match-cancel').click();
  ok('cancel: match still running', (await mod.step()) !== 'ended' && (await mod.page.locator('[data-testid=end-match][data-open=false]').count()) === 1);
  // Idle cycles: nobody acts. rules-12 publishes a stalemate warning after 2 idle cycles and a draw after 3.
  let idleClosed = 0, warned = false, stalemate = false;
  for (let i = 0; i < 40 && (await mod.step()) !== 'ended'; i++) { await closeStep(); idleClosed++; if ((await ps[0].page.locator('[data-testid=stalemate-warning]').count()) > 0) warned = true; }
  stalemate = (await mod.step()) === 'ended';
  ok(`stalemate: three idle cycles end the match (closes: ${idleClosed})`, stalemate);
  ok('stalemate: warning banner appeared on a player before the draw', warned);
  ok('stalemate: end screen shows the distinct draw reason (draw / stalemate) with full reveal', stalemate && (await ps[0].page.locator('[data-testid=ended][data-winner=draw][data-reason=stalemate]').count()) === 1 && (await ps[0].page.locator('[data-testid=ended] .seat-chip .tag').count()) === 7);
  if (stalemate) {
    // Second moderator room for the approved end-match control (needs a running match).
    for (const p of [mod, ...ps]) await p.ctx.close();
    const mod2 = await mk('Mod2', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
    const code2 = await mod2.create('moderator');
    const ps2 = [];
    for (const n of NAMES.slice(0, 7)) { const p = await mk(n + '2'); await p.join(code2); await p.ready(); ps2.push(p); }
    await mod2.page.getByTestId('start').click();
    await mod2.page.waitForSelector('[data-testid=mod-console]', { timeout: 15_000 });
    // Normal UI-driven loop until the first verdict closes: proves nomination ballots, the defense grant and the Yes/No step.
    const close2 = async () => { await mod2.page.getByTestId('close-step').click(); await mod2.page.locator('[role=alertdialog] .btn').nth(1).click(); await mod2.page.waitForTimeout(250); };
    let sawDefense = false, sawConfirm = false;
    for (let i = 0; i < 24 && !sawConfirm && (await mod2.step()) !== 'ended'; i++) {
      const step = await mod2.step();
      if (step === 'night.main' || step === 'night.witch') { for (const p of ps2) await p.pickFirst().catch(() => {}); if (step === 'night.witch') { const w = ps2.find((p) => p.game().me.role === 'witch' && p.game().me.alive); if (w) await w.page.getByTestId('heal-no').click().catch(() => {}); } }
      if (step === 'hunter') for (const p of ps2) await p.pickFirst().catch(() => {});
      if (step === 'day.vote') { const alive = ps2.filter((p) => p.game().me.alive); const target = alive[0]; for (const p of alive) { if (p === target) continue; const b = p.page.locator(`[data-testid=seat-${target.game().me.seat}]`); if (await b.count()) { await b.click(); await p.page.getByTestId('confirm').click(); } } await mod2.page.waitForTimeout(300); }
      if (step === 'day.defense') {
        sawDefense = true;
        const acc = mod2.game().step.accused;
        const other = ps2.find((p) => p.game().me.alive && p.game().me.seat !== acc);
        ok('defense: living non-accused players may speak (public speak grant + "Everyone may speak" copy)', !!other && (await other.page.locator('[data-testid=voice][data-speak=public]').count()) === 1 && /Everyone may speak/.test(await other.page.getByTestId('defense-hint').innerText()) && (await other.page.locator('[data-testid=day-defense][data-everyone=true]').count()) === 1);
        const accused = ps2.find((p) => p.game().me.seat === acc);
        if (accused) ok('defense: the accused keeps the floor copy and the public speak grant', /defense|Your defense/i.test(await accused.page.getByTestId('defense-hint').innerText()) && (await accused.page.locator('[data-testid=voice][data-speak=public]').count()) === 1);
      }
      if (step === 'day.confirm') { for (const p of ps2.filter((p) => p.game().me.alive)) await p.page.getByTestId('vote-yes').click().catch(() => {}); await mod2.page.waitForTimeout(300); sawConfirm = true; }
      await close2();
    }
    ok('moderator room 2: reached a defense and a verdict through the UI', sawDefense && sawConfirm);
    if ((await mod2.step()) !== 'ended') { await mod2.page.getByTestId('end-match-open').click(); await mod2.page.getByTestId('end-match-input').fill('END'); await mod2.page.getByTestId('end-match-confirm').click(); await mod2.page.waitForTimeout(400); }
    ok('moderator end-match (match.end): ended by the moderator, no winner, full reveal on a player', (await ps2[0].page.locator('[data-testid=ended][data-reason=aborted]').count()) === 1 && (await ps2[0].page.locator('[data-testid=ended] .seat-chip .tag').count()) === 7 && !/village|wolves/.test(await ps2[0].page.locator('[data-testid=ended]').getAttribute('data-winner')));
    for (const p of [mod2, ...ps2]) await p.ctx.close();
    await browser.close(); server.kill('SIGTERM');
    console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
  }
  let guard = 0;
  while (guard++ < 60) {
    const step = await mod.step();
    if (step === 'ended') break;
    if (step === 'night.main' || step === 'night.witch' || step === 'hunter') { for (const p of ps) await p.pickFirst().catch(() => {}); if (step === 'night.witch') { const w = ps.find((p) => p.game().me.role === 'witch' && p.game().me.alive); if (w) await w.page.getByTestId('heal-no').click().catch(() => {}); } }
    if (step === 'day.defense') {
      const acc = mod.game().step.accused;
      const other = ps.find((p) => p.game().me.alive && p.game().me.seat !== acc);
      if (other) ok('defense: living non-accused players may speak (grant + copy "Everyone may speak")', (await other.page.locator('[data-testid=voice][data-speak=public]').count()) === 1 && /Everyone may speak/.test(await other.page.getByTestId('defense-hint').innerText()) && (await other.page.locator('[data-testid=day-defense][data-everyone=true]').count()) === 1);
    }
    if (step === 'day.vote') { const alive = ps.filter((p) => p.game().me.alive); const target = alive[0]; for (const p of alive) { if (p === target) continue; const b = p.page.locator(`[data-testid=seat-${target.game().me.seat}]`); if (await b.count()) { await b.click(); await p.page.getByTestId('confirm').click(); } } await mod.page.waitForTimeout(300);
      ok('open ballots: a voter sees the live ballot list on day.vote', (await alive[1].page.locator('[data-testid=ballots]').count()) === 1);
      for (const d of ps.filter((p) => !p.game().me.alive)) ok(`${d.name} (dead, moderator mode): ghost panel, no action hooks at day.vote`, (await d.page.locator('[data-testid=ghost-panel]').count()) === 1 && (await d.page.locator('[data-testid=confirm], [data-testid=vote-skip], [data-testid=vote-yes], [data-testid=vote-no]').count()) === 0); }
    if (step === 'day.confirm') { for (const p of ps.filter((p) => p.game().me.alive)) await p.page.getByTestId('vote-yes').click().catch(() => {}); await mod.page.waitForTimeout(300); }
    await closeStep();
    await mod.page.waitForTimeout(150);
  }
  if ((await mod.step()) !== 'ended') { // end via the approved control
    await mod.page.getByTestId('end-match-open').click(); await mod.page.getByTestId('end-match-input').fill('END'); await mod.page.getByTestId('end-match-confirm').click(); await mod.page.waitForTimeout(300);
    ok('moderator end-match: ended by the moderator, no winner, full reveal on a player', (await ps[0].page.locator('[data-testid=ended][data-reason=aborted]').count()) === 1 && (await ps[0].page.locator('[data-testid=ended] .seat-chip .tag').count()) === 7);
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
