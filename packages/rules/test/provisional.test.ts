// Every PROVISIONAL config key must be swappable: changing it changes behavior, with no engine edits.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apply, channelsFor, createMatch, project, PROVISIONAL, type DeepPartial, type Role, type RulesConfig } from '../src/index.ts';
import { close, day, match, MOD, night, ok, S, SYS } from './helpers.ts';

type Cfg = DeepPartial<RulesConfig>;

/** key -> [alternative config, scenario returning an observable]. */
const SWAPS: Record<string, [Cfg, (cfg: Cfg) => unknown]> = {
  firstNightKill: [{ firstNightKill: false }, (c) => apply(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 6 }).ok],
  'reveal.causeAtDawn': [
    { reveal: { causeAtDawn: true, historyAtEnd: true } },
    (c) => night(match(undefined, c), { bite: 6 }).publicLog.find((e) => e.t === 'dawn'),
  ],
  'reveal.historyAtEnd': [
    { reveal: { causeAtDawn: false, historyAtEnd: false } },
    (c) => project(night(match(['wolf', 'villager', 'villager'] as Role[], c), { bite: 1 }), { kind: 'seat', seat: 2 }).reveal?.history === null,
  ],
  'wolves.canTargetWolf': [{ wolves: { canTargetWolf: true } }, (c) => apply(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 1 }).ok],
  'wolves.mayPass': [{ wolves: { mayPass: false } }, (c) => apply(match(undefined, c), S(0), { type: 'wolf.pick', seat: 0, target: 'pass' }).ok],
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
  'protection.guardBlocksPoison': [
    { protection: { guardBlocksPoison: true, doubleProtectionKills: false } },
    (c) => night(match(undefined, c), { bite: 'pass', protect: 6, poison: 6 }).seats[6]?.alive,
  ],
  'protection.doubleProtectionKills': [
    { protection: { guardBlocksPoison: false, doubleProtectionKills: true } },
    (c) => night(match(undefined, c), { bite: 6, protect: 6, heal: true }).seats[6]?.alive,
  ],
  'day.selfVote': [{ day: { selfVote: true } }, (c) => apply(close(night(match(undefined, c), { bite: 'pass' })), S(2), { type: 'vote.nominate', seat: 2, target: 2 }).ok],
  'day.accusedVotesOnConfirm': [
    { day: { accusedVotesOnConfirm: false } },
    (c) => apply(close(close(day1Voted(c))), S(0), { type: 'vote.confirm', seat: 0, choice: 'no' }).ok,
  ],
  'moderator.mayBreakRules': [{ moderator: { mayBreakRules: true } }, (c) => apply(match(undefined, c), MOD, { type: 'seer.inspect', seat: 2, target: 2 }).ok],
  'removal.systemDuringSecret': [{ removal: { systemDuringSecret: true } }, (c) => apply(match(undefined, c), SYS, { type: 'player.remove', seat: 6 }).ok],
  'wolves.passHandling': [
    { wolves: { passHandling: 'ignored' } },
    (c) => {
      // 2 pass vs 1 pick: 'counted' -> pass leads, no attack; 'ignored' -> the single pick wins.
      let s = match(['wolf', 'wolf', 'wolf', 'seer', 'guard', 'witch', 'hunter', 'villager', 'villager'] as Role[], c);
      s = ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 'pass' });
      s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 'pass' });
      s = ok(s, S(2), { type: 'wolf.pick', seat: 2, target: 8 });
      return close(s).nightRec?.victim;
    },
  ],
  'moderator.canActForSeats': [{ moderator: { canActForSeats: false } }, (c) => apply(match(undefined, c), MOD, { type: 'guard.protect', seat: 3, target: 6 }).ok],
  'moderator.canSetWolfTarget': [{ moderator: { canSetWolfTarget: false } }, (c) => apply(match(undefined, c), MOD, { type: 'wolf.decide', target: 6 }).ok],
  'moderator.speaksInPublic': [{ moderator: { speaksInPublic: true } }, (c) => channelsFor(match(undefined, c), { kind: 'moderator' })],
};

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
