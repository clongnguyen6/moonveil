// Balance-screening bots (PROVISIONAL tooling). NOT players: crude, explicit policies that only screen for obviously
// broken setups (Q17/Q18). Bots act on their own seat projection plus a modelled public-speech table. Hidden state
// is used in exactly two documented places: the noisy "social read" weight and which wolf counter-claims.
import {
  apply, createMatch, project, stepTiming,
  type AvailableAction, type Command, type DeckCounts, type DeepPartial, type MatchState, type Projection, type RulesConfig, type Seat,
} from '../src/index.ts';
import { nextInt, nextRandom } from '../src/rng.ts';

export type PolicyName = 'random' | 'heuristic';

/** Heuristic knobs: every one is an assumption about human play. Override per run via playMatch({ knobs }). */
export const HEURISTIC_DEFAULTS = {
  /** Social read: a living wolf is this many times more likely than a villager to be suspected (1 = no read). */
  wolfSuspicionWeight: 1.5,
  /** Chance a villager repeats the currently most-accused player instead of its own read. */
  bandwagon: 0.5,
  /** Chance a villager votes Skip when no claim guides it. */
  skip: 0.1,
  /** When the real Seer claims, chance a living wolf counter-claims (accusing the real Seer). */
  counterClaim: 0.5,
  /** With two Seer claims, chance a villager trusts the real one. */
  trustRealSeer: 0.6,
  /** Yes/No: chance a villager votes Yes on an accused with no claim information. */
  confirmYes: 0.65,
  /** Chance a Guard protects itself when there is no Seer claim to protect. */
  guardSelf: 0.2,
  /** Open ballots (approved): chance a villager without a claim to follow joins the current live vote leader. */
  followLiveVotes: 0.4,
  /** Smarter village: the Seer claims publicly by this day even without having found a wolf (99 = only after finding one). */
  seerClaimDay: 99,
  /** Smarter village: villagers never accuse, and vote No on, a player cleared by a Seer they trust. */
  respectClears: false,
};
/** Sensitivity preset bounding the bot artifact (village coordinates around the Seer). */
export const SMART_VILLAGE: Partial<typeof HEURISTIC_DEFAULTS> = { seerClaimDay: 2, respectClears: true, trustRealSeer: 0.9, followLiveVotes: 0.2 };
export type Knobs = typeof HEURISTIC_DEFAULTS;
let K: Knobs = HEURISTIC_DEFAULTS;

class Rng {
  s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
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
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
    }
    return xs;
  }
}

/** Public speech: Seer claims and the day's spoken accusations. */
interface Table {
  real: { seat: Seat; wolves: Seat[]; clears: Seat[] } | null;
  fake: { seat: Seat; accuses: Seat } | null;
  /** Seat -> who they accused aloud in today's discussion. */
  accusations: Map<Seat, Seat>;
}

export interface MatchResult {
  winner: string;
  nights: number;
  /** Sum of full step durations entered (votes and nights always run to deadline; Hunter counted at full 20 s). */
  seconds: number;
  executions: { wolf: number; village: number };
}

export function playMatch(opts: {
  seed: number;
  players: number;
  policy: PolicyName;
  deck?: DeckCounts;
  config?: DeepPartial<RulesConfig>;
  knobs?: Partial<Knobs>;
}): MatchResult {
  K = { ...HEURISTIC_DEFAULTS, ...opts.knobs };
  const r = createMatch({ seed: opts.seed, playerCount: opts.players, deck: opts.deck, config: { players: { min: 3, max: 30 }, ...opts.config } });
  if (!r.ok) throw new Error(r.error.message);
  let s = r.state;
  const rng = new Rng(opts.seed ^ 0x5bd1e995);
  const table: Table = { real: null, fake: null, accusations: new Map() };
  let seconds = 0;
  let seq = -1;
  const act = (seat: Seat, cmd: Command | null) => {
    if (!cmd) return;
    const res = apply(s, { kind: 'seat', seat }, cmd);
    if (res.ok) s = res.state;
  };
  for (let guard = 0; guard < 3000 && s.step.kind !== 'ended'; guard++) {
    if (s.stepSeq !== seq) {
      seq = s.stepSeq;
      seconds += stepTiming(s).seconds;
      if (s.step.kind === 'day.discussion') {
        table.accusations.clear();
        if (opts.policy === 'heuristic') discuss(s, table, rng);
      }
    }
    for (const seat of rng.shuffle(s.seats.map((x) => x.seat))) {
      const types = (project(s, { kind: 'seat', seat }).me?.actions ?? []).map((a) => a.type);
      for (const type of types) {
        const p = project(s, { kind: 'seat', seat }); // re-project: an earlier action can change later menus
        const a = p.me?.actions.find((x) => x.type === type);
        if (!a || hasActed(a)) continue;
        act(seat, opts.policy === 'random' ? randomChoice(a, seat, rng) : heuristicChoice(a, p, s, table, rng));
      }
    }
    const closed = apply(s, { kind: 'system' }, { type: 'step.close' });
    if (!closed.ok) throw new Error(closed.error.message);
    s = closed.state;
  }
  const executions = { wolf: 0, village: 0 };
  for (const e of s.publicLog) if (e.t === 'executed') executions[s.seats[e.seat]?.role === 'wolf' ? 'wolf' : 'village']++;
  return { winner: s.outcome?.winner ?? 'timeout', nights: s.night, seconds, executions };
}

