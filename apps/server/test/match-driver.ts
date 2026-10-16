// Scripted clients for the REAL rules engine (protocol level, in-process, manual clock).
// Bots read only their own snapshot (me.actions) and send `act` like a browser would.
import assert from 'node:assert/strict';
import type { GameView, SeatView } from '@moonveil/protocol';
import { createRulesEngine } from '@moonveil/rules';
import type { RulesEngine } from '../src/rules/engine.ts';
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
  function run(maxSteps = 400) {
    for (let i = 0; i < maxSteps && driver.view.status === 'playing'; i++) {
      for (const p of room.players) botAct(p, r);
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

// ---- shared isolation assertions ----

const games = (c: FakeClient) => views(c).map((v) => v.game as GameView | null).filter((g): g is GameView => g !== null);

export function assertSeatIsolation(p: FakeClient) {
  const all = games(p);
  const me = all[0]!.me!;
  for (const g of all) {
    assert.equal(g.me!.seat, me.seat, 'identity stable');
    assert.equal(g.me!.role, me.role, 'role stable');
    if (g.step.kind === 'ended') continue;
    assert.equal(g.moderator, null, `seat ${me.seat} got moderator data`);
    if (me.role !== 'wolf') assert.equal(g.pack, null, `seat ${me.seat} got pack view`);
    const revealed = new Set(g.publicLog.flatMap((e) => (e.t === 'roleRevealed' ? [e.seat] : [])));
    const wolves = new Set(g.pack?.seats ?? []);
    for (const s of g.seats) {
      if (s.role === null || s.seat === me.seat || revealed.has(s.seat)) continue;
      assert.ok(me.role === 'wolf' && wolves.has(s.seat) && s.role === 'wolf', `seat ${me.seat} learned role of ${s.seat}`);
    }
  }
}

// Approved: interim tallies and others' ballots never reach players (events, snapshots, reconnect).
export function assertBallotSecrecy(p: FakeClient) {
  for (const g of games(p)) {
    const st = g.step as { kind: string; votes?: unknown };
    if ((st.kind === 'day.vote' || st.kind === 'day.confirm') && g.step.kind !== 'ended') {
      assert.equal(st.votes ?? null, null, `seat ${g.me!.seat} saw ballots during ${st.kind}`);
    }
    for (const e of g.publicLog) {
      if (e.t === 'nomination' || e.t === 'confirm') assert.equal(e.votes, null, `seat ${g.me!.seat} saw ballots in ${e.t}`);
    }
  }
}

