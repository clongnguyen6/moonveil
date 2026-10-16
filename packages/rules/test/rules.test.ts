import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMatch, DEFAULT_CONFIG, defaultDeck, evaluateVictory, stepTiming, tallyConfirm, validateDeck, type Role } from '../src/index.ts';
import { alive, close, day, lastLog, match, MOD, night, ok, rejects, ROLES7, S, SYS } from './helpers.ts';

describe('setup', () => {
  it('default decks for 6-16 are valid and follow the Q17 table', () => {
    for (let n = 6; n <= 16; n++) {
      const deck = defaultDeck(n, DEFAULT_CONFIG);
      assert.ok(deck, `deck for ${n}`);
      assert.equal(validateDeck(deck, n, DEFAULT_CONFIG), null);
    }
    assert.equal(defaultDeck(10, DEFAULT_CONFIG)?.wolf, 3);
    assert.equal(defaultDeck(5, DEFAULT_CONFIG), null);
    assert.equal(defaultDeck(17, DEFAULT_CONFIG), null);
  });

  it('rejects decks where an ordinary first night forces parity (F3)', () => {
    const c = { ...DEFAULT_CONFIG, players: { min: 1, max: 99 } };
    // 7 = 3 wolves + 4 villagers: one bite -> 3 v 3.
    assert.match(validateDeck({ wolf: 3, seer: 0, witch: 0, guard: 0, hunter: 0, villager: 4 }, 7, c) ?? '', /first night/);
    // Old 6-player preset (2W S Wi G V): bite + poison -> 2 v 2.
    assert.match(validateDeck({ wolf: 2, seer: 1, witch: 1, guard: 1, hunter: 0, villager: 1 }, 6, c) ?? '', /first night/);
    assert.equal(validateDeck({ wolf: 2, seer: 1, witch: 1, guard: 1, hunter: 0, villager: 1 }, 6, { ...c, limits: { ...c.limits, firstDawnParityCheck: 'biteOnly' } }), null);
  });

  it('rejects bad decks', () => {
    const base = { wolf: 2, seer: 1, witch: 1, guard: 1, hunter: 1, villager: 1 };
    assert.match(validateDeck({ ...base, wolf: 0, villager: 3 }, 7, DEFAULT_CONFIG) ?? '', /wolf/);
    assert.match(validateDeck({ ...base, wolf: 4, villager: 0, hunter: 0 }, 7, DEFAULT_CONFIG) ?? '', /fewer/);
    assert.match(validateDeck({ ...base, seer: 2, villager: 0 }, 7, DEFAULT_CONFIG) ?? '', /too many seer/);
    assert.match(validateDeck(base, 8, DEFAULT_CONFIG) ?? '', /roles for/);
    assert.match(validateDeck(base, 5, DEFAULT_CONFIG) ?? '', /outside/);
  });

  it('assignment is seeded and deterministic', () => {
    const a = createMatch({ seed: 'abc', playerCount: 9 });
    const b = createMatch({ seed: 'abc', playerCount: 9 });
    const c = createMatch({ seed: 'xyz', playerCount: 9 });
    assert.ok(a.ok && b.ok && c.ok);
    assert.deepEqual(a.state, b.state);
    assert.notDeepEqual(a.state.seats.map((s) => s.role), c.state.seats.map((s) => s.role));
  });

  it('starts at night 1; wolves know the pack; others know only themselves', () => {
    const s = match();
    assert.deepEqual(s.step, { kind: 'night.main', night: 1 });
    assert.deepEqual(s.knowledge[0], [{ k: 'role', seat: 0, role: 'wolf' }, { k: 'role', seat: 1, role: 'wolf' }]);
    assert.deepEqual(s.knowledge[2], [{ k: 'role', seat: 2, role: 'seer' }]);
  });

  it('state is plain JSON (round-trips)', () => {
    const s = night(match(), { bite: 6, inspect: 0, protect: 3, heal: false, poison: 'pass' });
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  });
});

