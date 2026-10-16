// Engine: createMatch + apply. Pure: apply clones the input state and returns a new one.
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
  /** Custom deck counts (host customization, Q17). Default: config.distribution. */
  deck?: DeckCounts;
  config?: DeepPartial<RulesConfig>;
}

export type CreateResult = { ok: true; state: MatchState } | { ok: false; error: EngineError };

export function createMatch(opts: CreateOptions): CreateResult {
  const config = resolveConfig(opts.config);
  let rng = seedFrom(opts.seed);
  let roles: Role[];
  if (opts.roles) {
    roles = [...opts.roles];
    const deck = Object.fromEntries(ROLES.map((r) => [r, roles.filter((x) => x === r).length])) as DeckCounts;
    const bad = validateDeck(deck, roles.length, config);
    if (bad) return fail('rule', bad);
  } else {
    const n = opts.playerCount ?? 0;
    const deck = opts.deck ?? defaultDeck(n, config);
    if (!deck) return fail('rule', `no default deck for ${n} players`);
    const bad = validateDeck(deck, n, config);
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
  const auth = authorize(actor, cmd);
  if (auth) return { ok: false, error: auth };
  const state = structuredClone(input);
  const lax = actor.kind === 'moderator' && state.config.moderator.mayBreakRules;
  const e = handle(state, cmd, lax);
  if (e) return { ok: false, error: e };
  if (actor.kind === 'moderator') state.history.push({ t: 'moderator', command: cmd });
  if (actor.kind === 'moderator' && state.nightRec && 'seat' in cmd && cmd.type !== 'player.remove') {
    if (!state.nightRec.byModerator.includes(cmd.seat)) state.nightRec.byModerator.push(cmd.seat);
  }
  return { ok: true, state };
}

// ---------- authorization ----------

const MOD_ONLY = new Set<Command['type']>(['wolf.decide', 'day.setOutcome']);
const MOD_OR_SYSTEM = new Set<Command['type']>(['step.close', 'player.remove', 'match.abort']);

function authorize(actor: Actor, cmd: Command): EngineError | null {
  if (MOD_ONLY.has(cmd.type)) return actor.kind === 'moderator' ? null : err('forbidden', 'moderator only');
  if (MOD_OR_SYSTEM.has(cmd.type)) return actor.kind === 'seat' ? err('forbidden', 'not allowed for seats') : null;
  // Seat commands: own seat, or moderator acting for a seat.
  if (actor.kind === 'moderator') return null;
  if (actor.kind === 'seat' && 'seat' in cmd && cmd.seat === actor.seat) return null;
  return err('forbidden', 'may only act for own seat');
}

// ---------- command handling ----------

function handle(state: MatchState, cmd: Command, lax: boolean): EngineError | null {
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
      rec.wolfPicks[cmd.seat] = cmd.target;
      return null;
    }
    case 'wolf.decide': {
      const rec = nightStep(state, 'night.main');
      if (!rec) return err('wrong_step', 'not night');
      if (cmd.target !== 'pass' && !isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
      if (cmd.target !== 'pass' && roleOf(state, cmd.target) === 'wolf' && !c.wolves.canTargetWolf) {
        const e = rule('wolves may not target a wolf');
        if (e) return e;
      }
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
      rec.guards[cmd.seat] = cmd.target;
      return null;
    }
    case 'hunter.pin': {
      const rec = nightStep(state, 'night.main');
      if (!rec) return err('wrong_step', 'not night');
      if (c.hunter.mode !== 'pinNightOnly') return err('wrong_step', 'pins are not used in this mode');
      if (!isAliveRole(state, cmd.seat, 'hunter')) return err('bad_seat', 'not a living hunter');
      if (cmd.target !== 'pass') {
        if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
        if (cmd.target === cmd.seat) {
          const e = rule('hunter may not pin self');
          if (e) return e;
        }
      }
      rec.pins[cmd.seat] = cmd.target;
      return null;
    }
    case 'witch.heal': {
      const rec = nightStep(state, 'night.witch');
      if (!rec) return err('wrong_step', 'not witch step');
      const w = state.seats[cmd.seat];
      if (!w || !isAliveRole(state, cmd.seat, 'witch')) return err('bad_seat', 'not a living witch');
      if (cmd.use) {
        if (!w.heal) return err('rule', 'heal already used');
        // Victim-dependent checks only when the witch can see the victim (no leak otherwise).
        if (witchSeesVictim(state, cmd.seat)) {
          if (rec.victim === null) {
            const e = rule('no victim tonight');
            if (e) return e;
          } else if (rec.victim === cmd.seat && !c.witch.canHealSelf) {
            const e = rule('witch may not heal self');
            if (e) return e;
          }
        }
        if (!c.witch.bothPotionsSameNight && typeof rec.poisons[cmd.seat] === 'number') {
          const e = rule('only one potion per night');
          if (e) return e;
        }
      }
      rec.heals[cmd.seat] = cmd.use;
      return null;
    }
    case 'witch.poison': {
      const rec = nightStep(state, 'night.witch');
      if (!rec) return err('wrong_step', 'not witch step');
      const w = state.seats[cmd.seat];
      if (!w || !isAliveRole(state, cmd.seat, 'witch')) return err('bad_seat', 'not a living witch');
      if (cmd.target !== 'pass') {
        if (!w.poison) return err('rule', 'poison already used');
        if (!isAlive(state, cmd.target)) return err('bad_target', 'target not alive');
        if (cmd.target === cmd.seat && !c.witch.canPoisonSelf) {
          const e = rule('witch may not poison self');
          if (e) return e;
        }
        if (!c.witch.bothPotionsSameNight && rec.heals[cmd.seat] === true) {
          const e = rule('only one potion per night');
          if (e) return e;
        }
      }
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
      step.shots[cmd.seat] = cmd.target;
      return null;
    }
    case 'day.setOutcome': {
      const step = state.step;
      if (!c.moderator.canSetDayOutcome) return err('forbidden', 'day outcome override disabled');
      if (!step.kind.startsWith('day.')) return err('wrong_step', 'not day');
      if (cmd.execute !== null && !isAlive(state, cmd.execute)) return err('bad_target', 'target not alive');
      state.publicLog.push({ t: 'dayOutcomeSet', day: state.day, execute: cmd.execute });
      if (cmd.execute === null) startNight(state);
      else execute(state, cmd.execute);
      return null;
    }
    case 'player.remove': {
      if (!isAlive(state, cmd.seat)) return err('bad_seat', 'seat not alive');
      removePlayer(state, cmd.seat);
      return null;
    }
    case 'match.abort':
      endMatch(state, { winner: 'aborted', reason: 'aborted' });
      return null;
    case 'step.close':
      closeStep(state);
      return null;
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
      state.step = { kind: 'day.vote', day: state.day, votes: state.seats.map(() => null) };
      return;
    case 'day.vote': {
      const living = state.seats.filter((s) => s.alive).length;
      const r = tallyNomination(step.votes, living, c.day.nomination);
      state.publicLog.push({
        t: 'nomination',
        day: state.day,
        accused: r.accused,
        tally: r.tally,
        votes: c.day.openVotes ? [...step.votes] : null,
      });
      if (r.accused === null) return startNight(state);
      if (c.day.defense) state.step = { kind: 'day.defense', day: state.day, accused: r.accused };
      else afterDefense(state, r.accused);
      return;
    }
    case 'day.defense':
      afterDefense(state, step.accused);
      return;
    case 'day.confirm': {
      const eligible = state.seats.filter((s) => s.alive && (c.day.accusedVotesOnConfirm || s.seat !== step.accused)).length;
      const r = tallyConfirm(step.votes, eligible, c.day.confirm);
      state.publicLog.push({
        t: 'confirm',
        day: state.day,
        accused: step.accused,
        yes: r.yes,
        no: r.no,
        votes: c.day.openVotes ? [...step.votes] : null,
        executed: r.executed,
      });
      if (r.executed) execute(state, step.accused);
      else startNight(state);
      return;
    }
    case 'hunter':
      closeHunter(state, step);
      return;
    case 'ended':
      return;
  }
}

