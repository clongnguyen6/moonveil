// APPROVED 2026-10-16: disconnected players (Q15/Q26 except removal) and automatic-mode pause/resume.
// The engine has no presence: "disconnected" = no commands from that seat; reconnect = rebuild from persisted JSON.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRulesEngine, project, type HostState, type MatchState } from '../src/index.ts';
import { alive, close, match, night, ok, S } from './helpers.ts';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const eng = createRulesEngine();
const host = (m: MatchState = match()): HostState => ({ seatIds: IDS, match: m, clock: null });
const persist = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('APPROVED disconnected players and their choices', () => {
  it('a choice submitted before disconnecting persists through reconnect and counts at the deadline', () => {
    let s = ok(match(), S(3), { type: 'guard.protect', seat: 3, target: 6 });
    s = ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    const restored = persist(s); // guard drops; server restores state; guard reconnects
    assert.deepEqual(project(restored, { kind: 'seat', seat: 3 }), project(s, { kind: 'seat', seat: 3 }));
    const after = close(close(restored));
    assert.equal(after.seats[6]?.alive, true, 'the persisted protection saved the victim');
  });

  it('a missing choice becomes a pass at the deadline (guard, seer, witch, voters)', () => {
    let s = ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    s = close(close(s)); // guard, seer and witch never act
    assert.equal(s.seats[6]?.alive, false, 'no protection, no heal');
    assert.equal(s.seats[3]?.guardLast, null);
    assert.equal(s.knowledge[2]?.some((f) => f.k === 'inspect'), false);
    assert.equal(s.seats[4]?.heal, true);
    s = close(s); // to day.vote; nobody votes
    s = close(s);
    assert.equal(s.step.kind, 'night.main', 'no ballots: no trial');
  });

  it('disconnected seats stay alive and count in the execution denominator', () => {
    let s = close(night(match(), { bite: 'pass' }));
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(close(s));
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' }); // 4,5,6 offline
    assert.equal(alive(s).length, 7);
    assert.equal(close(s).seats[0]?.alive, true, '3*2 = 6 is not > 7');
  });

  it('reconnect restores identity, role and state with no extra knowledge', () => {
    const h = eng.sync(host(night(match(), { bite: 6 })), 1_000);
    for (const id of IDS) assert.deepEqual(eng.view(persist(h), { kind: 'seat', seat: id }), eng.view(h, { kind: 'seat', seat: id }));
  });
});

describe('APPROVED automatic-mode pause/resume: exact remaining time, nothing expires while paused', () => {
  /** Host state positioned at each phase type. */
  const phases = (): [string, HostState, number][] => {
    const m = match();
    const witch = close(m);
    const disc = night(m, { bite: 'pass' });
    const vote = close(disc);
    let defense = vote;
    for (const v of [1, 2, 3]) defense = ok(defense, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    defense = close(defense);
    const confirm = close(defense);
    const hunter = night(m, { bite: 5 });
    return [
      ['night.main', host(m), 40_000],
      ['night.witch', host(witch), 20_000],
      ['day.discussion', host(disc), 165_000],
      ['day.vote', host(vote), 30_000],
      ['day.defense', host(defense), 30_000],
      ['day.confirm', host(confirm), 15_000],
      ['hunter', host(hunter), 20_000],
    ];
  };

  for (const [name, h0, duration] of phases()) {
    it(`${name}: pause keeps the exact remaining time; no expiry while paused; resumes with the same time left`, () => {
      const t0 = 1_000_000;
      let h = eng.sync(h0, t0);
      assert.equal(eng.timer(h, t0)?.durationMs, duration);
      h = eng.pause(h, t0 + 7_000);
      const before = eng.view(h, { kind: 'seat', seat: 'c' });
      assert.deepEqual(eng.timer(h, t0 + 7_000), { durationMs: duration, remainingMs: duration - 7_000, deadline: null, paused: true });
      const longLater = t0 + 7_000 + 3_600_000;
      const still = eng.tick(h, longLater);
      assert.equal(still.match.stepSeq, h.match.stepSeq, 'paused phase never expires');
      assert.equal(eng.timer(still, longLater)?.remainingMs, duration - 7_000);
      h = eng.resume(still, longLater);
      assert.deepEqual(eng.timer(h, longLater), { durationMs: duration, remainingMs: duration - 7_000, deadline: longLater + duration - 7_000, paused: false });
      assert.deepEqual(eng.view(h, { kind: 'seat', seat: 'c' }), before, 'view after resume = view before pause');
      assert.equal(eng.tick(h, longLater + duration - 7_001).match.stepSeq, h.match.stepSeq, 'not yet');
      assert.notEqual(eng.tick(h, longLater + duration - 7_000).match.stepSeq, h.match.stepSeq, 'closes exactly at the deadline');
    });
  }

  it('night stays 60 s of running time across a pause in the main step', () => {
    const t0 = 0;
    let h = eng.sync(host(), t0);
    h = eng.pause(h, 25_000); // 15 s left in main
    h = eng.resume(h, 900_000);
    h = eng.tick(h, 914_999);
    assert.equal(h.match.step.kind, 'night.main');
    h = eng.tick(h, 915_000);
    assert.equal(h.match.step.kind, 'night.witch');
    assert.deepEqual(eng.timer(h, 915_000), { durationMs: 20_000, remainingMs: 20_000, deadline: 935_000, paused: false });
    // Running time: 25 s + 15 s (main) + 20 s (witch) = 60 s.
    h = eng.tick(h, 935_000);
    assert.equal(h.match.step.kind, 'day.discussion');
  });

  it('a step that changes while paused starts its clock paused; pause/resume are idempotent', () => {
    let h = eng.pause(eng.sync(host(), 0), 10_000);
    h = eng.sync(eng.advance(h), 20_000); // e.g. a moderator closes the step meanwhile
    assert.equal(h.match.step.kind, 'night.witch');
    assert.equal(eng.timer(h, 20_000)?.paused, true);
    assert.deepEqual(eng.pause(h, 30_000), h);
    const r = eng.resume(h, 40_000);
    assert.deepEqual(eng.resume(r, 50_000), r);
    assert.equal(eng.timer(r, 40_000)?.remainingMs, 20_000);
  });

  it('a removal resumes the same step without restarting its clock', () => {
    let h = eng.sync(host(night(match(), { bite: 'pass' })), 0);
    const r = eng.remove(h, 'g');
    assert.ok(r.ok);
    h = eng.sync(r.state, 10_000);
    assert.equal(eng.timer(h, 10_000)?.remainingMs, 165_000 - 10_000);
  });
});
