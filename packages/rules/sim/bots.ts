// Balance-screening bots. NOT players: crude, explicit policies to catch obviously broken setups (Q17/Q18).
// Bots decide only from their own seat projection + a modelled public "claims" table (speech), never hidden state.
import { apply, createMatch, project, stepTiming, type AvailableAction, type Command, type DeckCounts, type DeepPartial, type MatchState, type Projection, type RulesConfig, type Seat } from '../src/index.ts';
import { nextInt, nextRandom } from '../src/rng.ts';

export type PolicyName = 'random' | 'heuristic';

/** Heuristic knobs (all explicit assumptions). */
export const HEURISTIC = {
  /** Village read quality: a living wolf is this many times more likely to be suspected than a villager. */
  wolfSuspicionWeight: 1.5,
  /** Chance a village voter follows the current leading candidate (bandwagon). */
  bandwagon: 0.5,
  /** Chance a village voter votes Skip when it has no claim to follow. */
  skip: 0.1,
  /** When the real Seer claims, chance a living wolf counter-claims (accusing the real Seer). */
  counterClaim: 0.5,
  /** With two Seer claims, chance a village voter trusts the real one. */
  trustRealSeer: 0.6,
  /** Yes/No: village says yes with this chance (no claim info). */
  confirmYes: 0.65,
  /** Guard protects self with this chance when no Seer claim. */
  guardSelf: 0.2,
};

class Rng {
  s: number;
  constructor(seed: number) {
    this.s = seed;
  }
  int(n: number): number {
    const r = nextInt(this.s, n);
    this.s = r.state;
    return r.value;
  }
  float(): number {
    const r = nextRandom(this.s);
    this.s = r.state;
    return r.value;
  }
  chance(p: number): boolean {
    return this.float() < p;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)] as T;
  }
  weighted<T>(xs: readonly T[], w: (x: T) => number): T {
    const ws = xs.map(w);
    let r = this.float() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < xs.length; i++) {
      r -= ws[i] as number;
      if (r <= 0) return xs[i] as T;
    }
    return xs[xs.length - 1] as T;
  }
}

/** Public speech model: what has been claimed out loud. */
interface Claims {
  real: { seat: Seat; wolves: Seat[]; clears: Seat[] } | null;
  fake: { seat: Seat; accuses: Seat } | null;
}

export interface MatchResult {
  winner: string;
  nights: number;
  seconds: number;
  /** Final state, for diagnostics only. */
  final: MatchState;
  claimed: boolean;
  counterClaimed: boolean;
}

export function playMatch(opts: { seed: number; players: number; policy: PolicyName; deck?: DeckCounts; config?: DeepPartial<RulesConfig> }): MatchResult {
  const r = createMatch({ seed: opts.seed, playerCount: opts.players, deck: opts.deck, config: { players: { min: 3, max: 30 }, ...opts.config } });
  if (!r.ok) throw new Error(r.error.message);
  let s = r.state;
  const rng = new Rng(opts.seed ^ 0x5bd1e995);
  const claims: Claims = { real: null, fake: null };
  let seconds = 0;
  let lastStep = '';
  const act = (seat: Seat, cmd: Command) => {
    const res = apply(s, { kind: 'seat', seat }, cmd);
    if (res.ok) s = res.state; // menus are legal; a rejection only means a stale choice, ignore
  };
  for (let guard = 0; guard < 2000 && s.step.kind !== 'ended'; guard++) {
    const key = `${s.step.kind}:${s.night}:${s.day}`;
    if (key !== lastStep) {
      seconds += stepTiming(s).seconds; // full durations (no early close): upper-bound pace
      lastStep = key;
    }
    if (s.step.kind === 'day.discussion' && opts.policy === 'heuristic') speak(s, claims, rng);
    // Seats act in random order (so bandwagon sees earlier votes).
    const order = s.seats.map((x) => x.seat);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j] as Seat, order[i] as Seat];
    }
    for (const seat of order) {
      const p = project(s, { kind: 'seat', seat });
      for (const a of p.me?.actions ?? []) {
        const fresh = project(s, { kind: 'seat', seat });
        const cur = fresh.me?.actions.find((x) => x.type === a.type);
        if (!cur || hasActed(cur)) continue;
        const cmd = opts.policy === 'random' ? randomChoice(cur, seat, rng) : heuristicChoice(cur, fresh, s, claims, rng);
        if (cmd) act(seat, cmd);
      }
    }
    const closed = apply(s, { kind: 'system' }, { type: 'step.close' });
    if (!closed.ok) throw new Error(closed.error.message);
    s = closed.state;
  }
  return { winner: s.outcome?.winner ?? 'timeout', nights: s.night, seconds, final: s, claimed: claims.real !== null, counterClaimed: claims.fake !== null };
}

