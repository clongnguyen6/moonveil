// Scripted clients for the REAL rules engine (protocol level, in-process, manual clock).
// Bots read only their own snapshot (me.actions) and send `act` like a browser would.
import type { GameView, SeatView } from '@moonveil/protocol';
import { createRulesEngine } from '@moonveil/rules';
import type { RulesEngine } from '../src/rules/engine.ts';
import { assertOpenBallotsViews, assertSeatIsolationViews } from './assertions.ts';
import { type FakeClient, setup } from './harness.ts';

export const gv = (c: FakeClient) => c.view.game as GameView;
export const views = (c: FakeClient): SeatView[] => c.states().map((f) => (f.t === 'state' ? f.view : (null as never)));
export const stepKind = (c: FakeClient) => gv(c).step.kind;
export const idx = (c: FakeClient) => gv(c).me!.seat;
export const role = (c: FakeClient) => gv(c).me!.role;

export function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

// One random legal choice per available action. Returns actions sent.
export function botAct(c: FakeClient, r: () => number): number {
  const me = gv(c).me;
  if (!me || c.view.status !== 'playing') return 0;
  let n = 0;
  for (const a of me.actions) {
    let action: Record<string, unknown> | null = null;
    switch (a.type) {
      case 'wolf.pick':
      case 'guard.protect':
      case 'hunter.shoot':
        action = { type: a.type, target: a.targets.length && r() < 0.85 ? pick(r, a.targets) : 'pass' };
        break;
      case 'seer.inspect':
        if (a.targets.length) action = { type: a.type, target: pick(r, a.targets) };
        break;
      case 'witch.heal':
        if (a.canUse) action = { type: a.type, use: r() < 0.5 };
        break;
      case 'witch.poison':
        action = { type: a.type, target: a.targets.length && r() < 0.3 ? pick(r, a.targets) : 'pass' };
        break;
      case 'vote.nominate':
        action = { type: a.type, target: a.targets.length && r() < 0.8 ? pick(r, a.targets) : 'skip' };
        break;
      case 'vote.confirm':
        action = { type: a.type, choice: r() < 0.6 ? 'yes' : 'no' };
        break;
    }
    if (action) {
      c.send({ t: 'act', action });
      n++;
    }
  }
  return n;
}

export function realMatch(opts: { mode: 'automatic' | 'moderator'; seats: number; seed: string }) {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed: opts.seed });
  const room = h.room(opts.mode, opts.seats);
  const driver = room.moderator ?? room.creator;
  driver.send({ t: 'start' });
  const r = rng(opts.seed);
  // Run: each step, every bot acts once, then the step closes (timer, or moderator step.close).
  function run(maxSteps = 400, beforeClose?: () => void) {
    for (let i = 0; i < maxSteps && driver.view.status === 'playing'; i++) {
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
