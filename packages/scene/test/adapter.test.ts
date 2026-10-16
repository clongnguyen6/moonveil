import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSceneInput, phaseOf } from '../src/adapter.ts';
import { intentFor } from '../src/choreo.ts';

const view = {
  me: { seat: 'b', kind: 'player' as const }, status: 'playing' as const, phaseEndsAt: 123,
  players: [{ seat: 'a', name: 'A', appearance: { color: 'ember', hat: 'cap' }, connected: true }, { seat: 'b', name: 'B', appearance: { color: 'nope', hat: 'flower' }, connected: false }],
  voice: [{ channel: 'public', listen: true, speak: true }],
};
const game = { night: 1, day: 2, step: { kind: 'day.vote' }, seats: [{ alive: false, death: { cause: 'night', night: 1, day: 0 } }, { alive: true, death: null }], seatIds: ['a', 'b'], reveal: null };

test('maps status/step to phase', () => {
  assert.equal(phaseOf('lobby', null), 'lobby');
  assert.equal(phaseOf('playing', 'night.main'), 'night');
  assert.equal(phaseOf('playing', 'night.witch'), 'night');
  assert.equal(phaseOf('playing', 'hunter'), 'day');
  assert.equal(phaseOf('playing', 'day.discussion'), 'day');
  assert.equal(phaseOf('playing', 'ended'), 'ended');
  assert.equal(phaseOf('ended', 'ended'), 'ended');
});

test('builds SceneInput from public fields only; seats by seatIds order; provisional appearance adapted', () => {
  const inp = toSceneInput(view, game);
  assert.equal(inp.phase, 'day'); assert.equal(inp.day, 2); assert.equal(inp.phaseEndsAt, 123);
  assert.deepEqual(inp.seats.map((s) => [s.seat, s.alive]), [['a', false], ['b', true]]);
  assert.equal(inp.players[0]!.appearance.top, 'ember'); assert.equal(inp.players[0]!.appearance.hat, 'cap');
  assert.equal(inp.players[1]!.appearance.hat, 'flower');
  assert.ok(['ember', 'moss', 'river', 'dusk', 'sand', 'berry', 'pine', 'slate', 'clay', 'sky', 'bark', 'rose'].includes(inp.players[1]!.appearance.top));
  assert.equal(inp.reveal, null);
  assert.deepEqual(intentFor(inp, 'a'), { kind: 'ghost' });
  assert.deepEqual(intentFor(inp, 'b'), { kind: 'seat', index: 1 });
  assert.ok(!('role' in inp) && !JSON.stringify(inp).includes('facts'));
});

test('lobby without a game; reveal at the end', () => {
  const lobby = toSceneInput({ ...view, status: 'lobby' }, null);
  assert.equal(lobby.phase, 'lobby'); assert.deepEqual(lobby.seats, []);
  const ended = toSceneInput({ ...view, status: 'ended' }, { ...game, step: { kind: 'ended' }, reveal: { roles: ['wolf', 'seer'] } });
  assert.equal(ended.phase, 'ended'); assert.deepEqual(ended.reveal, { a: 'wolf', b: 'seer' });
});
