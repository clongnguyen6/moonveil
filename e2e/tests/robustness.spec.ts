// Frozen tab, server restart with recovery. (Silent network: network.spec.ts.) Each test logs `ROBUST {json}` with what was observed.
// Chromium only (CDP lifecycle freeze). Moderator mode = no phase timers, so the clock is ours.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Player, test } from '../harness/index.ts';
import { fixtureGame as g } from './fixture-helpers.ts';

const WATCHDOG_WAIT_MS = 30_000; // > client watchdog (25 s) and > server ping timeout (<= 20 s)
const log = (o: object) => console.log('ROBUST ' + JSON.stringify(o));
const connectedFor = (viewer: Player, seat: string) => viewer.view().players.find((p) => p.seat === seat)?.connected;

async function moderated(table: import('../harness/index.ts').Table, baseURL?: string) {
  const opts = baseURL ? { baseURL } : {};
  const mod = await table.player('Mod', opts);
  const ps: Player[] = [];
  for (const n of ['Ann', 'Bao', 'Chi']) ps.push(await table.player(n, opts));
  await table.seat('moderator', mod, ps);
  await mod.page.getByTestId('start').click();
  for (const p of ps) await expect(p.page.getByTestId('phase')).toHaveText('hidden');
  return { mod, ps };
}

// Headless Chromium ignores Page.setWebLifecycleState (page stays visible, timers run; probed 2026-10-16).
// Debugger.pause stops all page JS (timers, socket handlers) while the network stack keeps running:
// the closest available model of a frozen background tab. Not a model of iOS suspending the whole app.
test('frozen tab (JS paused) catches up on resume with same seat', async ({ table }) => {
  test.setTimeout(90_000);
  const { mod, ps } = await moderated(table);
  const ann = ps[0]!;
  const seat = ann.seat;
  await ann.page.evaluate(() => {
    (window as unknown as { __ticks: number }).__ticks = 0;
    setInterval(() => (window as unknown as { __ticks: number }).__ticks++, 100);
  });
  const cdp = await ann.context.newCDPSession(ann.page);
  await cdp.send('Debugger.enable');
  const paused = new Promise((r) => cdp.once('Debugger.paused', r));
  await cdp.send('Debugger.pause');
  await paused;
  const framesAtFreeze = ann.frames.length;
  const tFreeze = Date.now();

  await mod.page.getByTestId('advance').click(); // hidden -> open while Ann is frozen
  await mod.page.waitForTimeout(WATCHDOG_WAIT_MS);
  const modSawConnected = connectedFor(mod, seat);
  const framesWhileFrozen = ann.frames.length - framesAtFreeze; // network level, delivered to the page later

  const welcomesBefore = ann.frames.filter((f) => f.msg.t === 'welcome').length;
  const t0 = Date.now();
  await cdp.send('Debugger.resume');
  await expect(ann.page.getByTestId('phase')).toHaveText('open');
  const catchUpMs = Date.now() - t0;
  const ticks = await ann.page.evaluate(() => (window as unknown as { __ticks: number }).__ticks);
  await ann.waitConnected();
  const reconnected = ann.frames.filter((f) => f.msg.t === 'welcome').length > welcomesBefore;
  expect(ann.view().me.seat).toBe(seat);
  // Proof the page was really frozen: ~10 ticks/s would give >= 300 if it had kept running.
  const frozenMs = t0 - tFreeze;
  expect(ticks).toBeLessThan(frozenMs / 100 / 2);
  log({ case: 'frozen', frozenMs, ticksDuringRun: ticks, modSawConnected, framesWhileFrozen, catchUpMs, reconnected });
});

const root = fileURLToPath(new URL('../..', import.meta.url));
// Own server for restart tests: E2E_PORT + 1 (set E2E_PORT to your scope's port range when sharing the machine).
const RESTART_PORT = Number(process.env.E2E_PORT ?? 4150) + 1;
function startServer(dataDir: string): ChildProcess {
  return spawn(process.execPath, ['apps/server/src/main.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(RESTART_PORT), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'fixture', MOONVEIL_DATA_DIR: dataDir },
    stdio: 'ignore',
  });
}
async function healthy() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${RESTART_PORT}/healthz`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

// Restart recovery: rooms are saved to MOONVEIL_DATA_DIR and restored on boot; clients resume by token.
for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
  test(`server restart mid-match (${signal}): match continues, same seats and secrets`, async ({ table }) => {
    test.setTimeout(90_000);
    const dataDir = mkdtempSync(join(tmpdir(), 'mv-restart-'));
    let srv = startServer(dataDir);
    try {
      await healthy();
      const { mod, ps } = await moderated(table, `http://127.0.0.1:${RESTART_PORT}`);
      const everyone = [mod, ...ps];
      const before = everyone.map((p) => ({ seat: p.seat, game: JSON.stringify(p.view().game) }));
      srv.kill(signal);
      await new Promise((r) => srv.once('exit', r));
      for (const p of everyone) await expect(p.page.getByTestId('conn')).toContainText('Reconnecting');

      srv = startServer(dataDir);
      const t0 = Date.now();
      await healthy();
      for (const p of everyone) await p.waitConnected();
      const reconnectMs = Date.now() - t0;
      everyone.forEach((p, i) => {
        expect(p.seat).toBe(before[i]!.seat);
        expect(JSON.stringify(p.view().game)).toBe(before[i]!.game);
      });
      await expect(ps[0]!.page.getByTestId('error')).toHaveCount(0);
      await mod.page.getByTestId('advance').click();
      for (const p of ps) await expect(p.page.getByTestId('phase')).toHaveText('open');
      log({ case: `restart-${signal}`, reconnectMs });
    } finally {
      srv.kill('SIGKILL');
    }
  });
}
