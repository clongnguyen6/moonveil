import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mushroom } from './mushroom.ts';
import { assertSelection, drawnLayers } from './costume-test-utils.ts';

test('mushroom: scarf and wood pack stay independent of headgear, with face/hands and ghost contrast preserved', () => {
  for (const color of [0xb07d4f, 0x3f8f7a]) for (const hat of ['mushroomCap', 'none']) {
    for (const front of ['scarf', 'none']) for (const back of ['woodPack', 'none']) {
      const choice = { variant: 'default', color, hat, front, back };
      assertSelection(mushroom, choice);
      const layers = drawnLayers(mushroom, choice);
      assert.equal(layers.includes('back'), back === 'woodPack');
      assert.equal(layers.includes('front'), front === 'scarf');
      assert.equal(layers.includes('hoodBack'), hat === 'mushroomCap');
      assert.equal(layers.includes('hatFront'), hat === 'mushroomCap');
    }
  }
  assert.equal(mushroom.hidesHair, false);
});
