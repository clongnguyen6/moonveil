// Scripted clients for the REAL rules engine (protocol level, in-process, manual clock).
// Bots read only their own snapshot (me.actions) and send `act` like a browser would.
import type { GameView, SeatView } from '@moonveil/protocol';
import { createRulesEngine } from '@moonveil/rules';
import type { RulesEngine } from '../src/rules/engine.ts';
import { assertOpenBallotsViews, assertSeatIsolationViews } from './assertions.ts';
import { planActions, rng, toAction } from './bot-policy.ts';
import { type FakeClient, setup } from './harness.ts';

export const gv = (c: FakeClient) => c.view.game as GameView;
export const views = (c: FakeClient): SeatView[] => c.states().map((f) => (f.t === 'state' ? f.view : (null as never)));
export const stepKind = (c: FakeClient) => gv(c).step.kind;
export const idx = (c: FakeClient) => gv(c).me!.seat;
export const role = (c: FakeClient) => gv(c).me!.role;

export { rng } from './bot-policy.ts';

// Shared bot policy (bot-policy.ts); executes the plan over the protocol.
export function botAct(c: FakeClient, r: () => number): number {
  if (c.view.status !== 'playing') return 0;
  const plans = planActions(gv(c), r);
  for (const p of plans) c.send({ t: 'act', action: toAction(p) });
  return plans.length;
}

// roleSeed: the server's match seed (browser e2e: `e2e:<S>`); seed: the bots' rng (browser e2e: `<S>`).
export function realMatch(opts: { mode: 'automatic' | 'moderator'; seats: number; seed: string; roleSeed?: string; lean?: boolean }) {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed: opts.roleSeed ?? opts.seed, lean: opts.lean ?? false });
  const room = h.room(opts.mode, opts.seats);
  const driver = room.moderator ?? room.creator;
  driver.send({ t: 'start' });
  const r = rng(opts.seed);
  // Run: each step, every bot acts once, then the step closes (timer, or moderator step.close).
  function run(maxSteps = 400, beforeClose?: () => void, maxDays = Infinity) {
    for (let i = 0; i < maxSteps && driver.view.status === 'playing'; i++) {
      if (((driver.view.game as GameView).day ?? 0) > maxDays) return;
      for (const p of room.players) botAct(p, r);
      beforeClose?.();
      if (opts.mode === 'moderator') {
        room.moderator!.send({ t: 'act', action: { type: 'step.close' } });
      } else {
        const ends = driver.view.phaseEndsAt;
        if (ends === null) throw new Error('automatic step without deadline');
        h.clock.tick(Math.max(0, ends - h.clock.now()));
      }
    }
  }
  return { h, ...room, driver, run, r };
}

// ---- shared isolation assertions (pure versions in ./assertions.ts, also used by the browser harness) ----

export function assertSeatIsolation(p: FakeClient) {
  assertSeatIsolationViews(views(p));
}

// Approved: day votes are open; checks the latest snapshot of every client at one moment.
export function assertOpenBallots(clients: FakeClient[]): boolean {
  return assertOpenBallotsViews(clients.map((c) => c.view));
}

// ---- scripted scenarios (real engine, fixed seed) ----

export function scripted(mode: 'automatic' | 'moderator', seats: number, seed: string) {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed });
  const room = h.room(mode, seats);
  const P = room.players;
  let driver = room.moderator ?? room.creator;
  const toNext = () => {
    if (driver.view.status !== 'playing') throw new Error(`toNext: status ${driver.view.status}`);
    if (mode === 'moderator') room.moderator!.send({ t: 'act', action: { type: 'step.close' } });
    else h.clock.tick(Math.max(0, driver.view.phaseEndsAt! - h.clock.now()));
  };
  // Bounded: a synchronous loop can't be stopped by test timeouts.
  const advanceUntil = (pred: () => boolean, max = 20) => {
    for (let i = 0; i < max; i++) {
      if (pred()) return;
      toNext();
    }
    throw new Error(`advanceUntil: gave up at ${stepKind(driver)} (${driver.view.status})`);
  };
  // Reconnect on a new connection; the new client replaces the old one in P and as driver.
  const resume = (old: FakeClient) => {
    if (old.closedWith === null) old.drop();
    const c = h.client();
    c.send({ t: 'resume', code: room.code, token: old.token! });
    const i = P.indexOf(old);
    if (i >= 0) P[i] = c;
    if (driver === old) driver = c;
    return c;
  };
  // Choose a connected client to read shared state from (the driver may have dropped).
  const watcher = () => [room.moderator, ...P].find((c) => c && c.closedWith === null)!;
  const setDriver = (c: FakeClient) => {
    driver = c;
  };
  const by = (r: string) => P.filter((p) => role(p) === r);
  return { h, ...room, P, get driver() { return driver; }, setDriver, toNext, advanceUntil, resume, watcher, by };
}

// What a strict browser acceptance match with acceptance seed S ends in (same roles, same bot choices, same loop).
export function simulateAcceptance(mode: 'automatic' | 'moderator', seats: number, S: string) {
  const m = realMatch({ mode, seats, seed: S, roleSeed: `e2e:${S}`, lean: true });
  m.run(400, undefined, seats + 3);
  const g = m.players[0]!.view.game as GameView;
  return { outcome: g.outcome, day: g.day, night: g.night };
}
