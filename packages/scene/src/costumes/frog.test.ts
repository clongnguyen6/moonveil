import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frog } from './frog.ts';
import { assertSelection, drawnLayers } from './costume-test-utils.ts';

test('frog: independent hat, pockets and leaf pack choices preserve rig, face, hands and pale ghosts', () => {
  for (const color of [0x3f8f7a, 0x6aa84f]) for (const hat of ['frogHat', 'none']) {
    for (const front of ['raincoatPockets', 'none']) for (const back of ['leafPack', 'none']) {
      const choice = { variant: 'default', color, hat, front, back };
      assertSelection(frog, choice);
      const layers = drawnLayers(frog, choice);
      assert.equal(layers.includes('back'), back === 'leafPack');
      assert.equal(layers.includes('front'), front === 'raincoatPockets');
      assert.equal(layers.includes('hoodBack'), hat === 'frogHat');
      assert.equal(layers.includes('hatFront'), hat === 'frogHat');
    }
  }
  assert.equal(frog.hidesHair, false);
});
