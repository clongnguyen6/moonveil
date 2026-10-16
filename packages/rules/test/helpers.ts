import assert from 'node:assert/strict';
import { apply, type Actor, type Command, type DeepPartial, type MatchState, type Role, type RulesConfig, type Seat } from '../src/index.ts';
import { createMatchUnchecked } from '../src/engine.ts';

export const S = (seat: Seat): Actor => ({ kind: 'seat', seat });
export const MOD: Actor = { kind: 'moderator' };
export const SYS: Actor = { kind: 'system' };

/** Standard 7-seat table: 0,1 wolf; 2 seer; 3 guard; 4 witch; 5 hunter; 6 villager. */
export const ROLES7: Role[] = ['wolf', 'wolf', 'seer', 'guard', 'witch', 'hunter', 'villager'];

export function match(roles: Role[] = ROLES7, config: DeepPartial<RulesConfig> = {}, seed = 'test'): MatchState {
  // Synthetic tables (e.g. 3 seats) use the test-only unchecked constructor; Batch A validation is tested explicitly.
  const r = createMatchUnchecked({ seed, roles, config });
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
}

export function ok(state: MatchState, actor: Actor, cmd: Command): MatchState {
  const r = apply(state, actor, cmd);
  if (!r.ok) assert.fail(`${cmd.type} rejected: ${r.error.code} ${r.error.message}`);
  return r.state;
}

export function rejects(state: MatchState, actor: Actor, cmd: Command, code?: string): void {
  const r = apply(state, actor, cmd);
  assert.equal(r.ok, false, `${cmd.type} should be rejected`);
  if (code && !r.ok) assert.equal(r.error.code, code);
}

export const close = (s: MatchState) => ok(s, SYS, { type: 'step.close' });

export interface NightPlan {
  bite?: Seat | 'pass';
  inspect?: Seat;
  protect?: Seat | 'pass';
  heal?: boolean;
  poison?: Seat | 'pass';
}

/** Play night.main + night.witch with the given plan. Every living wolf picks `bite`. */
export function night(state: MatchState, plan: NightPlan): MatchState {
  let s = state;
  assert.equal(s.step.kind, 'night.main');
  const living = (r: Role) => s.seats.filter((x) => x.alive && x.role === r).map((x) => x.seat);
  if (plan.bite !== undefined) for (const w of living('wolf')) s = ok(s, S(w), { type: 'wolf.pick', seat: w, target: plan.bite });
  if (plan.inspect !== undefined) for (const x of living('seer')) s = ok(s, S(x), { type: 'seer.inspect', seat: x, target: plan.inspect });
  if (plan.protect !== undefined) for (const x of living('guard')) s = ok(s, S(x), { type: 'guard.protect', seat: x, target: plan.protect });
  s = close(s);
  if (s.step.kind === 'night.witch') {
    if (plan.heal !== undefined) for (const x of living('witch')) s = ok(s, S(x), { type: 'witch.heal', seat: x, use: plan.heal });
    if (plan.poison !== undefined) for (const x of living('witch')) s = ok(s, S(x), { type: 'witch.poison', seat: x, target: plan.poison });
    s = close(s);
  }
  return s;
}

/** Day with everyone living voting `target` (or per-seat map), then Yes/No by `confirm`. */
export function day(state: MatchState, target: Seat | 'skip' | Record<number, Seat | 'skip'>, confirm: 'yes' | 'no' = 'yes'): MatchState {
  let s = state;
  assert.equal(s.step.kind, 'day.discussion');
  s = close(s);
  for (const x of s.seats.filter((q) => q.alive)) {
    const t = typeof target === 'object' ? target[x.seat] : target;
    if (t === undefined || t === x.seat) continue;
    s = ok(s, S(x.seat), { type: 'vote.nominate', seat: x.seat, target: t });
  }
  s = close(s);
  if (s.step.kind === 'day.defense') s = close(s);
  if (s.step.kind === 'day.confirm') {
    for (const x of s.seats.filter((q) => q.alive)) s = ok(s, S(x.seat), { type: 'vote.confirm', seat: x.seat, choice: confirm });
    s = close(s);
  }
  return s;
}

export const alive = (s: MatchState) => s.seats.filter((x) => x.alive).map((x) => x.seat);
export const lastLog = (s: MatchState, t: string) => [...s.publicLog].reverse().find((e) => e.t === t);
