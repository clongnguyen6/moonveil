#!/usr/bin/env node
// Post-deploy check against the public URL (ADR 0010 §7b/§9 G4). Run from this machine, scene off, 3 headless pages:
//   node scripts/env.mjs node scripts/postdeploy-check.mjs https://<domain> [--idle-min=16] [--actions=2]
//        [--action-timeout-min=30] [--no-voice] [--out=.cache/postdeploy/<file>.jsonl]
// Checks: /healthz; SPA routes; /api/lan = [] (public origin set); /ws origin rule (own origin opens, foreign 403);
// create + 2 joins through the real UI; brief voice join (sessions arrive = server reached LiveKit; a page connects
// = browser reached LiveKit), then leave (keeps Cloud minutes small); WebSocket idle for --idle-min with no
// reconnect; then waits for --actions account-holder actions (restart, then redeploy) and checks every page
// reconnects to the same room and seat. Host-header preservation is not observable from outside (see 0010 §7b).
// Prints one JSON line per check; exit 1 on any failure.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import WebSocket from 'ws';

const args = process.argv.slice(2);
const url = (args.find((a) => !a.startsWith('--')) ?? '').replace(/\/+$/, '');
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const IDLE_MIN = Number(opt('idle-min', '16'));
const ACTIONS = Number(opt('actions', '2'));
const ACTION_TIMEOUT_MS = Number(opt('action-timeout-min', '30')) * 60_000;
const VOICE = !args.includes('--no-voice');
// Hard cap on LiveKit Cloud participant-minutes for this script (pages x connected time); voice phase is cut short at it.
const VOICE_CAP_MIN = Number(opt('voice-cap-min', '10'));
const OUT = opt('out', `.cache/postdeploy/check-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
if (!/^https?:\/\/[^/]+$/.test(url)) {
  console.error('usage: postdeploy-check.mjs https://<domain> [--idle-min=16] [--actions=2] [--no-voice]');
  process.exit(2);
}
mkdirSync(dirname(OUT), { recursive: true });
let failed = 0;
const log = (o) => {
  const line = JSON.stringify({ at: new Date().toISOString(), ...o });
  console.log(line);
  appendFileSync(OUT, line + '\n');
  if (o.ok === false) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. HTTP
const hz = await fetch(`${url}/healthz`).catch((e) => ({ status: 0, text: async () => String(e) }));
log({ check: 'healthz', status: hz.status, body: (await hz.text()).slice(0, 80), ok: hz.status === 200 });
if (hz.status !== 200) process.exit(1);
for (const path of ['/', '/r/ABCDEF']) {
  const r = await fetch(`${url}${path}`);
  log({ check: `spa ${path}`, status: r.status, ok: r.status === 200 && (await r.text()).includes('<div') });
}
const lan = await (await fetch(`${url}/api/lan`)).json().catch(() => null);
log({ check: 'api/lan empty (MOONVEIL_PUBLIC_ORIGIN set)', body: lan, ok: Array.isArray(lan?.urls) && lan.urls.length === 0 });

// 2. Origin rule on /ws (Host preservation itself is not observable from outside).
const wsUrl = url.replace(/^http/, 'ws') + '/ws';
const tryWs = (origin) =>
  new Promise((r) => {
    const ws = new WebSocket(wsUrl, { headers: { origin } });
    ws.on('open', () => (ws.close(), r('open')));
    ws.on('error', (e) => r(e.message));
  });
const own = new URL(url).origin;
const ro = await tryWs(own);
log({ check: 'ws own origin opens', result: ro, ok: ro === 'open' });
const rf = await tryWs('https://evil.example');
log({ check: 'ws foreign origin refused', result: rf, ok: /403/.test(rf) });

// 3. Real UI: host creates, two players join. Scene off; fake mic devices for the voice check.
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const quiet = () => {
  localStorage.setItem('moonveil.ui.settings', JSON.stringify({ scene: false, sound: false, reducedMotion: 'on' }));
  globalThis.__MOONVEIL_SCENE = 'off';
};
const recorder = () => {
  const c = globalThis.__moonveil;
  globalThis.__mvLog = [];
  let last = null;
  const rec = () => {
    const s = c.getState();
    if (s.status !== last) {
      last = s.status;
      globalThis.__mvLog.push({ t: Date.now(), status: s.status, code: s.code, close: s.lastCloseCode });
    }
  };
  rec();
  c.subscribe(rec);
};
const st = (p) => p.evaluate(() => { const s = globalThis.__moonveil.getState(); return { status: s.status, code: s.code, seat: s.view?.me?.seat ?? null, players: s.view?.players?.length ?? 0, sessions: s.voiceSessions.length, close: s.lastCloseCode }; });
const pages = [];
try {
  for (const name of ['PD-Host', 'PD-Two', 'PD-Three']) {
    const ctx = await browser.newContext({ baseURL: url, viewport: { width: 1280, height: 800 } });
    await ctx.grantPermissions(['microphone'], { origin: own }).catch(() => {});
    await ctx.addInitScript(quiet);
    const page = await ctx.newPage();
    pages.push({ name, page });
  }
  const [host, ...joiners] = pages;
  await host.page.goto('/');
  await host.page.getByTestId('name').fill(host.name);
  await host.page.getByTestId('create-automatic').click();
  await host.page.getByTestId('room').waitFor({ state: 'attached', timeout: 20_000 });
  await host.page.waitForFunction(() => globalThis.__moonveil?.getState().code, null, { timeout: 20_000 });
  const code = (await st(host.page)).code;
  for (const j of joiners) {
    await j.page.goto('/');
    await j.page.getByTestId('name').fill(j.name);
    await j.page.getByTestId('code').fill(code);
    await j.page.getByTestId('join').click();
    await j.page.waitForFunction(() => globalThis.__moonveil?.getState().status === 'open', null, { timeout: 20_000 });
  }
  await host.page.waitForFunction(() => globalThis.__moonveil.getState().view?.players?.length === 3, null, { timeout: 20_000 });
  const scene = await host.page.locator('[data-testid=scene-slot] canvas').count();
  log({ check: 'create + 2 joins via UI', code, players: (await st(host.page)).players, sceneCanvases: scene, ok: true });
  for (const p of pages) await p.page.evaluate(recorder);
  const seats = Object.fromEntries(await Promise.all(pages.map(async (p) => [p.name, (await st(p.page)).seat])));

  // 4. Voice, briefly: server reached LiveKit (sessions arrive) and this browser reached LiveKit (a page connects).
  if (VOICE) {
    let sessions = false;
    for (let i = 0; i < 40 && !sessions; i++, await sleep(500)) sessions = (await Promise.all(pages.map((p) => st(p.page)))).every((s) => s.sessions > 0);
    log({ check: 'voice sessions issued (server -> LiveKit API)', ok: sessions, hint: sessions ? undefined : 'no sessions: LIVEKIT_* missing, server cannot reach LiveKit (Limited Trial?), or voice errors in the service logs. STOP and report.' });
    if (sessions) {
      // Connected time is bounded: at most capMs per page so pages x time stays under VOICE_CAP_MIN (LiveKit bills
      // >= 10 s per session). leaveVoice runs in finally, and browser.close() would disconnect anyway.
      const capMs = Math.min(60_000, (VOICE_CAP_MIN * 60_000) / pages.length);
      const joinAt = Date.now();
      let states = [];
      let connectedMs = null;
      try {
        for (const p of pages) await p.page.evaluate(() => void globalThis.__moonveil.joinVoice());
        while (Date.now() - joinAt < capMs) {
          states = await Promise.all(pages.map((p) => p.page.evaluate(() => globalThis.__moonveil.voice?.getSnapshot().channels.public?.state ?? 'none')));
          if (states.every((s) => s === 'connected')) {
            connectedMs = Date.now() - joinAt;
            break;
          }
          await sleep(500);
        }
        await sleep(3_000); // brief hold: connections stable
        states = await Promise.all(pages.map((p) => p.page.evaluate(() => globalThis.__moonveil.voice?.getSnapshot().channels.public?.state ?? 'none')));
      } finally {
        for (const p of pages) await p.page.evaluate(() => globalThis.__moonveil.leaveVoice()).catch(() => {});
      }
      const heldMs = Date.now() - joinAt;
      log({ check: 'voice connected (browser -> LiveKit Cloud)', states, connectAfterMs: connectedMs, ok: states.every((s) => s === 'connected') });
      // Upper bound: every page billed for the whole join..leave span, min 10 s each.
      log({ check: 'voice participant-minutes used (upper bound)', pages: pages.length, heldSec: Math.round(heldMs / 1000), participantMinutes: +((pages.length * Math.max(heldMs, 10_000)) / 60_000).toFixed(2), capMinutes: VOICE_CAP_MIN, ok: (pages.length * heldMs) / 60_000 <= VOICE_CAP_MIN });
    }
  }

  // 5. Idle WebSocket: nobody touches anything; no page may reconnect.
  const idleEnd = Date.now() + IDLE_MIN * 60_000;
  log({ check: 'idle start', minutes: IDLE_MIN, ok: true });
  while (Date.now() < idleEnd) await sleep(30_000);
  const logs = await Promise.all(pages.map((p) => p.page.evaluate(() => globalThis.__mvLog)));
  const reconnects = logs.map((l, i) => ({ page: pages[i].name, transitions: l.filter((x) => x.status !== 'open').length }));
  const now = await Promise.all(pages.map((p) => st(p.page)));
  log({ check: `ws idle ${IDLE_MIN} min, no reconnect`, reconnects, statuses: now.map((s) => s.status), ok: reconnects.every((r) => r.transitions === 0) && now.every((s) => s.status === 'open') });

  // 6. Account-holder actions (1: Restart, 2: Redeploy). Each: every page drops, reconnects, same room and seat.
  for (let n = 1; n <= ACTIONS; n++) {
    const what = n === 1 ? 'RESTART' : 'REDEPLOY';
    for (const p of pages) await p.page.evaluate(() => (globalThis.__mvLog = []));
    log({ check: `waiting for action ${n}/${ACTIONS}`, ask: `account holder: ${what} the service now`, ok: true });
    const deadline = Date.now() + ACTION_TIMEOUT_MS;
    let dropped = false;
    while (Date.now() < deadline) {
      const l = await Promise.all(pages.map((p) => p.page.evaluate(() => globalThis.__mvLog)));
      dropped = l.every((x) => x.some((e) => e.status === 'reconnecting'));
      const back = (await Promise.all(pages.map((p) => st(p.page)))).every((s) => s.status === 'open');
      if (dropped && back) break;
      await sleep(2_000);
    }
    const after = await Promise.all(pages.map((p) => st(p.page)));
    const l = await Promise.all(pages.map((p) => p.page.evaluate(() => globalThis.__mvLog)));
    const gap = l.map((x) => {
      const a = x.find((e) => e.status === 'reconnecting');
      const b = [...x].reverse().find((e) => e.status === 'open');
      return a && b ? b.t - a.t : null;
    });
    log({
      check: `${what.toLowerCase()} restores the room`,
      dropped,
      statuses: after.map((s) => s.status),
      sameRoom: after.every((s) => s.code === code),
      sameSeats: pages.every((p, i) => after[i].seat === seats[p.name]),
      players: after[0].players,
      closeCodes: l.map((x) => x.find((e) => e.status === 'reconnecting')?.close ?? null),
      reconnectGapMs: gap,
      ok: dropped && after.every((s) => s.status === 'open' && s.code === code) && pages.every((p, i) => after[i].seat === seats[p.name]) && after[0].players === 3,
    });
  }
  for (const p of pages) await p.page.getByTestId('leave').click({ timeout: 5_000 }).catch(() => {});
} catch (e) {
  log({ check: 'exception', error: String(e).slice(0, 500), ok: false });
} finally {
  await browser.close();
  log({ check: 'summary', failed, out: OUT, ok: failed === 0 });
  process.exitCode = failed ? 1 : 0;
}
