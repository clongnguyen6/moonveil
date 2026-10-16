// Engine: createMatch + apply. Pure: apply clones the input state and returns a new one.
import { clone } from './clone.ts';
import { type DeckCounts, type DeepPartial, type RulesConfig, resolveConfig } from './config.ts';
import {
  defaultDeck,
  evaluateVictory,
  hunterTriggers,
  nightDeaths,
  resolveWolfTarget,
  seerResult,
  tallyConfirm,
  tallyNomination,
  validateDeck,
} from './policies.ts';
import { seedFrom, shuffle } from './rng.ts';
import {
  type Actor,
  type ApplyResult,
  type Command,
  type Continuation,
  type DeathCause,
  type EngineError,
  type ErrorCode,
  type Fact,
  type MatchState,
  type NightRecord,
  type Outcome,
  type Role,
  ROLES,
  type Seat,
} from './types.ts';

export interface CreateOptions {
  seed: string | number;
  /** Exact role per seat (moderator-assigned). Overrides playerCount/deck. */
  roles?: Role[];
  playerCount?: number;
  /** Custom deck counts (host customization, approved within limits). Default: DEFAULT_DECKS. */
  deck?: DeckCounts;
  config?: DeepPartial<RulesConfig>;
}

export type CreateResult = { ok: true; state: MatchState } | { ok: false; error: EngineError };

/** Creates a match. Every deck and table size is validated against the approved Batch A rules. */
export function createMatch(opts: CreateOptions): CreateResult {
  return build(opts, true);
}

/**
 * TEST-ONLY: same as createMatch but skips deck/table-size validation, for synthetic tables (e.g. 3 seats).
 * Deliberately not exported from index.ts, so hosts cannot bypass the approved rules.
 */
export function createMatchUnchecked(opts: CreateOptions): CreateResult {
  return build(opts, false);
}

function build(opts: CreateOptions, validate: boolean): CreateResult {
  let config: RulesConfig;
  try {
    config = resolveConfig(opts.config);
  } catch (e) {
    return fail('bad_value', (e as Error).message);
  }
  let rng = seedFrom(opts.seed);
  let roles: Role[];
  if (opts.roles) {
    roles = [...opts.roles];
    const deck = Object.fromEntries(ROLES.map((r) => [r, roles.filter((x) => x === r).length])) as DeckCounts;
    const bad = validate ? validateDeck(deck, roles.length, config) : null;
    if (bad) return fail('rule', bad);
  } else {
    const n = opts.playerCount ?? 0;
    const deck = opts.deck ?? defaultDeck(n);
    if (!deck) return fail('rule', `no default deck for ${n} players (supported: 7-15)`);
    const bad = validate ? validateDeck(deck, n, config) : null;
    if (bad) return fail('rule', bad);
    const list = ROLES.flatMap((r) => Array<Role>(deck[r]).fill(r));
    const sh = shuffle(list, rng);
    roles = sh.items;
    rng = sh.state;
  }
  const n = roles.length;
  const state: MatchState = {
    v: 1,
    config,
    seats: roles.map((role, seat) => ({ seat, role, alive: true, death: null, heal: true, poison: true, guardLast: null })),
    rng,
    night: 0,
    day: 0,
    step: { kind: 'night.main', night: 0 },
    stepSeq: 0,
    nightRec: null,
    publicLog: [],
    knowledge: roles.map(() => []),
    history: [],
    outcome: null,
  };
  const wolves = state.seats.filter((s) => s.role === 'wolf').map((s) => s.seat);
  for (let seat = 0; seat < n; seat++) {
    const role = roles[seat] as Role;
    grant(state, seat, { k: 'role', seat, role });
    if (role === 'wolf') for (const w of wolves) if (w !== seat) grant(state, seat, { k: 'role', seat: w, role: 'wolf' });
  }
  startNight(state);
  return { ok: true, state };
}

export function apply(input: MatchState, actor: Actor, cmd: Command): ApplyResult {
  if (input.step.kind === 'ended') return fail('ended', 'match has ended');
  const auth = authorize(actor, cmd, input.config);
  if (auth) return { ok: false, error: auth };
  const state = clone(input);
  const lax = actor.kind === 'moderator' && state.config.moderator.mayBreakRules;
  const e = handle(state, cmd, lax, false, actor.kind);
  if (e) return { ok: false, error: e };
  if (actor.kind === 'moderator') state.history.push({ t: 'moderator', command: cmd });
  if (actor.kind === 'moderator' && state.nightRec && 'seat' in cmd && cmd.type !== 'player.remove') {
    if (!state.nightRec.byModerator.includes(cmd.seat)) state.nightRec.byModerator.push(cmd.seat);
  }
  return { ok: true, state };
}

