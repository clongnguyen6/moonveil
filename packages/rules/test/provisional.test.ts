// Every PROVISIONAL config key must be swappable: changing it changes behavior, with no engine edits.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apply, channelsFor, createMatch, project, PROVISIONAL, stepTiming, type DeepPartial, type Role, type RulesConfig } from '../src/index.ts';
import { close, day, match, MOD, night, ok, S, SYS } from './helpers.ts';

type Cfg = DeepPartial<RulesConfig>;

/** key -> [alternative config, scenario returning an observable]. */
const SWAPS: Record<string, [Cfg, (cfg: Cfg) => unknown]> = {
  'players.min': [{ players: { min: 7, max: 16 } }, (c) => createMatch({ seed: 1, playerCount: 6, config: c }).ok],
  'players.max': [{ players: { min: 6, max: 15 } }, (c) => createMatch({ seed: 1, playerCount: 16, config: c }).ok],
  distribution: [
    { distribution: { '7': { wolf: 1, seer: 1, witch: 1, guard: 1, hunter: 1, villager: 2 } } },
    (c) => {
      const r = createMatch({ seed: 1, playerCount: 7, config: c });
      return r.ok && r.state.seats.filter((s) => s.role === 'wolf').length;
    },
  ],
  'limits.maxPerSpecialRole': [
    { limits: { maxPerSpecialRole: 2 } },
    (c) => createMatch({ seed: 1, roles: ['wolf', 'wolf', 'seer', 'seer', 'villager', 'villager', 'villager'], config: { players: { min: 1, max: 99 }, ...c } }).ok,
  ],
  firstNightKill: [{ firstNightKill: false }, (c) => apply(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 6 }).ok],
  'reveal.roleOnDeath': [{ reveal: { roleOnDeath: true, causeAtDawn: false, historyAtEnd: true } }, (c) => night(match(undefined, c), { bite: 6 }).publicLog.some((e) => e.t === 'roleRevealed')],
  'reveal.causeAtDawn': [
    { reveal: { roleOnDeath: false, causeAtDawn: true, historyAtEnd: true } },
    (c) => night(match(undefined, c), { bite: 6 }).publicLog.find((e) => e.t === 'dawn'),
  ],
  'reveal.historyAtEnd': [
    { reveal: { roleOnDeath: false, causeAtDawn: false, historyAtEnd: false } },
    (c) => project(night(match(['wolf', 'villager', 'villager'] as Role[], c), { bite: 1 }), { kind: 'seat', seat: 2 }).reveal?.history === null,
  ],
  'wolves.resolve': [
    { wolves: { resolve: 'unanimous', canTargetWolf: false, mayPass: true } },
    (c) => {
      let s = ok(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 5 });
      s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 6 });
      return close(s).nightRec?.victim === null;
    },
  ],
  'wolves.canTargetWolf': [{ wolves: { resolve: 'plurality', canTargetWolf: true, mayPass: true } }, (c) => apply(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 1 }).ok],
  'wolves.mayPass': [{ wolves: { resolve: 'plurality', canTargetWolf: false, mayPass: false } }, (c) => apply(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 'pass' }).ok],
  'seer.result': [{ seer: { result: 'exactRole' } }, (c) => ok(match(undefined, c), S(2), { type: 'seer.inspect', seat: 2, target: 5 }).knowledge[2]?.at(-1)],
  'guard.canProtectSelf': [{ guard: { canProtectSelf: false, noRepeatTarget: true, passResetsRepeat: true } }, (c) => apply(match(undefined, c), S(3), { type: 'guard.protect', seat: 3, target: 3 }).ok],
  'guard.noRepeatTarget': [
    { guard: { canProtectSelf: true, noRepeatTarget: false, passResetsRepeat: true } },
    (c) => apply(day(night(match(undefined, c), { bite: 'pass', protect: 6 }), 'skip'), S(3), { type: 'guard.protect', seat: 3, target: 6 }).ok,
  ],
  'guard.passResetsRepeat': [
    { guard: { canProtectSelf: true, noRepeatTarget: true, passResetsRepeat: false } },
    (c) => {
      let s = day(night(match(undefined, c), { bite: 'pass', protect: 6 }), 'skip');
      s = day(night(s, { bite: 'pass', protect: 'pass' }), 'skip');
      return apply(s, S(3), { type: 'guard.protect', seat: 3, target: 6 }).ok;
    },
  ],
  'witch.seesVictim': [
    { witch: { seesVictim: 'always', bothPotionsSameNight: true, canHealSelf: true, canPoisonSelf: false } },
    (c) => {
      let s = day(night(match(undefined, c), { bite: 6, heal: true }), 'skip');
      s = close(ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 3 }));
      return s.knowledge[4]?.filter((f) => f.k === 'victim').length;
    },
  ],
  'witch.bothPotionsSameNight': [
    { witch: { seesVictim: 'whileHealUnused', bothPotionsSameNight: false, canHealSelf: true, canPoisonSelf: false } },
    (c) => {
      const s = ok(close(ok(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 6 })), S(4), { type: 'witch.heal', seat: 4, use: true });
      return apply(s, S(4), { type: 'witch.poison', seat: 4, target: 0 }).ok;
    },
  ],
  'witch.canHealSelf': [
    { witch: { seesVictim: 'whileHealUnused', bothPotionsSameNight: true, canHealSelf: false, canPoisonSelf: false } },
    (c) => apply(close(ok(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 4 })), S(4), { type: 'witch.heal', seat: 4, use: true }).ok,
  ],
  'witch.canPoisonSelf': [
    { witch: { seesVictim: 'whileHealUnused', bothPotionsSameNight: true, canHealSelf: true, canPoisonSelf: true } },
    (c) => apply(close(match(undefined, c)), S(4), { type: 'witch.poison', seat: 4, target: 4 }).ok,
  ],
  'protection.guardBlocksPoison': [
    { protection: { guardBlocksPoison: true, doubleProtectionKills: false } },
    (c) => night(match(undefined, c), { bite: 'pass', protect: 6, poison: 6 }).seats[6]?.alive,
  ],
  'protection.doubleProtectionKills': [
    { protection: { guardBlocksPoison: false, doubleProtectionKills: true } },
    (c) => night(match(undefined, c), { bite: 6, protect: 6, heal: true }).seats[6]?.alive,
  ],
  'hunter.mode': [
    { hunter: { mode: 'pinNightOnly', shootsWhenPoisoned: true, shootsWhenRemoved: false } },
    (c) => night(match(undefined, c), { bite: 5 }).step.kind,
  ],
  'hunter.shootsWhenPoisoned': [
    { hunter: { mode: 'shootOnDeath', shootsWhenPoisoned: false, shootsWhenRemoved: false } },
    (c) => night(match(undefined, c), { bite: 'pass', poison: 5 }).step.kind,
  ],
  'hunter.shootsWhenRemoved': [
    { hunter: { mode: 'shootOnDeath', shootsWhenPoisoned: true, shootsWhenRemoved: true } },
    (c) => ok(match(undefined, c), MOD, { type: 'player.remove', seat: 5 }).step.kind,
  ],
  'day.selfVote': [{ day: { selfVote: true } }, (c) => apply(close(night(match(undefined, c), { bite: 'pass' })), S(2), { type: 'vote.nominate', seat: 2, target: 2 }).ok],
  'day.nomination': [
    { day: { nomination: 'majorityOfLiving' } },
    (c) => {
      let s = close(night(match(undefined, c), { bite: 'pass' }));
      for (const v of [1, 2]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
      return close(s).step.kind;
    },
  ],
  'day.defense': [{ day: { defense: false } }, (c) => close(day1Voted(c)).step.kind],
  'day.confirmVote': [{ day: { confirmVote: false } }, (c) => close(close(day1Voted(c))).step.kind],
  'day.confirm': [
    { day: { confirm: 'majorityOfCast' } },
    (c) => {
      let s = close(close(day1Voted({ ...c, day: { ...c.day, defense: true, confirmVote: true } })));
      s = ok(s, S(2), { type: 'vote.confirm', seat: 2, choice: 'yes' });
      s = ok(s, S(3), { type: 'vote.confirm', seat: 3, choice: 'yes' });
      s = ok(s, S(4), { type: 'vote.confirm', seat: 4, choice: 'no' });
      return close(s).seats[0]?.alive;
    },
  ],
  'day.accusedVotesOnConfirm': [
    { day: { accusedVotesOnConfirm: false } },
    (c) => apply(close(close(day1Voted(c))), S(0), { type: 'vote.confirm', seat: 0, choice: 'no' }).ok,
  ],
  'day.openVotes': [{ day: { openVotes: false } }, (c) => project(day1Voted(c), { kind: 'public' }).step],
  'victory.zeroSurvivors': [
    { victory: { zeroSurvivors: 'village' } },
    (c) => {
      let s = night(match(['wolf', 'witch', 'hunter'] as Role[], c), { bite: 2, poison: 0 });
      s = close(ok(s, S(2), { type: 'hunter.shoot', seat: 2, target: 1 }));
      return s.outcome?.winner;
    },
  ],
  'moderator.mayBreakRules': [{ moderator: { mayBreakRules: true, canSetDayOutcome: true } }, (c) => apply(match(undefined, c), MOD, { type: 'seer.inspect', seat: 2, target: 2 }).ok],
  'moderator.canSetDayOutcome': [
    { moderator: { mayBreakRules: false, canSetDayOutcome: false } },
    (c) => apply(night(match(undefined, c), { bite: 'pass' }), MOD, { type: 'day.setOutcome', execute: 6 }).ok,
  ],
  'removal.systemDuringSecret': [{ removal: { systemDuringSecret: true } }, (c) => apply(match(undefined, c), SYS, { type: 'player.remove', seat: 6 }).ok],
  'comms.wolvesAtNight': [{ comms: { wolvesAtNight: false } }, (c) => channelsFor(match(undefined, c), { kind: 'seat', seat: 0 })],
  'comms.livingHearPublicAtNight': [{ comms: { livingHearPublicAtNight: true } }, (c) => channelsFor(match(undefined, c), { kind: 'seat', seat: 6 })],
  'comms.defenseOnlyAccusedSpeaks': [{ comms: { defenseOnlyAccusedSpeaks: false } }, (c) => channelsFor(close(day1Voted(c)), { kind: 'seat', seat: 2 })],
  'comms.moderatorHearsAll': [{ comms: { moderatorHearsAll: false } }, (c) => channelsFor(match(undefined, c), { kind: 'moderator' })],
  'limits.firstDawnParityCheck': [
    { limits: { firstDawnParityCheck: 'off' } },
    (c) => createMatch({ seed: 1, playerCount: 7, deck: { wolf: 3, seer: 0, witch: 0, guard: 0, hunter: 0, villager: 4 }, config: c }).ok,
  ],
  'comms.pendingHunterJoinsGhosts': [{ comms: { pendingHunterJoinsGhosts: true } }, (c) => channelsFor(night(match(undefined, c), { bite: 5 }), { kind: 'seat', seat: 5 })],
  'timing.nightMain': [{ timing: { nightMain: 60 } }, (c) => stepTiming(match(undefined, c)).seconds],
  'timing.nightWitch': [{ timing: { nightWitch: 30 } }, (c) => stepTiming(close(match(undefined, c))).seconds],
  'timing.discussionBase': [{ timing: { discussionBase: 30 } }, (c) => stepTiming(night(match(undefined, c), { bite: 'pass' })).seconds],
  'timing.discussionPerAlive': [{ timing: { discussionPerAlive: 20 } }, (c) => stepTiming(night(match(undefined, c), { bite: 'pass' })).seconds],
  'timing.discussionMin': [{ timing: { discussionMin: 200 } }, (c) => stepTiming(night(match(undefined, c), { bite: 'pass' })).seconds],
  'timing.discussionMax': [{ timing: { discussionMax: 120 } }, (c) => stepTiming(night(match(undefined, c), { bite: 'pass' })).seconds],
  'timing.vote': [{ timing: { vote: 45 } }, (c) => stepTiming(close(night(match(undefined, c), { bite: 'pass' }))).seconds],
  'timing.defense': [{ timing: { defense: 45 } }, (c) => stepTiming(close(day1Voted(c))).seconds],
  'timing.confirm': [{ timing: { confirm: 25 } }, (c) => stepTiming(close(close(day1Voted(c)))).seconds],
  'timing.hunter': [{ timing: { hunter: 30 } }, (c) => stepTiming(night(match(undefined, c), { bite: 5 })).seconds],
  'timing.nightEarlyClose': [
    { timing: { nightEarlyClose: true } },
    (c) => stepTiming(night1AllActed(c)).earlyCloseReady,
  ],
  'timing.publicEarlyClose': [
    { timing: { publicEarlyClose: true } },
    (c) => {
      let s = close(night(match(undefined, c), { bite: 'pass' }));
      for (const x of s.seats.filter((q) => q.alive)) s = ok(s, S(x.seat), { type: 'vote.nominate', seat: x.seat, target: 'skip' });
      return stepTiming(s).earlyCloseReady;
    },
  ],
};

