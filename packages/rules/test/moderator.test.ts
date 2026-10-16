import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apply } from '../src/index.ts';
import { alive, close, day, lastLog, match, MOD, night, ok, rejects, S, SYS } from './helpers.ts';

describe('authorization', () => {
  it('seats act only for themselves and cannot drive steps', () => {
    const s = match();
    rejects(s, S(6), { type: 'wolf.pick', seat: 0, target: 6 }, 'forbidden');
    rejects(s, S(0), { type: 'step.close' }, 'forbidden');
    rejects(s, S(0), { type: 'wolf.decide', target: 6 }, 'forbidden');
    rejects(s, S(0), { type: 'player.remove', seat: 6 }, 'forbidden');
    rejects(s, SYS, { type: 'wolf.pick', seat: 0, target: 6 }, 'forbidden');
    rejects(s, SYS, { type: 'day.setOutcome', execute: 6 }, 'forbidden');
  });

  it('wrong role / wrong step / dead target are rejected', () => {
    const s = match();
    rejects(s, S(6), { type: 'seer.inspect', seat: 6, target: 0 }, 'bad_seat');
    rejects(s, S(4), { type: 'witch.heal', seat: 4, use: true }, 'wrong_step');
    rejects(s, S(0), { type: 'vote.nominate', seat: 0, target: 2 }, 'wrong_step');
    const d = night(s, { bite: 6 });
    rejects(close(d), S(0), { type: 'vote.nominate', seat: 0, target: 6 }, 'bad_target');
  });

  it('apply never mutates its input', () => {
    const s = match();
    const snap = JSON.stringify(s);
    apply(s, S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    apply(s, SYS, { type: 'step.close' });
    assert.equal(JSON.stringify(s), snap);
  });
});

describe('moderator powers (Q16)', () => {
  it('acts for a seat, logged in history with byModerator', () => {
    let s = ok(match(), MOD, { type: 'guard.protect', seat: 3, target: 6 });
    assert.deepEqual(s.nightRec?.byModerator, [3]);
    s = ok(s, MOD, { type: 'seer.inspect', seat: 2, target: 0 });
    assert.ok(s.knowledge[2]?.some((f) => f.k === 'inspect'), 'result still goes to the seer');
    assert.ok(s.history.some((h) => h.t === 'moderator'));
  });

  it('moderator actions obey the rules unless mayBreakRules', () => {
    rejects(match(), MOD, { type: 'seer.inspect', seat: 2, target: 2 }, 'rule');
    ok(match(undefined, { moderator: { mayBreakRules: true } }), MOD, { type: 'seer.inspect', seat: 2, target: 2 });
  });

  it('wolf.decide overrides pack picks', () => {
    let s = ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 6 });
    s = close(ok(s, MOD, { type: 'wolf.decide', target: 5 }));
    assert.equal(s.nightRec?.victim, 5);
  });

  it('day.setOutcome executes directly or skips to night', () => {
    const morning = night(match(), { bite: 'pass' });
    let s = ok(morning, MOD, { type: 'day.setOutcome', execute: 6 });
    assert.equal(s.seats[6]?.alive, false);
    assert.equal(s.step.kind, 'night.main');
    s = ok(morning, MOD, { type: 'day.setOutcome', execute: null });
    assert.equal(s.step.kind, 'night.main');
    rejects(match(), MOD, { type: 'day.setOutcome', execute: 6 }, 'wrong_step');
    rejects(night(match(undefined, { moderator: { canSetDayOutcome: false } }), { bite: 'pass' }), MOD, { type: 'day.setOutcome', execute: 6 }, 'forbidden');
  });

  it('abort ends with winner aborted', () => {
    const s = ok(match(), MOD, { type: 'match.abort' });
    assert.deepEqual(s.outcome, { winner: 'aborted', reason: 'aborted' });
  });
});

describe('removal (Q15)', () => {
  it('removal is a death, public, checks victory, resumes the step', () => {
    let s = ok(match(), MOD, { type: 'player.remove', seat: 6 });
    assert.deepEqual(lastLog(s, 'removed'), { t: 'removed', seat: 6 });
    assert.equal(s.step.kind, 'night.main');
    s = ok(s, MOD, { type: 'player.remove', seat: 0 });
    s = ok(s, MOD, { type: 'player.remove', seat: 1 });
    assert.deepEqual(s.outcome, { winner: 'village', reason: 'noWolves' });
  });

  it('system removal waits for the night to end; moderator may remove anytime (Q26)', () => {
    rejects(match(), SYS, { type: 'player.remove', seat: 6 }, 'wrong_step');
    rejects(close(match()), SYS, { type: 'player.remove', seat: 6 }, 'wrong_step');
    ok(night(match(), { bite: 'pass' }), SYS, { type: 'player.remove', seat: 6 });
  });

  it('removing the accused cancels the day', () => {
    let s = close(night(match(), { bite: 'pass' }));
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(s);
    assert.equal(s.step.kind, 'day.defense');
    s = ok(s, MOD, { type: 'player.remove', seat: 0 });
    assert.equal(s.step.kind, 'night.main');
  });

  it('removed hunter does not shoot by default', () => {
    const s = ok(match(), MOD, { type: 'player.remove', seat: 5 });
    assert.equal(s.step.kind, 'night.main');
    assert.deepEqual(alive(s), [0, 1, 2, 3, 4, 6]);
  });

  it('votes by and for a removed seat are cleared', () => {
    let s = close(night(match(), { bite: 'pass' }));
    s = ok(s, S(2), { type: 'vote.nominate', seat: 2, target: 6 });
    s = ok(s, S(6), { type: 'vote.nominate', seat: 6, target: 2 });
    s = ok(s, SYS, { type: 'player.remove', seat: 6 });
    assert.equal(s.step.kind === 'day.vote' && s.step.votes.filter((v) => v !== null).length, 0);
  });
});
