import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededBody, seededExtras } from '../src/seed.ts';
import { appearanceFromProtocol } from '../src/appearance.ts';

test('seeded body and extras are deterministic per seat and match what the scene draws for a legacy appearance', () => {
  for (const seat of ['s1', 's2', 'seat-abc', 'x']) {
    assert.deepEqual(seededBody(seat), seededBody(seat));
    const drawn = appearanceFromProtocol({ color: 'ember', hat: 'none' }, seat);
    assert.deepEqual(seededBody(seat), { skin: drawn.skin, hair: drawn.hair, hairColor: drawn.hairColor });
    const ex = seededExtras(seat);
    assert.equal(ex.front === 'scarf', drawn.extra === 'scarf');
    assert.equal(ex.back === 'backpack', drawn.extra === 'backpack');
    assert.ok(!(ex.front === 'scarf' && ex.back === 'backpack'), 'today a seat has at most one extra');
  }
});

test('different seats differ somewhere across the catalog (seed is not constant)', () => {
  const keys = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify([seededBody(`s${i}`), seededExtras(`s${i}`)])));
  assert.ok(keys.size > 10);
});
