// Randomized full matches: legal-menu play + invariant checks after every command.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  apply, channelsFor, createMatch, evaluateVictory, project, type Actor, type AvailableAction, type Command, type DeepPartial, type MatchState, type RulesConfig,
} from '../src/index.ts';
import { nextInt } from '../src/rng.ts';

const SECRET_FACT_OWNER = { inspect: 'seer', victim: 'witch', packTarget: 'wolf' } as const;

function checkInvariants(s: MatchState, frozen: Map<number, string>): void {
  const ended = s.step.kind === 'ended';
  const revealed = new Set(s.publicLog.flatMap((e) => (e.t === 'roleRevealed' ? [e.seat] : [])));
  // APPROVED Q20: the only public role reveals before the end are Hunters, at their shot turn.
  for (const e of s.publicLog) if (e.t === 'roleRevealed') assert.equal(e.role, 'hunter', `non-hunter reveal of ${e.seat}`);
  const turns = new Set(s.publicLog.flatMap((e) => (e.t === 'hunterTurn' ? e.seats : [])));
  for (const r of revealed) assert.ok(turns.has(r), `hunter ${r} revealed without a shot turn`);
  for (const v of s.seats) {
    const p = project(s, { kind: 'seat', seat: v.seat });
    for (const sv of p.seats) {
      if (sv.role === null) continue;
      const ok = sv.seat === v.seat || ended || revealed.has(sv.seat) || (v.role === 'wolf' && s.seats[sv.seat]?.role === 'wolf');
      assert.ok(ok, `seat ${v.seat} sees role of ${sv.seat}`);
    }
    assert.equal(p.pack !== null, v.role === 'wolf');
    if (p.pack?.picks) assert.ok(v.alive && s.step.kind === 'night.main');
    assert.equal(p.moderator, null);
    assert.deepEqual(p.me?.facts, s.knowledge[v.seat]);
    const ch = channelsFor(s, { kind: 'seat', seat: v.seat }).map((g) => g.channel);
    if (!ended) {
      assert.ok(!ch.includes('wolves') || (v.alive && v.role === 'wolf'), `seat ${v.seat} on wolf channel`);
      const pendingHunter = s.step.kind === 'hunter' && s.step.pending.includes(v.seat);
      assert.equal(ch.includes('ghosts'), !v.alive && !pendingHunter, `ghost channel for ${v.seat}`);
    }
    const facts = s.knowledge[v.seat] ?? [];
    for (const f of facts) {
      if (f.k in SECRET_FACT_OWNER) assert.equal(v.role, SECRET_FACT_OWNER[f.k as keyof typeof SECRET_FACT_OWNER], `${f.k} fact held by ${v.role}`);
    }
    // APPROVED Q03 entitlement: victim facts only up to (and including) the night the heal was used.
    const heal = facts.find((f) => f.k === 'own' && f.act === 'heal');
    const healNight = heal && heal.k === 'own' ? heal.night : Infinity;
    for (const f of facts) if (f.k === 'victim') assert.ok(f.night <= healNight, 'victim fact after heal used');
    // APPROVED day votes: no non-moderator view carries other seats' ballots or interim tallies.
    if (s.step.kind === 'day.vote' || s.step.kind === 'day.confirm') {
      assert.equal((p.step as { votes: unknown }).votes, null, 'interim ballots leaked');
    }
    if (!v.alive) {
      const snap = JSON.stringify(facts);
      if (!frozen.has(v.seat)) frozen.set(v.seat, snap);
      assert.equal(snap, frozen.get(v.seat), `ghost ${v.seat} ledger changed`);
      const acts = p.me?.actions ?? [];
      assert.ok(acts.every((a) => a.type === 'hunter.shoot'), 'ghost has only the hunter shot');
    }
  }
  const pub = project(s, { kind: 'public' });
  assert.ok(pub.seats.every((x) => x.role === null || ended || revealed.has(x.seat)));
  const v = evaluateVictory(s.seats);
  if (ended) {
    if (s.outcome?.winner !== 'aborted') assert.deepEqual(s.outcome, v);
  } else if (v !== null) {
    assert.equal(s.step.kind, 'hunter', 'victory reached but match continues outside a hunter turn');
  }
}

