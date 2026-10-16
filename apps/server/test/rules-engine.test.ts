// Conformance: the real @moonveil/rules host engine through Room. Compile-time: createRulesEngine() must satisfy
// the server contract with no cast. Runtime: wire isolation over real projections (PROVISIONAL rule config).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRulesEngine, type HostState } from '@moonveil/rules';
import type { RulesEngine } from '../src/rules/engine.ts';
import { type FakeClient, setup } from './harness.ts';

const conforms: RulesEngine<HostState> = createRulesEngine();
void conforms;

interface Proj {
  step: { kind: string };
  seats: { seat: number; role: string | null }[];
  seatIds: string[];
  me: { seat: number; role: string } | null;
  pack: { seats: number[] } | null;
  moderator: unknown;
}
const proj = (c: FakeClient) => c.view.game as Proj;
const statesOf = (c: FakeClient) => c.states().map((f) => (f.t === 'state' ? f.view : null)!);

// Before the end: a seat may know only its own role, plus fellow wolves if it is a wolf. No moderator data.
function assertRoleIsolation(players: FakeClient[]) {
  for (const p of players) {
    const mine = proj(p).me!;
    const wolves = new Set(proj(p).pack?.seats ?? []);
    for (const v of statesOf(p)) {
      const g = v.game as Proj | null;
      if (!g || g.step.kind === 'ended') continue;
      assert.equal(g.moderator, null, `${p.seat} got moderator data`);
      for (const s of g.seats) {
        if (s.role === null || s.seat === mine.seat) continue;
        assert.ok(mine.role === 'wolf' && wolves.has(s.seat) && s.role === 'wolf', `${p.seat} learned role of seat ${s.seat}`);
      }
      if (mine.role !== 'wolf') assert.equal(g.pack, null, `${p.seat} got pack view`);
    }
  }
}

test('real engine, automatic, 8 players: role isolation, silent wolf pick, night never closes early', () => {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown> });
  const { players, creator } = h.room('automatic', 8);
  creator.send({ t: 'start' });
  assert.equal(creator.view.status, 'playing');
  assert.equal(proj(creator).step.kind, 'night.main');
  assert.equal(proj(creator).seatIds.length, 8);

  const wolves = players.filter((p) => proj(p).me!.role === 'wolf');
  const others = players.filter((p) => proj(p).me!.role !== 'wolf');
  assert.ok(wolves.length >= 1 && others.length >= 1);
  for (const w of wolves) assert.deepEqual([...proj(w).pack!.seats].sort(), wolves.map((x) => proj(x).me!.seat).sort());

  // A wolf's pick reaches wolves only.
  const target = proj(others[0]!).me!.seat;
  const before = others.map((o) => o.frames.length);
  wolves[0]!.send({ t: 'act', ref: 'p', action: { type: 'wolf.pick', target } });
  assert.deepEqual(wolves[0]!.frames.at(-1), { t: 'ack', ref: 'p' });
  others.forEach((o, i) => assert.equal(o.frames.length, before[i], 'non-wolf got a frame from a wolf pick'));

  // Non-wolf trying a wolf command: error to itself only, code passed through.
  others[0]!.send({ t: 'act', action: { type: 'wolf.pick', target } });
  const err = others[0]!.frames.at(-1)!;
  assert.ok(err.t === 'error' && err.code === 'invalid-action', JSON.stringify(err));

  // Night is secret: the timer is the only clock, even after inputs.
  const endsAt = creator.view.phaseEndsAt!;
  h.clock.tick(endsAt - h.clock.now() - 1);
  assert.equal(proj(creator).step.kind, 'night.main');
  h.clock.tick(1);
  assert.notEqual(proj(creator).step.kind, 'night.main');

  // Run a few phases on timers only; isolation holds throughout.
  for (let i = 0; i < 6 && creator.view.status === 'playing'; i++) {
    const e = creator.view.phaseEndsAt;
    if (e === null) break;
    h.clock.tick(e - h.clock.now());
  }
  const seen = new Set(statesOf(creator).map((v) => (v.game as Proj | null)?.step.kind));
  assert.ok(seen.has('day.discussion') && seen.has('night.witch'), `steps seen: ${[...seen].join(',')}`);
  assertRoleIsolation(players);
});

test('real engine, moderator mode: moderator gets moderator projection; players never do', () => {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown> });
  const { players, moderator } = h.room('moderator', 7);
  const mod = moderator!;
  mod.send({ t: 'start' });
  const mv = proj(mod);
  assert.notEqual(mv.moderator, null);
  assert.ok(mv.seats.every((s) => s.role !== null), 'moderator sees all roles');
  // Moderator closes the step through engine.moderate.
  mod.send({ t: 'act', action: { type: 'step.close' } });
  assert.notEqual(proj(players[0]!).step.kind, 'night.main');
  assert.equal(players[0]!.view.phaseEndsAt, null);
  assertRoleIsolation(players);
  // Voice: moderator grants come from the engine's channel policy.
  assert.ok(mod.view.voice.some((g) => g.channel === 'public'));
});
