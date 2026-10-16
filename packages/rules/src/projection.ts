// Per-viewer projection. The ONLY sanctioned way to expose state outside the server.
// Rule: a seat sees public info + its own knowledge ledger + live secrets it is entitled to while alive.
import { apply } from './engine.ts';
import type { Command, DeathCause, Fact, HistoryEntry, MatchState, NightRecord, Outcome, Pick, PublicEvent, Role, Seat, SeatState } from './types.ts';
import type { RulesConfig } from './config.ts';

export type Viewer = { kind: 'seat'; seat: Seat } | { kind: 'moderator' } | { kind: 'public' };

export interface SeatView {
  seat: Seat;
  alive: boolean;
  /** Known role, or null if the viewer is not entitled to it. */
  role: Role | null;
  /** Public death cause; bite/poison/pin are shown as 'night' unless config.reveal.causeAtDawn. */
  death: { cause: DeathCause | 'night'; night: number; day: number } | null;
}

export type StepView =
  | { kind: 'night.main' | 'night.witch'; night: number }
  | { kind: 'hunter'; pending: Seat[]; submitted: Seat[] }
  | { kind: 'day.discussion'; day: number }
  | { kind: 'day.vote'; day: number; votes: (Seat | 'skip' | null)[] | null; voted: boolean[] }
  | { kind: 'day.defense'; day: number; accused: Seat }
  | { kind: 'day.confirm'; day: number; accused: Seat; votes: ('yes' | 'no' | null)[] | null; voted: boolean[] }
  | { kind: 'ended' };

export type AvailableAction =
  | { type: 'wolf.pick'; targets: Seat[]; canPass: boolean; current: Pick | null }
  | { type: 'seer.inspect'; targets: Seat[] }
  | { type: 'guard.protect'; targets: Seat[]; current: Pick | null }
  | { type: 'hunter.pin'; targets: Seat[]; current: Pick | null }
  | { type: 'witch.heal'; canUse: boolean; current: boolean | null }
  | { type: 'witch.poison'; targets: Seat[]; current: Pick | null }
  | { type: 'vote.nominate'; targets: Seat[]; current: Seat | 'skip' | null }
  | { type: 'vote.confirm'; current: 'yes' | 'no' | null }
  | { type: 'hunter.shoot'; targets: Seat[]; current: Pick | null };

export interface MeView {
  seat: Seat;
  role: Role;
  alive: boolean;
  /** Everything this seat legitimately learned (frozen at death). */
  facts: Fact[];
  potions: { heal: boolean; poison: boolean } | null;
  guardLast: Seat | null;
  actions: AvailableAction[];
}

export interface PackView {
  seats: Seat[];
  /** Live picks of living wolves; only while viewer is a living wolf in night.main. */
  picks: (Pick | null)[] | null;
  decision: Pick | null;
}

export interface Projection {
  viewer: Viewer;
  playerCount: number;
  roleCounts: Record<Role, number>;
  night: number;
  day: number;
  step: StepView;
  seats: SeatView[];
  publicLog: PublicEvent[];
  me: MeView | null;
  pack: PackView | null;
  outcome: Outcome | null;
  /** End-of-match reveal (all viewers). */
  reveal: { roles: Role[]; history: HistoryEntry[] | null } | null;
  /** Moderator only: full secret state. */
  moderator: { seats: SeatState[]; nightRec: NightRecord | null; history: HistoryEntry[]; knowledge: Fact[][]; config: RulesConfig } | null;
}

export function project(state: MatchState, viewer: Viewer): Projection {
  const ended = state.step.kind === 'ended';
  const isMod = viewer.kind === 'moderator';
  const me = viewer.kind === 'seat' ? state.seats[viewer.seat] : undefined;
  if (viewer.kind === 'seat' && !me) throw new Error(`unknown seat ${viewer.seat}`);

  const known = new Map<Seat, Role>();
  for (const e of state.publicLog) if (e.t === 'roleRevealed') known.set(e.seat, e.role);
  if (me) for (const f of state.knowledge[me.seat] ?? []) if (f.k === 'role') known.set(f.seat, f.role);

  const roleCounts = { wolf: 0, villager: 0, seer: 0, guard: 0, witch: 0, hunter: 0 } as Record<Role, number>;
  for (const s of state.seats) roleCounts[s.role]++;

  const seats: SeatView[] = state.seats.map((s) => ({
    seat: s.seat,
    alive: s.alive,
    role: ended || isMod ? s.role : (known.get(s.seat) ?? null),
    death: s.death ? { ...s.death, cause: publicCause(s.death.cause, state, isMod || ended) } : null,
  }));

  return {
    viewer,
    playerCount: state.seats.length,
    roleCounts,
    night: state.night,
    day: state.day,
    step: stepView(state),
    seats,
    publicLog: structuredClone(state.publicLog),
    me: me ? meView(state, me) : null,
    pack: me && me.role === 'wolf' ? packView(state, me) : null,
    outcome: state.outcome,
    reveal: ended
      ? { roles: state.seats.map((s) => s.role), history: state.config.reveal.historyAtEnd ? structuredClone(state.history) : null }
      : null,
    moderator: isMod
      ? {
          seats: structuredClone(state.seats),
          nightRec: structuredClone(state.nightRec),
          history: structuredClone(state.history),
          knowledge: structuredClone(state.knowledge),
          config: state.config,
        }
      : null,
  };
}

