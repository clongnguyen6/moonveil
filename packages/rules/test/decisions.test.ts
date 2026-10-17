// APPROVED 2026-10-16 (batch): Q03 Witch, Q07 wolf target, Q09/Q10 nomination + 30 s defense, night timing,
// day votes (fixed deadline; open ballots in ballots.test.ts), Q25 channels. Fixed behaviour.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  channelsFor, createRulesEngine, project, resolveWolfTarget, stepTiming, tallyNomination,
  type ChannelViewer, type MatchState, type Role, type Viewer,
} from '../src/index.ts';
import { alive, close, day, lastLog, match, MOD, night, ok, rejects, S } from './helpers.ts';

const R10: Role[] = ['wolf', 'wolf', 'wolf', 'seer', 'guard', 'witch', 'hunter', 'villager', 'villager', 'villager'];
/** Reconnect = rebuild from the persisted (JSON) state and project again. */
const reconnect = (s: MatchState, v: Viewer) => project(JSON.parse(JSON.stringify(s)) as MatchState, v);
const seat = (n: number): Viewer => ({ kind: 'seat', seat: n });
/** Night 1, wolves bite `victim`, now in the Witch step. */
const witchStep = (victim: number, s: MatchState = match()) => close(ok(s, S(0), { type: 'wolf.pick', seat: 0, target: victim }));

describe('APPROVED Q03 Witch', () => {
  it('heal and poison on the same night', () => {
    let s = witchStep(6);
    s = ok(s, S(4), { type: 'witch.heal', seat: 4, use: true });
    s = close(ok(s, S(4), { type: 'witch.poison', seat: 4, target: 0 }));
    assert.equal(s.seats[6]?.alive, true);
    assert.equal(s.seats[0]?.alive, false);
    assert.deepEqual([s.seats[4]?.heal, s.seats[4]?.poison], [false, false]);
  });

  it('a second heal and a second poison are refused (moderator cannot bypass)', () => {
    let s = night(match(), { bite: 6, heal: true, poison: 3 });
    s = witchStep(2, day(s, 'skip'));
    rejects(s, S(4), { type: 'witch.heal', seat: 4, use: true }, 'rule');
    rejects(s, S(4), { type: 'witch.poison', seat: 4, target: 0 }, 'rule');
    const lax = { ...s, config: { ...s.config, moderator: { ...s.config.moderator, mayBreakRules: true } } };
    rejects(lax, MOD, { type: 'witch.heal', seat: 4, use: true }, 'rule');
    rejects(lax, MOD, { type: 'witch.poison', seat: 4, target: 0 }, 'rule');
  });

  it('self-heal accepted; self-poison refused (even with mayBreakRules)', () => {
    const s = close(ok(witchStep(4), S(4), { type: 'witch.heal', seat: 4, use: true }));
    assert.equal(s.seats[4]?.alive, true);
    rejects(witchStep(6), S(4), { type: 'witch.poison', seat: 4, target: 4 }, 'rule');
    rejects(witchStep(6, match(undefined, { moderator: { mayBreakRules: true } })), MOD, { type: 'witch.poison', seat: 4, target: 4 }, 'rule');
  });

  it('victim visible while heal unused, hidden after it is spent; identical on reconnect', () => {
    const n1 = witchStep(6);
    const p1 = project(n1, seat(4));
    assert.deepEqual(p1.me?.facts.filter((f) => f.k === 'victim'), [{ k: 'victim', night: 1, target: 6 }]);
    assert.deepEqual(reconnect(n1, seat(4)), p1);
    const n2 = witchStep(3, day(close(ok(n1, S(4), { type: 'witch.heal', seat: 4, use: true })), 'skip'));
    const p2 = project(n2, seat(4));
    assert.deepEqual(p2.me?.facts.filter((f) => f.k === 'victim').map((f) => f.k === 'victim' && f.night), [1], 'no night-2 victim');
    assert.equal(p2.me?.actions.some((a) => a.type === 'witch.heal'), false);
    assert.deepEqual(reconnect(n2, seat(4)), p2);
  });
});

