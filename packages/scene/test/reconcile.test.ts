import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appearanceKey, playersDiff, spawnPoint, avatarVisible } from '../src/reconcile.ts';
import { createMap, isWalkable } from '../src/map.ts';
import { makeInput } from '../fixtures/index.ts';

test('appearance change in the input is detected; same appearance is not', () => {
  const a = makeInput('lobby', 4).players, b = a.map((p) => ({ ...p }));
  assert.deepEqual(playersDiff(a, b), { added: [], removed: [], changedAppearance: [], renamed: [] });
  b[1] = { ...b[1]!, appearance: { ...b[1]!.appearance, hat: b[1]!.appearance.hat === 'cap' ? 'beanie' : 'cap' } };
  b[2] = { ...b[2]!, name: 'Renamed' };
  const d = playersDiff(a, b);
  assert.deepEqual(d.changedAppearance, [b[1]!.seat]);
  assert.deepEqual(d.renamed, [b[2]!.seat]);
  assert.notEqual(appearanceKey(a[1]!.appearance), appearanceKey(b[1]!.appearance));
  assert.equal(appearanceKey(a[0]!.appearance), appearanceKey(b[0]!.appearance));
});

test('players joining and leaving are reported', () => {
  const a = makeInput('lobby', 4).players, b = makeInput('lobby', 5).players.slice(1);
  const d = playersDiff(a, b);
  assert.deepEqual(d.added, ['s5']); assert.deepEqual(d.removed, ['s1']);
});

test('spawn points are distinct and walkable for 16 players', () => {
  const map = createMap(16);
  const pts = Array.from({ length: 16 }, (_, i) => spawnPoint(map, i));
  for (const p of pts) assert.ok(isWalkable(map, p.x, p.y));
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y) > 30, `spawn ${i} and ${j} too close`);
});

test('a hidden avatar renders nothing, whatever its alpha; a faded avatar is invisible too', () => {
  assert.equal(avatarVisible('hidden', 1), false);
  assert.equal(avatarVisible('idle', 0), false);
  assert.equal(avatarVisible('idle', 1), true);
  assert.equal(avatarVisible('ghost', 0.5), true);
});
