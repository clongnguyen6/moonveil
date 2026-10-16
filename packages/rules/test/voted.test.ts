// APPROVED (Human, 2026-10-16): during nomination and the Yes/No vote, every viewer sees WHO has voted (identity and
// has-voted status only). WHAT anyone chose and any interim tally stay hidden until close. Supersedes day.showWhoVoted.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { project, type MatchState, type Viewer } from '../src/index.ts';
import { close, match, night, ok, S } from './helpers.ts';

const seat = (n: number): Viewer => ({ kind: 'seat', seat: n });
const PUBLIC: Viewer = { kind: 'public' };
const reconnect = (s: MatchState, v: Viewer) => project(JSON.parse(JSON.stringify(s)) as MatchState, v);
/** Viewers that must see voters but no choices: living non-voter (4), living voter (2), ghost (6), public. */
const VIEWERS: [string, Viewer][] = [['living non-voter', seat(4)], ['living voter', seat(2)], ['ghost', seat(6)], ['public', PUBLIC]];

/** Day 1 nomination (seat 6 died at night), with the given ballots. */
function nomination(ballots: Record<number, number | 'skip'>): MatchState {
  let s = close(night(match(), { bite: 6 }));
  for (const [v, t] of Object.entries(ballots)) s = ok(s, S(Number(v)), { type: 'vote.nominate', seat: Number(v), target: t });
  return s;
}
/** Day 1 Yes/No round on seat 0 (nominated by 1,2,3), with the given choices. */
function confirm(choices: Record<number, 'yes' | 'no'>): MatchState {
  let s = nomination({ 1: 0, 2: 0, 3: 0 });
  s = close(close(s));
  for (const [v, c] of Object.entries(choices)) s = ok(s, S(Number(v)), { type: 'vote.confirm', seat: Number(v), choice: c });
  return s;
}
/** Projection minus the viewer's own ballot (which legitimately differs when the viewer is a voter). */
const others = (s: MatchState, v: Viewer) => {
  const p = project(s, v);
  return { ...p, me: p.me ? { ...p.me, ballot: null, actions: [] } : null };
};

describe('APPROVED voted status during day votes', () => {
  it('every view (living, ghost, public, reconnect) shows the set of voters, in both votes', () => {
    const n = nomination({ 0: 1, 2: 'skip', 3: 0 });
    const c = confirm({ 1: 'yes', 5: 'no' });
    for (const [name, v] of VIEWERS) {
      for (const p of [project(n, v), reconnect(n, v)]) {
        assert.deepEqual(p.step.kind === 'day.vote' && p.step.voted, [true, false, true, true, false, false, false], name);
      }
      for (const p of [project(c, v), reconnect(c, v)]) {
        assert.deepEqual(p.step.kind === 'day.confirm' && p.step.voted, [false, true, false, false, false, true, false], name);
      }
    }
  });

  it('no view carries choices or counts until close', () => {
    const strip = (p: ReturnType<typeof project>) => JSON.stringify({ ...p, me: p.me ? { ...p.me, ballot: null, actions: [] } : null });
    // Nomination open: no choices in the step, no nomination result, no tally anywhere in the view.
    const n = nomination({ 0: 1, 1: 0, 2: 0, 3: 'skip' });
    for (const [name, v] of VIEWERS) {
      const p = project(n, v);
      assert.equal(p.step.kind === 'day.vote' && p.step.votes, null, name);
      assert.equal(p.publicLog.some((e) => e.t === 'nomination'), false, name);
      assert.equal(strip(p).includes('"tally"'), false, `${name}: interim tally`);
    }
    // Yes/No open: no choices and no confirm result (the earlier, closed nomination result is legitimately public).
    const c = confirm({ 1: 'yes', 2: 'yes', 4: 'no' });
    for (const [name, v] of VIEWERS) {
      const p = project(c, v);
      assert.equal(p.step.kind === 'day.confirm' && p.step.votes, null, name);
      assert.equal(p.publicLog.some((e) => e.t === 'confirm'), false, name);
      assert.equal(/"(yes|no)"/.test(strip(p)), false, `${name}: a Yes/No choice leaked`);
    }
  });

  it('same voters, different choices: identical to a third seat, a ghost and the public', () => {
    const a = nomination({ 0: 1, 1: 0, 2: 0 });
    const b = nomination({ 0: 'skip', 1: 2, 2: 1 });
    for (const [name, v] of VIEWERS.filter(([n]) => n !== 'living voter')) assert.deepEqual(project(a, v), project(b, v), name);
    const ca = confirm({ 1: 'yes', 2: 'no' });
    const cb = confirm({ 1: 'no', 2: 'yes' });
    for (const [name, v] of VIEWERS.filter(([n]) => n !== 'living voter')) assert.deepEqual(project(ca, v), project(cb, v), name);
  });

  it('different voters: views differ only in the voted set', () => {
    const a = nomination({ 0: 1, 1: 0 });
    const b = nomination({ 0: 1, 3: 0 });
    for (const [name, v] of VIEWERS.filter(([n]) => n !== 'living voter')) {
      const pa = project(a, v);
      const pb = project(b, v);
      assert.notDeepEqual(pa.step, pb.step, name);
      const strip = (p: typeof pa) => ({ ...p, step: { ...p.step, voted: null } });
      assert.deepEqual(strip(pa), strip(pb), `${name}: only voted differs`);
    }
  });

  it('changing a vote keeps the voted status and changes nothing else for others', () => {
    const before = nomination({ 0: 1, 1: 0, 2: 0 });
    const after = ok(before, S(1), { type: 'vote.nominate', seat: 1, target: 3 });
    for (const [name, v] of VIEWERS) {
      if (name === 'living voter') {
        // Voter 2 is not the one who changed: identical apart from nothing.
        assert.deepEqual(others(after, v), others(before, v), name);
      } else {
        assert.deepEqual(project(after, v), project(before, v), name);
      }
    }
    assert.equal(project(after, seat(1)).me?.ballot, 3, 'the changer sees their own new choice');
    const yn = confirm({ 1: 'yes' });
    const yn2 = ok(yn, S(1), { type: 'vote.confirm', seat: 1, choice: 'no' });
    for (const [name, v] of VIEWERS.filter(([n]) => n !== 'living voter')) assert.deepEqual(project(yn2, v), project(yn, v), name);
  });
});