function hasActed(a: AvailableAction): boolean {
  return 'current' in a && a.current !== null;
}

// ---------- random policy: uniform over legal options ----------

function randomChoice(a: AvailableAction, seat: Seat, rng: Rng): Command | null {
  const t = 'targets' in a ? a.targets : [];
  switch (a.type) {
    case 'wolf.pick':
      return t.length ? { type: a.type, seat, target: rng.pick(t) } : null;
    case 'seer.inspect':
      return t.length ? { type: a.type, seat, target: rng.pick(t) } : null;
    case 'guard.protect':
    case 'hunter.pin':
    case 'hunter.shoot':
      return { type: a.type, seat, target: t.length ? rng.pick(t) : 'pass' };
    case 'witch.heal':
      return { type: a.type, seat, use: a.canUse && rng.chance(0.5) };
    case 'witch.poison':
      return { type: a.type, seat, target: t.length && rng.chance(0.25) ? rng.pick(t) : 'pass' };
    case 'vote.nominate':
      return { type: a.type, seat, target: rng.chance(1 / (t.length + 1)) || !t.length ? 'skip' : rng.pick(t) };
    case 'vote.confirm':
      return { type: a.type, seat, choice: rng.chance(0.5) ? 'yes' : 'no' };
  }
}

// ---------- heuristic policy ----------

/** Day speech: Seer claims once it has found a living wolf; a wolf may counter-claim. */
function speak(s: MatchState, claims: Claims, rng: Rng): void {
  if (claims.real) {
    // Real seer updates results each day while alive.
    const p = project(s, { kind: 'seat', seat: claims.real.seat });
    if (p.me?.alive) Object.assign(claims.real, seerResults(p));
    return;
  }
  for (const seat of s.seats.filter((x) => x.alive)) {
    const p = project(s, { kind: 'seat', seat: seat.seat });
    if (p.me?.role !== 'seer') continue;
    const res = seerResults(p);
    if (res.wolves.some((w) => s.seats[w]?.alive)) {
      claims.real = { seat: seat.seat, ...res };
      // A living wolf decides to counter-claim (each wolf knows its own role; no other hidden state used).
      const wolves = s.seats.filter((x) => x.alive && x.role === 'wolf');
      if (wolves.length && rng.chance(HEURISTIC.counterClaim)) claims.fake = { seat: rng.pick(wolves).seat, accuses: seat.seat };
    }
  }
}

function seerResults(p: Projection): { wolves: Seat[]; clears: Seat[] } {
  const f = p.me?.facts ?? [];
  return {
    wolves: f.flatMap((x) => (x.k === 'inspect' && x.result === 'wolf' ? [x.target] : [])),
    clears: f.flatMap((x) => (x.k === 'inspect' && x.result !== 'wolf' ? [x.target] : [])),
  };
}

