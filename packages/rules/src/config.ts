// Rules configuration. Every key is PROVISIONAL (see docs/rules/PROPOSAL.md, Qxx) until Human approves it.
// Approved rules (not configurable): six roles, parity/no-wolves victory, resolve-before-victory, Yes/No execution
// threshold, Q06 Hunter, Q14 zero survivors = draw, Q20 no reveal on death, Q24 ghost knowledge.
import { clone } from './clone.ts';
import type { Role } from './types.ts';

export type DeckCounts = Record<Role, number>;

export interface RulesConfig {
  players: { min: number; max: number }; // Q18
  /** Default deck per player count (Q17). Keys are player counts as strings. */
  distribution: Record<string, DeckCounts>;
  limits: {
    maxPerSpecialRole: number; // Q17
    /** Q17 (F3): reject decks where ordinary first-night deaths can force parity at the first dawn. */
    firstDawnParityCheck: 'biteAndPoison' | 'biteOnly' | 'off';
  };
  firstNightKill: boolean; // Q23
  reveal: {
    causeAtDawn: boolean; // Q21
    historyAtEnd: boolean; // Q24 end-of-match history (not covered by the Q24 approval)
  };
  wolves: {
    resolve: 'plurality' | 'unanimous' | 'random'; // Q07
    canTargetWolf: boolean; // Q01
    mayPass: boolean; // Q08
  };
  seer: { result: 'wolfOrNot' | 'exactRole' }; // Q05
  guard: {
    canProtectSelf: boolean; // Q01
    noRepeatTarget: boolean; // Q02
    passResetsRepeat: boolean; // Q02
  };
  witch: {
    seesVictim: 'whileHealUnused' | 'always' | 'never'; // Q03
    bothPotionsSameNight: boolean; // Q03
    canHealSelf: boolean; // Q01/Q03
    canPoisonSelf: boolean; // Q01
  };
  protection: {
    guardBlocksPoison: boolean; // Q04
    doubleProtectionKills: boolean; // Q04
  };
  day: {
    selfVote: boolean; // Q01
    nomination: 'plurality' | 'majorityOfLiving'; // Q09
    defense: boolean; // Q10
    confirmVote: boolean; // Q10
    accusedVotesOnConfirm: boolean; // Q10
    openVotes: boolean; // Q22
  };
  moderator: {
    mayBreakRules: boolean; // Q16
  };
  /** Q26: may the system/host remove a seat during a secret (night) step? Moderator always may. */
  removal: { systemDuringSecret: boolean };
  /** Q25: voice/text channels. Ghost rules (ghost channel, hear public, no wolf channel) are approved, not configurable. */
  comms: {
    wolvesAtNight: boolean;
    livingHearPublicAtNight: boolean;
    defenseOnlyAccusedSpeaks: boolean;
    moderatorHearsAll: boolean;
  };
  /** Seconds. Q11/Q19. */
  timing: {
    nightMain: number;
    nightWitch: number;
    discussionBase: number;
    discussionPerAlive: number;
    discussionMin: number;
    discussionMax: number;
    vote: number;
    defense: number;
    confirm: number;
    hunter: number;
    nightEarlyClose: boolean;
    /** Q11/Q22 (F6): votes may close early once everyone has voted. Hunter step always may. */
    publicEarlyClose: boolean;
  };
}

const d = (wolf: number, seer: number, witch: number, guard: number, hunter: number, villager: number): DeckCounts => ({
  wolf, seer, witch, guard, hunter, villager,
});

