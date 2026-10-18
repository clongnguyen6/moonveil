// Scene costumes vs foundation's wire catalog (ADR 0011). Test-only protocol import; scene source stays protocol-free.
// Holds with only the placeholder registered and with every catalog look registered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OUTFITS, OUTFIT_IDS, COLORS, HATS as WIRE_HATS, SKINS as WIRE_SKINS, HAIRS as WIRE_HAIRS, HAIR_COLORS as WIRE_HAIR_COLORS } from '@moonveil/protocol';
import { COSTUMES } from '../src/costumes/index.ts';
import { HATS, HAIRS, HAIR_COLORS, SKINS, TOPS } from '../src/types.ts';
import { WIRE_OUTFITS, sceneAppearance } from '../src/adapter.ts';
import { outfitOf } from '../src/reconcile.ts';

test('the scene knows exactly the wire outfit ids', () => {
  assert.deepEqual([...WIRE_OUTFITS].sort(), [...OUTFIT_IDS].sort());
});

test('every registered costume for a wire outfit declares options identical to its catalog row', () => {
  for (const [id, c] of Object.entries(COSTUMES)) {
    if (!Object.hasOwn(OUTFITS, id)) continue;
    assert.notEqual(id, 'camper', 'camper is the base look, not a costume');
    assert.ok(c.options, `${id}: wire outfit registered without options`);
    const row = OUTFITS[id as keyof typeof OUTFITS];
    const { variants, colors, hats, fronts, backs } = c.options;
    assert.deepEqual({ variants, colors, hats, fronts, backs }, { variants: row.variants, colors: row.colors, hats: row.hats, fronts: row.fronts, backs: row.backs }, `${id}: options differ from the wire row`);
  }
});

test('every wire outfit renders (dressed when registered, else a plain camper); registered non-catalog costumes are unreachable', () => {
  for (const id of OUTFIT_IDS) {
    const dressed = id !== 'camper' && !!COSTUMES[id]?.options;
    assert.equal(outfitOf(sceneAppearance({ outfit: id }, 's1')), dressed ? id : '', id);
  }
  for (const id of Object.keys(COSTUMES)) if (!Object.hasOwn(OUTFITS, id)) assert.equal(outfitOf(sceneAppearance({ outfit: id }, 's1')), '', `${id} must not be reachable from the wire`);
});

test('scene enums match the wire catalog: colours, camper hats, body', () => {
  assert.deepEqual([...TOPS], [...COLORS]);
  assert.deepEqual([...HATS].sort(), [...OUTFITS.camper.hats].sort());
  assert.ok(HATS.every((h) => (WIRE_HATS as readonly string[]).includes(h)));
  assert.deepEqual([...SKINS], [...WIRE_SKINS]); assert.deepEqual([...HAIRS], [...WIRE_HAIRS]); assert.deepEqual([...HAIR_COLORS], [...WIRE_HAIR_COLORS]);
});
