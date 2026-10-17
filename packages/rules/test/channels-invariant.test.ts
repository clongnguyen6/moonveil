// APPROVED Q25 channel table must hold under EVERY combination of provisional settings.
// Method: (1) prove channelsFor reads only `moderator.speaksInPublic` from config, so no other setting can reach the grant
// function; (2) run full random matches under single toggles, all-flipped, a pairwise covering array over every
// provisional setting, and random combinations, checking an independent oracle at every step for every seat,
// the moderator, and a reconnect (JSON) snapshot. The full product (~12.6M combinations) is not enumerated; (1) shows it
// is unnecessary.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  apply, availableActions, channelsFor, createMatch, DEFAULT_CONFIG, ENUMS, PROVISIONAL, resolveConfig,
  type AvailableAction, type ChannelGrant, type Command, type MatchState, type RulesConfig,
} from '../src/index.ts';
import { nextInt } from '../src/rng.ts';

type Viewer = { kind: 'seat'; seat: number } | { kind: 'moderator' };
const g = (channel: string, listen: boolean, speak: boolean) => ({ channel, listen, speak });

/** Independent oracle, written from the approval text (Human, 2026-10-16; defense 2026-10-18), not from channels.ts. */
function approved(s: MatchState, v: Viewer): ChannelGrant[] | 'moderator' {
  if (s.step.kind === 'ended') return [g('public', true, true)] as ChannelGrant[];
  if (v.kind === 'moderator') return 'moderator'; // listens everywhere; public speech is provisional (checked separately)
  const me = s.seats[v.seat]!;
  const night = s.step.kind === 'night.main' || s.step.kind === 'night.witch';
  if (!me.alive) {
    const pending = s.step.kind === 'hunter' && s.step.pending.includes(me.seat);
    return (pending ? [g('public', true, false)] : [g('public', true, false), g('ghosts', true, true)]) as ChannelGrant[];
  }
  if (night) return (me.role === 'wolf' ? [g('wolves', true, true)] : []) as ChannelGrant[];
  return [g('public', true, true)] as ChannelGrant[]; // every day step, defense included (2026-10-18)
}

/** Every config path channelsFor read, across all checked states (structural proof). */
const READS = new Set<string>();
function spy(o: object, prefix: string): object {
  return new Proxy(o, {
    get(t, k) {
      const path = prefix ? `${prefix}.${String(k)}` : String(k);
      const v = Reflect.get(t, k);
      if (typeof v === 'object' && v !== null) return spy(v, path);
      READS.add(path);
      return v;
    },
  });
}

const SEEN_STEPS: string[] = [];
function checkAll(s: MatchState): void {
  SEEN_STEPS.push(s.step.kind);
  const viewers: Viewer[] = [...s.seats.map((x) => ({ kind: 'seat' as const, seat: x.seat })), { kind: 'moderator' }];
  const snapshot = JSON.parse(JSON.stringify(s)) as MatchState;
  const watched = { ...s, config: spy(s.config, '') as RulesConfig };
  for (const v of viewers) {
    const got = channelsFor(watched, v);
    assert.deepEqual(channelsFor(snapshot, v), got, 'reconnect snapshot differs');
    const want = approved(s, v);
    if (want === 'moderator') {
      assert.deepEqual(got.map((x) => [x.channel, x.listen]), [['public', true], ['wolves', true], ['ghosts', true]], 'moderator listens to all');
      assert.equal(got.find((x) => x.channel === 'wolves')?.speak, false);
      assert.equal(got.find((x) => x.channel === 'ghosts')?.speak, false);
      assert.equal(got.find((x) => x.channel === 'public')?.speak, s.config.moderator.speaksInPublic, 'only provisional part');
    } else {
      assert.deepEqual(got, want, `${JSON.stringify(v)} in ${s.step.kind}`);
    }
  }
}

// ---------- provisional parameter domains (derived from the registry, so new settings are covered automatically) ----------

