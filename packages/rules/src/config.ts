// Rules configuration. Every key here is PROVISIONAL (see docs/rules/PROPOSAL.md, Qxx) until Human approves it.
// Approved rules are fixed engine behaviour and are NOT here: six roles; Batch A table sizes/decks (7-15); victory (parity / no wolves / zero = draw);
// resolve-before-victory; Q03 Witch; Q06 Hunter; Q07 wolf plurality; Q09/Q10 nomination, 30 s defense, Yes/No with
// Yes*2 > living; Q11 night = fixed 60 s, never early; day votes run to their deadline; Batch B step durations;
// Q16 moderator Yes count; day votes are open ballots shown live (Q22); Q20 reveal rules; Q24 ghost knowledge; Q25 channel policy (except moderator speaking).
import { clone } from './clone.ts';
import type { Role } from './types.ts';

export type DeckCounts = Record<Role, number>;

/** APPROVED: total night length in seconds (main + Witch step), fixed regardless of roles or completion. */
export const NIGHT_TOTAL_SECONDS = 60;
/** APPROVED: defense length in seconds. */
export const DEFENSE_SECONDS = 30;

// APPROVED Batch B (2026-10-17), seconds. Night split B1; discussion B2; votes and Hunter B3; Hunter early close B4.
/** Main night step (Wolves, Seer, Guard); the Witch step gets NIGHT_TOTAL_SECONDS - this. */
export const NIGHT_MAIN_SECONDS = 40;
/** Discussion = DISCUSSION_BASE + DISCUSSION_PER_ALIVE x living players, clamped to [DISCUSSION_MIN, DISCUSSION_MAX]. */
export const DISCUSSION_BASE_SECONDS = 60;
export const DISCUSSION_PER_ALIVE_SECONDS = 15;
export const DISCUSSION_MIN_SECONDS = 90;
export const DISCUSSION_MAX_SECONDS = 240;
/** Nomination vote. */
export const VOTE_SECONDS = 30;
/** Yes/No vote. */
export const CONFIRM_SECONDS = 15;
/** Hunter turn; ends early once every pending Hunter has shot or held fire. */
export const HUNTER_SECONDS = 20;

/** APPROVED F1-A (2026-10-16): consecutive no-death full cycles that end the match as a stalemate draw (warning after one fewer). */
export const STALEMATE_CYCLES = 3;

/** APPROVED Batch A (2026-10-16): supported table sizes. */
export const PLAYERS_MIN = 7;
export const PLAYERS_MAX = 15;
/** APPROVED Batch A: custom decks may hold at most one of each special role. */
export const MAX_PER_SPECIAL_ROLE = 1;

const d = (wolf: number, seer: number, witch: number, guard: number, hunter: number, villager: number): DeckCounts => ({
  wolf, seer, witch, guard, hunter, villager,
});
/** APPROVED Batch A: default deck. 2 Wolves at 7-12, 3 at 13-15; one each of Seer, Witch, Guard, Hunter; rest Villagers. */
export const DEFAULT_DECKS: Readonly<Record<number, DeckCounts>> = Object.freeze(
  Object.fromEntries(
    Array.from({ length: PLAYERS_MAX - PLAYERS_MIN + 1 }, (_, i) => {
      const n = PLAYERS_MIN + i;
      const wolves = n <= 12 ? 2 : 3;
      return [n, d(wolves, 1, 1, 1, 1, n - wolves - 4)];
    }),
  ),
);

export interface RulesConfig {
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
}

export const DEFAULT_CONFIG: RulesConfig = {
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
};

/** Registry of provisional config paths -> proposal item. Tests assert every entry has a swap test. */
export const PROVISIONAL: Record<string, string> = {
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
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Allowed values for string-enum settings. */
export const ENUMS: Record<string, readonly string[]> = {
  'wolves.passHandling': ['counted', 'ignored'],
  'seer.result': ['wolfOrNot', 'exactRole'],
};

/**
 * Deep-merge overrides onto defaults.
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
    if (typeof def === 'object' && def !== null) {
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
