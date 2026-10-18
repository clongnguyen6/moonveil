import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecordingBrush, makeContext } from '../rig.ts';
import { fish } from './fish.ts';
import { assertSelection, drawnLayers } from './costume-test-utils.ts';

test('shark: hood, felt tabs and fin keep face/arcs clear, with an independent pouch and pale ghosts', () => {
  for (const color of [0xe08a3c, 0xe0b23c, 0x6d7f94, 0x3e9fc4]) {
    for (const hat of ['fishHeadgear', 'none']) for (const back of ['none', 'finPouch']) {
      const choice = { variant: 'shark', color, hat, front: 'none', back };
      assertSelection(fish, choice);
      const layers = drawnLayers(fish, choice);
      assert.equal(layers.includes('back'), back === 'finPouch');
      assert.equal(layers.includes('hoodBack'), hat === 'fishHeadgear');
      assert.equal(layers.includes('hatFront'), hat === 'fishHeadgear');
      assert.equal(layers.includes('front'), false);
    }
  }
});

test('fish variant changes headgear only; legacy mismatched hat IDs cannot select a second style', () => {
  function draw(variant: string, hat: string, layer: 'back' | 'hatFront') {
    const b = new RecordingBrush();
    fish.pieces[layer]!(makeContext(b, false, 1, { variant, hat, back: 'finPouch', front: 'none', color: 0x6d7f94 }));
    return b.rec;
  }
  assert.deepEqual(draw('puffer', 'fishHeadgear', 'back'), draw('shark', 'fishHeadgear', 'back'));
  assert.notDeepEqual(draw('puffer', 'fishHeadgear', 'hatFront'), draw('shark', 'fishHeadgear', 'hatFront'));
  for (const variant of ['puffer', 'shark']) {
    for (const hat of ['none', 'pufferHat', 'sharkHat']) {
      assert.equal(draw(variant, hat, 'hatFront').ops.length, 0);
    }
  }
});
