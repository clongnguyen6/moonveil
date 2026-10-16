// Server behaviour for the aligned host contract (rules host.ts): moderate, earlyClose, moderator channels.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EARLY_CLOSE_GRACE_MS } from '../src/room.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine, type FixtureState } from '../src/rules/fixture-engine.ts';
import { game, setup } from './harness.ts';

const errCode = (c: { errors(): { t: string }[] }) => (c.errors().at(-1) as { code?: string; message?: string } | undefined);

test('automatic: public phase closes early after grace once engine says earlyClose', () => {
  const h = setup({ fixture: { hiddenMs: 30_000, openMs: 60_000 } });
  const { players, creator } = h.room('automatic', 4);
  creator.send({ t: 'start' });
  h.clock.tick(30_000);
  assert.equal(game(creator).phase, 'open');
  for (const p of players.slice(0, 3)) p.send({ t: 'act', action: { kind: 'done' } });
  h.clock.tick(EARLY_CLOSE_GRACE_MS * 2);
  assert.equal(game(creator).phase, 'open', 'not everyone done');
  players[3]!.send({ t: 'act', action: { kind: 'done' } });
  h.clock.tick(EARLY_CLOSE_GRACE_MS - 1);
  assert.equal(game(creator).phase, 'open', 'grace not elapsed');
  h.clock.tick(1);
  assert.equal(game(creator).phase, 'hidden', 'closed early, long before the 60 s deadline');
});

test('automatic: server never closes a secret phase early, even if the engine says so', () => {
  const base = createFixtureEngine({ hiddenMs: 30_000, openMs: 30_000 });
  const lying: RulesEngine<FixtureState> = { ...base, phase: (s) => ({ ...base.phase(s), earlyClose: true }) };
  const h = setup({ engine: () => lying as RulesEngine<unknown> });
  const { players, creator } = h.room('automatic', 4);
  creator.send({ t: 'start' });
  const member = players.find((p) => game(p).me!.inGroup)!;
  member.send({ t: 'act', action: { kind: 'mark', target: creator.seat } });
  h.clock.tick(29_999);
  assert.equal(game(creator).phase, 'hidden');
  h.clock.tick(1);
  assert.equal(game(creator).phase, 'open');
});

test('moderator mode: moderator act -> engine.moderate; players cannot moderate; errors to actor only', () => {
  const h = setup();
  const { players, moderator } = h.room('moderator', 4);
  const mod = moderator!;
  mod.send({ t: 'start' });
  const before = players.map((p) => p.frames.length);
  players[0]!.send({ t: 'act', action: { kind: 'close' } });
  assert.match(errCode(players[0]!)!.message!, /bad action|not allowed/);
  players.forEach((p, i) => assert.equal(p.frames.length - before[i]!, i === 0 ? 1 : 0));
  mod.send({ t: 'act', action: { kind: 'nope' } });
  assert.equal(errCode(mod)!.message, 'forbidden: fixture: only close');
  mod.send({ t: 'act', action: { kind: 'close' } });
  assert.equal(game(players[0]!).phase, 'open');
  assert.equal(players[0]!.view.phaseEndsAt, null, 'moderator mode: no timers after moderate');
});

test('moderator voice grants come from the engine', () => {
  const h = setup();
  const { moderator } = h.room('moderator', 4);
  moderator!.send({ t: 'start' });
  assert.deepEqual(h.voice.grants.get(`${moderator!.code}/${moderator!.seat}`), [{ channel: 'public', listen: true, speak: true }]);
  assert.deepEqual(moderator!.view.voice, [{ channel: 'public', listen: true, speak: true }]);
});
