// Rules configuration. Every key here is PROVISIONAL (see docs/rules/PROPOSAL.md, Qxx) until Human approves it.
// Approved rules are fixed engine behaviour and are NOT here: six roles; victory (parity / no wolves / zero = draw);
// resolve-before-victory; Q03 Witch; Q06 Hunter; Q07 wolf plurality; Q09/Q10 nomination, 30 s defense, Yes/No with
// Yes*2 > living; Q11 night = fixed 60 s, never early; day votes run to deadline with hidden interim results;
// Q16 moderator Yes count; day votes are open ballots shown live (Q22); Q20 reveal rules; Q24 ghost knowledge; Q25 channel policy (except moderator speaking).
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
  };
  moderator: {
    mayBreakRules: boolean; // Q16
    /** Q16: moderator may submit actions on behalf of seats. */
    canActForSeats: boolean;
    /** Q16: moderator may set the pack target (wolf.decide). */
    canSetWolfTarget: boolean;
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
  day: { selfVote: false, accusedVotesOnConfirm: true },
  // speaksInPublic=false: approved Q25 grants the moderator listening only; speech is not approved.
  moderator: { mayBreakRules: false, canActForSeats: true, canSetWolfTarget: true, speaksInPublic: false },
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
  'moderator.mayBreakRules': 'Q16',
  'moderator.canActForSeats': 'Q16',
  'moderator.canSetWolfTarget': 'Q16',
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

/** Allowed values for string-enum settings. */
export const ENUMS: Record<string, readonly string[]> = {
  'limits.firstDawnParityCheck': ['biteAndPoison', 'biteOnly', 'off'],
  'wolves.passHandling': ['counted', 'ignored'],
  'seer.result': ['wolfOrNot', 'exactRole'],
};

/**
 * Deep-merge overrides onto defaults. `distribution` is replaced wholesale when given.
 * STRICT: unknown keys (including removed settings, e.g. the old comms.* keys), wrong types and invalid enum values
 * throw, so approved behaviour cannot be configured away by a stale or mistyped option.
 */
export function resolveConfig(overrides: DeepPartial<RulesConfig> = {}): RulesConfig {
  const out = clone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
  const defaults = DEFAULT_CONFIG as unknown as Record<string, unknown>;
  const bad = (msg: string) => {
    throw new Error(`invalid rules config: ${msg}`);
  };
  for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (!(k in defaults)) bad(`unknown setting '${k}'`);
    const def = defaults[k];
    if (k === 'distribution') {
      if (typeof v !== 'object' || v === null) bad(`'distribution' must be an object`);
      out[k] = clone(v);
    } else if (typeof def === 'object' && def !== null) {
      if (typeof v !== 'object' || v === null) bad(`'${k}' must be an object`);
      for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
        if (sv === undefined) continue;
        const path = `${k}.${sk}`;
        const sdef = (def as Record<string, unknown>)[sk];
        if (!(sk in (def as object))) bad(`unknown setting '${path}'`);
        if (typeof sv !== typeof sdef) bad(`'${path}' must be ${typeof sdef}`);
        if (ENUMS[path] && !ENUMS[path].includes(sv as string)) bad(`'${path}' must be one of ${ENUMS[path].join(', ')}`);
        if (typeof sv === 'number' && !Number.isFinite(sv)) bad(`'${path}' must be finite`);
      }
      out[k] = { ...(out[k] as object), ...clone(v) };
    } else {
      if (typeof v !== typeof def) bad(`'${k}' must be ${typeof def}`);
      out[k] = clone(v);
    }
  }
  return out as unknown as RulesConfig;
}
