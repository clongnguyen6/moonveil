// Isolated rule policies: one decision per function. Approved ones are fixed; provisional ones are selected by config.
// Pure: no state mutation, no IO.
import {
  CONFIRM_SECONDS,
  DEFAULT_DECKS,
  DEFENSE_SECONDS,
  DISCUSSION_BASE_SECONDS,
  DISCUSSION_MAX_SECONDS,
  DISCUSSION_MIN_SECONDS,
  DISCUSSION_PER_ALIVE_SECONDS,
  type DeckCounts,
  HUNTER_SECONDS,
  MAX_PER_SPECIAL_ROLE,
  NIGHT_MAIN_SECONDS,
  NIGHT_TOTAL_SECONDS,
  PLAYERS_MAX,
  PLAYERS_MIN,
  type RulesConfig,
  VOTE_SECONDS,
} from './config.ts';
import { nextInt } from './rng.ts';
import type { DeathCause, MatchState, Outcome, Pick, Role, Seat, SeatState } from './types.ts';
import { ROLES } from './types.ts';

/**
 * APPROVED Q07 (2026-10-16): the target with the most living-wolf picks is chosen; ties are broken at random
 * (seeded) among the tied top targets. No picks -> no attack. How 'pass' picks count is provisional (Q08):
 * 'counted' = pass prevents the attack only if it alone has the most picks; 'ignored' = passes are dropped.
 */
export function resolveWolfTarget(
  picks: Pick[],
  passHandling: RulesConfig['wolves']['passHandling'],
  rng: number,
): { target: Seat | null; rng: number } {
  const counted = passHandling === 'ignored' ? picks.filter((p) => p !== 'pass') : picks;
  if (counted.length === 0) return { target: null, rng };
  const top = topCounts(counted);
  const seats = top.filter((p): p is Seat => p !== 'pass');
  if (seats.length === 0) return { target: null, rng }; // pass alone leads
  if (seats.length === 1) return { target: seats[0] as Seat, rng };
  const r = nextInt(rng, seats.length);
  return { target: seats[r.value] as Seat, rng: r.state };
}

function topCounts<T extends string | number>(items: T[]): T[] {
  const counts = tally(items);
  const max = Math.max(...counts.map((c) => c.count));
  return counts.filter((c) => c.count === max).map((c) => c.target);
}

/** Stable tally: ordered by count desc, then numeric seat asc, 'skip'/'pass' last. */
export function tally<T extends string | number>(items: T[]): { target: T; count: number }[] {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()]
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count || order(a.target) - order(b.target));
}
const order = (t: string | number) => (typeof t === 'number' ? t : Number.MAX_SAFE_INTEGER);

/**
 * APPROVED Q09/Q10 (2026-10-16): the single highest count goes on trial; no majority needed. 'skip' is a counted
 * option. No votes, a tie at the top (incl. with 'skip') or 'skip' leading -> no trial.
 */
export function tallyNomination(votes: (Seat | 'skip' | null)[]): { accused: Seat | null; tally: { target: Seat | 'skip'; count: number }[] } {
  const cast = votes.filter((v): v is Seat | 'skip' => v !== null);
  const t = tally(cast);
  const first = t[0];
  if (!first || first.target === 'skip') return { accused: null, tally: t };
  if (t[1] && t[1].count === first.count) return { accused: null, tally: t };
  return { accused: first.target, tally: t };
}

/**
 * APPROVED (Human, 2026-10-16): execution needs a strict majority of ALL living players: yes * 2 > livingCount.
 * Abstentions, non-votes and disconnected (still living) seats stay in the denominator. Not configurable.
 */
export function tallyConfirm(votes: ('yes' | 'no' | null)[], livingCount: number): { yes: number; no: number; executed: boolean } {
  const yes = votes.filter((v) => v === 'yes').length;
  const no = votes.filter((v) => v === 'no').length;
  return { yes, no, executed: yes * 2 > livingCount };
}

/** APPROVED: village wins when no wolves; wolves win at parity; zero survivors = draw (Q14, 2026-10-16). */
export function evaluateVictory(seats: SeatState[]): Outcome | null {
  const alive = seats.filter((s) => s.alive);
  const wolves = alive.filter((s) => s.role === 'wolf').length;
  const village = alive.length - wolves;
  if (alive.length === 0) {
    return { winner: 'draw', reason: 'zeroSurvivors' };
  }
  if (wolves === 0) return { winner: 'village', reason: 'noWolves' };
  if (wolves >= village) return { winner: 'wolves', reason: 'parity' };
  return null;
}

/** Q05 */
export function seerResult(role: Role, rule: RulesConfig['seer']['result']): 'wolf' | 'notWolf' | Role {
  if (rule === 'exactRole') return role;
  return role === 'wolf' ? 'wolf' : 'notWolf';
}

export interface NightInputs {
  victim: Seat | null;
  /** Seats protected by a living Guard. */
  guarded: Seat[];
  /** True if a living Witch used the heal tonight. */
  healed: boolean;
  /** Poison targets from living Witches. */
  poisoned: Seat[];
}

