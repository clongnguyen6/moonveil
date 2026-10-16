// Rules configuration. Every key here is PROVISIONAL (see docs/rules/PROPOSAL.md, Qxx) until Human approves it.
// Approved rules are fixed engine behaviour and are NOT here: six roles; victory (parity / no wolves / zero = draw);
// resolve-before-victory; Q03 Witch; Q06 Hunter; Q07 wolf plurality; Q09/Q10 nomination, 30 s defense, Yes/No with
// Yes*2 > living; Q11 night = fixed 60 s, never early; day votes run to deadline with hidden interim results;
// Q16 moderator Yes count; Q20 reveal rules; Q24 ghost knowledge; Q25 channel policy (except moderator speaking).
import { clone } from './clone.ts';
import type { Role } from './types.ts';

export type DeckCounts = Record<Role, number>;

/** APPROVED: total night length in seconds (main + Witch step), fixed regardless of roles or completion. */
export const NIGHT_TOTAL_SECONDS = 60;
/** APPROVED: defense length in seconds. */
export const DEFENSE_SECONDS = 30;

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
    canTargetWolf: boolean; // Q01
    mayPass: boolean; // Q08
    /** Q08: how 'pass' picks count in the (approved) plurality. 'counted': pass wins only if it alone leads; 'ignored'. */
    passHandling: 'counted' | 'ignored';
  };
  seer: { result: 'wolfOrNot' | 'exactRole' }; // Q05
  guard: {
    canProtectSelf: boolean; // Q01
    noRepeatTarget: boolean; // Q02
    passResetsRepeat: boolean; // Q02
  };
  protection: {
    guardBlocksPoison: boolean; // Q04
    doubleProtectionKills: boolean; // Q04
  };
  day: {
    selfVote: boolean; // Q01
    accusedVotesOnConfirm: boolean; // Q10 (not covered by the approvals)
    /** Q22: at close, publish who voted for what (true) or only the totals (false). Interim results are hidden (approved). */
    revealBallotsAtClose: boolean;
    /** Q22: mid-vote, may players see WHO has voted (not what)? */
    showWhoVoted: boolean;
  };
  moderator: {
    mayBreakRules: boolean; // Q16
    /** Q16: moderator may submit actions on behalf of seats. */
    canActForSeats: boolean;
    /** Q16: moderator may set the pack target (wolf.decide). */
    canSetWolfTarget: boolean;
    /** Q16/Q22: moderator sees live ballots mid-vote. */
    seesLiveBallots: boolean;
    /** Q16/Q25: moderator may speak in public (listening to every channel is approved). */
    speaksInPublic: boolean;
  };
  /** Q26: may the system/host remove a seat during a secret (night) step? Moderator always may. */
  removal: { systemDuringSecret: boolean };
  /** Seconds. Q11/Q19. Night total (60) and defense (30) are approved constants above. */
  timing: {
    /** Q11: main night step; the Witch step gets NIGHT_TOTAL_SECONDS - nightMain. Must be 1..59. */
    nightMain: number;
    discussionBase: number;
    discussionPerAlive: number;
    discussionMin: number;
    discussionMax: number;
    vote: number;
    confirm: number;
    hunter: number;
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
  wolves: { canTargetWolf: false, mayPass: true, passHandling: 'counted' },
  seer: { result: 'wolfOrNot' },
  guard: { canProtectSelf: true, noRepeatTarget: true, passResetsRepeat: true },
  protection: { guardBlocksPoison: false, doubleProtectionKills: false },
  day: { selfVote: false, accusedVotesOnConfirm: true, revealBallotsAtClose: true, showWhoVoted: false },
  moderator: { mayBreakRules: false, canActForSeats: true, canSetWolfTarget: true, seesLiveBallots: true, speaksInPublic: true },
  removal: { systemDuringSecret: false },
  timing: {
    nightMain: 40,
    discussionBase: 60,
    discussionPerAlive: 15,
    discussionMin: 90,
    discussionMax: 240,
    vote: 30,
    confirm: 15,
    hunter: 20,
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
  'wolves.canTargetWolf': 'Q01',
  'wolves.mayPass': 'Q08',
  'wolves.passHandling': 'Q08',
  'seer.result': 'Q05',
  'guard.canProtectSelf': 'Q01',
  'guard.noRepeatTarget': 'Q02',
  'guard.passResetsRepeat': 'Q02',
  'protection.guardBlocksPoison': 'Q04',
  'protection.doubleProtectionKills': 'Q04',
  'day.selfVote': 'Q01',
  'day.accusedVotesOnConfirm': 'Q10',
  'day.revealBallotsAtClose': 'Q22',
  'day.showWhoVoted': 'Q22',
  'moderator.mayBreakRules': 'Q16',
  'moderator.canActForSeats': 'Q16',
  'moderator.canSetWolfTarget': 'Q16',
  'moderator.seesLiveBallots': 'Q16',
  'moderator.speaksInPublic': 'Q16/Q25',
  'removal.systemDuringSecret': 'Q26',
  'timing.nightMain': 'Q11-split',
  'timing.discussionBase': 'Q19',
  'timing.discussionPerAlive': 'Q19',
  'timing.discussionMin': 'Q19',
  'timing.discussionMax': 'Q19',
  'timing.vote': 'Q19',
  'timing.confirm': 'Q19',
  'timing.hunter': 'Q19',
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
