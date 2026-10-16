// APPROVED Q06 Hunter (Human, 2026-10-16): fixed engine behaviour, one test per approved point.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { channelsFor, isPendingHunter, project, type MatchState, type Role } from '../src/index.ts';
import { alive, close, lastLog, match, MOD, night, ok, S } from './helpers.ts';

/** Day 1 (nobody died at night): seats in `nominators` put `accused` on trial; everyone listed in `yes` votes Yes. */
function executeOnDay1(s: MatchState, accused: number, yes: number[]): MatchState {
  let t = close(night(s, { bite: 'pass' }));
  for (const v of yes.filter((x) => x !== accused)) t = ok(t, S(v), { type: 'vote.nominate', seat: v, target: accused });
  t = close(close(t));
  for (const v of yes) t = ok(t, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
  return close(t);
}
const shoot = (s: MatchState, h: number, target: number | 'pass') => close(ok(s, S(h), { type: 'hunter.shoot', seat: h, target }));

describe('APPROVED Q06 trigger: any gameplay death gives a shot', () => {
  it('night attack', () => assert.deepEqual(night(match(), { bite: 5 }).step.kind, 'hunter'));
  it('poison', () => assert.deepEqual(night(match(), { bite: 'pass', poison: 5 }).step.kind, 'hunter'));
  it('daytime execution', () => assert.equal(executeOnDay1(match(), 5, [0, 1, 2, 3]).step.kind, 'hunter'));
  it("another Hunter's shot (chain)", () => {
    let s = night(match(['wolf', 'wolf', 'hunter', 'hunter', 'villager', 'villager', 'villager'] as Role[], { limits: { maxPerSpecialRole: 2 } }), { bite: 2 });
    s = shoot(s, 2, 3);
    assert.deepEqual(s.step.kind === 'hunter' && s.step.pending, [3]);
  });
});

describe('APPROVED Q06 timeout and resolution order', () => {
  it('timeout: no shot', () => {
    const s = close(night(match(), { bite: 5 }));
    assert.deepEqual(lastLog(s, 'shot'), { t: 'shot', by: 5, target: null });
    assert.equal(alive(s).length, 6);
  });

  it('execution, then a shot that reaches parity: Wolves win only after the shot', () => {
    // 2 wolves vs hunter + 3 villagers. Executing the hunter leaves 2 v 3 (no win); the shot on a villager makes 2 v 2.
    let s = executeOnDay1(match(['wolf', 'wolf', 'hunter', 'villager', 'villager', 'villager'] as Role[]), 2, [0, 1, 3, 4]);
    assert.equal(s.step.kind, 'hunter');
    assert.equal(s.outcome, null);
    s = shoot(s, 2, 3);
    assert.deepEqual(s.outcome, { winner: 'wolves', reason: 'parity' });
  });

  it('execution, then Hunter shoots Hunter, then the last wolf: zero survivors resolved after the whole chain', () => {
    let s = executeOnDay1(match(['wolf', 'hunter', 'hunter'] as Role[], { limits: { maxPerSpecialRole: 2 } }), 1, [0, 1, 2]);
    assert.equal(s.step.kind, 'hunter');
    s = shoot(s, 1, 2);
    assert.equal(s.outcome, null, 'no victory check mid-chain');
    s = shoot(s, 2, 0);
    assert.deepEqual(s.outcome, { winner: 'draw', reason: 'zeroSurvivors' });
  });
});

describe('APPROVED Q06 removal is not a gameplay death', () => {
  it('removal by day: no shot', () => {
    const s = ok(night(match(), { bite: 'pass' }), MOD, { type: 'player.remove', seat: 5 });
    assert.equal(s.step.kind, 'day.discussion');
  });
  it('removal mid-night (main step and Witch step): no shot, not announced at dawn', () => {
    let a = ok(match(), MOD, { type: 'player.remove', seat: 5 });
    a = night(a, { bite: 6 });
    assert.equal(a.step.kind, 'day.discussion');
    assert.deepEqual((lastLog(a, 'dawn') as { dead: number[] }).dead, [6]);
    let b = close(ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 5 }));
    b = close(ok(b, MOD, { type: 'player.remove', seat: 5 }));
    assert.equal(b.step.kind, 'day.discussion');
    assert.ok(!b.publicLog.some((e) => e.t === 'hunterTurn'));
  });
  it('removal during a running Hunter turn adds no shot', () => {
    let s = night(match(['wolf', 'wolf', 'hunter', 'hunter', 'villager', 'villager', 'villager'] as Role[], { limits: { maxPerSpecialRole: 2 } }), { bite: 2 });
    s = ok(s, MOD, { type: 'player.remove', seat: 3 });
    assert.deepEqual(s.step.kind === 'hunter' && s.step.pending, [2]);
    s = close(s);
    assert.ok(!s.publicLog.some((e) => e.t === 'hunterTurn' && e.seats.includes(3)));
  });
});

describe('APPROVED Q06 pending window: no ghost voice/text, no ghost-only knowledge, then granted', () => {
  it('denied while pending, granted after the shot resolves', () => {
    const s = night(match(), { bite: 5 });
    assert.equal(isPendingHunter(s, 5), true);
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 5 }), [{ channel: 'public', listen: true, speak: false }]);
    const after = shoot(s, 5, 'pass');
    assert.equal(isPendingHunter(after, 5), false);
    assert.deepEqual(channelsFor(after, { kind: 'seat', seat: 5 }), [
      { channel: 'public', listen: true, speak: false },
      { channel: 'ghosts', listen: true, speak: true },
    ]);
  });

  it('other ghosts keep the ghost channel during the window; in a chain, only the still-pending Hunter is denied', () => {
    let s = night(match(['wolf', 'wolf', 'hunter', 'hunter', 'villager', 'villager', 'villager'] as Role[], { limits: { maxPerSpecialRole: 2 } }), { bite: 2 });
    s = shoot(s, 2, 3);
    assert.ok(channelsFor(s, { kind: 'seat', seat: 2 }).some((g) => g.channel === 'ghosts'));
    assert.ok(!channelsFor(s, { kind: 'seat', seat: 3 }).some((g) => g.channel === 'ghosts'));
  });

  it('projection while pending carries no ghost-only data: facts frozen at death, only the shot action', () => {
    const before = project(match(), { kind: 'seat', seat: 5 }).me?.facts;
    const s = night(match(), { bite: 5 });
    const p = project(s, { kind: 'seat', seat: 5 });
    assert.deepEqual(p.me?.facts, before);
    assert.deepEqual(p.me?.actions.map((a) => a.type), ['hunter.shoot']);
    assert.equal(p.pack, null);
    assert.equal(p.moderator, null);
  });
});

