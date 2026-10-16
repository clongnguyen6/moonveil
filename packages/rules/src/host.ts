// Host contract for the server (adopted from foundation's draft apps/server/src/rules/engine.ts, with additions).
// Seats inside the game are indices 0..n-1; `view().seatIds[i]` maps index -> server SeatId.
import { type ChannelGrant, channelsFor } from './channels.ts';
import { type DeepPartial, type DeckCounts, type RulesConfig, resolveConfig } from './config.ts';
import { apply, createMatch, isSecretStep } from './engine.ts';
import { stepTiming } from './policies.ts';
import { deadlineOf, isExpired, type PhaseClock, pauseClock, remainingMs, resumeClock, startClock } from './clock.ts';
import { type Projection, project } from './projection.ts';
import type { Actor, Command, MatchState, Seat } from './types.ts';

export type SeatId = string;
export type HostViewer = { kind: 'seat'; seat: SeatId } | { kind: 'moderator' } | { kind: 'public' };

export interface PhaseInfo {
  /** Step kind, e.g. 'night.main', 'day.vote'. */
  name: string;
  /** Hidden actions happen; server freezes presence and never closes early. */
  secret: boolean;
  durationMs: number;
  /** Public steps only: everyone eligible has acted; server MAY close now. Always false when secret. */
  earlyClose: boolean;
  ended: boolean;
}

export type HostResult<S> = { ok: true; state: S } | { ok: false; error: string; code: string };

export interface HostState {
  seatIds: SeatId[];
  match: MatchState;
  /** Automatic-mode phase clock (null until the first sync, and after the match ends). */
  clock: PhaseClock | null;
}

export interface TimerInfo {
  durationMs: number;
  remainingMs: number;
  /** Absolute ms when the phase closes; null while paused (or no clock). */
  deadline: number | null;
  paused: boolean;
}

export type HostView = Projection & { seatIds: SeatId[] };

export interface RulesEngine<S> {
  readonly id: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  setup(input: { seats: readonly SeatId[]; seed: string }): S;
  phase(state: S): PhaseInfo;
  /** Player action. `action` is a Command without `seat` (the server supplies the actor). */
  submit(state: S, seat: SeatId, action: unknown): HostResult<S>;
  /** ADDED: moderator command (any Command incl. acting for a seat, wolf.decide, day.confirmCount, player.remove, match.abort, step.close). */
  moderate(state: S, action: unknown): HostResult<S>;
  /** ADDED: system removal (host/server policy, e.g. long disconnect). Rejected during secret steps by default (Q26). */
  remove(state: S, seat: SeatId): HostResult<S>;
  /** Close the current step (moderator, or the server's early close). In automatic mode use tick() for expiry. */
  advance(state: S): S;
  /** ADDED (automatic mode). After ANY change, call sync(now): starts a full clock when the step changed. */
  sync(state: S, now: number): S;
  /** ADDED. Closes the step only if its clock is running and expired, then starts the next clock. Paused never expires. */
  tick(state: S, now: number): S;
  /** ADDED. Freeze remaining time (server: all player seats disconnected). Idempotent. */
  pause(state: S, now: number): S;
  /** ADDED. Continue with exactly the remaining time frozen at pause (server: any player reconnected). Idempotent. */
  resume(state: S, now: number): S;
  /** ADDED. Current timer for phaseEndsAt / UI. */
  timer(state: S, now: number): TimerInfo | null;
  /** The ONLY game data for a client. CHANGED: viewer may also be 'public'. */
  view(state: S, viewer: HostViewer): HostView;
  /** CHANGED: accepts a SeatId (as drafted) or a viewer (moderator). Grants apply to voice and text alike. */
  channels(state: S, who: SeatId | HostViewer): ChannelGrant[];
}

export interface HostOptions {
  config?: DeepPartial<RulesConfig>;
  /** Host-customized deck (Q17); default from config.distribution. */
  deck?: (playerCount: number) => DeckCounts | undefined;
}