describe('night', () => {
  it('bite kills at dawn; dawn lists names only', () => {
    const s = night(match(), { bite: 6 });
    assert.deepEqual(alive(s), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(lastLog(s, 'dawn'), { t: 'dawn', night: 1, dead: [6], causes: null });
    assert.equal(s.step.kind, 'day.discussion');
  });

  it('guard protection blocks the bite; heal blocks the bite and is spent', () => {
    assert.deepEqual(alive(night(match(), { bite: 6, protect: 6 })).length, 7);
    const s = night(match(), { bite: 6, heal: true });
    assert.equal(alive(s).length, 7);
    assert.equal(s.seats[4]?.heal, false);
  });

  it('heal on a guarded victim is still spent (Q04)', () => {
    const s = night(match(), { bite: 6, protect: 6, heal: true });
    assert.equal(alive(s).length, 7);
    assert.equal(s.seats[4]?.heal, false);
  });

  it('poison goes through guard protection (Q04)', () => {
    const s = night(match(), { bite: 'pass', protect: 6, poison: 6 });
    assert.deepEqual(alive(s), [0, 1, 2, 3, 4, 5]);
    assert.equal(s.seats[4]?.poison, false);
  });

  it('witch may use both potions in one night; dawn sorted by seat (Q03, Q21)', () => {
    const s = night(match(), { bite: 6, heal: true, poison: 0 });
    assert.deepEqual(alive(s), [1, 2, 3, 4, 5, 6]);
    const s2 = night(match(), { bite: 6, poison: 0 });
    assert.deepEqual((lastLog(s2, 'dawn') as { dead: number[] }).dead, [0, 6]);
  });

  it('guard cannot repeat target on consecutive nights; pass resets (Q02)', () => {
    let s = night(match(), { bite: 'pass', protect: 6 });
    s = day(s, 'skip');
    rejects(s, S(3), { type: 'guard.protect', seat: 3, target: 6 }, 'rule');
    s = night(s, { bite: 'pass', protect: 'pass' });
    s = day(s, 'skip');
    ok(s, S(3), { type: 'guard.protect', seat: 3, target: 6 });
  });

  it('self-target rules (Q01)', () => {
    const s = match();
    ok(s, S(3), { type: 'guard.protect', seat: 3, target: 3 });
    rejects(s, S(2), { type: 'seer.inspect', seat: 2, target: 2 }, 'rule');
    rejects(s, S(0), { type: 'wolf.pick', seat: 0, target: 1 }, 'rule');
    const w = close(ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 4 }));
    ok(w, S(4), { type: 'witch.heal', seat: 4, use: true });
    rejects(w, S(4), { type: 'witch.poison', seat: 4, target: 4 }, 'rule');
  });

  it('seer learns wolf/not-wolf immediately, once per night (Q05)', () => {
    let s = ok(match(), S(2), { type: 'seer.inspect', seat: 2, target: 1 });
    assert.deepEqual(s.knowledge[2]?.at(-1), { k: 'inspect', night: 1, target: 1, result: 'wolf' });
    rejects(s, S(2), { type: 'seer.inspect', seat: 2, target: 6 }, 'locked');
    s = ok(match(), S(2), { type: 'seer.inspect', seat: 2, target: 5 });
    assert.deepEqual(s.knowledge[2]?.at(-1), { k: 'inspect', night: 1, target: 5, result: 'notWolf' });
  });

  it('seer killed the same night keeps the result', () => {
    const s = night(match(), { bite: 2, inspect: 0 });
    assert.equal(s.seats[2]?.alive, false);
    assert.ok(s.knowledge[2]?.some((f) => f.k === 'inspect' && f.target === 0));
  });

  it('witch sees the victim only while heal is unused (Q03)', () => {
    let s = night(match(), { bite: 6, heal: true });
    assert.deepEqual(s.knowledge[4]?.filter((f) => f.k === 'victim'), [{ k: 'victim', night: 1, target: 6 }]);
    s = day(s, 'skip');
    s = night(s, { bite: 5 });
    assert.equal(s.knowledge[4]?.filter((f) => f.k === 'victim').length, 1);
  });

  it('witch step runs even when the witch is dead (Q11)', () => {
    let s = night(match(), { bite: 4 });
    s = day(s, 'skip');
    s = close(ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 6 }));
    assert.equal(s.step.kind, 'night.witch');
  });

  it('wolves: plurality; tie broken by seeded random, reproducibly (Q07)', () => {
    let s = match(['wolf', 'wolf', 'wolf', 'seer', 'guard', 'witch', 'hunter', 'villager', 'villager']);
    s = ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 7 });
    s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 7 });
    s = ok(s, S(2), { type: 'wolf.pick', seat: 2, target: 8 });
    assert.equal(close(s).nightRec?.victim, 7);
    let t = match(ROLES7, {}, 'tie-seed');
    t = ok(t, S(0), { type: 'wolf.pick', seat: 0, target: 5 });
    t = ok(t, S(1), { type: 'wolf.pick', seat: 1, target: 6 });
    const v1 = close(t).nightRec?.victim;
    assert.ok(v1 === 5 || v1 === 6);
    assert.equal(close(t).nightRec?.victim, v1);
  });

  it('no wolf picks -> nobody attacked; "Nobody died" is an empty dawn', () => {
    const s = night(match(), {});
    assert.deepEqual((lastLog(s, 'dawn') as { dead: number[] }).dead, []);
  });

  it('dead wolves do not count; picks from seats removed mid-night are ignored', () => {
    let s = ok(match(), S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 5 });
    s = ok(s, MOD, { type: 'player.remove', seat: 1 });
    assert.equal(close(s).nightRec?.victim, 6);
  });
});

