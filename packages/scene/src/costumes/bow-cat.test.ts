import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bowCat } from './bow-cat.ts';
import { assertSelection, drawnLayers } from './costume-test-utils.ts';
import { costumeById } from './index.ts';

test('bowCat: catalog ID resolves; hood/bow and fish sling toggle independently without covering face or hands', () => {
  assert.equal(costumeById('bowCat'), bowCat);
  for (const color of [0xcf7aa8, 0xc44f6e]) for (const hat of ['catHood', 'none']) {
    for (const front of ['fishSling', 'none']) {
      const choice = { variant: 'default', color, hat, front, back: 'none' };
      assertSelection(bowCat, choice);
      const layers = drawnLayers(bowCat, choice);
      assert.equal(layers.includes('front'), front === 'fishSling');
      assert.equal(layers.includes('hoodBack'), hat === 'catHood');
      assert.equal(layers.includes('hatFront'), hat === 'catHood');
      assert.equal(layers.includes('back'), false);
    }
  }
  assert.equal(bowCat.hidesHair, false);
});