describe('APPROVED Q07 wolf target', () => {
  it('picks visible only to living wolves (not dead wolves, others or public)', () => {
    let s = day(night(match(R10), { bite: 'pass' }), 0); // wolf 0 executed
    s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 7 });
    assert.deepEqual(project(s, seat(2)).pack?.picks, [null, 7, null, null, null, null, null, null, null, null]);
    assert.equal(project(s, seat(0)).pack?.picks, null, 'dead wolf');
    for (const v of [seat(3), seat(7), { kind: 'public' } as Viewer]) {
      const p = project(s, v);
      assert.equal(p.pack, null);
      assert.equal(JSON.stringify(p).includes('wolfPicks'), false);
    }
  });

  it('plurality wins', () => {
    let s = match(R10);
    s = ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 7 });
    s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 7 });
    s = ok(s, S(2), { type: 'wolf.pick', seat: 2, target: 8 });
    assert.equal(close(s).nightRec?.victim, 7);
  });

  it('two-way and three-way ties pick only among the tied top targets; seeded and deterministic', () => {
    const outcomes = (picks: (number | 'pass')[]) => {
      const seen = new Set<number | null>();
      for (let seed = 0; seed < 200; seed++) {
        const a = resolveWolfTarget(picks, 'counted', seed).target;
        assert.equal(resolveWolfTarget(picks, 'counted', seed).target, a, 'deterministic');
        seen.add(a);
      }
      return [...seen].sort();
    };
    assert.deepEqual(outcomes([5, 5, 6, 6, 7]), [5, 6]);
    assert.deepEqual(outcomes([5, 5, 6, 6, 7, 7, 8]), [5, 6, 7]);
  });

  it('no wolf picks -> no attack (current provisional Q08 rule)', () => {
    assert.equal(close(match(R10)).nightRec?.victim, null);
    assert.equal(resolveWolfTarget([], 'counted', 1).target, null);
  });
});

describe('APPROVED Q09/Q10 nomination (tested separately from execution)', () => {
  const nominate = (votes: (number | 'skip' | null)[]) => tallyNomination(votes).accused;
  it('plurality without majority (3 of 10) puts the top player on trial', () => {
    assert.equal(nominate([7, 7, 7, 8, 8, 9, 9, null, null, null]), 7);
  });
  it('two-way tie at the top: no trial', () => assert.equal(nominate([7, 7, 8, 8, 9, null, null, null, null, null]), null));
  it('Skip has the most votes: no trial', () => assert.equal(nominate(['skip', 'skip', 'skip', 7, 7, null, null, null, null, null]), null));
  it('Skip tied with the top player: no trial', () => assert.equal(nominate(['skip', 'skip', 7, 7, 8, null, null, null, null, null]), null));
  it('zero votes cast: no trial', () => assert.equal(nominate(Array(10).fill(null)), null));

  it('in a match: a trial leads to a 30 s defense, then the Yes/No round; no trial -> night', () => {
    let s = close(night(match(R10), { bite: 'pass' }));
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 7 });
    for (const v of [4, 5]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 8 });
    s = close(s);
    assert.deepEqual(s.step, { kind: 'day.defense', day: 1, accused: 7 });
    assert.deepEqual(stepTiming(s), { seconds: 30, earlyCloseReady: false });
    const eng = createRulesEngine();
    assert.equal(eng.phase({ seatIds: R10.map((_, i) => `s${i}`), match: s, clock: null }).durationMs, 30_000);
    assert.equal(close(s).step.kind, 'day.confirm');
    let t = close(night(match(R10), { bite: 'pass' }));
    for (const v of [1, 2]) t = ok(t, S(v), { type: 'vote.nominate', seat: v, target: 'skip' });
    assert.equal(close(t).step.kind, 'night.main');
  });

  it('then, separately: strict majority of all living executes the nominee (10 living: 5 no, 6 yes)', () => {
    const atConfirm = () => {
      let s = close(night(match(R10), { bite: 'pass' }));
      for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 7 });
      return close(close(s));
    };
    const yes = (n: number) => {
      let s = atConfirm();
      for (const v of [0, 1, 2, 3, 4, 5].slice(0, n)) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
      return close(s).seats[7]?.alive;
    };
    assert.equal(yes(5), true);
    assert.equal(yes(6), false);
  });
});

