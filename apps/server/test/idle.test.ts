import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { ManualClock, FakeClient, profile } from './harness.ts';
import { Registry } from '../src/rooms.ts';

function setupIdle(idleMs: number) {
  const clock = new ManualClock();
  const registry = new Registry({
    engine: () => createFixtureEngine({ hiddenMs: 30_000, openMs: 30_000 }) as RulesEngine<unknown>,
    scheduler: clock,
    now: clock.now,
    idleMs,
  });
  return { clock, registry, client: () => new FakeClient(registry) };
}

test('idle cleanup: room closes only after idleMs with no connection; seat then unrecoverable', () => {
  const h = setupIdle(60_000);
  const a = h.client();
  a.send({ t: 'create', mode: 'automatic', profile: profile('Ann') });
  h.clock.tick(10 * 60_000);
  h.registry.sweep();
  assert.equal(h.registry.size, 1, 'connected room is never swept');
  a.drop();
  h.clock.tick(59_000);
  h.registry.sweep();
  assert.equal(h.registry.size, 1, 'not idle long enough');
  h.clock.tick(2_000);
  h.registry.sweep();
  assert.equal(h.registry.size, 0);
  const again = h.client();
  again.send({ t: 'resume', code: a.code!, token: a.token! });
  assert.deepEqual(again.errors()[0], { t: 'error', code: 'room-not-found', message: 'no such room' });
});

test('idle cleanup: a reconnect inside the window resets the idle clock', () => {
  const h = setupIdle(60_000);
  const a = h.client();
  a.send({ t: 'create', mode: 'automatic', profile: profile('Ann') });
  a.drop();
  h.clock.tick(50_000);
  const a2 = h.client();
  a2.send({ t: 'resume', code: a.code!, token: a.token! });
  a2.drop();
  h.clock.tick(50_000);
  h.registry.sweep();
  assert.equal(h.registry.size, 1);
});

test('automatic match keeps advancing with nobody connected (documented behaviour)', () => {
  const h = setupIdle(30 * 60_000);
  const players = [h.client()];
  players[0]!.send({ t: 'create', mode: 'automatic', profile: profile('P0') });
  for (let i = 1; i < 4; i++) {
    const c = h.client();
    c.send({ t: 'join', code: players[0]!.code!, profile: profile(`P${i}`) });
    players.push(c);
  }
  for (const p of players) p.send({ t: 'ready', ready: true });
  players[0]!.send({ t: 'start' });
  for (const p of players) p.drop();
  h.clock.tick(4 * 30_000); // fixture: 2 rounds x (hidden + open)
  const back = h.client();
  back.send({ t: 'resume', code: players[0]!.code!, token: players[0]!.token! });
  assert.equal(back.view.status, 'ended', 'match ran to the end while everyone was away');
});