function afterDefense(state: MatchState, accused: Seat): void {
  if (state.config.day.confirmVote) {
    state.step = { kind: 'day.confirm', day: state.day, accused, votes: state.seats.map(() => null) };
  } else {
    execute(state, accused);
  }
}

function execute(state: MatchState, seat: Seat): void {
  kill(state, [{ seat, cause: 'executed' }]);
  state.publicLog.push({ t: 'executed', day: state.day, seat });
  revealIfConfigured(state, [seat]);
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
    pins: nulls(),
    heals: nulls(),
    poisons: nulls(),
    victim: null,
    byModerator: [],
  };
  state.step = { kind: 'night.main', night: state.night };
  state.publicLog.push({ t: 'nightStart', night: state.night });
}

function startDay(state: MatchState): void {
  state.day = state.night;
  state.step = { kind: 'day.discussion', day: state.day };
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
      const r = resolveWolfTarget(picks, wolves.length, c.wolves.resolve, state.rng);
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
    const p = rec.pins[s.seat];
    if (s.alive && s.role === 'hunter' && p !== null && p !== undefined) {
      grant(state, s.seat, { k: 'own', night: rec.night, act: 'pin', target: p === 'pass' ? null : p });
    }
  }
  // Q11: the witch step runs whenever the deck has a witch, alive or not (public deck; hides witch death).
  if (state.seats.some((s) => s.role === 'witch')) {
    state.step = { kind: 'night.witch', night: rec.night };
    for (const s of state.seats) {
      if (s.alive && s.role === 'witch' && witchSeesVictim(state, s.seat)) {
        grant(state, s.seat, { k: 'victim', night: rec.night, target: victim });
      }
    }
  } else {
    resolveNight(state);
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
    if (rec.heals[w.seat] === true && w.heal) {
      const selfBlocked = rec.victim === w.seat && !c.witch.canHealSelf;
      if (rec.victim !== null && !selfBlocked) healed = true;
      if (rec.victim !== null || !witchSeesVictim(state, w.seat)) w.heal = false;
      grant(state, w.seat, { k: 'own', night: rec.night, act: 'heal', target: rec.victim });
    }
    const p = rec.poisons[w.seat];
    if (typeof p === 'number' && w.poison && isAlive(state, p)) {
      poisoned.push(p);
      w.poison = false;
      grant(state, w.seat, { k: 'own', night: rec.night, act: 'poison', target: p });
    }
  }
  const deaths = nightDeaths({ victim: rec.victim, guarded, healed, poisoned }, c.protection);
  if (c.hunter.mode === 'pinNightOnly') {
    // Q06 alternative (sky2): pinned player dies with a hunter who dies at night. Chain to fixpoint.
    let grew = true;
    while (grew) {
      grew = false;
      for (const d of [...deaths]) {
        const s = state.seats[d.seat];
        const pin = rec.pins[d.seat];
        if (s?.role === 'hunter' && hunterTriggers(d.cause, c.hunter) && typeof pin === 'number') {
          if (isAlive(state, pin) && !deaths.some((x) => x.seat === pin)) {
            deaths.push({ seat: pin, cause: 'pin' });
            grew = true;
          }
        }
      }
    }
    deaths.sort((a, b) => a.seat - b.seat);
  }
  kill(state, deaths);
  state.history.push({ t: 'night', night: rec.night, record: rec, deaths });
  state.nightRec = null;
  state.publicLog.push({
    t: 'dawn',
    night: rec.night,
    dead: deaths.map((d) => d.seat),
    causes: c.reveal.causeAtDawn ? deaths.map((d) => d.cause) : null,
  });
  revealIfConfigured(
    state,
    deaths.map((d) => d.seat),
  );
  afterDeaths(state, c.hunter.mode === 'shootOnDeath' ? deaths : [], { to: 'day' });
}