function heuristicChoice(a: AvailableAction, p: Projection, s: MatchState, claims: Claims, rng: Rng): Command | null {
  const me = p.me;
  if (!me) return null;
  const seat = me.seat;
  const t = 'targets' in a ? a.targets : [];
  const alive = (x: Seat) => p.seats[x]?.alive === true;
  const pack = new Set(p.pack?.seats ?? []);
  const claimedWolf = claims.real?.wolves.find(alive) ?? null;
  switch (a.type) {
    case 'wolf.pick': {
      // Pack bites the real claimed Seer; else follows an existing pack pick; else random village.
      const existing = p.pack?.picks?.find((x) => typeof x === 'number');
      if (claims.real && t.includes(claims.real.seat)) return { type: a.type, seat, target: claims.real.seat };
      if (typeof existing === 'number' && t.includes(existing)) return { type: a.type, seat, target: existing };
      return t.length ? { type: a.type, seat, target: rng.pick(t) } : null;
    }
    case 'seer.inspect': {
      const seen = new Set(me.facts.flatMap((f) => (f.k === 'inspect' ? [f.target] : [])));
      const fresh = t.filter((x) => !seen.has(x));
      return { type: a.type, seat, target: rng.pick(fresh.length ? fresh : t) };
    }
    case 'guard.protect': {
      if (claims.real && t.includes(claims.real.seat)) return { type: a.type, seat, target: claims.real.seat };
      if (t.includes(seat) && rng.chance(HEURISTIC.guardSelf)) return { type: a.type, seat, target: seat };
      const others = t.filter((x) => x !== seat);
      return { type: a.type, seat, target: others.length ? rng.pick(others) : 'pass' };
    }
    case 'witch.heal':
      return { type: a.type, seat, use: a.canUse };
    case 'witch.poison':
      return { type: a.type, seat, target: claimedWolf !== null && t.includes(claimedWolf) && trustsReal(claims, rng) ? claimedWolf : 'pass' };
    case 'hunter.pin':
    case 'hunter.shoot': {
      const sus = claimedWolf ?? lastLeader(p);
      return { type: a.type, seat, target: sus !== null && t.includes(sus) ? sus : t.length ? rng.pick(t) : 'pass' };
    }
    case 'vote.nominate': {
      const step = s.step.kind === 'day.vote' ? s.step : null;
      const leader = step ? leading(p) : null;
      if (me.role === 'wolf') {
        // Wolves pile on the leading non-wolf, else the real Seer if claimed, else a random village seat.
        if (leader !== null && !pack.has(leader)) return { type: a.type, seat, target: leader };
        if (claims.real && t.includes(claims.real.seat)) return { type: a.type, seat, target: claims.real.seat };
        const v = t.filter((x) => !pack.has(x));
        return { type: a.type, seat, target: v.length ? rng.pick(v) : 'skip' };
      }
      if (claims.real && claims.real.seat === seat && claimedWolf !== null && t.includes(claimedWolf)) return { type: a.type, seat, target: claimedWolf };
      const follow = claimTarget(claims, alive, rng);
      if (follow !== null && t.includes(follow) && follow !== seat) return { type: a.type, seat, target: follow };
      if (leader !== null && t.includes(leader) && rng.chance(HEURISTIC.bandwagon)) return { type: a.type, seat, target: leader };
      if (rng.chance(HEURISTIC.skip)) return { type: a.type, seat, target: 'skip' };
      const cleared = new Set(claims.real?.clears ?? []);
      const pool = t.filter((x) => !cleared.has(x));
      const pool2 = pool.length ? pool : t;
      // Noisy read: wolves slightly more suspicious. (Uses true role only as a weight, modelling imperfect social reads.)
      return { type: a.type, seat, target: rng.weighted(pool2, (x) => (s.seats[x]?.role === 'wolf' ? HEURISTIC.wolfSuspicionWeight : 1)) };
    }
    case 'vote.confirm': {
      const accused = s.step.kind === 'day.confirm' ? s.step.accused : null;
      if (accused === null) return null;
      if (me.role === 'wolf') return { type: a.type, seat, choice: pack.has(accused) ? 'no' : 'yes' };
      if (accused === seat) return { type: a.type, seat, choice: 'no' };
      if (claimedWolf === accused) return { type: a.type, seat, choice: 'yes' };
      if (claims.real?.seat === accused) return { type: a.type, seat, choice: rng.chance(1 - HEURISTIC.trustRealSeer) ? 'yes' : 'no' };
      return { type: a.type, seat, choice: rng.chance(HEURISTIC.confirmYes) ? 'yes' : 'no' };
    }
  }
}

function trustsReal(claims: Claims, rng: Rng): boolean {
  return !claims.fake || rng.chance(HEURISTIC.trustRealSeer);
}

/** Who a village voter follows given public claims (null = no claim to follow). */
function claimTarget(claims: Claims, alive: (x: Seat) => boolean, rng: Rng): Seat | null {
  const realWolf = claims.real?.wolves.find(alive) ?? null;
  const fake = claims.fake && alive(claims.fake.seat) && alive(claims.fake.accuses) ? claims.fake.accuses : null;
  if (realWolf !== null && fake !== null) return rng.chance(HEURISTIC.trustRealSeer) ? realWolf : fake;
  return realWolf ?? fake;
}

/** Current leading nomination candidate (public, open votes). */
function leading(p: Projection): Seat | null {
  if (p.step.kind !== 'day.vote' || !p.step.votes) return null;
  const counts = new Map<Seat, number>();
  for (const v of p.step.votes) if (typeof v === 'number') counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: Seat | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c];
  return best;
}

/** Top suspect from the most recent public nomination tally. */
function lastLeader(p: Projection): Seat | null {
  for (let i = p.publicLog.length - 1; i >= 0; i--) {
    const e = p.publicLog[i];
    if (e?.t === 'nomination') {
      const top = e.tally.find((x) => typeof x.target === 'number' && p.seats[x.target as Seat]?.alive);
      return top ? (top.target as Seat) : null;
    }
  }
  return null;
}
