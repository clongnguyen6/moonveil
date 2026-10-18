import assert from 'node:assert/strict';
import { test } from 'node:test';
import { robotCat } from './robot-cat.ts';
import { assertSelection, drawnLayers } from './costume-test-utils.ts';
import { costumeById } from './index.ts';

test('robotCat: catalog ID resolves; hood/bell and utility pocket toggle independently, with pale ghosts', () => {
  assert.equal(costumeById('robotCat'), robotCat);
  for (const color of [0x3e9fc4, 0x6d7f94]) for (const hat of ['robotHood', 'none']) {
    for (const front of ['utilityPocket', 'none']) {
      const choice = { variant: 'default', color, hat, front, back: 'none' };
      assertSelection(robotCat, choice);
      const layers = drawnLayers(robotCat, choice);
      assert.equal(layers.includes('front'), front === 'utilityPocket');
      assert.equal(layers.includes('hoodBack'), hat === 'robotHood');
      assert.equal(layers.includes('hatFront'), hat === 'robotHood');
      assert.equal(layers.includes('back'), false);
    }
  }
  assert.equal(robotCat.hidesHair, false);
});
