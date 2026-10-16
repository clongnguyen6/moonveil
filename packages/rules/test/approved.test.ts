// APPROVED 2026-10-16: Q14 (zero survivors = draw), Q20 (no reveal on death; Hunter revealed when the shot turn opens;
// all roles at end), Q24 (ghosts keep, never gain; public events still arrive). Fixed behaviour, no settings.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { project, type MatchState, type Role, type Viewer } from '../src/index.ts';
import { close, day, match, MOD, night, ok, ROLES7, S } from './helpers.ts';

const viewers = (s: MatchState): Viewer[] => [{ kind: 'public' }, ...s.seats.map((x) => ({ kind: 'seat' as const, seat: x.seat }))];
/** Role of `seat` as seen by `v` (null = hidden). */
const seen = (s: MatchState, v: Viewer, seat: number) => project(s, v).seats[seat]?.role ?? null;
/** True if `v` is entitled to know `seat`'s role without any public reveal (self, or wolf pack). */
const entitled = (s: MatchState, v: Viewer, seat: number) =>
  v.kind === 'seat' && (v.seat === seat || (s.seats[v.seat]?.role === 'wolf' && s.seats[seat]?.role === 'wolf'));

describe('APPROVED Q14: zero survivors after all shots and chains = draw', () => {
  it('chain completed by a Hunter shot leaves nobody: draw, not a Wolf or Village win', () => {
    // wolf 0, witch 1, hunter 2. Night: wolf bites hunter, witch poisons wolf -> only the witch is left alive.
    let s = night(match(['wolf', 'witch', 'hunter'] as Role[]), { bite: 2, poison: 0 });
    assert.equal(s.outcome, null, 'victory waits for the pending shot');
    s = close(ok(s, S(2), { type: 'hunter.shoot', seat: 2, target: 1 }));
    assert.deepEqual(s.outcome, { winner: 'draw', reason: 'zeroSurvivors' });
  });
});

describe('APPROVED Q20: no role revealed on death; Hunter revealed when the shot turn opens; all roles at end', () => {
  it('bite, poison, execution and removal reveal no role to anyone not already entitled', () => {
    let s = night(match(), { bite: 6, poison: 3 }); // villager + guard die at night
    s = day(s, 0); // a wolf executed (1 wolf v 3 left)
    s = ok(s, MOD, { type: 'player.remove', seat: 4 }); // witch removed
    assert.equal(s.outcome, null);
    for (const v of viewers(s)) {
      for (const dead of [6, 3, 0, 4]) {
        if (!entitled(s, v, dead)) assert.equal(seen(s, v, dead), null, `viewer ${JSON.stringify(v)} sees role of ${dead}`);
      }
    }
    assert.ok(!s.publicLog.some((e) => e.t === 'roleRevealed'));
  });

  it('APPROVED Q20 Hunter exception: revealed to every viewer when the turn opens, and still after a timeout with no shot', () => {
    const open = night(match(), { bite: 5 });
    assert.equal(open.step.kind, 'hunter');
    for (const v of viewers(open)) assert.equal(seen(open, v, 5), 'hunter', `at open, viewer ${JSON.stringify(v)}`);
    const timedOut = close(open);
    assert.deepEqual(timedOut.publicLog.filter((e) => e.t === 'shot'), [{ t: 'shot', by: 5, target: null }]);
    for (const v of viewers(timedOut)) assert.equal(seen(timedOut, v, 5), 'hunter', `after timeout, viewer ${JSON.stringify(v)}`);
    // Any other deaths in the same batch stay hidden.
    const both = night(match(), { bite: 5, poison: 6 });
    for (const v of viewers(both)) if (!entitled(both, v, 6)) assert.equal(seen(both, v, 6), null);
  });

  it("the Hunter's shot turn reveals the Hunter (and only the Hunter) to every viewer", () => {
    const s = night(match(), { bite: 5 });
    for (const v of viewers(s)) assert.equal(seen(s, v, 5), 'hunter');
    assert.deepEqual(
      s.publicLog.filter((e) => e.t === 'roleRevealed'),
      [{ t: 'roleRevealed', seat: 5, role: 'hunter' }],
    );
  });

  it('match end reveals every role to every viewer (living, dead, public)', () => {
    let s = night(match(), { bite: 6 });
    s = day(s, 0);
    s = night(s, { bite: 3 });
    s = day(s, 1); // last wolf executed -> village wins
    assert.equal(s.step.kind, 'ended');
    for (const v of viewers(s)) {
      const p = project(s, v);
      assert.deepEqual(p.reveal?.roles, ROLES7);
      assert.deepEqual(p.seats.map((x) => x.role), ROLES7);
    }
  });
});

describe('APPROVED Q24: ghosts keep, never gain; public events still arrive', () => {
  it("a dead Seer's ledger is unchanged in content while public events keep arriving", () => {
    let s = ok(match(), S(2), { type: 'seer.inspect', seat: 2, target: 0 });
    s = night(s, { bite: 2 });
    const facts = structuredClone(project(s, { kind: 'seat', seat: 2 }).me?.facts);
    const logLen = project(s, { kind: 'seat', seat: 2 }).publicLog.length;
    s = day(s, 1);
    s = night(s, { bite: 6 });
    const p = project(s, { kind: 'seat', seat: 2 });
    assert.deepEqual(p.me?.facts, facts);
    assert.ok(p.publicLog.length > logLen, 'public events still arrive');
    assert.ok(p.publicLog.some((e) => e.t === 'executed' && e.seat === 1));
    assert.ok(p.publicLog.some((e) => e.t === 'dawn' && e.night === 2));
    assert.equal(p.pack, null);
    assert.equal(p.seats[0]?.role, null, 'no new secret roles');
  });

  it('a dead wolf keeps the pack list but gains no picks, targets or wolf channel', () => {
    let s = day(night(match(), { bite: 'pass' }), 0);
    const facts = structuredClone(s.knowledge[0]);
    s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 6 });
    const p = project(s, { kind: 'seat', seat: 0 });
    assert.deepEqual(p.pack, { seats: [0, 1], picks: null, decision: null });
    s = close(s);
    assert.deepEqual(s.knowledge[0], facts);
  });
});
