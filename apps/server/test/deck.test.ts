// Host deck customization (approved Batch A; UI proposal P12). Expectations come from the engine's own deck
// functions (no hard-coded role tables), so rule-table changes don't break these tests.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView, ServerMessage } from '@moonveil/protocol';
import { createHostedRulesEngine } from '../src/rules/decks.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { type FakeClient, profile, setup } from './harness.ts';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
const lastError = (c: FakeClient) => c.frames.filter((f): f is Msg<'error'> => f.t === 'error').at(-1);
const hosted = () => createHostedRulesEngine() as RulesEngine<unknown>;

// A different valid deck for n players: move one villager to another role if the engine accepts it.
function altDeck(n: number): Record<string, number> {
  const eng = createHostedRulesEngine();
  const base = eng.decks!.default(n)!;
  for (const role of Object.keys(base)) {
    if (role === 'villager' || !base.villager) continue;
    const cand = { ...base, villager: base.villager - 1, [role]: (base[role] ?? 0) + 1 };
    if (eng.decks!.validate(cand, n) === null) return cand;
  }
  for (const role of Object.keys(base)) {
    if (role === 'villager' || !base[role]) continue;
    const cand = { ...base, villager: (base.villager ?? 0) + 1, [role]: base[role]! - 1 };
    if (eng.decks!.validate(cand, n) === null) return cand;
  }
  throw new Error('no alternative deck found');
}

test('lobby deck: default shown to all; host sets/resets custom; invalid -> error to host only', () => {
  const h = setup({ engine: hosted, seed: 'deck' });
  const { creator, players } = h.room('automatic', 8);
  const eng = createHostedRulesEngine();
  for (const p of players) assert.deepEqual(p.view.deck, { default: eng.decks!.default(8), custom: null, error: null });
  const custom = altDeck(8);
  creator.send({ t: 'deck', ref: 'd', counts: custom });
  assert.deepEqual(creator.frames.at(-1), { t: 'ack', ref: 'd' });
  for (const p of players) assert.deepEqual(p.view.deck!.custom, custom);
  // invalid: everyone a wolf
  const before = players.slice(1).map((p) => p.frames.length);
  creator.send({ t: 'deck', counts: { wolf: 8 } });
  assert.equal(lastError(creator)!.code, 'invalid-action');
  players.slice(1).forEach((p, i) => assert.equal(p.frames.length, before[i], 'others got a frame for a rejected deck'));
  assert.deepEqual(players[1]!.view.deck!.custom, custom, 'rejected deck not applied');
  // non-host
  players[2]!.send({ t: 'deck', counts: null });
  assert.equal(lastError(players[2]!)!.code, 'not-allowed');
  // reset
  creator.send({ t: 'deck', counts: null });
  assert.equal(players[3]!.view.deck!.custom, null);
});

test('a join that invalidates the custom deck blocks start until fixed; start deals the custom deck', () => {
  const h = setup({ engine: hosted, seed: 'deck-start' });
  const { creator } = h.room('automatic', 8);
  const custom = altDeck(8);
  creator.send({ t: 'deck', counts: custom });
  const late = h.client();
  late.send({ t: 'join', code: creator.code!, profile: profile('Late') });
  late.send({ t: 'ready', ready: true });
  assert.notEqual(creator.view.deck!.error, null, 'custom deck for 8 is invalid at 9');
  assert.equal(creator.view.canStart, false);
  late.send({ t: 'leave' });
  assert.equal(creator.view.deck!.error, null);
  assert.equal(creator.view.canStart, true);
  creator.send({ t: 'start' });
  const g = creator.view.game as GameView;
  for (const [role, n] of Object.entries(custom)) assert.equal(g.roleCounts[role as keyof typeof g.roleCounts], n, `dealt ${role}`);
  assert.equal(creator.view.deck, null, 'deck editor only in lobby');
});

test('fixture engine has no deck notion', () => {
  const h = setup({ engine: () => createFixtureEngine() as RulesEngine<unknown> });
  const { creator } = h.room('automatic', 4);
  assert.equal(creator.view.deck, null);
  creator.send({ t: 'deck', counts: null });
  assert.equal(lastError(creator)!.code, 'not-allowed');
});