const hasActed = (a: AvailableAction) => 'current' in a && a.current !== null;

// ---------- random policy: uniform over legal options ----------

function randomChoice(a: AvailableAction, seat: Seat, rng: Rng): Command | null {
  const t = 'targets' in a ? a.targets : [];
  switch (a.type) {
    case 'wolf.pick':
    case 'seer.inspect':
      return t.length ? { type: a.type, seat, target: rng.pick(t) } : null;
    case 'guard.protect':
    case 'hunter.shoot':
      return { type: a.type, seat, target: t.length ? rng.pick(t) : 'pass' };
    case 'witch.heal':
      return { type: a.type, seat, use: a.canUse && rng.chance(0.5) };
    case 'witch.poison':
      return { type: a.type, seat, target: t.length && rng.chance(0.25) ? rng.pick(t) : 'pass' };
    case 'vote.nominate':
      return { type: a.type, seat, target: !t.length || rng.chance(1 / (t.length + 1)) ? 'skip' : rng.pick(t) };
    case 'vote.confirm':
      return { type: a.type, seat, choice: rng.chance(0.5) ? 'yes' : 'no' };
  }
}

// ---------- heuristic policy ----------

function seerResults(p: Projection): { wolves: Seat[]; clears: Seat[] } {
  const f = p.me?.facts ?? [];
  return {
    wolves: f.flatMap((x) => (x.k === 'inspect' && x.result === 'wolf' ? [x.target] : [])),
    clears: f.flatMap((x) => (x.k === 'inspect' && x.result !== 'wolf' ? [x.target] : [])),
  };
}

/** Discussion: the Seer may claim; then every living player accuses someone aloud, in random order. */
function discuss(s: MatchState, table: Table, rng: Rng): void {
  const alive = s.seats.filter((x) => x.alive).map((x) => x.seat);
  const isAlive = (x: Seat) => alive.includes(x);
  if (table.real && isAlive(table.real.seat)) Object.assign(table.real, seerResults(project(s, { kind: 'seat', seat: table.real.seat })));
  if (!table.real) {
    for (const seat of alive) {
      const p = project(s, { kind: 'seat', seat });
      if (p.me?.role !== 'seer') continue;
      const res = seerResults(p);
      if (res.wolves.some(isAlive) || s.day >= K.seerClaimDay) {
        table.real = { seat, ...res };
        // Documented hidden-state use #2: which living wolf counter-claims.
        const wolves = s.seats.filter((x) => x.alive && x.role === 'wolf');
        if (wolves.length && rng.chance(K.counterClaim)) table.fake = { seat: rng.pick(wolves).seat, accuses: seat };
      }
    }
  }
  for (const seat of rng.shuffle([...alive])) {
    const p = project(s, { kind: 'seat', seat });
    const target = accuse(p, s, table, rng);
    if (target !== null) table.accusations.set(seat, target);
  }
}

function mostAccused(table: Table, alive: (x: Seat) => boolean, exclude: Set<Seat> = new Set()): Seat | null {
  const counts = new Map<Seat, number>();
  for (const t of table.accusations.values()) if (alive(t) && !exclude.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best: Seat | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c];
  return best;
}

function claimTarget(table: Table, alive: (x: Seat) => boolean, rng: Rng): Seat | null {
  const realWolf = table.real?.wolves.find(alive) ?? null;
  const fake = table.fake && alive(table.fake.seat) && alive(table.fake.accuses) ? table.fake.accuses : null;
  if (realWolf !== null && fake !== null) return rng.chance(K.trustRealSeer) ? realWolf : fake;
  return realWolf ?? fake;
}

/** Who this seat accuses aloud. */
function accuse(p: Projection, s: MatchState, table: Table, rng: Rng): Seat | null {
  const me = p.me;
  if (!me) return null;
  const alive = (x: Seat) => p.seats[x]?.alive === true;
  const others = p.seats.filter((x) => x.alive && x.seat !== me.seat).map((x) => x.seat);
  if (!others.length) return null;
  const pack = new Set(p.pack?.seats ?? []);
  if (me.role === 'wolf') {
    const lead = mostAccused(table, alive, pack);
    if (lead !== null) return lead;
    if (table.real && alive(table.real.seat)) return table.real.seat;
    const v = others.filter((x) => !pack.has(x));
    return v.length ? rng.pick(v) : null;
  }
  if (table.real?.seat === me.seat) return table.real.wolves.find(alive) ?? null;
  const follow = claimTarget(table, alive, rng);
  if (follow !== null && follow !== me.seat) return follow;
  const lead = mostAccused(table, alive, K.respectClears ? new Set(table.real?.clears ?? []) : new Set());
  if (lead !== null && lead !== me.seat && rng.chance(K.bandwagon)) return lead;
  const cleared = new Set(table.real?.clears ?? []);
  const pool = others.filter((x) => !cleared.has(x));
  // Documented hidden-state use #1: the noisy social read weights true wolves by wolfSuspicionWeight.
  return rng.weighted(pool.length ? pool : others, (x) => (s.seats[x]?.role === 'wolf' ? K.wolfSuspicionWeight : 1));
}

