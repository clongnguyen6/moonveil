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

import { effectiveAppearance, LookTracker } from '../src/reconcile.ts';

test('local appearance override applies only to the local seat; others keep the snapshot look', () => {
  const inp = makeInput('lobby', 4);
  const draft = { ...inp.players[0]!.appearance, hat: 'bucket' as const, top: 'sand' as const };
  assert.deepEqual(effectiveAppearance(inp, inp.me.seat, draft), draft);
  for (const p of inp.players.slice(1)) assert.deepEqual(effectiveAppearance(inp, p.seat, draft), p.appearance);
  assert.equal(effectiveAppearance(inp, 'nobody', draft), null);
});

test('clearing the override restores the snapshot look, also after a snapshot update during the draft', () => {
  const inp = makeInput('lobby', 4);
  const me = inp.me.seat;
  const draft = { ...inp.players[0]!.appearance, hair: 'curly' as const };
  const updated = { ...inp, players: inp.players.map((p) => (p.seat === me ? { ...p, name: 'Renamed' } : p)) };
  assert.deepEqual(effectiveAppearance(updated, me, draft), draft);          // snapshot update while drafting: keep the draft
  assert.deepEqual(effectiveAppearance(updated, me, null), inp.players[0]!.appearance);
});

test('no re-bake when the look is unchanged; one re-bake per actual change', () => {
  const a = makeInput('lobby', 2).players[0]!.appearance;
  const t = new LookTracker(a);
  assert.equal(t.apply({ ...a }), false);
  assert.equal(t.apply({ ...a, hat: a.hat === 'cap' ? 'beanie' : 'cap' }), true);
  assert.equal(t.apply(t.current), false);
  assert.equal(t.apply(a), true);
  assert.equal(t.rebakes, 2);
});

test('applying a look touches nothing but the look (pose and position are not part of the tracker)', () => {
  const a = makeInput('lobby', 2).players[0]!.appearance;
  const state = { x: 700, y: 900, facing: -1, mode: 'walk', look: new LookTracker(a) };
  const before = { x: state.x, y: state.y, facing: state.facing, mode: state.mode };
  state.look.apply({ ...a, top: 'rose' });
  assert.deepEqual({ x: state.x, y: state.y, facing: state.facing, mode: state.mode }, before);
});