/** Validate without applying (no clone, no mutation). Used for menus; same rules as apply(). */
export function check(state: MatchState, actor: Actor, cmd: Command): EngineError | null {
  if (state.step.kind === 'ended') return err('ended', 'match has ended');
  const auth = authorize(actor, cmd, state.config);
  if (auth) return auth;
  return handle(state, cmd, actor.kind === 'moderator' && state.config.moderator.mayBreakRules, true, actor.kind);
}

// ---------- authorization ----------

const MOD_ONLY = new Set<Command['type']>(['wolf.decide', 'day.confirmCount']);
const MOD_OR_SYSTEM = new Set<Command['type']>(['step.close', 'player.remove', 'match.abort']);

function authorize(actor: Actor, cmd: Command, config: RulesConfig): EngineError | null {
  if (MOD_ONLY.has(cmd.type)) return actor.kind === 'moderator' ? null : err('forbidden', 'moderator only');
  if (MOD_OR_SYSTEM.has(cmd.type)) return actor.kind === 'seat' ? err('forbidden', 'not allowed for seats') : null;
  // Seat commands: own seat, or moderator acting for a seat (provisional Q16: moderator.canActForSeats).
  if (actor.kind === 'moderator') return config.moderator.canActForSeats ? null : err('forbidden', 'moderator may not act for seats');
  if (actor.kind === 'seat' && 'seat' in cmd && cmd.seat === actor.seat) return null;
  return err('forbidden', 'may only act for own seat');
}

// ---------- command handling ----------