export function createRulesEngine(opts: HostOptions = {}): RulesEngine<HostState> {
  const config = resolveConfig(opts.config);
  const index = (s: HostState, id: SeatId): Seat => {
    const i = s.seatIds.indexOf(id);
    if (i < 0) throw new Error(`unknown seat ${id}`);
    return i;
  };
  const run = (s: HostState, actor: Actor, cmd: Command | null): HostResult<HostState> => {
    if (!cmd) return { ok: false, code: 'bad_action', error: 'malformed action' };
    const r = apply(s.match, actor, cmd);
    return r.ok ? { ok: true, state: { ...s, match: r.state } } : { ok: false, code: r.error.code, error: r.error.message };
  };
  const eng: RulesEngine<HostState> = {
    id: 'moonveil-werewolf',
    minPlayers: config.players.min,
    maxPlayers: config.players.max,
    setup({ seats, seed }) {
      const r = createMatch({ seed, playerCount: seats.length, config: opts.config, deck: opts.deck?.(seats.length) });
      if (!r.ok) throw new Error(r.error.message);
      return { seatIds: [...seats], match: r.state, clock: null };
    },
    phase(s) {
      const t = stepTiming(s.match);
      const secret = isSecretStep(s.match);
      return { name: s.match.step.kind, secret, durationMs: t.seconds * 1000, earlyClose: !secret && t.earlyCloseReady, ended: s.match.step.kind === 'ended' };
    },
    submit(s, seat, action) {
      if (!s.seatIds.includes(seat)) return { ok: false, code: 'forbidden', error: 'not a player' };
      const i = index(s, seat);
      const withSeat = isRecord(action) ? { ...action, seat: i } : null;
      return run(s, { kind: 'seat', seat: i }, parseCommand(withSeat, s.seatIds.length));
    },
    moderate(s, action) {
      return run(s, { kind: 'moderator' }, parseCommand(action, s.seatIds.length));
    },
    remove(s, seat) {
      if (!s.seatIds.includes(seat)) return { ok: false, code: 'bad_seat', error: 'unknown seat' };
      return run(s, { kind: 'system' }, { type: 'player.remove', seat: index(s, seat) });
    },
    advance(s) {
      const r = apply(s.match, { kind: 'system' }, { type: 'step.close' });
      return r.ok ? { ...s, match: r.state } : s;
    },
    sync(s, now) {
      if (s.match.step.kind === 'ended') return s.clock === null ? s : { ...s, clock: null };
      if (s.clock && s.clock.stepSeq === s.match.stepSeq) return s;
      // A new phase inherits the paused state (e.g. a step changed while every player was disconnected).
      return { ...s, clock: startClock(s.match, now, s.clock !== null && s.clock.runningSince === null) };
    },
    tick(s, now) {
      const t = eng.sync(s, now);
      if (!t.clock || !isExpired(t.clock, now)) return t;
      return eng.sync(eng.advance(t), now);
    },
    pause(s, now) {
      const t = eng.sync(s, now);
      return t.clock ? { ...t, clock: pauseClock(t.clock, now) } : t;
    },
    resume(s, now) {
      const t = eng.sync(s, now);
      return t.clock ? { ...t, clock: resumeClock(t.clock, now) } : t;
    },
    timer(s, now) {
      const c = s.clock;
      if (!c || c.stepSeq !== s.match.stepSeq) return null;
      return { durationMs: c.durationMs, remainingMs: remainingMs(c, now), deadline: deadlineOf(c), paused: c.runningSince === null };
    },
    view(s, viewer) {
      const v = viewer.kind === 'seat' ? { kind: 'seat' as const, seat: index(s, viewer.seat) } : viewer;
      return { ...project(s.match, v), seatIds: [...s.seatIds] };
    },
    channels(s, who) {
      if (typeof who === 'string') return channelsFor(s.match, { kind: 'seat', seat: index(s, who) });
      if (who.kind === 'moderator') return channelsFor(s.match, who);
      if (who.kind === 'seat') return channelsFor(s.match, { kind: 'seat', seat: index(s, who.seat) });
      return channelsFor(s.match, { kind: 'moderator' }).filter((g) => g.channel === 'public').map((g) => ({ ...g, speak: false }));
    },
  };
  return eng;
}

// ---------- untrusted input parsing ----------

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Strictly parse an untrusted command. Seats are indices 0..n-1. Returns null if malformed. */
export function parseCommand(input: unknown, n: number): Command | null {
  if (!isRecord(input) || typeof input.type !== 'string') return null;
  const seat = (v: unknown): v is Seat => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  const pick = (v: unknown) => v === 'pass' || seat(v);
  const keys = (...k: string[]) => Object.keys(input).every((x) => x === 'type' || k.includes(x));
  const x = input as Record<string, unknown>;
  switch (input.type) {
    case 'wolf.pick':
    case 'guard.protect':
    case 'witch.poison':
    case 'hunter.shoot':
      return keys('seat', 'target') && seat(x.seat) && pick(x.target) ? (input as unknown as Command) : null;
    case 'seer.inspect':
      return keys('seat', 'target') && seat(x.seat) && seat(x.target) ? (input as unknown as Command) : null;
    case 'witch.heal':
      return keys('seat', 'use') && seat(x.seat) && typeof x.use === 'boolean' ? (input as unknown as Command) : null;
    case 'vote.nominate':
      return keys('seat', 'target') && seat(x.seat) && (x.target === null || x.target === 'skip' || seat(x.target)) ? (input as unknown as Command) : null;
    case 'vote.confirm':
      return keys('seat', 'choice') && seat(x.seat) && (x.choice === null || x.choice === 'yes' || x.choice === 'no') ? (input as unknown as Command) : null;
    case 'wolf.decide':
      return keys('target') && pick(x.target) ? (input as unknown as Command) : null;
    case 'day.confirmCount':
      // Shape only; the engine validates integer range against the living count at apply time.
      return keys('yes') && typeof x.yes === 'number' ? (input as unknown as Command) : null;
    case 'player.remove':
      return keys('seat') && seat(x.seat) ? (input as unknown as Command) : null;
    case 'match.abort':
    case 'step.close':
      return keys() ? (input as unknown as Command) : null;
    default:
      return null;
  }
}
