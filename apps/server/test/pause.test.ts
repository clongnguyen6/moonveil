// Approved pause rule (automatic mode): timers pause while ALL player seats are disconnected and resume
// when any player reconnects; remaining time is exact; paused wall time never expires a phase.
// Presence trigger + server timers are foundation's; the clock is the engine's (rules API v0.3).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRulesEngine } from '@moonveil/rules';
import type { RulesEngine } from '../src/rules/engine.ts';
import { type FakeClient, setup } from './harness.ts';
import { stepKind } from './match-driver.ts';

function started(seed: string) {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed });
  const room = h.room('automatic', 8);
  room.creator.send({ t: 'start' });
  return { h, ...room };
}
const resume = (h: ReturnType<typeof setup>, old: FakeClient) => {
  const c = h.client();
  c.send({ t: 'resume', code: old.code!, token: old.token! });
  return c;
};
const game = (c: FakeClient) => JSON.stringify(c.view.game);

test('all players disconnected: phase pauses; a long pause never expires it; one reconnect resumes with exact remaining time', () => {
  const m = started('pause-exact');
  assert.equal(stepKind(m.creator), 'night.main');
  // Automatic rooms have no moderator seat, so only player seats can hold the clock (rule: moderator/spectator don't).
  assert.equal(m.creator.view.moderator, null);
  const deadline = m.creator.view.phaseEndsAt!;
  m.h.clock.tick(15_000);
  const remaining = deadline - m.h.clock.now();
  const logBefore = JSON.stringify((m.players[3]!.view.game as { publicLog: unknown }).publicLog);
  for (const p of m.players) p.drop();
  m.h.clock.tick(6 * 60 * 60_000 + 7_777); // ~6 h away; not a multiple of any phase cycle
  const back = resume(m.h, m.players[3]!);
  const g = back.view.game as { night: number; publicLog: unknown };
  assert.equal(stepKind(back), 'night.main', 'phase expired during pause');
  assert.equal(g.night, 1, 'match advanced during pause');
  assert.equal(JSON.stringify(g.publicLog), logBefore, 'events happened during pause');
  assert.equal(back.view.phaseEndsAt, m.h.clock.now() + remaining, 'exact remaining time');
  m.h.clock.tick(remaining - 1);
  assert.equal(stepKind(back), 'night.main');
  m.h.clock.tick(1);
  assert.equal(stepKind(back), 'night.witch');
});

test('a single connected player keeps the clock running (pause needs ALL players gone)', () => {
  const m = started('pause-partial');
  const deadline = m.creator.view.phaseEndsAt!;
  for (const p of m.players.slice(1)) p.drop();
  m.h.clock.tick(deadline - m.h.clock.now());
  assert.equal(stepKind(m.players[0]!), 'night.witch');
});

test('reconnect after a pause: same identity, role and knowledge; nothing extra', () => {
  const m = started('pause-knowledge');
  const before = m.players.map((p) => ({ seat: p.seat, game: game(p) }));
  for (const p of m.players) p.drop();
  m.h.clock.tick(60 * 60_000);
  const back = m.players.map((p) => resume(m.h, p));
  back.forEach((c, i) => {
    assert.equal(c.seat, before[i]!.seat);
    assert.equal(game(c), before[i]!.game, 'game view changed across pause/reconnect');
  });
});

test('secret phase: others see nothing of who was absent (no frames, presence frozen)', () => {
  const m = started('pause-presence');
  const [a, b, ...rest] = m.players as [FakeClient, FakeClient, ...FakeClient[]];
  const marks = rest.map((r) => r.frames.length);
  a.drop();
  const a2 = resume(m.h, a);
  b.drop();
  rest.forEach((r, i) => assert.equal(r.frames.length, marks[i], 'frame caused by a drop during a secret phase'));
  // Everyone leaves (pause), then players return one by one: each sees everyone as connected (frozen at night start).
  for (const p of [a2, ...rest]) p.drop();
  m.h.clock.tick(10 * 60_000);
  const first = resume(m.h, rest[0]!);
  assert.equal(stepKind(first), 'night.main');
  assert.ok(first.view.players.every((p) => p.connected), 'presence of absent players leaked at night');
});

test('pause only applies while playing in automatic mode; moderator mode has no timers', () => {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed: 'pause-mod' });
  const room = h.room('moderator', 8);
  room.moderator!.send({ t: 'start' });
  assert.equal(room.moderator!.view.phaseEndsAt, null);
  for (const p of room.players) p.drop();
  h.clock.tick(60 * 60_000);
  assert.equal(stepKind(room.moderator!), 'night.main', 'moderator drives the pace');
});
