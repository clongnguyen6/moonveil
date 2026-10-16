// Core types. All state is plain JSON (arrays indexed by seat, no Maps) so it can be persisted and replayed.
import type { RulesConfig } from './config.ts';

export type Seat = number;
export const ROLES = ['wolf', 'villager', 'seer', 'guard', 'witch', 'hunter'] as const;
export type Role = (typeof ROLES)[number];
export type Faction = 'wolves' | 'village';
export const factionOf = (r: Role): Faction => (r === 'wolf' ? 'wolves' : 'village');

export type Pass = 'pass';
export type Pick = Seat | Pass;
export type DeathCause = 'bite' | 'poison' | 'executed' | 'shot' | 'removed';

export interface SeatState {
  seat: Seat;
  role: Role;
  alive: boolean;
  death: { cause: DeathCause; night: number; day: number } | null;
  /** Witch potions remaining. Ignored for other roles. */
  heal: boolean;
  poison: boolean;
  /** Guard's protected target last night (null = none / reset). */
  guardLast: Seat | null;
}

/** Secret inputs of the current night. Arrays indexed by seat; null = not submitted. */
export interface NightRecord {
  night: number;
  wolfPicks: (Pick | null)[];
  /** Moderator-set pack decision; overrides picks. */
  wolfDecision: Pick | null;
  inspections: (Seat | null)[];
  guards: (Pick | null)[];
  heals: (boolean | null)[];
  poisons: (Pick | null)[];
  /** Pack victim, fixed when night.main closes. */
  victim: Seat | null;
  /** Seats whose action was entered by the moderator. */
  byModerator: Seat[];
}

/** Where to go after a batch of deaths resolves. */
export type Continuation = { to: 'day' } | { to: 'night' } | { to: 'resume'; step: Step };

export type Step =
  | { kind: 'night.main'; night: number }
  | { kind: 'night.witch'; night: number }
  | { kind: 'hunter'; pending: Seat[]; shots: (Pick | null)[]; then: Continuation }
  | { kind: 'day.discussion'; day: number }
  | { kind: 'day.vote'; day: number; votes: (Seat | 'skip' | null)[] }
  | { kind: 'day.defense'; day: number; accused: Seat }
  | { kind: 'day.confirm'; day: number; accused: Seat; votes: ('yes' | 'no' | null)[] }
  | { kind: 'ended' };
export type StepKind = Step['kind'];

export type Winner = 'wolves' | 'village' | 'draw' | 'aborted';
export interface Outcome {
  winner: Winner;
  reason: 'noWolves' | 'parity' | 'zeroSurvivors' | 'aborted';
}

/** Private knowledge, granted only to living seats; ghosts keep what they had. */
export type Fact =
  | { k: 'role'; seat: Seat; role: Role }
  | { k: 'inspect'; night: number; target: Seat; result: 'wolf' | 'notWolf' | Role }
  | { k: 'victim'; night: number; target: Seat | null }
  | { k: 'packTarget'; night: number; target: Seat | null }
  | { k: 'own'; night: number; act: 'protect' | 'heal' | 'poison'; target: Seat | null };

export type PublicEvent =
  | { t: 'nightStart'; night: number }
  | { t: 'dawn'; night: number; dead: Seat[]; causes: DeathCause[] | null }
  | { t: 'roleRevealed'; seat: Seat; role: Role }
  | { t: 'dayStart'; day: number }
  | { t: 'nomination'; day: number; accused: Seat | null; tally: { target: Seat | 'skip'; count: number }[]; votes: (Seat | 'skip' | null)[] }
  /** counted: 'votes' = in-app Yes/No ballots (open); 'moderator' = Yes count entered by the moderator (show of hands; no/votes null). */
  | { t: 'confirm'; day: number; accused: Seat; counted: 'votes' | 'moderator'; yes: number; no: number | null; votes: ('yes' | 'no' | null)[] | null; executed: boolean }
  | { t: 'executed'; day: number; seat: Seat }
  | { t: 'hunterTurn'; seats: Seat[] }
  | { t: 'shot'; by: Seat; target: Seat | null }
  | { t: 'removed'; seat: Seat }
  | { t: 'ended'; outcome: Outcome };

/** Full secret record, for the moderator and end-of-match reveal. */
export type HistoryEntry =
  | { t: 'night'; night: number; record: NightRecord; deaths: { seat: Seat; cause: DeathCause }[] }
  | { t: 'seerResult'; night: number; seat: Seat; target: Seat; result: 'wolf' | 'notWolf' | Role }
  | { t: 'moderator'; command: Command };

export interface MatchState {
  v: 1;
  config: RulesConfig;
  seats: SeatState[];
  rng: number;
  night: number;
  day: number;
  step: Step;
  /** Increments on every new step instance (not on resume after removal). Hosts key phase clocks on it. */
  stepSeq: number;
  nightRec: NightRecord | null;
  publicLog: PublicEvent[];
  knowledge: Fact[][];
  history: HistoryEntry[];
  outcome: Outcome | null;
}

export type Actor = { kind: 'seat'; seat: Seat } | { kind: 'moderator' } | { kind: 'system' };

export type Command =
  | { type: 'wolf.pick'; seat: Seat; target: Pick }
  | { type: 'wolf.decide'; target: Pick }
  | { type: 'seer.inspect'; seat: Seat; target: Seat }
  | { type: 'guard.protect'; seat: Seat; target: Pick }
  | { type: 'witch.heal'; seat: Seat; use: boolean }
  | { type: 'witch.poison'; seat: Seat; target: Pick }
  | { type: 'vote.nominate'; seat: Seat; target: Seat | 'skip' | null }
  | { type: 'vote.confirm'; seat: Seat; choice: 'yes' | 'no' | null }
  | { type: 'hunter.shoot'; seat: Seat; target: Pick }
  | { type: 'step.close' }
  /** APPROVED Q16 (2026-10-16): moderator enters the Yes count of a show of hands; engine applies Yes*2 > living. */
  | { type: 'day.confirmCount'; yes: number }
  | { type: 'player.remove'; seat: Seat }
  | { type: 'match.abort' };

export type ErrorCode =
  | 'forbidden' // actor may not issue this command
  | 'wrong_step' // command not valid in current step
  | 'bad_seat' // unknown seat / wrong role / dead actor
  | 'bad_target' // target unknown or dead
  | 'bad_value' // malformed or out-of-range value (e.g. a Yes count)
  | 'rule' // forbidden by a rule (self-target, repeat, potion used...)
  | 'locked' // already submitted and not changeable
  | 'ended';

export interface EngineError {
  code: ErrorCode;
  message: string;
}
export type ApplyResult = { ok: true; state: MatchState } | { ok: false; error: EngineError };
