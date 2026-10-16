import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMap, isWalkable, wanderPoint, streamX, BRIDGE_Y, FIRE, WORLD, MAX_PLAYERS } from '../src/map.ts';
import { Rng } from '../src/rng.ts';

test('map is deterministic for a seed', () => {
  const a = createMap(10), b = createMap(10);
  assert.deepEqual(a.trees.slice(0, 5), b.trees.slice(0, 5));
  assert.equal(a.tents.length, 10);
  assert.equal(a.seats.length, 10);
});

test('stream blocks except on the bridge; fire and tents block; seats and doors are reachable', () => {
  const m = createMap(10);
  assert.equal(isWalkable(m, streamX(400), 400), false);
  assert.equal(isWalkable(m, streamX(BRIDGE_Y), BRIDGE_Y), true);
  assert.equal(isWalkable(m, FIRE.x, FIRE.y), false);
  for (const t of m.tents) { assert.equal(isWalkable(m, t.x, t.y - 30), false); assert.equal(isWalkable(m, t.door.x, t.door.y), true, `door of tent at ${t.x},${t.y}`); }
  for (const s of m.seats) assert.equal(isWalkable(m, s.sit.x, s.sit.y), true);
  assert.equal(isWalkable(m, -10, 500), false);
  assert.equal(isWalkable(m, Number.NaN, 500), false);
  assert.equal(isWalkable(m, WORLD.w + 5, 500), false);
});

test('tents never overlap, for every supported player count', () => {
  for (let n = 4; n <= MAX_PLAYERS; n++) {
    const m = createMap(n);
    for (let i = 0; i < m.tents.length; i++) for (let j = i + 1; j < m.tents.length; j++) {
      const a = m.tents[i]!, b = m.tents[j]!;
      assert.ok(Math.abs(a.x - b.x) > 120 || Math.abs(a.y - b.y) > 70, `n=${n}: tents ${i} and ${j} overlap`);
    }
    for (let i = 0; i < m.seats.length; i++) for (let j = i + 1; j < m.seats.length; j++) {
      const a = m.seats[i]!, b = m.seats[j]!;
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 50, `n=${n}: seats ${i} and ${j} too close`);
    }
  }
});

test('no tree inside the camp core clearing or on a tent', () => {
  const m = createMap(16);
  for (const t of m.trees) {
    assert.ok(Math.hypot((t.x - FIRE.x) / 760, (t.y - FIRE.y) / 540) >= 1, `tree in clearing at ${t.x},${t.y}`);
    for (const tent of m.tents) assert.ok(Math.hypot(tent.x - t.x, (tent.y - t.y) * 1.4) >= 120);
  }
  assert.ok(m.trees.length >= 300, `forest too thin: ${m.trees.length}`);
});

test('wanderPoint always returns a walkable point on the camp side of the stream', () => {
  const m = createMap(12); const rng = new Rng(3);
  for (let i = 0; i < 200; i++) { const p = wanderPoint(m, rng); assert.equal(isWalkable(m, p.x, p.y), true); assert.ok(p.x < streamX(p.y) - 90); }
});