describe('day', () => {
  const morning = () => night(match(), { bite: 'pass' });

  it('discussion -> vote -> defense -> confirm -> execution -> night', () => {
    let s = close(morning());
    assert.equal(s.step.kind, 'day.vote');
    for (const v of [1, 2, 3, 4]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(s);
    assert.deepEqual(s.step, { kind: 'day.defense', day: 1, accused: 0 });
    s = close(s);
    assert.equal(s.step.kind, 'day.confirm');
    s = ok(s, S(1), { type: 'vote.confirm', seat: 1, choice: 'no' });
    for (const v of [2, 3, 4, 5]) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
    s = close(s);
    assert.equal(s.seats[0]?.alive, false);
    assert.deepEqual(s.step, { kind: 'night.main', night: 2 });
  });

  it('tie at top -> no nomination; skip on top -> none (Q09)', () => {
    let s = day(morning(), { 0: 1, 1: 0, 2: 0, 3: 1 });
    assert.equal((lastLog(s, 'nomination') as { accused: unknown }).accused, null);
    assert.equal(s.step.kind, 'night.main');
    s = day(morning(), { 0: 'skip', 1: 'skip', 2: 0 });
    assert.equal((lastLog(s, 'nomination') as { accused: unknown }).accused, null);
  });

  it('confirm tie -> no execution (Q10)', () => {
    let s = close(close(day0vote(morning())));
    s = ok(s, S(2), { type: 'vote.confirm', seat: 2, choice: 'yes' });
    s = ok(s, S(3), { type: 'vote.confirm', seat: 3, choice: 'no' });
    s = close(s);
    assert.equal(s.seats[0]?.alive, true);
    assert.equal((lastLog(s, 'confirm') as { executed: boolean }).executed, false);
  });

  it('no self-vote; dead may not vote', () => {
    const s = close(night(match(), { bite: 6 }));
    rejects(s, S(2), { type: 'vote.nominate', seat: 2, target: 2 }, 'rule');
    rejects(s, S(6), { type: 'vote.nominate', seat: 6, target: 0 }, 'bad_seat');
  });

  it('hunter step may close once the shot is in; discussion length scales with living players', () => {
    const s = night(match(), { bite: 'pass' });
    assert.equal(stepTiming(s).seconds, 60 + 15 * 7);
    const h = ok(night(match(), { bite: 5 }), S(5), { type: 'hunter.shoot', seat: 5, target: 'pass' });
    assert.equal(stepTiming(h).earlyCloseReady, true);
  });

  function day0vote(s: ReturnType<typeof match>) {
    let t = close(s);
    for (const v of [1, 2, 3]) t = ok(t, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    return t;
  }
});

describe('APPROVED 2026-10-16: execution needs Yes * 2 > all living players', () => {
  const R10: Role[] = ['wolf', 'wolf', 'wolf', 'seer', 'guard', 'witch', 'hunter', 'villager', 'villager', 'villager'];
  /** Day 1 at the Yes/No step, nobody dead, seat 0 accused. */
  const atConfirm = (roles: Role[] = ROLES7, accused = 0) => {
    let s = close(night(match(roles), { bite: 'pass' }));
    for (const v of alive(s).filter((x) => x !== accused).slice(0, 3)) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: accused });
    s = close(close(s));
    assert.deepEqual(s.step.kind === 'day.confirm' && s.step.accused, accused);
    return s;
  };
  const vote = (s: ReturnType<typeof match>, yes: number[], no: number[] = []) => {
    for (const v of yes) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
    for (const v of no) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'no' });
    return close(s);
  };

  it('pure function boundaries (odd and even living counts)', () => {
    const v = (y: number, n: number, total: number) => [...Array(y).fill('yes'), ...Array(n).fill('no'), ...Array(total - y - n).fill(null)];
    assert.equal(tallyConfirm(v(4, 0, 7), 7).executed, true);
    assert.equal(tallyConfirm(v(3, 0, 7), 7).executed, false);
    assert.equal(tallyConfirm(v(6, 0, 10), 10).executed, true);
    assert.equal(tallyConfirm(v(5, 0, 10), 10).executed, false);
    assert.equal(tallyConfirm(v(5, 5, 10), 10).executed, false);
    assert.equal(tallyConfirm(v(3, 2, 10), 10).executed, false);
  });

  it('7 living: 4 Yes executes, 3 Yes does not (even with 0 No)', () => {
    assert.equal(vote(atConfirm(), [1, 2, 3, 4]).seats[0]?.alive, false);
    assert.equal(vote(atConfirm(), [1, 2, 3]).seats[0]?.alive, true);
  });

  it('10 living: 6 Yes executes; 5 Yes does not; 3 Yes + 2 No does not', () => {
    assert.equal(vote(atConfirm(R10), [1, 2, 3, 4, 5, 6]).seats[0]?.alive, false);
    assert.equal(vote(atConfirm(R10), [1, 2, 3, 4, 5], [6, 7, 8, 9, 0]).seats[0]?.alive, true);
    const s = vote(atConfirm(R10), [1, 2, 3], [4, 5]);
    assert.equal(s.seats[0]?.alive, true);
    assert.deepEqual(lastLog(s, 'confirm'), { t: 'confirm', day: 1, accused: 0, counted: 'votes', yes: 3, no: 2, votes: [null, 'yes', 'yes', 'yes', 'no', 'no', null, null, null, null], executed: false });
  });

  it('abstaining and disconnected (silent) seats stay in the denominator; the accused counts even if barred from voting', () => {
    // 7 living, 3 Yes, everyone else silent (disconnected or abstaining): 3*2 = 6 <= 7.
    assert.equal(vote(atConfirm(), [1, 2, 3]).seats[0]?.alive, true);
    // Accused may not vote: denominator is still all 7 living, so 3 Yes is not enough.
    let s = close(night(match(undefined, { day: { accusedVotesOnConfirm: false } }), { bite: 'pass' }));
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = vote(close(close(s)), [1, 2, 3]);
    assert.equal(s.seats[0]?.alive, true);
  });

  it('removed seats are dead and leave the denominator (6 living -> 4 Yes needed, 3 not enough)', () => {
    let s = ok(atConfirm(), MOD, { type: 'player.remove', seat: 6 });
    assert.equal(alive(s).length, 6);
    assert.equal(vote(s, [1, 2, 3]).seats[0]?.alive, true);
    assert.equal(vote(s, [1, 2, 3, 4]).seats[0]?.alive, false);
  });

  it('an executed Hunter shoots before victory is checked; a spared Hunter does not', () => {
    let s = vote(atConfirm(ROLES7, 5), [0, 1, 2, 3]);
    assert.equal(s.seats[5]?.alive, false);
    assert.equal(s.step.kind, 'hunter');
    s = close(ok(s, S(5), { type: 'hunter.shoot', seat: 5, target: 0 }));
    assert.equal(s.seats[0]?.alive, false);
    assert.equal(s.step.kind, 'night.main');
    const spared = vote(atConfirm(ROLES7, 5), [0, 1, 2]);
    assert.equal(spared.seats[5]?.alive, true);
    assert.equal(spared.step.kind, 'night.main');
  });
});