function commandFor(a: AvailableAction, seat: number, pick: (n: number) => number): Command {
  const choose = <T>(xs: T[]): T => xs[pick(xs.length)] as T;
  switch (a.type) {
    case 'wolf.pick': return { type: a.type, seat, target: a.targets.length && pick(5) ? choose(a.targets) : 'pass' };
    case 'seer.inspect': return { type: a.type, seat, target: choose(a.targets) };
    case 'guard.protect': return { type: a.type, seat, target: a.targets.length && pick(4) ? choose(a.targets) : 'pass' };
    case 'witch.heal': return { type: a.type, seat, use: a.canUse && pick(3) === 0 };
    case 'witch.poison': return { type: a.type, seat, target: a.targets.length && pick(4) === 0 ? choose(a.targets) : 'pass' };
    case 'vote.nominate': return { type: a.type, seat, target: a.targets.length && pick(5) ? choose(a.targets) : 'skip' };
    case 'vote.confirm': return { type: a.type, seat, choice: pick(3) ? 'yes' : 'no' };
    case 'hunter.shoot': return { type: a.type, seat, target: a.targets.length && pick(4) ? choose(a.targets) : 'pass' };
  }
}

function simulate(seed: number, players: number, config: DeepPartial<RulesConfig>): MatchState {
  const r = createMatch({ seed, playerCount: players, config });
  assert.ok(r.ok);
  let s = r.state;
  let rng = seed ^ 0x9e3779b9;
  const pick = (n: number) => { const x = nextInt(rng, n); rng = x.state; return x.value; };
  const frozen = new Map<number, string>();
  const run = (actor: Actor, cmd: Command) => {
    const res = apply(s, actor, cmd);
    assert.ok(res.ok, `${cmd.type} rejected: ${!res.ok && res.error.message}`);
    s = res.state;
    checkInvariants(s, frozen);
  };
  checkInvariants(s, frozen);
  for (let i = 0; i < 500 && s.step.kind !== 'ended'; i++) {
    for (const seat of s.seats) {
      const types = (project(s, { kind: 'seat', seat: seat.seat }).me?.actions ?? []).map((a) => a.type);
      for (const type of types) {
        if (pick(10) === 0) continue;
        // Re-project before each action: an earlier action can change later menus (e.g. one potion per night).
        const p = project(s, { kind: 'seat', seat: seat.seat });
        const a = p.me?.actions.find((x) => x.type === type);
        if (!a) continue;
        // Wolves usually follow an existing pack pick (realistic coordination; keeps 'unanimous' matches short).
        const packPick = p.pack?.picks?.find((x) => x !== null);
        const cmd: Command =
          a.type === 'wolf.pick' && packPick != null && pick(5) ? { type: 'wolf.pick', seat: seat.seat, target: packPick } : commandFor(a, seat.seat, pick);
        run({ kind: 'seat', seat: seat.seat }, cmd);
      }
    }
    if (pick(60) === 0) {
      const living = s.seats.filter((x) => x.alive);
      run({ kind: 'moderator' }, { type: 'player.remove', seat: (living[pick(living.length)] as { seat: number }).seat });
      if ((s.step.kind as string) === 'ended') break;
    }
    run({ kind: 'system' }, { type: 'step.close' });
  }
  assert.equal(s.step.kind, 'ended', `seed ${seed} did not end`);
  return s;
}

const VARIANTS: [string, DeepPartial<RulesConfig>][] = [
  ['defaults', {}],
  ['cause at dawn + no history at end', { reveal: { causeAtDawn: true, historyAtEnd: false } }],
  ['totals only at close, who-voted shown, passes ignored', { day: { revealBallotsAtClose: false, showWhoVoted: true }, wolves: { passHandling: 'ignored' } }],
];

describe('randomized matches', () => {
  for (const [name, cfg] of VARIANTS) {
    it(`${name}: 6-16 players x 4 seeds terminate with invariants intact`, () => {
      const winners: Record<string, number> = {};
      for (let n = 6; n <= 16; n++) {
        for (let k = 0; k < 4; k++) {
          const s = simulate(n * 1000 + k, n, cfg);
          const w = s.outcome?.winner ?? 'none';
          winners[w] = (winners[w] ?? 0) + 1;
        }
      }
      assert.ok((winners.wolves ?? 0) > 0 && (winners.village ?? 0) > 0, JSON.stringify(winners));
    });
  }

  it('same seed + same commands -> identical state; state survives JSON', () => {
    const a = simulate(4242, 9, {});
    const b = simulate(4242, 9, {});
    assert.deepEqual(a, b);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  });
});
