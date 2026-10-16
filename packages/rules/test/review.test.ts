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

// F5 (heal target leak under seesVictim='never') is moot since Q03 was approved (2026-10-16): the Witch always sees the
// victim while her heal is unused, so a heal fact always names a target she was entitled to see. See approved-q03.test.ts.

describe('F7: entitlement under the selected policy; ghost ledger contents', () => {
  it('victim facts stop after the heal night (approved Q03)', () => {
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