describe('hunter (Q06 shootOnDeath)', () => {
  it('bitten hunter shoots at dawn; shot resolves before day', () => {
    let s = night(match(), { bite: 5 });
    assert.deepEqual(s.step.kind, 'hunter');
    s = ok(s, S(5), { type: 'hunter.shoot', seat: 5, target: 0 });
    s = close(s);
    assert.deepEqual(alive(s), [1, 2, 3, 4, 6]);
    assert.equal(s.step.kind, 'day.discussion');
  });

  it('executed hunter shoots; then night', () => {
    let s = day(night(match(), { bite: 'pass' }), 5);
    assert.equal(s.step.kind, 'hunter');
    s = close(ok(s, S(5), { type: 'hunter.shoot', seat: 5, target: 1 }));
    assert.equal(s.seats[1]?.alive, false);
    assert.equal(s.step.kind, 'night.main');
  });

  it('timeout -> no shot', () => {
    const s = close(night(match(), { bite: 5 }));
    assert.equal(alive(s).length, 6);
    assert.deepEqual(lastLog(s, 'shot'), { t: 'shot', by: 5, target: null });
  });

  it('parity would be reached but the hunter shot kills the last wolf first -> village', () => {
    // 1 wolf, hunter, witch: bite hunter, witch poisons nobody -> 1 wolf vs 1 witch = parity, unless hunter shoots wolf.
    let s = match(['wolf', 'hunter', 'witch'] as Role[]);
    s = night(s, { bite: 1, heal: false, poison: 'pass' });
    assert.equal(s.step.kind, 'hunter');
    assert.equal(s.outcome, null);
    s = close(ok(s, S(1), { type: 'hunter.shoot', seat: 1, target: 0 }));
    assert.deepEqual(s.outcome, { winner: 'village', reason: 'noWolves' });
  });

  it('hunter shooting a second hunter chains', () => {
    let s = match(['wolf', 'wolf', 'hunter', 'hunter', 'villager', 'villager', 'villager'] as Role[], { limits: { maxPerSpecialRole: 2 } });
    s = night(s, { bite: 2 });
    s = close(ok(s, S(2), { type: 'hunter.shoot', seat: 2, target: 3 }));
    assert.deepEqual(s.step.kind === 'hunter' && s.step.pending, [3]);
    s = close(ok(s, S(3), { type: 'hunter.shoot', seat: 3, target: 0 }));
    assert.deepEqual(alive(s), [1, 4, 5, 6]);
    assert.equal(s.step.kind, 'day.discussion');
  });
});