const get = (c: unknown, path: string) => path.split('.').reduce((o, k) => (o as Record<string, unknown>)[k], c);
function domain(path: string): unknown[] {
  const def = get(DEFAULT_CONFIG, path);
  if (ENUMS[path]) return [...ENUMS[path]];
  if (typeof def === 'boolean') return [def, !def];
  if (typeof def === 'number') return [def, def + 15];
  return [def];
}
const PARAMS = Object.keys(PROVISIONAL).map((path) => ({ path, values: domain(path) }));

function toConfig(row: Record<string, unknown>): Partial<RulesConfig> {
  const out: Record<string, Record<string, unknown> | unknown> = {};
  for (const [path, v] of Object.entries(row)) {
    const [a, b] = path.split('.') as [string, string | undefined];
    if (b === undefined) out[a] = v;
    else out[a] = { ...((out[a] as Record<string, unknown>) ?? {}), [b]: v };
  }
  return out as Partial<RulesConfig>;
}

/** Greedy pairwise covering array (deterministic). */
function pairwise(seed: number): Record<string, unknown>[] {
  const uncovered = new Set<string>();
  const key = (i: number, a: number, j: number, b: number) => `${i}:${a}|${j}:${b}`;
  PARAMS.forEach((p, i) => PARAMS.forEach((q, j) => {
    if (j <= i) return;
    p.values.forEach((_, a) => q.values.forEach((__, b) => uncovered.add(key(i, a, j, b))));
  }));
  const rows: Record<string, unknown>[] = [];
  let rng = seed;
  while (uncovered.size > 0) {
    let best: number[] = [];
    let bestGain = -1;
    for (let t = 0; t < 40; t++) {
      const idx = PARAMS.map((p) => {
        const r = nextInt(rng, p.values.length);
        rng = r.state;
        return r.value;
      });
      let gain = 0;
      for (let i = 0; i < PARAMS.length; i++) for (let j = i + 1; j < PARAMS.length; j++) if (uncovered.has(key(i, idx[i]!, j, idx[j]!))) gain++;
      if (gain > bestGain) [best, bestGain] = [idx, gain];
    }
    for (let i = 0; i < PARAMS.length; i++) for (let j = i + 1; j < PARAMS.length; j++) uncovered.delete(key(i, best[i]!, j, best[j]!));
    rows.push(Object.fromEntries(PARAMS.map((p, i) => [p.path, p.values[best[i]!]])));
  }
  return rows;
}

function combos(): [string, Record<string, unknown>][] {
  const out: [string, Record<string, unknown>][] = [['all defaults', {}]];
  for (const p of PARAMS) for (const v of p.values.slice(1)) out.push([`${p.path}=${String(v)}`, { [p.path]: v }]);
  out.push(['all flipped', Object.fromEntries(PARAMS.map((p) => [p.path, p.values[p.values.length - 1]]))]);
  pairwise(7).forEach((r, i) => out.push([`pairwise #${i}`, r]));
  let rng = 99;
  for (let i = 0; i < 25; i++) {
    out.push([`random #${i}`, Object.fromEntries(PARAMS.map((p) => {
      const r = nextInt(rng, p.values.length);
      rng = r.state;
      return [p.path, p.values[r.value]];
    }))]);
  }
  return out;
}

// ---------- random legal play, checking the oracle after every command ----------

function command(a: AvailableAction, seat: number, pick: (n: number) => number): Command {
  const t = 'targets' in a ? a.targets : [];
  const any = <T, A>(xs: T[], alt: A): T | A => (xs.length && pick(4) ? (xs[pick(xs.length)] as T) : alt);
  switch (a.type) {
    case 'wolf.pick': return { type: a.type, seat, target: any(t, 'pass' as const) };
    case 'seer.inspect': return { type: a.type, seat, target: t[pick(t.length)]! };
    case 'guard.protect': return { type: a.type, seat, target: any(t, 'pass' as const) };
    case 'witch.heal': return { type: a.type, seat, use: a.canUse && pick(2) === 0 };
    case 'witch.poison': return { type: a.type, seat, target: pick(4) === 0 && t.length ? t[pick(t.length)]! : 'pass' };
    case 'vote.nominate': return { type: a.type, seat, target: any(t, 'skip' as const) };
    case 'vote.confirm': return { type: a.type, seat, choice: pick(3) ? 'yes' : 'no' };
    case 'hunter.shoot': return { type: a.type, seat, target: any(t, 'pass' as const) };
  }
}

