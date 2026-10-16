// Regression tests for review findings on 9af74b8 (F2, F5, F7). Each fails on 9af74b8.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { channelsFor, project, type MatchState } from '../src/index.ts';
import { close, day, lastLog, match, MOD, night, ok, S } from './helpers.ts';

describe('F2: seats removed mid-night', () => {
  it('a Hunter removed during the Witch step is not announced at dawn and does not shoot', () => {
    let s = close(ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 5 }));
    assert.equal(s.step.kind, 'night.witch');
    s = ok(s, MOD, { type: 'player.remove', seat: 5 });
    assert.equal(s.nightRec?.victim, null, 'pending bite on a removed seat is void');
    s = close(s);
    assert.deepEqual(lastLog(s, 'dawn'), { t: 'dawn', night: 1, dead: [], causes: null });
    assert.equal(s.step.kind, 'day.discussion');
    assert.equal(s.seats[5]?.death?.cause, 'removed');
  });

  it('poison on a removed seat is void; history lists only newly dead', () => {
    let s = close(ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 6 }));
    s = ok(s, S(4), { type: 'witch.poison', seat: 4, target: 3 });
    s = ok(s, MOD, { type: 'player.remove', seat: 3 });
    s = close(s);
    assert.deepEqual((lastLog(s, 'dawn') as { dead: number[] }).dead, [6]);
    const h = s.history.findLast((x) => x.t === 'night');
    assert.deepEqual(h?.t === 'night' && h.deaths, [{ seat: 6, cause: 'bite' }]);
  });
});

describe('F5: witch heal fact under seesVictim=never', () => {
  const healNight = (victim: number): MatchState => {
    let s = match(undefined, { witch: { seesVictim: 'never' } });
    s = ok(s, S(0), { type: 'wolf.pick', seat: 0, target: victim });
    s = close(s);
    return close(ok(s, S(4), { type: 'witch.heal', seat: 4, use: true }));
  };
  it('two different victims, both healed: the witch cannot tell them apart', () => {
    const a = healNight(5);
    const b = healNight(6);
    assert.equal(a.seats.every((x) => x.alive), true);
    assert.equal(b.seats.every((x) => x.alive), true);
    assert.deepEqual(project(a, { kind: 'seat', seat: 4 }), project(b, { kind: 'seat', seat: 4 }));
    assert.deepEqual(a.knowledge[4]?.at(-1), { k: 'own', night: 1, act: 'heal', target: null });
  });
  it('when entitled (default policy), the heal fact names the target', () => {
    const s = close(ok(close(ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 6 })), S(4), { type: 'witch.heal', seat: 4, use: true }));
    assert.deepEqual(s.knowledge[4]?.at(-1), { k: 'own', night: 1, act: 'heal', target: 6 });
  });
});

describe('F7: entitlement under the selected policy; ghost ledger contents', () => {
  it('seesVictim=never: no victim facts ever; whileHealUnused: none after the heal night', () => {
    let s = match(undefined, { witch: { seesVictim: 'never' } });
    s = night(s, { bite: 6 });
    assert.equal(s.knowledge[4]?.some((f) => f.k === 'victim'), false);
    let t = night(match(), { bite: 6, heal: true });
    t = night(day(t, 'skip'), { bite: 3 });
    assert.deepEqual(t.knowledge[4]?.filter((f) => f.k === 'victim').map((f) => f.night), [1]);
  });

  it('ghost ledger is identical in content after more play (not just length)', () => {
    let s = ok(match(), S(2), { type: 'seer.inspect', seat: 2, target: 0 });
    s = night(s, { bite: 2 });
    const before = structuredClone(s.knowledge[2]);
    s = night(day(s, 'skip'), { bite: 6 });
    s = day(s, 1);
    assert.deepEqual(s.knowledge[2], before);
    assert.deepEqual(project(s, { kind: 'seat', seat: 2 }).me?.facts, before);
  });

  it('F1: a pending Hunter hears public only until the shot resolves, then joins ghosts', () => {
    let s = night(match(), { bite: 5 });
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 5 }), [{ channel: 'public', listen: true, speak: false }]);
    s = close(ok(s, S(5), { type: 'hunter.shoot', seat: 5, target: 'pass' }));
    assert.ok(channelsFor(s, { kind: 'seat', seat: 5 }).some((g) => g.channel === 'ghosts' && g.speak));
  });
});