describe('victory', () => {
  it('approved rule: parity and no-wolves', () => {
    const seats = (spec: [Role, boolean][]) =>
      spec.map(([role, a], seat) => ({ seat, role, alive: a, death: null, heal: true, poison: true, guardLast: null }));
    assert.deepEqual(evaluateVictory(seats([['wolf', true], ['villager', true], ['seer', true]])), null);
    assert.deepEqual(evaluateVictory(seats([['wolf', true], ['hunter', true]])), { winner: 'wolves', reason: 'parity' });
    assert.deepEqual(evaluateVictory(seats([['wolf', false], ['villager', true]])), { winner: 'village', reason: 'noWolves' });
    assert.deepEqual(evaluateVictory(seats([['wolf', false], ['villager', false]])), { winner: 'draw', reason: 'zeroSurvivors' });
  });

  it('zero survivors via chain is a draw (Q14 example)', () => {
    // wolf 0, witch 1, hunter 2: wolf bites hunter, witch poisons wolf, hunter shoots witch.
    let s = match(['wolf', 'witch', 'hunter'] as Role[]);
    s = night(s, { bite: 2, poison: 0 });
    s = close(ok(s, S(2), { type: 'hunter.shoot', seat: 2, target: 1 }));
    assert.deepEqual(s.outcome, { winner: 'draw', reason: 'zeroSurvivors' });
  });

  it('wolves win at dawn by parity; match ends before day', () => {
    let s = match(['wolf', 'villager', 'villager'] as Role[]);
    s = night(s, { bite: 1 });
    assert.deepEqual(s.outcome, { winner: 'wolves', reason: 'parity' });
    assert.equal(s.step.kind, 'ended');
    rejects(s, SYS, { type: 'step.close' }, 'ended');
  });
});
