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
    rejects(s, SYS, { type: 'day.confirmCount', yes: 4 }, 'forbidden');
    rejects(s, S(0), { type: 'day.confirmCount', yes: 4 }, 'forbidden');
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

  it('abort ends with winner aborted', () => {
    const s = ok(match(), MOD, { type: 'match.end', confirm: 'end-match' });
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

describe('APPROVED Q16 (2026-10-16): moderator enters the Yes count; engine applies Yes*2 > living', () => {
  /** Yes/No round on day 1 with seat 0 accused, after `plan` at night. */
  const atConfirm = (plan: Parameters<typeof night>[1] = { bite: 'pass' }) => {
    let s = night(match(), plan);
    if (s.step.kind === 'hunter') s = close(s);
    s = close(s);
    for (const v of [1, 2, 3].filter((x) => s.seats[x]?.alive)) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(close(s));
    assert.equal(s.step.kind, 'day.confirm');
    return s;
  };
  const count = (s: ReturnType<typeof match>, yes: number) => ok(s, MOD, { type: 'day.confirmCount', yes });

  it('odd living (7): 3 Yes (less than half) spares, 4 Yes executes', () => {
    assert.equal(count(atConfirm(), 3).seats[0]?.alive, true);
    const s = count(atConfirm(), 4);
    assert.equal(s.seats[0]?.alive, false);
    assert.deepEqual(lastLog(s, 'confirm'), { t: 'confirm', day: 1, accused: 0, counted: 'moderator', yes: 4, no: null, votes: null, executed: true });
  });

  it('even living (6): 3 Yes (exactly half) spares, 4 Yes executes', () => {
    const base = atConfirm({ bite: 6 });
    assert.equal(alive(base).length, 6);
    assert.equal(count(base, 3).seats[0]?.alive, true);
    assert.equal(count(base, 4).seats[0]?.alive, false);
  });

  it('rejects negative, non-integer and over-limit counts, even with mayBreakRules', () => {
    const s = atConfirm();
    rejects(s, MOD, { type: 'day.confirmCount', yes: -1 }, 'bad_value');
    rejects(s, MOD, { type: 'day.confirmCount', yes: 2.5 }, 'bad_value');
    rejects(s, MOD, { type: 'day.confirmCount', yes: 8 }, 'bad_value');
    ok(s, MOD, { type: 'day.confirmCount', yes: 7 });
    ok(s, MOD, { type: 'day.confirmCount', yes: 0 });
    const lax = close(close(day0(match(undefined, { moderator: { mayBreakRules: true } }))));
    rejects(lax, MOD, { type: 'day.confirmCount', yes: 8 }, 'bad_value');
  });

  it('only in the Yes/No round; the moderator has no direct day-result path', () => {
    rejects(match(), MOD, { type: 'day.confirmCount', yes: 4 }, 'wrong_step');
    rejects(night(match(), { bite: 'pass' }), MOD, { type: 'day.confirmCount', yes: 4 }, 'wrong_step');
    const defense = close(day0(match()));
    assert.equal(defense.step.kind, 'day.defense');
    rejects(defense, MOD, { type: 'day.confirmCount', yes: 4 }, 'wrong_step');
    // The removed direct-result command is unknown to the engine at runtime.
    rejects(defense, MOD, { type: 'day.setOutcome', execute: 0 } as unknown as Parameters<typeof ok>[2], 'bad_value');
  });

  it('living count changed earlier that day (Hunter shot at dawn): validated against the current 5 living', () => {
    // Night: bite hunter 5; hunter shoots villager 6 -> 5 living at day.
    let s = night(match(), { bite: 5 });
    s = close(ok(s, S(5), { type: 'hunter.shoot', seat: 5, target: 6 }));
    s = close(s);
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(close(s));
    assert.equal(alive(s).length, 5);
    rejects(s, MOD, { type: 'day.confirmCount', yes: 6 }, 'bad_value');
    assert.equal(count(s, 2).seats[0]?.alive, true);
    assert.equal(count(s, 3).seats[0]?.alive, false);
  });

  it('living count changed during the Yes/No round (removal): validated at apply time', () => {
    const s = ok(atConfirm(), MOD, { type: 'player.remove', seat: 6 });
    assert.equal(alive(s).length, 6);
    rejects(s, MOD, { type: 'day.confirmCount', yes: 7 }, 'bad_value');
    assert.equal(count(s, 3).seats[0]?.alive, true);
    assert.equal(count(s, 4).seats[0]?.alive, false);
  });
});

/** Day 1 at day.vote with seats 1,2,3 voting for seat 0 (not yet closed). */
function day0(s: ReturnType<typeof match>) {
  let t = close(night(s, { bite: 'pass' }));
  for (const v of [1, 2, 3]) t = ok(t, S(v), { type: 'vote.nominate', seat: v, target: 0 });
  return t;
}