function publicCause(c: DeathCause, state: MatchState, full: boolean): DeathCause | 'night' {
  if (full || state.config.reveal.causeAtDawn) return c;
  return c === 'bite' || c === 'poison' || c === 'pin' ? 'night' : c;
}

function stepView(state: MatchState): StepView {
  const s = state.step;
  const open = state.config.day.openVotes;
  switch (s.kind) {
    case 'night.main':
    case 'night.witch':
      return { kind: s.kind, night: s.night };
    case 'hunter':
      return { kind: 'hunter', pending: [...s.pending], submitted: s.pending.filter((p) => s.shots[p] !== null) };
    case 'day.discussion':
      return { kind: s.kind, day: s.day };
    case 'day.vote':
      return { kind: s.kind, day: s.day, votes: open ? [...s.votes] : null, voted: s.votes.map((v) => v !== null) };
    case 'day.defense':
      return { kind: s.kind, day: s.day, accused: s.accused };
    case 'day.confirm':
      return { kind: s.kind, day: s.day, accused: s.accused, votes: open ? [...s.votes] : null, voted: s.votes.map((v) => v !== null) };
    case 'ended':
      return { kind: 'ended' };
  }
}

function meView(state: MatchState, me: SeatState): MeView {
  return {
    seat: me.seat,
    role: me.role,
    alive: me.alive,
    facts: structuredClone(state.knowledge[me.seat] ?? []),
    potions: me.role === 'witch' ? { heal: me.heal, poison: me.poison } : null,
    guardLast: me.role === 'guard' ? me.guardLast : null,
    actions: availableActions(state, me),
  };
}

function packView(state: MatchState, me: SeatState): PackView {
  const seats = state.seats.filter((s) => s.role === 'wolf').map((s) => s.seat);
  const live = me.alive && state.step.kind === 'night.main' && state.nightRec;
  if (!live || !state.nightRec) return { seats, picks: null, decision: null };
  const rec = state.nightRec;
  return {
    seats,
    picks: state.seats.map((s) => (s.role === 'wolf' && s.alive ? (rec.wolfPicks[s.seat] ?? null) : null)),
    decision: rec.wolfDecision,
  };
}

/** Legal options for this seat now, computed by dry-running apply() so UI and engine never disagree. */
export function availableActions(state: MatchState, me: SeatState): AvailableAction[] {
  const step = state.step;
  const rec = state.nightRec;
  const light: MatchState = { ...state, history: [], publicLog: [], knowledge: state.seats.map(() => []) };
  const actor = { kind: 'seat' as const, seat: me.seat };
  const ok = (cmd: Command) => apply(light, actor, cmd).ok;
  const targets = (mk: (t: Seat) => Command) => state.seats.filter((s) => ok(mk(s.seat))).map((s) => s.seat);
  const out: AvailableAction[] = [];

  if (step.kind === 'hunter' && step.pending.includes(me.seat)) {
    out.push({ type: 'hunter.shoot', targets: targets((t) => ({ type: 'hunter.shoot', seat: me.seat, target: t })), current: step.shots[me.seat] ?? null });
    return out;
  }
  if (!me.alive) return out;

  if (step.kind === 'night.main' && rec) {
    if (me.role === 'wolf') {
      const t = targets((x) => ({ type: 'wolf.pick', seat: me.seat, target: x }));
      const canPass = ok({ type: 'wolf.pick', seat: me.seat, target: 'pass' });
      if (t.length || canPass) out.push({ type: 'wolf.pick', targets: t, canPass, current: rec.wolfPicks[me.seat] ?? null });
    }
    if (me.role === 'seer' && rec.inspections[me.seat] === null) {
      out.push({ type: 'seer.inspect', targets: targets((x) => ({ type: 'seer.inspect', seat: me.seat, target: x })) });
    }
    if (me.role === 'guard') {
      out.push({ type: 'guard.protect', targets: targets((x) => ({ type: 'guard.protect', seat: me.seat, target: x })), current: rec.guards[me.seat] ?? null });
    }
    if (me.role === 'hunter' && state.config.hunter.mode === 'pinNightOnly') {
      out.push({ type: 'hunter.pin', targets: targets((x) => ({ type: 'hunter.pin', seat: me.seat, target: x })), current: rec.pins[me.seat] ?? null });
    }
  }
  if (step.kind === 'night.witch' && rec && me.role === 'witch') {
    if (me.heal) {
      out.push({ type: 'witch.heal', canUse: ok({ type: 'witch.heal', seat: me.seat, use: true }), current: rec.heals[me.seat] ?? null });
    }
    if (me.poison) {
      out.push({ type: 'witch.poison', targets: targets((x) => ({ type: 'witch.poison', seat: me.seat, target: x })), current: rec.poisons[me.seat] ?? null });
    }
  }
  if (step.kind === 'day.vote') {
    out.push({ type: 'vote.nominate', targets: targets((x) => ({ type: 'vote.nominate', seat: me.seat, target: x })), current: step.votes[me.seat] ?? null });
  }
  if (step.kind === 'day.confirm' && ok({ type: 'vote.confirm', seat: me.seat, choice: 'yes' })) {
    out.push({ type: 'vote.confirm', current: step.votes[me.seat] ?? null });
  }
  return out;
}

