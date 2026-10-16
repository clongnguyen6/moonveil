// Isolated rule policies. Each function owns one provisional decision (PROPOSAL.md Qxx) and is selected by config.
// Pure: no state mutation, no IO.
import type { DeckCounts, RulesConfig } from './config.ts';
import { nextInt } from './rng.ts';
import type { DeathCause, MatchState, Outcome, Pick, Role, Seat, SeatState } from './types.ts';
import { ROLES } from './types.ts';

/** Q07: pack victim from living wolves' submitted picks (null = not submitted, excluded). */
export function resolveWolfTarget(
  picks: Pick[],
  livingWolves: number,
  rule: RulesConfig['wolves']['resolve'],
  rng: number,
): { target: Seat | null; rng: number } {
  if (picks.length === 0) return { target: null, rng };
  const asTarget = (p: Pick): Seat | null => (p === 'pass' ? null : p);
  if (rule === 'unanimous') {
    const first = picks[0] as Pick;
    const all = picks.length === livingWolves && picks.every((p) => p === first);
    return { target: all ? asTarget(first) : null, rng };
  }
  if (rule === 'random') {
    const r = nextInt(rng, picks.length);
    return { target: asTarget(picks[r.value] as Pick), rng: r.state };
  }
  // plurality; 'pass' is a candidate; tie broken by seeded random.
  const top = topCounts(picks);
  if (top.length === 1) return { target: asTarget(top[0] as Pick), rng };
  const r = nextInt(rng, top.length);
  return { target: asTarget(top[r.value] as Pick), rng: r.state };
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

/** Q09: nomination from cast votes. Tie at top (incl. with 'skip') -> nobody. */
export function tallyNomination(
  votes: (Seat | 'skip' | null)[],
  livingVoters: number,
  rule: RulesConfig['day']['nomination'],
): { accused: Seat | null; tally: { target: Seat | 'skip'; count: number }[] } {
  const cast = votes.filter((v): v is Seat | 'skip' => v !== null);
  const t = tally(cast);
  const first = t[0];
  if (!first || first.target === 'skip') return { accused: null, tally: t };
  if (t[1] && t[1].count === first.count) return { accused: null, tally: t };
  if (rule === 'majorityOfLiving' && first.count * 2 <= livingVoters) return { accused: null, tally: t };
  return { accused: first.target, tally: t };
}

/** Q10: Yes/No confirmation. Tie -> no execution. */
export function tallyConfirm(
  votes: ('yes' | 'no' | null)[],
  eligibleVoters: number,
  rule: RulesConfig['day']['confirm'],
): { yes: number; no: number; executed: boolean } {
  const yes = votes.filter((v) => v === 'yes').length;
  const no = votes.filter((v) => v === 'no').length;
  // F4: 'majorityOfCastWithQuorum' also needs at least half of eligible voters to vote Yes or No.
  const executed =
    rule === 'majorityOfLiving' ? yes * 2 > eligibleVoters : rule === 'majorityOfCast' ? yes > no : yes > no && (yes + no) * 2 >= eligibleVoters;
  return { yes, no, executed };
}

/** Approved: village wins when no wolves; wolves win at parity. Q14 decides zero survivors. */
export function evaluateVictory(seats: SeatState[], zeroSurvivors: RulesConfig['victory']['zeroSurvivors']): Outcome | null {
  const alive = seats.filter((s) => s.alive);
  const wolves = alive.filter((s) => s.role === 'wolf').length;
  const village = alive.length - wolves;
  if (alive.length === 0) {
    return { winner: zeroSurvivors, reason: 'zeroSurvivors' };
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

/** Q06: does a Hunter who died this way get an effect? */
export function hunterTriggers(cause: DeathCause, h: RulesConfig['hunter']): boolean {
  if (cause === 'removed') return h.shootsWhenRemoved;
  if (cause === 'poison') return h.shootsWhenPoisoned;
  return true;
}

/** Q17 */
export function defaultDeck(playerCount: number, config: RulesConfig): DeckCounts | null {
  const deck = config.distribution[String(playerCount)];
  return deck ? { ...deck } : null;
}

/** Q17/Q18: returns error message or null. */
export function validateDeck(deck: DeckCounts, playerCount: number, config: RulesConfig): string | null {
  if (playerCount < config.players.min || playerCount > config.players.max) {
    return `player count ${playerCount} outside ${config.players.min}-${config.players.max}`;
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
    if (deck[r] > config.limits.maxPerSpecialRole) return `too many ${r}`;
  }
  // F3: parity at the first dawn is reached if village - wolves <= deaths an ordinary first night can cause.
  const check = config.limits.firstDawnParityCheck;
  if (check !== 'off') {
    const deaths = (config.firstNightKill ? 1 : 0) + (check === 'biteAndPoison' ? deck.witch : 0);
    if (playerCount - 2 * deck.wolf <= deaths) return 'first night could force a wolf win (parity at first dawn)';
  }
  return null;
}

export type TimedStep = MatchState['step']['kind'];

/** Q11/Q19: step duration and whether the server may close it early. Night never closes early by default. */
export function stepTiming(state: MatchState): { seconds: number; earlyCloseReady: boolean } {
  const t = state.config.timing;
  const step = state.step;
  const alive = state.seats.filter((s) => s.alive);
  switch (step.kind) {
    case 'night.main':
    case 'night.witch':
      return {
        seconds: step.kind === 'night.main' ? t.nightMain : t.nightWitch,
        earlyCloseReady: t.nightEarlyClose && nightInputsComplete(state),
      };
    case 'day.discussion': {
      const raw = t.discussionBase + t.discussionPerAlive * alive.length;
      return { seconds: Math.min(t.discussionMax, Math.max(t.discussionMin, raw)), earlyCloseReady: false };
    }
    case 'day.vote':
      return { seconds: t.vote, earlyCloseReady: t.publicEarlyClose && alive.every((s) => step.votes[s.seat] !== null) };
    case 'day.defense':
      return { seconds: t.defense, earlyCloseReady: false };
    case 'day.confirm': {
      const eligible = alive.filter((s) => state.config.day.accusedVotesOnConfirm || s.seat !== step.accused);
      return { seconds: t.confirm, earlyCloseReady: t.publicEarlyClose && eligible.every((s) => step.votes[s.seat] !== null) };
    }
    case 'hunter':
      return { seconds: t.hunter, earlyCloseReady: step.pending.every((s) => step.shots[s] !== null) };
    case 'ended':
      return { seconds: 0, earlyCloseReady: false };
  }
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
        case 'hunter':
          return state.config.hunter.mode !== 'pinNightOnly' || rec.pins[s.seat] !== null;
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
