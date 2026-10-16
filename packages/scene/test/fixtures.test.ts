import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeServer, makeInput, seatId, visiblePoseSeats } from '../fixtures/index.ts';
import { isWalkable } from '../src/map.ts';

const all = Array.from({ length: 10 }, (_, i) => seatId(i));

test('pose entitlement: lobby everyone; living seats get nothing during play; ghosts and moderator get dead seats only', () => {
  assert.deepEqual(visiblePoseSeats(makeInput('lobby'), all), all);
  assert.deepEqual(visiblePoseSeats(makeInput('seating'), all), []);
  assert.deepEqual(visiblePoseSeats(makeInput('night'), all), []);
  assert.deepEqual(visiblePoseSeats(makeInput('ghost', 10, { viewer: seatId(0) }), all), []);          // living viewer
  assert.deepEqual(visiblePoseSeats(makeInput('ghost'), all), [seatId(3), seatId(7)]);                   // ghost viewer
  assert.deepEqual(visiblePoseSeats(makeInput('ghost', 10, { viewer: 'moderator' }), all), [seatId(3), seatId(7)]);
  assert.deepEqual(visiblePoseSeats(makeInput('ended'), all), []);
});

test('fake server never emits a dead seat pose to a living viewer, in any phase, over time', () => {
  for (const scene of ['seating', 'night', 'day', 'ghost', 'ended'] as const) {
    const s = new FakeServer(scene, 10, seatId(0));
    const frames: number[] = [];
    s.onPoses((f) => frames.push(f.poses.length));
    for (let i = 0; i < 200; i++) s.update(1 / 30);
    assert.ok(frames.length > 0);
    assert.ok(frames.every((n) => n === 0), `${scene}: living viewer received poses`);
    assert.ok([...s.speaking].every((seat) => s.audibleSeats().includes(seat)));
  }
});

test('fake server: ghost viewer receives only dead seats; lobby poses stay walkable', () => {
  const g = new FakeServer('ghost', 10);
  let seen = new Set<string>();
  g.onPoses((f) => { seen = new Set(f.poses.map((p) => p.seat)); });
  for (let i = 0; i < 200; i++) g.update(1 / 30);
  assert.deepEqual([...seen].sort(), [seatId(3), seatId(7)]);
  const l = new FakeServer('lobby', 16);
  l.onPoses((f) => { for (const p of f.poses) assert.equal(isWalkable(l.map, p.x, p.y), true, `pose off-walkable for ${p.seat}`); });
  for (let i = 0; i < 600; i++) l.update(1 / 30);
  assert.equal(l.move(seatId(0), -50, 0, 1), false);
  assert.equal(l.move(seatId(0), 700, 1000, 1), true);
  const seated = new FakeServer('seating', 10);
  assert.equal(seated.move(seatId(0), 700, 1000, 1), false, 'living seat may not move during play');
});