describe('APPROVED night timing: fixed 60 s, never early', () => {
  const nightSeconds = (s: MatchState) => {
    assert.equal(s.step.kind, 'night.main');
    const a = stepTiming(s);
    const w = close(s);
    assert.equal(w.step.kind, 'night.witch', 'Witch step always runs');
    const b = stepTiming(w);
    return { total: a.seconds + b.seconds, early: a.earlyCloseReady || b.earlyCloseReady };
  };
  it('identical across role and death combinations', () => {
    const cases: [string, MatchState][] = [
      ['default 7', match()],
      ['6-player preset, no Witch in deck', match(['wolf', 'wolf', 'seer', 'guard', 'hunter', 'villager'])],
      ['Witch dead', day(night(match(), { bite: 4 }), 'skip')],
      ['heal spent', day(night(match(), { bite: 6, heal: true }), 'skip')],
      ['Seer and Guard dead', day(night(match(), { bite: 2, poison: 3 }), 'skip')],
    ];
    for (const [name, s] of cases) assert.deepEqual(nightSeconds(s), { total: 60, early: false }, name);
  });

  it('no early close when every night action is submitted', () => {
    let s = match();
    for (const w of [0, 1]) s = ok(s, S(w), { type: 'wolf.pick', seat: w, target: 6 });
    s = ok(s, S(2), { type: 'seer.inspect', seat: 2, target: 0 });
    s = ok(s, S(3), { type: 'guard.protect', seat: 3, target: 5 });
    assert.equal(stepTiming(s).earlyCloseReady, false);
    s = close(s);
    s = ok(s, S(4), { type: 'witch.heal', seat: 4, use: true });
    s = ok(s, S(4), { type: 'witch.poison', seat: 4, target: 0 });
    assert.equal(stepTiming(s).earlyCloseReady, false);
  });
});

