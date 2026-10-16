// Approved rules the server must enforce via engine projections/timing (Human, 2026-10-16). REAL engine.
// `todo` = needs the rules owner's next batch in dev; runs and reports, doesn't fail the suite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRulesEngine } from '@moonveil/rules';
import type { RulesEngine } from '../src/rules/engine.ts';
import { type FakeClient, setup } from './harness.ts';
import { assertBallotSecrecy, gv, idx, stepKind } from './match-driver.ts';

function auto(seats: number, seed: string) {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed });
  const room = h.room('automatic', seats);
  room.creator.send({ t: 'start' });
  const d = room.creator;
  const toNext = () => h.clock.tick(Math.max(0, d.view.phaseEndsAt! - h.clock.now()));
  const until = (pred: () => boolean, max = 20) => {
    for (let i = 0; i < max && !pred(); i++) toNext();
    assert.ok(pred(), `until: stuck at ${stepKind(d)}`);
  };
  return { h, ...room, d, toNext, until };
}

for (const seats of [7, 8, 9, 10]) {
  test(`night is a fixed 60 s and never ends early (${seats} seats, all inputs submitted)`, () => {
    const m = auto(seats, `night-${seats}`);
    const start = m.h.clock.now();
    assert.equal(stepKind(m.d), 'night.main');
    // Everyone submits everything they can: the night still runs to its deadlines.
    for (const p of m.players) {
      for (const a of gv(p).me!.actions) {
        if (a.type === 'wolf.pick' || a.type === 'guard.protect' || a.type === 'seer.inspect') {
          p.send({ t: 'act', action: { type: a.type, target: a.targets[0] } });
        }
      }
    }
    m.h.clock.tick(m.d.view.phaseEndsAt! - m.h.clock.now() - 1);
    assert.equal(stepKind(m.d), 'night.main', 'night.main closed early');
    m.h.clock.tick(1);
    if (stepKind(m.d) === 'night.witch') {
      for (const p of m.players) if (gv(p).me!.actions.some((a) => a.type === 'witch.heal')) p.send({ t: 'act', action: { type: 'witch.heal', use: false } });
      m.h.clock.tick(m.d.view.phaseEndsAt! - m.h.clock.now() - 1);
      assert.equal(stepKind(m.d), 'night.witch', 'night.witch closed early');
      m.h.clock.tick(1);
    }
    assert.ok(!stepKind(m.d).startsWith('night.'), `still night: ${stepKind(m.d)}`);
    assert.equal(m.h.clock.now() - start, 60_000, 'night length');
  });
}

test('votes run to their deadline even when everyone has voted; voter sees own choice', () => {
  const m = auto(8, 'votes');
  m.until(() => stepKind(m.d) === 'day.vote');
  const living = m.players.filter((p) => gv(p).me!.alive);
  const target = gv(living[0]!).seats.find((s) => s.alive && s.seat !== idx(living[0]!) && s.seat !== idx(living[1]!))!.seat;
  for (const p of living) p.send({ t: 'act', action: { type: 'vote.nominate', target } });
  const own = gv(living[1]!).me!.actions.find((a) => a.type === 'vote.nominate') as { current: unknown } | undefined;
  assert.equal(own?.current, target, 'voter sees own choice');
  m.h.clock.tick(m.d.view.phaseEndsAt! - m.h.clock.now() - 1);
  assert.equal(stepKind(m.d), 'day.vote', 'vote closed early');
});

test('ballots and interim tallies never reach players before close, incl. after reconnect', () => {
  const m = auto(8, 'ballots-reconnect');
  m.until(() => stepKind(m.d) === 'day.vote');
  const living = m.players.filter((p) => gv(p).me!.alive);
  for (const p of living.slice(1)) p.send({ t: 'act', action: { type: 'vote.nominate', target: 'skip' } });
  const p0 = living[0]!;
  p0.drop();
  const back: FakeClient = m.h.client();
  back.send({ t: 'resume', code: m.code, token: p0.token! });
  for (const p of [...living.slice(1), back]) assert.ok(assertBallotSecrecy(p) > 0, 'vote step observed');
});

test('moderator enters the Yes count (day.confirmCount); no direct day-result route', () => {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed: 'confirm-count' });
  const room = h.room('moderator', 8);
  const mod = room.moderator!;
  mod.send({ t: 'start' });
  const close = () => mod.send({ t: 'act', action: { type: 'step.close' } });
  for (let i = 0; i < 20 && stepKind(mod) !== 'day.vote'; i++) close();
  const target = gv(mod).seats.find((s) => s.alive)!.seat;
  for (const p of room.players) if (gv(p).me!.alive) p.send({ t: 'act', action: { type: 'vote.nominate', target } });
  close();
  close(); // defense -> confirm
  assert.equal(stepKind(mod), 'day.confirm');
  mod.send({ t: 'act', ref: 'yc', action: { type: 'day.confirmCount', yes: 8 } });
  assert.deepEqual(mod.frames.at(-1), { t: 'ack', ref: 'yc' });
  mod.send({ t: 'act', ref: 'so', action: { type: 'day.setOutcome', execute: null } });
  const e = mod.frames.at(-1)!;
  assert.ok(e.t === 'error' && e.ref === 'so', 'day.setOutcome must be rejected');
});
