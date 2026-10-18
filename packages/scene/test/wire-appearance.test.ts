import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneAppearance, toSceneInput } from '../src/adapter.ts';
import { appearanceFromProtocol } from '../src/appearance.ts';
import { seededBody, seededExtras } from '../src/seed.ts';
import { baseItems, outfitOf } from '../src/reconcile.ts';
import { COSTUMES } from '../src/costumes/index.ts';
import type { Costume } from '../src/rig.ts';

const SEATS = ['s1', 's2', 's3', 'seat-abc', 'x'];

test('legacy { color, hat } is drawn exactly as before', () => {
  for (const seat of SEATS) assert.deepEqual(sceneAppearance({ color: 'moss', hat: 'cap' }, seat), appearanceFromProtocol({ color: 'moss', hat: 'cap' }, seat));
});

test('canonical camper: chosen front/back win over the seat seed; the legacy upgrade looks identical', () => {
  for (const seat of SEATS) {
    const off = sceneAppearance({ outfit: 'camper', variant: 'default', color: 'river', hat: 'beanie', front: 'none', back: 'none' }, seat);
    assert.deepEqual(baseItems(off, null), { hair: true, hat: true, scarf: false, backpack: false });
    const both = sceneAppearance({ outfit: 'camper', color: 'river', hat: 'none', front: 'scarf', back: 'backpack' }, seat);
    assert.equal(baseItems(both, null).scarf && baseItems(both, null).backpack, true);
    // server upgrade of legacy = camper + seededExtras, body absent -> scene seeds the body
    const legacy = appearanceFromProtocol({ color: 'river', hat: 'cap' }, seat);
    const upgraded = sceneAppearance({ outfit: 'camper', variant: 'default', color: 'river', hat: 'cap', ...seededExtras(seat) }, seat);
    assert.deepEqual(baseItems(upgraded, null), baseItems(legacy, null), seat);
    for (const k of ['skin', 'hair', 'hairColor', 'top', 'hat'] as const) assert.equal(upgraded[k], legacy[k], `${seat} ${k}`);
    assert.equal(outfitOf(upgraded), '');
  }
});

test('wire body is used when valid, otherwise the seat-seeded body', () => {
  const a = sceneAppearance({ outfit: 'camper', color: 'sand', hat: 'none', front: 'none', back: 'none', body: { skin: 'deep', hair: 'bun', hairColor: 'red' } }, 's1');
  assert.deepEqual([a.skin, a.hair, a.hairColor], ['deep', 'bun', 'red']);
  const b = sceneAppearance({ outfit: 'camper', color: 'sand', hat: 'none', body: { skin: 'green', hair: 'bun', hairColor: 'red' } }, 's1');
  assert.deepEqual({ skin: b.skin, hair: b.hair, hairColor: b.hairColor }, seededBody('s1'));
});

test('only catalog outfits reach the art: placeholder, unknown ids and prototype keys render a plain camper', () => {
  for (const outfit of ['placeholder', 'nope', '__proto__', 'constructor', 'toString', 'bowCat']) {
    const a = sceneAppearance({ outfit, variant: 'ring', color: 'rose', hat: 'catHood', front: 'scarf', back: 'backpack' }, 's2');
    assert.equal(outfitOf(a), '', outfit);
    assert.deepEqual(baseItems(a, null), { hair: true, hat: true, scarf: false, backpack: false }, outfit);
    assert.equal(a.hat, 'none', 'the camper hat slot gets none, not the outfit headgear'); assert.equal(a.top, 'rose');
  }
});

test('a registered costume with catalog options is dressed; choices outside its options fall back to its defaults', () => {
  const duckish: Costume = { id: 'testDuck', options: { variants: ['ring', 'plain'], colors: ['sand', 'clay'], hats: ['duckCap', 'none'], fronts: ['none'], backs: ['none'] }, pieces: {} };
  COSTUMES[duckish.id] = duckish;
  try {
    const ok = sceneAppearance({ outfit: 'testDuck', variant: 'plain', color: 'clay', hat: 'none', front: 'none', back: 'none' }, 's3');
    assert.deepEqual({ outfit: ok.outfit, variant: ok.variant, top: ok.top, hat: ok.hat, front: ok.front, back: ok.back }, { outfit: 'testDuck', variant: 'plain', top: 'clay', hat: 'none', front: 'none', back: 'none' });
    const bad = sceneAppearance({ outfit: 'testDuck', variant: 'x', color: 'moss', hat: 'beanie', front: 'scarf', back: 'backpack' }, 's3');
    assert.deepEqual({ variant: bad.variant, top: bad.top, hat: bad.hat, front: bad.front, back: bad.back }, { variant: 'ring', top: 'sand', hat: 'duckCap', front: 'none', back: 'none' });
    assert.deepEqual(baseItems(bad, duckish), { hair: true, hat: false, scarf: false, backpack: false }, 'the base never draws its items on a costume');
    const omitted = sceneAppearance({ outfit: 'testDuck' }, 's3');
    assert.deepEqual([omitted.variant, omitted.top, omitted.hat], ['ring', 'sand', 'duckCap'], 'omitted fields = outfit defaults, as the server normalises');
  } finally { delete COSTUMES[duckish.id]; }
});

test('toSceneInput maps every player through the wire adapter', () => {
  const view = {
    me: { seat: 's1', kind: 'player' as const }, status: 'lobby' as const, phaseEndsAt: null, voice: [],
    players: [
      { seat: 's1', name: 'An', connected: true, appearance: { color: 'ember', hat: 'none' } },
      { seat: 's2', name: 'Bình', connected: true, appearance: { outfit: 'placeholder', color: 'slate', hat: 'none' } },
      { seat: 's3', name: 'Chi', connected: true, appearance: { outfit: 'camper', color: 'pine', hat: 'hood', front: 'scarf', back: 'none' } },
    ],
  };
  const input = toSceneInput(view, null);
  assert.deepEqual(input.players.map((p) => outfitOf(p.appearance)), ['', '', '']);
  assert.equal(input.players[2]!.appearance.front, 'scarf');
});