/** Start a hunter turn for eligible newly-dead hunters, or finish the batch. */
function afterDeaths(state: MatchState, deaths: { seat: Seat; cause: DeathCause }[], then: Continuation): void {
  const c = state.config;
  const hunters =
    c.hunter.mode === 'shootOnDeath'
      ? deaths.filter((d) => state.seats[d.seat]?.role === 'hunter' && hunterTriggers(d.cause, c.hunter)).map((d) => d.seat)
      : [];
  if (hunters.length > 0) {
    state.step = { kind: 'hunter', pending: hunters, shots: state.seats.map(() => null), then };
    state.publicLog.push({ t: 'hunterTurn', seats: hunters });
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
  kill(state, deaths);
  revealIfConfigured(
    state,
    deaths.map((d) => d.seat),
  );
  afterDeaths(state, deaths, step.then);
}

/** Approved rule: victory only after the whole batch (incl. hunter chain) has resolved. */
function finishBatch(state: MatchState, then: Continuation): void {
  const outcome = evaluateVictory(state.seats, state.config.victory.zeroSurvivors);
  if (outcome) return endMatch(state, outcome);
  if (then.to === 'day') return startDay(state);
  if (then.to === 'night') return startNight(state);
  const s = then.step;
  if ((s.kind === 'day.defense' || s.kind === 'day.confirm') && !isAlive(state, s.accused)) return startNight(state);
  state.step = s;
}

function removePlayer(state: MatchState, seat: Seat): void {
  const cur = state.step;
  kill(state, [{ seat, cause: 'removed' }]);
  state.publicLog.push({ t: 'removed', seat });
  revealIfConfigured(state, [seat]);
  if (cur.kind === 'day.vote') {
    cur.votes[seat] = null;
    cur.votes = cur.votes.map((v) => (v === seat ? null : v));
  }
  if (cur.kind === 'day.confirm') cur.votes[seat] = null;
  const triggers = state.seats[seat]?.role === 'hunter' && state.config.hunter.mode === 'shootOnDeath' && hunterTriggers('removed', state.config.hunter);
  if (cur.kind === 'hunter') {
    // Joins the running hunter turn; victory is checked when that turn closes.
    if (triggers) cur.pending.push(seat);
    return;
  }
  afterDeaths(state, [{ seat, cause: 'removed' }], { to: 'resume', step: cur });
}

function endMatch(state: MatchState, outcome: Outcome): void {
  state.outcome = outcome;
  state.step = { kind: 'ended' };
  state.publicLog.push({ t: 'ended', outcome });
}

// ---------- helpers ----------

function kill(state: MatchState, deaths: { seat: Seat; cause: DeathCause }[]): void {
  for (const d of deaths) {
    const s = state.seats[d.seat];
    if (s && s.alive) {
      s.alive = false;
      s.death = { cause: d.cause, night: state.night, day: state.day };
    }
  }
}

function revealIfConfigured(state: MatchState, seats: Seat[]): void {
  if (!state.config.reveal.roleOnDeath) return;
  for (const seat of seats) state.publicLog.push({ t: 'roleRevealed', seat, role: roleOf(state, seat) });
}

/** Knowledge is granted only to living seats (ghosts keep, never gain). */
function grant(state: MatchState, seat: Seat, fact: Fact): void {
  const s = state.seats[seat];
  if (s && s.alive) state.knowledge[seat]?.push(fact);
}

export function witchSeesVictim(state: MatchState, seat: Seat): boolean {
  const mode = state.config.witch.seesVictim;
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return state.seats[seat]?.heal === true;
}

function nightStep(state: MatchState, kind: 'night.main' | 'night.witch'): NightRecord | null {
  return state.step.kind === kind ? state.nightRec : null;
}
const isAlive = (state: MatchState, seat: Seat) => state.seats[seat]?.alive === true;
const isAliveRole = (state: MatchState, seat: Seat, role: Role) => isAlive(state, seat) && state.seats[seat]?.role === role;
const roleOf = (state: MatchState, seat: Seat) => (state.seats[seat] as { role: Role }).role;
const err = (code: ErrorCode, message: string): EngineError => ({ code, message });
const fail = (code: ErrorCode, message: string) => ({ ok: false as const, error: err(code, message) });