/** Night 1 main step with every living night actor submitted. */
function night1AllActed(c: Cfg) {
  let s = match(undefined, c);
  for (const w of [0, 1]) s = ok(s, S(w), { type: 'wolf.pick', seat: w, target: 6 });
  s = ok(s, S(2), { type: 'seer.inspect', seat: 2, target: 0 });
  return ok(s, S(3), { type: 'guard.protect', seat: 3, target: 6 });
}

/** Day 1 at the nomination step with seats 1,2,3 voting for seat 0. */
function day1Voted(c: Cfg) {
  let s = close(night(match(undefined, c), { bite: 'pass' }));
  for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
  return s;
}

describe('provisional rules are swappable by config', () => {
  it('every PROVISIONAL key has a swap scenario (and vice versa)', () => {
    assert.deepEqual(Object.keys(SWAPS).sort(), Object.keys(PROVISIONAL).sort());
  });
  for (const [key, [alt, scenario]] of Object.entries(SWAPS)) {
    it(`${key} (${PROVISIONAL[key]}) changes behavior`, () => {
      const a = scenario({});
      const b = scenario(alt);
      assert.notDeepEqual(a, b, `${key}: default and alternative gave the same result ${JSON.stringify(a)}`);
    });
  }
});

describe('Q06 alternative: pinNightOnly (sky2 behavior)', () => {
  const pin = { hunter: { mode: 'pinNightOnly' as const, shootsWhenPoisoned: true, shootsWhenRemoved: false } };
  it('pinned player dies with the hunter at night, even if protected', () => {
    const s = night(match(undefined, pin), { bite: 5, pin: 6, protect: 6 });
    assert.deepEqual(s.seats.filter((x) => !x.alive).map((x) => x.seat), [5, 6]);
    assert.equal(s.step.kind, 'day.discussion');
  });
  it('execution of the hunter has no effect', () => {
    let s = night(match(undefined, pin), { bite: 'pass', pin: 6 });
    s = day(s, 5);
    assert.equal(s.seats[6]?.alive, true);
    assert.equal(s.step.kind, 'night.main');
  });
  it('pin is rejected in shootOnDeath mode', () => {
    assert.equal(apply(match(), S(5), { type: 'hunter.pin', seat: 5, target: 6 }).ok, false);
  });
});
