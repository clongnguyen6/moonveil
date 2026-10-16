import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intentFor, canMove, phaseLabel } from '../src/choreo.ts';
import { makeInput, seatId } from '../fixtures/index.ts';

test('intents follow phase and public alive flag only', () => {
  assert.deepEqual(intentFor(makeInput('lobby'), 's1'), { kind: 'free' });
  assert.deepEqual(intentFor(makeInput('seating'), 's3'), { kind: 'seat', index: 2 });
  assert.deepEqual(intentFor(makeInput('night'), 's3'), { kind: 'tent', index: 2 });
  assert.deepEqual(intentFor(makeInput('ghost'), seatId(3)), { kind: 'ghost' });
  assert.deepEqual(intentFor(makeInput('ghost'), seatId(0)), { kind: 'seat', index: 0 });
  assert.deepEqual(intentFor(makeInput('ended'), 's2'), { kind: 'seat', index: 1 });
  assert.deepEqual(intentFor(makeInput('seating'), 'nobody'), { kind: 'absent' });
  assert.deepEqual(intentFor(makeInput('seating', 10, { viewer: 'moderator' }), 'mod'), { kind: 'absent' });
});

test('movement permission: lobby or dead during play; never moderator; never living after end', () => {
  assert.equal(canMove(makeInput('lobby'), 's1'), true);
  assert.equal(canMove(makeInput('seating'), 's1'), false);
  assert.equal(canMove(makeInput('night'), 's1'), false);
  const g = makeInput('ghost');
  assert.equal(canMove(g, seatId(3)), true);
  assert.equal(canMove(g, seatId(0)), false);
  assert.equal(canMove(makeInput('lobby', 10, { viewer: 'moderator' }), 'mod'), false);
  assert.equal(canMove(makeInput('ended'), 's1'), false);
});

test('phase labels', () => {
  assert.equal(phaseLabel(makeInput('lobby')), 'Lobby');
  assert.equal(phaseLabel(makeInput('night')), 'Night 1');
  assert.equal(phaseLabel(makeInput('day')), 'Day 2');
});