function play(config: Partial<RulesConfig>, seed: number, players: number): number {
  const r = createMatch({ seed, playerCount: players, config });
  if (!r.ok) return 0; // e.g. a combination that makes the default deck invalid: nothing to check
  let s = r.state;
  let rng = seed ^ 0x2545f491;
  const pick = (n: number) => {
    const x = nextInt(rng, n);
    rng = x.state;
    return x.value;
  };
  let checks = 0;
  checkAll(s);
  for (let i = 0; i < 400 && s.step.kind !== 'ended'; i++) {
    for (const seat of s.seats) {
      for (const a of availableActions(s, seat)) {
        if (s.seats[seat.seat] === undefined || pick(10) === 0) continue;
        const res = apply(s, { kind: 'seat', seat: seat.seat }, command(a, seat.seat, pick));
        if (res.ok) s = res.state;
      }
    }
    if (pick(40) === 0) {
      const living = s.seats.filter((x) => x.alive);
      const res = apply(s, { kind: 'moderator' }, { type: 'player.remove', seat: living[pick(living.length)]!.seat });
      if (res.ok) s = res.state;
      checkAll(s);
      checks++;
      if (s.step.kind === 'ended') break;
    }
    s = (apply(s, { kind: 'system' }, { type: 'step.close' }) as { ok: true; state: MatchState }).state;
    checkAll(s);
    checks++;
  }
  return checks;
}

describe('APPROVED Q25 table holds under every combination of provisional settings', () => {
  it('the approved table holds in full random matches across all combinations', () => {
    const list = combos();
    let checks = 0;
    for (const [name, row] of list) {
      const cfg = toConfig(row);
      resolveConfig(cfg); // every generated combination is a valid config
      for (const [seed, players] of [[11, 7], [12, 10]] as const) {
        try {
          checks += play(cfg, seed + name.length, players);
        } catch (e) {
          throw new Error(`combination "${name}": ${(e as Error).message}`);
        }
      }
    }
    // Defaults + all flipped + every single flip + 25 random rows, plus a non-empty pairwise array (scales with the registry).
    const singles = PARAMS.reduce((n, p) => n + p.values.length - 1, 0);
    assert.ok(list.length > 2 + singles + 25, `${list.length} combinations`);
    assert.ok(checks > 1000, `${checks} checked states`);
    // Structural proof over every checked state: the grant function reads no other setting.
    assert.deepEqual([...READS], ['moderator.speaksInPublic']);
    const kinds = new Set(SEEN_STEPS);
    for (const k of ['night.main', 'night.witch', 'hunter', 'day.discussion', 'day.vote', 'day.defense', 'day.confirm', 'ended']) {
      assert.ok(kinds.has(k), `coverage: step ${k} never checked`);
    }
  });

  it('settings that could violate the table do not exist: removed or mistyped keys are rejected', () => {
    for (const bad of [
      { comms: { livingHearPublicAtNight: true } },
      { comms: { wolvesAtNight: false } },
      { moderator: { speaksInPublic: 'yes' } },
      { moderator: { hearsAll: false } },
      { wolves: { passHandling: 'whatever' } },
      { witch: { seesVictim: 'always' } },
      { timing: { nightTotal: 30 } },
      { timing: { nightMain: 30 } }, // Batch B approved: durations are no longer settings
    ]) {
      assert.throws(() => resolveConfig(bad as never), /invalid rules config/, JSON.stringify(bad));
      const r = createMatch({ seed: 1, playerCount: 7, config: bad as never });
      assert.equal(r.ok, false);
    }
  });
});
