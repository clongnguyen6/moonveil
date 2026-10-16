// APPROVED (Human, 2026-10-16):
// F1-A stalemate draw: 3 consecutive full cycles (night + its day) without a gameplay death end the match as a draw
// (reason 'stalemate'); a warning at the end of the 2nd. Boundary = end of the day, after Hunter shots/chains and the
// win check. Gameplay deaths: bite, poison, execution, Hunter shot. Removal does not reset the streak.
// Moderator end: moderator-only `match.end` with confirm 'end-match'; no winner; normal end-of-match disclosure.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { channelsFor, createRulesEngine, project, type MatchState, type Role, type Viewer } from '../src/index.ts';
import { close, day, match, MOD, night, ok, rejects, S, SYS } from './helpers.ts';

const warnings = (s: MatchState) => s.publicLog.filter((e) => e.t === 'stalemateWarning');
/** One quiet cycle from night.main: Wolves pass, nobody is protected or poisoned, everyone Skips. Ends at next night.main or ended. */
const quiet = (s: MatchState) => day(night(s, { bite: 'pass' }), 'skip');

describe('APPROVED F1-A stalemate draw', () => {
  it('warning exactly at the 2nd quiet boundary, draw at the 3rd', () => {
    let s = quiet(match());
    assert.equal(s.quietCycles, 1);
    assert.equal(warnings(s).length, 0, 'no warning after the 1st boundary');
    s = quiet(s);
    assert.equal(s.quietCycles, 2);
    assert.deepEqual(warnings(s), [{ t: 'stalemateWarning', day: 2 }], 'warning at the end of day 2');
    assert.deepEqual(s.step, { kind: 'night.main', night: 3 }, 'play continues after the warning');
    s = quiet(s);
    assert.deepEqual(s.outcome, { winner: 'draw', reason: 'stalemate' });
    assert.equal(s.step.kind, 'ended');
    assert.equal(s.day, 3);
    assert.ok(s.seats.every((x) => x.alive), 'a stalemate, not zero survivors');
  });

  it('a night death (bite) resets the streak; a poison death resets it too', () => {
    let s = quiet(quiet(match())); // 2 quiet, warned
    s = day(night(s, { bite: 6 }), 'skip'); // bite in cycle 3
    assert.equal(s.outcome, null);
    assert.equal(s.quietCycles, 0);
    s = quiet(quiet(match()));
    s = day(night(s, { bite: 'pass', poison: 3 }), 'skip'); // only death: poison
    assert.equal(s.outcome, null);
    assert.equal(s.quietCycles, 0);
    s = quiet(s);
    assert.equal(s.quietCycles, 1, 'the count starts again from zero');
  });

  it('a Hunter shot counts as a gameplay death', () => {
    // A shot always follows another gameplay death (the Hunter's own). To isolate the shot, clear the flag after the
    // Hunter's death and before the shot resolves: the shot alone must set it again.
    let s = quiet(match());
    s = night(s, { bite: 5 }); // Hunter bitten -> pending shot
    assert.equal(s.step.kind, 'hunter');
    s = { ...s, cycleHadDeath: false };
    s = close(ok(s, S(5), { type: 'hunter.shoot', seat: 5, target: 6 }));
    assert.equal(s.cycleHadDeath, true, 'shot death sets the flag');
    s = day(s, 'skip');
    assert.equal(s.quietCycles, 0);
  });

  it('removal is not a gameplay death: it does not reset the streak', () => {
    let s = quiet(match());
    s = night(s, { bite: 'pass' });
    s = ok(s, MOD, { type: 'player.remove', seat: 6 }); // removed during day 2
    s = day(s, 'skip');
    assert.equal(s.quietCycles, 2);
    assert.deepEqual(warnings(s), [{ t: 'stalemateWarning', day: 2 }]);
    s = quiet(s);
    assert.deepEqual(s.outcome, { winner: 'draw', reason: 'stalemate' });
  });

  it('win check first: if the final cycle ends with a winner, that winner stands (no stalemate)', () => {
    // wolf 0, hunter 1, villagers 2-3 (+4,5,6). Two quiet cycles; on day 3 the Hunter is executed and shoots the
    // last wolf: the chain ends with the Village winning at the 3rd boundary.
    const roles: Role[] = ['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager'];
    let s = quiet(quiet(match(roles)));
    assert.equal(s.quietCycles, 2);
    s = day(night(s, { bite: 'pass' }), 1); // execute the Hunter on day 3
    assert.equal(s.step.kind, 'hunter');
    s = close(ok(s, S(1), { type: 'hunter.shoot', seat: 1, target: 0 }));
    assert.deepEqual(s.outcome, { winner: 'village', reason: 'noWolves' });
  });

  it('states saved before this rule (no streak fields) load as a zero streak', () => {
    const saved = JSON.parse(JSON.stringify(match())) as Record<string, unknown>;
    delete saved.quietCycles;
    delete saved.cycleHadDeath;
    const s = quiet(saved as unknown as MatchState);
    assert.equal(s.quietCycles, 1);
  });

  it('warning copy matches the boundary: "before the end of the next day", never "next dawn"', () => {
    const narration = readFileSync(new URL('../../../docs/rules/NARRATION.md', import.meta.url), 'utf8');
    const line = narration.split('\n').find((l) => l.includes('stalemateWarning')) ?? '';
    assert.match(line, /If nobody dies before the end of the next day, the match ends in a draw\./);
    assert.doesNotMatch(line, /dawn/i);
  });
});