/** Q04: which seats die from the night (before Hunter effects). Sorted by seat. */
export function nightDeaths(inp: NightInputs, p: RulesConfig['protection']): { seat: Seat; cause: DeathCause }[] {
  const out = new Map<Seat, DeathCause>();
  if (inp.victim !== null) {
    const g = inp.guarded.includes(inp.victim);
    const saved = p.doubleProtectionKills && g && inp.healed ? false : g || inp.healed;
    if (!saved) out.set(inp.victim, 'bite');
  }
  for (const s of inp.poisoned) {
    if (p.guardBlocksPoison && inp.guarded.includes(s)) continue;
    if (!out.has(s)) out.set(s, 'poison');
  }
  return [...out.entries()].map(([seat, cause]) => ({ seat, cause })).sort((a, b) => a.seat - b.seat);
}

/** APPROVED Q06 (2026-10-16): any gameplay death (bite, poison, execution, shot) gives a shot; administrative removal does not. */
export function hunterTriggers(cause: DeathCause): boolean {
  return cause !== 'removed';
}

/** APPROVED Batch A: the default deck for a supported table size, else null. */
export function defaultDeck(playerCount: number): DeckCounts | null {
  const deck = DEFAULT_DECKS[playerCount];
  return deck ? { ...deck } : null;
}

/**
 * APPROVED Batch A (2026-10-16): 7-15 players; at most one of each special role; at least one Wolf, fewer Wolves
 * than Village; and no setup the Wolves could win on the first night (one bite plus every Witch poison).
 * `config.firstNightKill` (provisional Q23) decides whether night 1 has a bite. Returns an error message or null.
 */
export function validateDeck(deck: DeckCounts, playerCount: number, config: RulesConfig): string | null {
  if (!Number.isInteger(playerCount) || playerCount < PLAYERS_MIN || playerCount > PLAYERS_MAX) {
    return `player count ${playerCount} outside ${PLAYERS_MIN}-${PLAYERS_MAX}`;
  }
  let total = 0;
  for (const r of ROLES) {
    const n = deck[r];
    if (!Number.isInteger(n) || n < 0) return `bad count for ${r}`;
    total += n;
  }
  if (total !== playerCount) return `deck has ${total} roles for ${playerCount} players`;
  if (deck.wolf < 1) return 'need at least one wolf';
  if (deck.wolf >= playerCount - deck.wolf) return 'wolves must be fewer than village';
  for (const r of ['seer', 'guard', 'witch', 'hunter'] as const) {
    if (deck[r] > MAX_PER_SPECIAL_ROLE) return `too many ${r}`;
  }
  // Parity at the first dawn is reached if village - wolves <= deaths an ordinary first night can cause.
  const deaths = (config.firstNightKill ? 1 : 0) + deck.witch;
  if (playerCount - 2 * deck.wolf <= deaths) return 'first night could force a wolf win (parity at first dawn)';
  return null;
}

export type TimedStep = MatchState['step']['kind'];

/**
 * Step duration for the automatic orchestrator, and whether the server may close early. All APPROVED, not config:
 * night = NIGHT_TOTAL_SECONDS (main + Witch), never early; votes run to their deadline; defense = DEFENSE_SECONDS;
 * Batch B (2026-10-17) durations; the Hunter step may close once every pending Hunter has shot or held fire.
 */
export function stepTiming(state: MatchState): { seconds: number; earlyCloseReady: boolean } {
  const step = state.step;
  switch (step.kind) {
    case 'night.main':
      return { seconds: NIGHT_MAIN_SECONDS, earlyCloseReady: false };
    case 'night.witch':
      return { seconds: NIGHT_TOTAL_SECONDS - NIGHT_MAIN_SECONDS, earlyCloseReady: false };
    case 'day.discussion':
      return { seconds: discussionSeconds(state.seats.filter((s) => s.alive).length), earlyCloseReady: false };
    case 'day.vote':
      return { seconds: VOTE_SECONDS, earlyCloseReady: false };
    case 'day.defense':
      return { seconds: DEFENSE_SECONDS, earlyCloseReady: false };
    case 'day.confirm':
      return { seconds: CONFIRM_SECONDS, earlyCloseReady: false };
    case 'hunter':
      return { seconds: HUNTER_SECONDS, earlyCloseReady: step.pending.every((s) => step.shots[s] !== null) };
    case 'ended':
      return { seconds: 0, earlyCloseReady: false };
  }
}

/** APPROVED B2: 60 s + 15 s per living player, clamped to 90..240 s. */
export function discussionSeconds(living: number): number {
  const raw = DISCUSSION_BASE_SECONDS + DISCUSSION_PER_ALIVE_SECONDS * living;
  return Math.min(DISCUSSION_MAX_SECONDS, Math.max(DISCUSSION_MIN_SECONDS, raw));
}

/** True when every living night actor has submitted for the current night step. */
export function nightInputsComplete(state: MatchState): boolean {
  const rec = state.nightRec;
  if (!rec) return false;
  const alive = state.seats.filter((s) => s.alive);
  if (state.step.kind === 'night.main') {
    return alive.every((s) => {
      switch (s.role) {
        case 'wolf':
          return rec.wolfDecision !== null || rec.wolfPicks[s.seat] !== null || (!state.config.firstNightKill && rec.night === 1);
        case 'seer':
          return rec.inspections[s.seat] !== null;
        case 'guard':
          return rec.guards[s.seat] !== null;
        default:
          return true;
      }
    });
  }
  if (state.step.kind === 'night.witch') {
    return alive.every(
      (s) => s.role !== 'witch' || ((!s.heal || rec.heals[s.seat] !== null) && (!s.poison || rec.poisons[s.seat] !== null)),
    );
  }
  return false;
}