function handle(state: MatchState, cmd: Command, lax: boolean, dry = false, actor: Actor['kind'] = 'system'): EngineError | null {
  const c = state.config;
  const rule = (msg: string) => (lax ? null : err('rule', msg));
  switch (cmd.type) {
    case 'wolf.pick': {
      const rec = nightStep(state, 'night.main');
      if (!rec) return err('wrong_step', 'not night');
      if (!isAliveRole(state, cmd.seat, 'wolf')) return err('bad_seat', 'not a living wolf');
      if (!c.firstNightKill && rec.night === 1) {
        const e = rule('no kill on night 1');
        if (e) return e;
      }
      if (cmd.target === 'pass') {
        if (!c.wolves.mayPass) {
          const e = rule('wolves may not pass');
          if (e) return e;
        }
      } else {
        if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
        if (roleOf(state, cmd.target) === 'wolf' && !c.wolves.canTargetWolf) {
          const e = rule('wolves may not target a wolf');
          if (e) return e;
        }
      }
      if (dry) return null;
      rec.wolfPicks[cmd.seat] = cmd.target;
      return null;
    }
    case 'wolf.decide': {
      if (!c.moderator.canSetWolfTarget) return err('forbidden', 'moderator may not set the wolf target');
      const rec = nightStep(state, 'night.main');
      if (!rec) return err('wrong_step', 'not night');
      if (cmd.target !== 'pass' && !isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
      if (cmd.target !== 'pass' && roleOf(state, cmd.target) === 'wolf' && !c.wolves.canTargetWolf) {
        const e = rule('wolves may not target a wolf');
        if (e) return e;
      }
      if (dry) return null;
      rec.wolfDecision = cmd.target;
      return null;
    }
    case 'seer.inspect': {
      const rec = nightStep(state, 'night.main');
      if (!rec) return err('wrong_step', 'not night');
      if (!isAliveRole(state, cmd.seat, 'seer')) return err('bad_seat', 'not a living seer');
      if (rec.inspections[cmd.seat] !== null) return err('locked', 'already inspected tonight');
      if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
      if (cmd.target === cmd.seat) {
        const e = rule('seer may not inspect self');
        if (e) return e;
      }
      if (dry) return null;
      rec.inspections[cmd.seat] = cmd.target;
      const result = seerResult(roleOf(state, cmd.target), c.seer.result);
      grant(state, cmd.seat, { k: 'inspect', night: rec.night, target: cmd.target, result });
      state.history.push({ t: 'seerResult', night: rec.night, seat: cmd.seat, target: cmd.target, result });
      return null;
    }
    case 'guard.protect': {
      const rec = nightStep(state, 'night.main');
      if (!rec) return err('wrong_step', 'not night');
      const g = state.seats[cmd.seat];
      if (!g || !isAliveRole(state, cmd.seat, 'guard')) return err('bad_seat', 'not a living guard');
      if (cmd.target !== 'pass') {
        if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
        if (cmd.target === cmd.seat && !c.guard.canProtectSelf) {
          const e = rule('guard may not protect self');
          if (e) return e;
        }
        if (c.guard.noRepeatTarget && g.guardLast === cmd.target) {
          const e = rule('guard may not protect the same player two nights in a row');
          if (e) return e;
        }
      }
      if (dry) return null;
      rec.guards[cmd.seat] = cmd.target;
      return null;
    }
    case 'witch.heal': {
      const rec = nightStep(state, 'night.witch');
      if (!rec) return err('wrong_step', 'not witch step');
      const w = state.seats[cmd.seat];
      if (!w || !isAliveRole(state, cmd.seat, 'witch')) return err('bad_seat', 'not a living witch');
      // APPROVED Q03: one heal per match, only on tonight's victim (self allowed); she sees the victim while it's unused.
      if (cmd.use) {
        if (!w.heal) return err('rule', 'heal already used');
        if (rec.victim === null) return err('rule', 'no victim tonight');
      }
      if (dry) return null;
      rec.heals[cmd.seat] = cmd.use;
      return null;
    }
    case 'witch.poison': {
      const rec = nightStep(state, 'night.witch');
      if (!rec) return err('wrong_step', 'not witch step');
      const w = state.seats[cmd.seat];
      if (!w || !isAliveRole(state, cmd.seat, 'witch')) return err('bad_seat', 'not a living witch');
      if (cmd.target !== 'pass') {
        // APPROVED Q03: one poison per match; never on self; may be used the same night as the heal.
        if (!w.poison) return err('rule', 'poison already used');
        if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
        if (cmd.target === cmd.seat) return err('rule', 'witch may not poison self');
      }
      if (dry) return null;
      rec.poisons[cmd.seat] = cmd.target;
      return null;
    }
    case 'vote.nominate': {
      const step = state.step;
      if (step.kind !== 'day.vote') return err('wrong_step', 'not nomination vote');
      if (!isAlive(state, cmd.seat)) return err('bad_seat', 'voter not alive');
      if (typeof cmd.target === 'number') {
        if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
        if (cmd.target === cmd.seat && !c.day.selfVote) {
          const e = rule('no self-vote');
          if (e) return e;
        }
      }
      if (dry) return null;
      step.votes[cmd.seat] = cmd.target;
      return null;
    }
    case 'vote.confirm': {
      const step = state.step;
      if (step.kind !== 'day.confirm') return err('wrong_step', 'not confirmation vote');
      if (!isAlive(state, cmd.seat)) return err('bad_seat', 'voter not alive');
      if (cmd.seat === step.accused && !c.day.accusedVotesOnConfirm) {
        const e = rule('accused may not vote');
        if (e) return e;
      }
      if (dry) return null;
      step.votes[cmd.seat] = cmd.choice;
      return null;
    }
    case 'hunter.shoot': {
      const step = state.step;
      if (step.kind !== 'hunter') return err('wrong_step', 'no hunter turn');
      if (!step.pending.includes(cmd.seat)) return err('bad_seat', 'not a pending hunter');
      if (cmd.target !== 'pass') {
        if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
      }
      if (dry) return null;
      step.shots[cmd.seat] = cmd.target;
      return null;
    }
    case 'day.confirmCount': {
      // APPROVED Q16: validated against the authoritative living count now; never bypassable (not a 'rule' error).
      const step = state.step;
      if (step.kind !== 'day.confirm') return err('wrong_step', 'not the Yes/No round');
      const living = state.seats.filter((s) => s.alive).length;
      if (typeof cmd.yes !== 'number' || !Number.isInteger(cmd.yes) || cmd.yes < 0 || cmd.yes > living) {
        return err('bad_value', `yes count must be an integer from 0 to ${living}`);
      }
      if (dry) return null;
      const r = tallyConfirm(Array<'yes'>(cmd.yes).fill('yes'), living);
      resolveConfirm(state, step.accused, 'moderator', r.yes, null, null, r.executed);
      return null;
    }
    case 'player.remove': {
      if (!isAlive(state, cmd.seat)) return err('bad_seat', 'seat not alive');
      if (actor === 'system' && isSecretStep(state) && !c.removal.systemDuringSecret) {
        return err('wrong_step', 'removal waits until the night ends');
      }
      if (dry) return null;
      removePlayer(state, cmd.seat);
      return null;
    }
    case 'match.abort':
      if (dry) return null;
      endMatch(state, { winner: 'aborted', reason: 'aborted' });
      return null;
    case 'step.close':
      if (dry) return null;
      closeStep(state);
      return null;
    default:
      // Runtime guard: callers bypassing parseCommand must not get a silent success.
      return err('bad_value', `unknown command ${(cmd as { type?: unknown }).type}`);
  }
}

// ---------- step transitions ----------

function closeStep(state: MatchState): void {
  const step = state.step;
  const c = state.config;
  switch (step.kind) {
    case 'night.main':
      closeNightMain(state);
      return;
    case 'night.witch':
      resolveNight(state);
      return;
    case 'day.discussion':
      setStep(state, { kind: 'day.vote', day: state.day, votes: state.seats.map(() => null) });
      return;
    case 'day.vote': {
      // APPROVED Q09/Q10: plurality nomination; results published only at close.
      const r = tallyNomination(step.votes);
      state.publicLog.push({
        t: 'nomination',
        day: state.day,
        accused: r.accused,
        tally: r.tally,
        votes: [...step.votes],
      });
      if (r.accused === null) return startNight(state);
      setStep(state, { kind: 'day.defense', day: state.day, accused: r.accused });
      return;
    }
    case 'day.defense':
      afterDefense(state, step.accused);
      return;
    case 'day.confirm': {
      // Approved: denominator = all living players (incl. the accused, abstainers, disconnected seats).
      const r = tallyConfirm(step.votes, state.seats.filter((s) => s.alive).length);
      resolveConfirm(state, step.accused, 'votes', r.yes, r.no, [...step.votes], r.executed);
      return;
    }
    case 'hunter':
      closeHunter(state, step);
      return;
    case 'ended':
      return;
  }
}

function resolveConfirm(
  state: MatchState,
  accused: Seat,
  counted: 'votes' | 'moderator',
  yes: number,
  no: number | null,
  votes: ('yes' | 'no' | null)[] | null,
  executed: boolean,
): void {
  state.publicLog.push({ t: 'confirm', day: state.day, accused, counted, yes, no, votes, executed });
  if (executed) execute(state, accused);
  else startNight(state);
}

/** APPROVED Q10: the 30 s defense is always followed by the Yes/No round. */
function afterDefense(state: MatchState, accused: Seat): void {
  setStep(state, { kind: 'day.confirm', day: state.day, accused, votes: state.seats.map(() => null) });
}

function execute(state: MatchState, seat: Seat): void {
  kill(state, [{ seat, cause: 'executed' }]);
  state.publicLog.push({ t: 'executed', day: state.day, seat });
  afterDeaths(state, [{ seat, cause: 'executed' }], { to: 'night' });
}

function startNight(state: MatchState): void {
  state.night += 1;
  const n = state.seats.length;
  const nulls = <T>() => Array<T | null>(n).fill(null);
  state.nightRec = {
    night: state.night,
    wolfPicks: nulls(),
    wolfDecision: null,
    inspections: nulls(),
    guards: nulls(),
    heals: nulls(),
    poisons: nulls(),
    victim: null,
    byModerator: [],
  };
  setStep(state, { kind: 'night.main', night: state.night });
  state.publicLog.push({ t: 'nightStart', night: state.night });
}

function startDay(state: MatchState): void {
  state.day = state.night;
  setStep(state, { kind: 'day.discussion', day: state.day });
  state.publicLog.push({ t: 'dayStart', day: state.day });
}

function closeNightMain(state: MatchState): void {
  const rec = state.nightRec as NightRecord;
  const c = state.config;
  const wolves = state.seats.filter((s) => s.alive && s.role === 'wolf');
  let victim: Seat | null = null;
  if (c.firstNightKill || rec.night !== 1) {
    if (rec.wolfDecision !== null) {
      victim = rec.wolfDecision === 'pass' ? null : rec.wolfDecision;
    } else {
      const picks = wolves.map((w) => rec.wolfPicks[w.seat]).filter((p): p is Seat | 'pass' => p !== null && p !== undefined);
      const r = resolveWolfTarget(picks, c.wolves.passHandling, state.rng);
      victim = r.target;
      state.rng = r.rng;
    }
  }
  if (victim !== null && !isAlive(state, victim)) victim = null;
  rec.victim = victim;
  for (const w of wolves) grant(state, w.seat, { k: 'packTarget', night: rec.night, target: victim });
  for (const s of state.seats) {
    const g = rec.guards[s.seat];
    if (s.alive && s.role === 'guard' && g !== null && g !== undefined) {
      grant(state, s.seat, { k: 'own', night: rec.night, act: 'protect', target: g === 'pass' ? null : g });
    }
  }
  // APPROVED night timing: the Witch step ALWAYS runs (even with no Witch in the deck, a dead Witch or a spent heal),
  // so every night has the same fixed total length.
  setStep(state, { kind: 'night.witch', night: rec.night });
  for (const s of state.seats) {
    if (s.alive && s.role === 'witch' && witchSeesVictim(state, s.seat)) {
      grant(state, s.seat, { k: 'victim', night: rec.night, target: victim });
    }
  }
}

function resolveNight(state: MatchState): void {
  const rec = state.nightRec as NightRecord;
  const c = state.config;
  const living = state.seats.filter((s) => s.alive);
  const guarded: Seat[] = [];
  for (const g of living.filter((s) => s.role === 'guard')) {
    const t = rec.guards[g.seat];
    if (typeof t === 'number') guarded.push(t);
    if (typeof t === 'number') g.guardLast = t;
    else if (c.guard.passResetsRepeat) g.guardLast = null;
  }
  let healed = false;
  const poisoned: Seat[] = [];
  for (const w of living.filter((s) => s.role === 'witch')) {
    if (rec.heals[w.seat] === true && w.heal && rec.victim !== null) {
      healed = true;
      w.heal = false;
      grant(state, w.seat, { k: 'own', night: rec.night, act: 'heal', target: rec.victim });
    }
    const p = rec.poisons[w.seat];
    if (typeof p === 'number' && w.poison && isAlive(state, p)) {
      poisoned.push(p);
      w.poison = false;
      grant(state, w.seat, { k: 'own', night: rec.night, act: 'poison', target: p });
    }
  }
  // F2: a seat already dead (e.g. removed mid-night) cannot die again, be announced, or trigger effects.
  const deaths = nightDeaths({ victim: rec.victim, guarded, healed, poisoned }, c.protection).filter((d) => isAlive(state, d.seat));
  const dead = kill(state, deaths);
  state.history.push({ t: 'night', night: rec.night, record: rec, deaths: dead });
  state.nightRec = null;
  state.publicLog.push({
    t: 'dawn',
    night: rec.night,
    dead: dead.map((d) => d.seat),
    causes: c.reveal.causeAtDawn ? dead.map((d) => d.cause) : null,
  });
  afterDeaths(state, dead, { to: 'day' });
}

/** APPROVED Q06: newly dead Hunters (gameplay death) get a shot turn before victory is checked; else finish the batch. */
function afterDeaths(state: MatchState, deaths: { seat: Seat; cause: DeathCause }[], then: Continuation): void {
  const hunters = deaths.filter((d) => state.seats[d.seat]?.role === 'hunter' && hunterTriggers(d.cause)).map((d) => d.seat);
  if (hunters.length > 0) {
    setStep(state, { kind: 'hunter', pending: hunters, shots: state.seats.map(() => null), then });
    state.publicLog.push({ t: 'hunterTurn', seats: hunters });
    // APPROVED Q20 (2026-10-16): no role is revealed on death, except the Hunter, revealed when the shot turn opens (even on timeout).
    for (const h of hunters) state.publicLog.push({ t: 'roleRevealed', seat: h, role: 'hunter' });
    return;
  }
  finishBatch(state, then);
}

function closeHunter(state: MatchState, step: Extract<MatchState['step'], { kind: 'hunter' }>): void {
  const deaths: { seat: Seat; cause: DeathCause }[] = [];
  for (const h of step.pending) {
    const t = step.shots[h];
    const target = typeof t === 'number' && isAlive(state, t) ? t : null;
    state.publicLog.push({ t: 'shot', by: h, target });
    if (target !== null && !deaths.some((d) => d.seat === target)) deaths.push({ seat: target, cause: 'shot' });
  }
  deaths.sort((a, b) => a.seat - b.seat);
  const dead = kill(state, deaths);
  afterDeaths(state, dead, step.then);
}

/** Approved rule: victory only after the whole batch (incl. hunter chain) has resolved. */
function finishBatch(state: MatchState, then: Continuation): void {
  const outcome = evaluateVictory(state.seats);
  if (outcome) return endMatch(state, outcome);
  if (then.to === 'day') return startDay(state);
  if (then.to === 'night') return startNight(state);
  const s = then.step;
  if ((s.kind === 'day.defense' || s.kind === 'day.confirm') && !isAlive(state, s.accused)) return startNight(state);
  state.step = s; // resumed after a removal: same step instance, stepSeq unchanged (phase clock continues)
}

function removePlayer(state: MatchState, seat: Seat): void {
  const cur = state.step;
  kill(state, [{ seat, cause: 'removed' }]);
  state.publicLog.push({ t: 'removed', seat });
  if (cur.kind === 'day.vote') {
    cur.votes[seat] = null;
    cur.votes = cur.votes.map((v) => (v === seat ? null : v));
  }
  if (cur.kind === 'day.confirm') cur.votes[seat] = null;
  const rec = state.nightRec;
  if (rec) {
    // F2: pending effects on a removed seat are void (it is no longer the victim, nor a pick/protect/poison target).
    if (rec.victim === seat) rec.victim = null;
    if (rec.wolfDecision === seat) rec.wolfDecision = null;
    for (const arr of [rec.wolfPicks, rec.guards, rec.poisons]) arr.forEach((v, i) => v === seat && (arr[i] = null));
  }
  // APPROVED Q06: removal is administrative, not a gameplay death -> never a Hunter shot.
  if (cur.kind === 'hunter') return; // victory is checked when the running hunter turn closes
  afterDeaths(state, [{ seat, cause: 'removed' }], { to: 'resume', step: cur });
}

/** Every new step instance gets a new stepSeq, so hosts can tell a fresh phase (new clock) from a resumed one. */
function setStep(state: MatchState, step: MatchState['step']): void {
  state.step = step;
  state.stepSeq += 1;
}

function endMatch(state: MatchState, outcome: Outcome): void {
  state.outcome = outcome;
  setStep(state, { kind: 'ended' });
  state.publicLog.push({ t: 'ended', outcome });
}

// ---------- helpers ----------

/** Kills living seats; returns only the newly dead (already-dead seats are ignored). */
function kill(state: MatchState, deaths: { seat: Seat; cause: DeathCause }[]): { seat: Seat; cause: DeathCause }[] {
  const out: { seat: Seat; cause: DeathCause }[] = [];
  for (const d of deaths) {
    const s = state.seats[d.seat];
    if (s && s.alive) {
      s.alive = false;
      s.death = { cause: d.cause, night: state.night, day: state.day };
      out.push(d);
    }
  }
  return out;
}


/** Knowledge is granted only to living seats (ghosts keep, never gain). */
function grant(state: MatchState, seat: Seat, fact: Fact): void {
  const s = state.seats[seat];
  if (s && s.alive) state.knowledge[seat]?.push(fact);
}

/** APPROVED Q03: the Witch sees the wolves' victim only while her heal is unused. */
export function witchSeesVictim(state: MatchState, seat: Seat): boolean {
  return state.seats[seat]?.heal === true;
}

function nightStep(state: MatchState, kind: 'night.main' | 'night.witch'): NightRecord | null {
  return state.step.kind === kind ? state.nightRec : null;
}
/** Night steps are secret: hidden actions happen; presence and timing must not leak. */
export const isSecretStep = (state: MatchState) => state.step.kind === 'night.main' || state.step.kind === 'night.witch';
const isAlive = (state: MatchState, seat: Seat) => state.seats[seat]?.alive === true;
const isAliveRole = (state: MatchState, seat: Seat, role: Role) => isAlive(state, seat) && state.seats[seat]?.role === role;
const roleOf = (state: MatchState, seat: Seat) => (state.seats[seat] as { role: Role }).role;
const err = (code: ErrorCode, message: string): EngineError => ({ code, message });
const fail = (code: ErrorCode, message: string) => ({ ok: false as const, error: err(code, message) });
