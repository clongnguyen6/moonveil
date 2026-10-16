// APPROVED (Human, 2026-10-16; supersedes day-ballot secrecy and voted-status-only): day votes are OPEN ballots shown
// live. Every view shows each voter's current choice (target or Skip; Yes or No). Counts are derivable and public.
// Unchanged: fixed deadlines (no early close), execution threshold, nomination rule, defense; night stays private.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { project, stepTiming, type MatchState, type Viewer } from '../src/index.ts';
import { alive, close, lastLog, match, night, ok, S } from './helpers.ts';

const seat = (n: number): Viewer => ({ kind: 'seat', seat: n });
const PUBLIC: Viewer = { kind: 'public' };
const reconnect = (s: MatchState, v: Viewer) => project(JSON.parse(JSON.stringify(s)) as MatchState, v);
/** Living voter (2), living non-voter (4), ghost (6), public, moderator. */
const VIEWERS: [string, Viewer][] = [['voter', seat(2)], ['non-voter', seat(4)], ['ghost', seat(6)], ['public', PUBLIC], ['moderator', { kind: 'moderator' }]];

/** Day 1 nomination (seat 6 died at night), with the given ballots. */
function nomination(ballots: Record<number, number | 'skip'>): MatchState {
  let s = close(night(match(), { bite: 6 }));
  for (const [v, t] of Object.entries(ballots)) s = ok(s, S(Number(v)), { type: 'vote.nominate', seat: Number(v), target: t });
  return s;
}
/** Day 1 Yes/No round on seat 0 (nominated by 1,2,3), with the given choices. */
function confirm(choices: Record<number, 'yes' | 'no'>): MatchState {
  let s = close(close(nomination({ 1: 0, 2: 0, 3: 0 })));
  for (const [v, c] of Object.entries(choices)) s = ok(s, S(Number(v)), { type: 'vote.confirm', seat: Number(v), choice: c });
  return s;
}
const votesOf = (s: MatchState, v: Viewer) => (project(s, v).step as { votes?: unknown }).votes;

describe('APPROVED open day ballots, shown live', () => {
  it('nomination: every view shows each voter -> target or Skip as soon as they vote', () => {
    let s = nomination({});
    for (const [name, v] of VIEWERS) assert.deepEqual(votesOf(s, v), [null, null, null, null, null, null, null], name);
    s = ok(s, S(0), { type: 'vote.nominate', seat: 0, target: 1 });
    for (const [name, v] of VIEWERS) assert.deepEqual(votesOf(s, v), [1, null, null, null, null, null, null], `${name} after 1st vote`);
    s = ok(s, S(3), { type: 'vote.nominate', seat: 3, target: 'skip' });
    for (const [name, v] of VIEWERS) {
      assert.deepEqual(votesOf(s, v), [1, null, null, 'skip', null, null, null], name);
      assert.deepEqual((project(s, v).step as { voted: unknown }).voted, [true, false, false, true, false, false, false], name);
    }
  });

  it('Yes/No: every view shows each voter -> Yes or No live', () => {
    const s = confirm({ 1: 'yes', 4: 'no', 5: 'yes' });
    for (const [name, v] of VIEWERS) assert.deepEqual(votesOf(s, v), [null, 'yes', null, null, 'no', 'yes', null], name);
  });

  it('a changed vote updates everywhere (and a withdrawn vote clears)', () => {
    let s = nomination({ 0: 1, 1: 0, 2: 0 });
    s = ok(s, S(1), { type: 'vote.nominate', seat: 1, target: 'skip' });
    for (const [name, v] of VIEWERS) assert.deepEqual(votesOf(s, v), [1, 'skip', 0, null, null, null, null], name);
    s = ok(s, S(2), { type: 'vote.nominate', seat: 2, target: null });
    for (const [name, v] of VIEWERS) assert.deepEqual(votesOf(s, v), [1, 'skip', null, null, null, null, null], name);
    let c = confirm({ 1: 'yes' });
    c = ok(c, S(1), { type: 'vote.confirm', seat: 1, choice: 'no' });
    for (const [name, v] of VIEWERS) assert.deepEqual(votesOf(c, v), [null, 'no', null, null, null, null, null], name);
  });

  it('a reconnect snapshot matches the live state, for every viewer', () => {
    for (const s of [nomination({ 0: 1, 2: 'skip', 3: 0 }), confirm({ 1: 'yes', 2: 'no' })]) {
      for (const [name, v] of VIEWERS) assert.deepEqual(reconnect(s, v), project(s, v), name);
    }
  });

  it('votes do not close early when everyone has voted; they close at the deadline with the full ballot in the result', () => {
    let s = nomination({});
    for (const v of alive(s)) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: v === 0 ? 1 : 0 });
    assert.deepEqual(stepTiming(s), { seconds: 30, earlyCloseReady: false });
    assert.equal(s.step.kind, 'day.vote');
    s = close(s);
    assert.deepEqual(lastLog(s, 'nomination'), {
      t: 'nomination', day: 1, accused: 0, tally: [{ target: 0, count: 5 }, { target: 1, count: 1 }], votes: [1, 0, 0, 0, 0, 0, null],
    });
    s = close(s); // defense -> confirm
    for (const v of alive(s)) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
    assert.deepEqual(stepTiming(s), { seconds: 15, earlyCloseReady: false });
    assert.equal(s.step.kind, 'day.confirm');
  });

  it('night stays private: wolf picks and night actions are invisible to non-entitled seats', () => {
    let s = match();
    s = ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    s = ok(s, S(2), { type: 'seer.inspect', seat: 2, target: 1 });
    s = ok(s, S(3), { type: 'guard.protect', seat: 3, target: 5 });
    const other = ok(ok(ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 5 }), S(2), { type: 'seer.inspect', seat: 2, target: 6 }), S(3), {
      type: 'guard.protect', seat: 3, target: 4,
    });
    for (const v of [seat(4), seat(5), seat(6), PUBLIC]) assert.deepEqual(project(s, v), project(other, v), JSON.stringify(v));
    assert.deepEqual(project(s, seat(1)).pack?.picks, [6, null, null, null, null, null, null], 'fellow wolf sees the pick');
    assert.equal(project(s, seat(4)).pack, null);
    // Witch step: the victim is the Witch's only (while her heal is unused).
    const w = close(s);
    for (const v of [seat(2), seat(3), seat(5), PUBLIC]) {
      assert.equal(JSON.stringify(project(w, v)).includes('"victim"'), false, JSON.stringify(v));
    }
  });
});