describe('APPROVED day votes: run to deadline (open ballots are tested in ballots.test.ts)', () => {
  /** Day 1 nomination step (nobody dead unless `bite`), with `ballots` cast. */
  const voting = (ballots: Record<number, number | 'skip'>, bite: number | 'pass' = 'pass') => {
    let s = close(night(match(), { bite }));
    for (const [v, t] of Object.entries(ballots)) s = ok(s, S(Number(v)), { type: 'vote.nominate', seat: Number(v), target: t });
    return s;
  };

  it('no early close when everyone has voted (nomination and Yes/No); durations are the deadline', () => {
    let s = voting({ 0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    assert.deepEqual(stepTiming(s), { seconds: 30, earlyCloseReady: false });
    s = close(close(s));
    for (const v of alive(s)) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
    assert.deepEqual(stepTiming(s), { seconds: 15, earlyCloseReady: false });
    assert.equal(s.step.kind, 'day.confirm', 'still open until step.close at the deadline');
  });

  it('at close the result event carries the tally and every ballot', () => {
    const s = close(voting({ 0: 1, 1: 0, 2: 0, 3: 0 }));
    assert.deepEqual(lastLog(s, 'nomination'), {
      t: 'nomination', day: 1, accused: 0,
      tally: [{ target: 0, count: 3 }, { target: 1, count: 1 }],
      votes: [1, 0, 0, 0, null, null, null],
    });
  });
});

describe('APPROVED Q25 channel grants (engine side)', () => {
  const PUB_TALK = { channel: 'public', listen: true, speak: true };
  const PUB_LISTEN = { channel: 'public', listen: true, speak: false };
  const WOLVES = { channel: 'wolves', listen: true, speak: true };
  const GHOSTS = { channel: 'ghosts', listen: true, speak: true };
  // Approved: moderator listens to every channel; speech is provisional and off by default.
  const MOD_GRANTS = [PUB_LISTEN, { channel: 'wolves', listen: true, speak: false }, { channel: 'ghosts', listen: true, speak: false }];
  const g = (s: MatchState, v: ChannelViewer) => channelsFor(s, v);
  const at = (s: MatchState) => ({
    villager: g(s, { kind: 'seat', seat: 7 }), wolf: g(s, { kind: 'seat', seat: 1 }), deadWolf: g(s, { kind: 'seat', seat: 0 }),
    ghost: g(s, { kind: 'seat', seat: 8 }), moderator: g(s, { kind: 'moderator' }),
  });

  // Night 1 bite villager 8 (ghost); day 1 execute wolf 0 (dead wolf); now night 2.
  const base = () => day(night(match(R10), { bite: 8 }), 0);

  it('grant table across phases', () => {
    let s = base(); // now night 2, night.main
    assert.deepEqual(at(s), { villager: [], wolf: [WOLVES], deadWolf: [PUB_LISTEN, GHOSTS], ghost: [PUB_LISTEN, GHOSTS], moderator: MOD_GRANTS });
    s = close(s); // night.witch
    assert.deepEqual(at(s).wolf, [WOLVES]);
    assert.deepEqual(at(s).villager, []);
    s = close(s); // dawn -> day.discussion (nobody attacked)
    assert.deepEqual(at(s), { villager: [PUB_TALK], wolf: [PUB_TALK], deadWolf: [PUB_LISTEN, GHOSTS], ghost: [PUB_LISTEN, GHOSTS], moderator: MOD_GRANTS });
    s = close(s); // day.vote
    assert.deepEqual(at(s).villager, [PUB_TALK]);
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 7 });
    s = close(s); // day.defense, accused 7
    // 2026-10-18: every living seat speaks during defense (supersedes accused-only).
    assert.deepEqual(g(s, { kind: 'seat', seat: 7 }), [PUB_TALK], 'accused speaks');
    assert.deepEqual(g(s, { kind: 'seat', seat: 9 }), [PUB_TALK], 'non-accused speaks');
    assert.deepEqual(g(s, { kind: 'seat', seat: 1 }), [PUB_TALK], 'living wolf speaks in public, no wolf channel by day');
    assert.deepEqual(at(s).ghost, [PUB_LISTEN, GHOSTS]);
    s = close(s); // day.confirm
    assert.deepEqual(at(s).villager, [PUB_TALK]);
  });

  it('pending Hunter: public-listen only until the turn resolves; then ghost grants', () => {
    let s = night(match(R10), { bite: 6 });
    assert.equal(s.step.kind, 'hunter');
    assert.deepEqual(g(s, { kind: 'seat', seat: 6 }), [PUB_LISTEN]);
    assert.deepEqual(g(s, { kind: 'seat', seat: 7 }), [PUB_TALK], 'living during the Hunter turn: day grants');
    s = close(s);
    assert.deepEqual(g(s, { kind: 'seat', seat: 6 }), [PUB_LISTEN, GHOSTS]);
  });

  it('transitions at death: a living wolf loses the wolf channel the moment it dies', () => {
    let s = close(night(match(R10), { bite: 'pass' }));
    assert.deepEqual(g(s, { kind: 'seat', seat: 0 }), [PUB_TALK]);
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(close(s));
    for (const v of [3, 4, 5, 6, 7, 8]) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
    s = close(s); // wolf 0 executed -> night 2
    assert.equal(s.step.kind, 'night.main');
    assert.deepEqual(g(s, { kind: 'seat', seat: 0 }), [PUB_LISTEN, GHOSTS]);
    assert.deepEqual(g(s, { kind: 'seat', seat: 1 }), [WOLVES]);
  });

  it('reconnect snapshot gives the same grants; views never carry channel membership', () => {
    const s = base();
    const r = JSON.parse(JSON.stringify(s)) as MatchState;
    for (let i = 0; i < 10; i++) assert.deepEqual(channelsFor(r, { kind: 'seat', seat: i }), channelsFor(s, { kind: 'seat', seat: i }));
    assert.deepEqual(channelsFor(r, { kind: 'moderator' }), channelsFor(s, { kind: 'moderator' }));
    for (let i = 0; i < 10; i++) assert.equal(JSON.stringify(project(s, seat(i))).includes('"channel"'), false);
  });

  it('moderator speaking is provisional (speaksInPublic, default off); listening to all is fixed', () => {
    const s = match(undefined, { moderator: { speaksInPublic: true } });
    assert.deepEqual(channelsFor(s, { kind: 'moderator' }), [PUB_TALK, { channel: 'wolves', listen: true, speak: false }, { channel: 'ghosts', listen: true, speak: false }]);
  });
});

