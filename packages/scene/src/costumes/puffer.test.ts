import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fish } from './fish.ts';
import { assertSelection, drawnLayers } from './costume-test-utils.ts';

test('puffer: shared fishHeadgear selects only puffer art; pouch is independent, ghosts stay pale', () => {
  for (const color of [0xe08a3c, 0xe0b23c, 0x6d7f94, 0x3e9fc4]) {
    for (const hat of ['fishHeadgear', 'none']) for (const back of ['none', 'finPouch']) {
      const choice = { variant: 'puffer', color, hat, front: 'none', back };
      assertSelection(fish, choice);
      const layers = drawnLayers(fish, choice);
      assert.equal(layers.includes('back'), back === 'finPouch');
      assert.equal(layers.includes('hoodBack'), hat === 'fishHeadgear');
      assert.equal(layers.includes('hatFront'), hat === 'fishHeadgear');
      assert.equal(layers.includes('front'), false);
    }
  }
  assert.equal(fish.hidesHair, false);
});