/** Current live nomination leader from the open ballots (optionally excluding the pack). */
function liveLeader(p: Projection, pack: Set<Seat>, excludePack: boolean): Seat | null {
  if (p.step.kind !== 'day.vote') return null;
  const counts = new Map<Seat, number>();
  for (const v of p.step.votes) if (typeof v === 'number' && !(excludePack && pack.has(v))) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: Seat | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c];
  return best;
}

function heuristicChoice(a: AvailableAction, p: Projection, s: MatchState, table: Table, rng: Rng): Command | null {
  const me = p.me;
  if (!me) return null;
  const seat = me.seat;
  const t = 'targets' in a ? a.targets : [];
  const alive = (x: Seat) => p.seats[x]?.alive === true;
  const pack = new Set(p.pack?.seats ?? []);
  const claimedWolf = table.real?.wolves.find(alive) ?? null;
  switch (a.type) {
    case 'wolf.pick': {
      if (table.real && t.includes(table.real.seat)) return { type: a.type, seat, target: table.real.seat };
      const existing = p.pack?.picks?.find((x) => typeof x === 'number');
      if (typeof existing === 'number' && t.includes(existing)) return { type: a.type, seat, target: existing };
      return t.length ? { type: a.type, seat, target: rng.pick(t) } : null;
    }
    case 'seer.inspect': {
      const seen = new Set(me.facts.flatMap((f) => (f.k === 'inspect' ? [f.target] : [])));
      const fresh = t.filter((x) => !seen.has(x));
      return t.length ? { type: a.type, seat, target: rng.pick(fresh.length ? fresh : t) } : null;
    }
    case 'guard.protect': {
      if (table.real && t.includes(table.real.seat)) return { type: a.type, seat, target: table.real.seat };
      if (t.includes(seat) && rng.chance(K.guardSelf)) return { type: a.type, seat, target: seat };
      const others = t.filter((x) => x !== seat);
      return { type: a.type, seat, target: others.length ? rng.pick(others) : 'pass' };
    }
    case 'witch.heal':
      return { type: a.type, seat, use: a.canUse };
    case 'witch.poison': {
      const trusted = claimedWolf !== null && (!table.fake || rng.chance(K.trustRealSeer));
      return { type: a.type, seat, target: trusted && t.includes(claimedWolf) ? claimedWolf : 'pass' };
    }
    case 'hunter.shoot': {
      const sus = claimedWolf ?? mostAccused(table, alive, new Set([seat]));
      return { type: a.type, seat, target: sus !== null && t.includes(sus) ? sus : t.length ? rng.pick(t) : 'pass' };
    }
    case 'vote.nominate': {
      // Ballots are open and live (approved): voters see the current leader as well as what was said aloud.
      const live = liveLeader(p, pack, false);
      if (me.role === 'wolf') {
        const wolfLive = liveLeader(p, pack, true);
        const lead = wolfLive ?? mostAccused(table, alive, pack);
        const v = t.filter((x) => !pack.has(x));
        return { type: a.type, seat, target: lead !== null && t.includes(lead) ? lead : v.length ? rng.pick(v) : 'skip' };
      }
      if (claimedWolf === null && live !== null && live !== seat && t.includes(live) && rng.chance(K.followLiveVotes)) {
        return { type: a.type, seat, target: live };
      }
      const said = table.accusations.get(seat);
      if (said !== undefined && t.includes(said) && !(claimedWolf === null && rng.chance(K.skip))) return { type: a.type, seat, target: said };
      return { type: a.type, seat, target: 'skip' };
    }
    case 'vote.confirm': {
      const accused = s.step.kind === 'day.confirm' ? s.step.accused : null;
      if (accused === null) return null;
      if (me.role === 'wolf') return { type: a.type, seat, choice: pack.has(accused) ? 'no' : 'yes' };
      if (accused === seat) return { type: a.type, seat, choice: 'no' };
      if (claimedWolf === accused) return { type: a.type, seat, choice: 'yes' };
      if (table.real?.seat === accused) return { type: a.type, seat, choice: rng.chance(1 - K.trustRealSeer) ? 'yes' : 'no' };
      if (K.respectClears && table.real?.clears.includes(accused) && rng.chance(K.trustRealSeer)) return { type: a.type, seat, choice: 'no' };
      if (table.accusations.get(seat) === accused) return { type: a.type, seat, choice: 'yes' };
      return { type: a.type, seat, choice: rng.chance(K.confirmYes) ? 'yes' : 'no' };
    }
  }
}