export const DEFAULT_CONFIG: RulesConfig = {
  players: { min: 6, max: 16 },
  distribution: {
    '6': d(2, 1, 0, 1, 1, 1), // F3: no Witch at 6 (bite+poison could force parity at first dawn)
    '7': d(2, 1, 1, 1, 1, 1),
    '8': d(2, 1, 1, 1, 1, 2),
    '9': d(2, 1, 1, 1, 1, 3),
    '10': d(3, 1, 1, 1, 1, 3),
    '11': d(3, 1, 1, 1, 1, 4),
    '12': d(3, 1, 1, 1, 1, 5),
    '13': d(4, 1, 1, 1, 1, 5),
    '14': d(4, 1, 1, 1, 1, 6),
    '15': d(4, 1, 1, 1, 1, 7),
    '16': d(5, 1, 1, 1, 1, 7),
  },
  limits: { maxPerSpecialRole: 1, firstDawnParityCheck: 'biteAndPoison' },
  firstNightKill: true,
  reveal: { causeAtDawn: false, historyAtEnd: true },
  wolves: { resolve: 'plurality', canTargetWolf: false, mayPass: true },
  seer: { result: 'wolfOrNot' },
  guard: { canProtectSelf: true, noRepeatTarget: true, passResetsRepeat: true },
  witch: { seesVictim: 'whileHealUnused', bothPotionsSameNight: true, canHealSelf: true, canPoisonSelf: false },
  protection: { guardBlocksPoison: false, doubleProtectionKills: false },
  day: {
    selfVote: false,
    nomination: 'plurality',
    defense: true,
    confirmVote: true,
    accusedVotesOnConfirm: true,
    openVotes: true,
  },
  moderator: { mayBreakRules: false },
  removal: { systemDuringSecret: false },
  comms: { wolvesAtNight: true, livingHearPublicAtNight: false, defenseOnlyAccusedSpeaks: true, moderatorHearsAll: true },
  timing: {
    nightMain: 40,
    nightWitch: 20,
    discussionBase: 60,
    discussionPerAlive: 15,
    discussionMin: 90,
    discussionMax: 240,
    vote: 30,
    defense: 30,
    confirm: 15,
    hunter: 20,
    nightEarlyClose: false,
    publicEarlyClose: false,
  },
};

/** Registry of provisional config paths -> proposal item. Tests assert every entry has a swap test. */
export const PROVISIONAL: Record<string, string> = {
  'players.min': 'Q18',
  'players.max': 'Q18',
  distribution: 'Q17',
  'limits.maxPerSpecialRole': 'Q17',
  'limits.firstDawnParityCheck': 'Q17',
  firstNightKill: 'Q23',
  'reveal.causeAtDawn': 'Q21',
  'reveal.historyAtEnd': 'Q24-history',
  'wolves.resolve': 'Q07',
  'wolves.canTargetWolf': 'Q01',
  'wolves.mayPass': 'Q08',
  'seer.result': 'Q05',
  'guard.canProtectSelf': 'Q01',
  'guard.noRepeatTarget': 'Q02',
  'guard.passResetsRepeat': 'Q02',
  'witch.seesVictim': 'Q03',
  'witch.bothPotionsSameNight': 'Q03',
  'witch.canHealSelf': 'Q03',
  'witch.canPoisonSelf': 'Q01',
  'protection.guardBlocksPoison': 'Q04',
  'protection.doubleProtectionKills': 'Q04',
  'day.selfVote': 'Q01',
  'day.nomination': 'Q09',
  'day.defense': 'Q10',
  'day.confirmVote': 'Q10',
  'day.accusedVotesOnConfirm': 'Q10',
  'day.openVotes': 'Q22',
  'moderator.mayBreakRules': 'Q16',
  'removal.systemDuringSecret': 'Q26',
  'comms.wolvesAtNight': 'Q25',
  'comms.livingHearPublicAtNight': 'Q25',
  'comms.defenseOnlyAccusedSpeaks': 'Q25',
  'comms.moderatorHearsAll': 'Q25',
  'timing.nightMain': 'Q11',
  'timing.nightWitch': 'Q11',
  'timing.discussionBase': 'Q19',
  'timing.discussionPerAlive': 'Q19',
  'timing.discussionMin': 'Q19',
  'timing.discussionMax': 'Q19',
  'timing.vote': 'Q19',
  'timing.defense': 'Q19',
  'timing.confirm': 'Q19',
  'timing.hunter': 'Q19',
  'timing.nightEarlyClose': 'Q11',
  'timing.publicEarlyClose': 'Q11/Q22',
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Deep-merge overrides onto defaults. `distribution` is replaced wholesale when given. */
export function resolveConfig(overrides: DeepPartial<RulesConfig> = {}): RulesConfig {
  const out = clone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) continue;
    if (k === 'distribution' || typeof v !== 'object' || v === null) {
      out[k] = clone(v);
    } else {
      out[k] = { ...(out[k] as object), ...clone(v) };
    }
  }
  return out as unknown as RulesConfig;
}