describe('APPROVED moderator ends the match', () => {
  const VIEWERS = (s: MatchState): Viewer[] => [{ kind: 'public' }, { kind: 'moderator' }, ...s.seats.map((x) => ({ kind: 'seat' as const, seat: x.seat }))];

  it('only the moderator can end it, with the explicit confirm; no winner', () => {
    const s = night(match(), { bite: 6 });
    rejects(s, MOD, { type: 'match.end' } as never, 'bad_value');
    rejects(s, MOD, { type: 'match.end', confirm: 'yes' } as never, 'bad_value');
    rejects(s, S(0), { type: 'match.end', confirm: 'end-match' }, 'forbidden');
    rejects(s, SYS, { type: 'match.end', confirm: 'end-match' }, 'forbidden');
    rejects(s, MOD, { type: 'match.abort' } as never, 'bad_value'); // the old unconfirmed command is gone
    const e = ok(s, MOD, { type: 'match.end', confirm: 'end-match' });
    assert.deepEqual(e.outcome, { winner: 'aborted', reason: 'aborted' });
    assert.equal(e.step.kind, 'ended');
  });

  it('a player or the host cannot end it in automatic mode (host engine)', () => {
    const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const eng = createRulesEngine();
    const h = eng.setup({ seats: IDS, seed: 'x' });
    for (const id of IDS) assert.equal(eng.submit(h, id, { type: 'match.end', confirm: 'end-match' }).ok, false, id);
    assert.equal(eng.moderate(h, { type: 'match.end' }).ok, false, 'missing confirm rejected at parse');
    assert.equal(eng.moderate(h, { type: 'match.end', confirm: 'end-match' }).ok, true, 'moderator route works');
  });

  it('end-of-match disclosure for every view, ended channels, and reconnect shows the ended state', () => {
    const e = ok(night(match(), { bite: 6 }), MOD, { type: 'match.end', confirm: 'end-match' });
    const roles = e.seats.map((x) => x.role);
    const saved = JSON.parse(JSON.stringify(e)) as MatchState;
    for (const v of VIEWERS(e)) {
      const p = project(e, v);
      assert.deepEqual(p.reveal?.roles, roles, JSON.stringify(v));
      assert.deepEqual(p.seats.map((x) => x.role), roles);
      assert.deepEqual(p.outcome, { winner: 'aborted', reason: 'aborted' });
      assert.deepEqual(project(saved, v), p, 'reconnect snapshot');
    }
    for (const x of e.seats) assert.deepEqual(channelsFor(e, { kind: 'seat', seat: x.seat }), [{ channel: 'public', listen: true, speak: true }]);
    assert.equal(ok(night(match(), { bite: 'pass' }), MOD, { type: 'match.end', confirm: 'end-match' }).publicLog.at(-1)?.t, 'ended');
  });
});
