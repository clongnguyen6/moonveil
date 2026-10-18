import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COSTUMES } from '../src/costumes/index.ts';
import { inspectCostume, ghostTint, labelAnchorFor, RIG, LAYER_ORDER, makeContext, RecordingBrush } from '../src/rig.ts';
import { appearanceKey } from '../src/reconcile.ts';
import { PRESETS } from '../src/appearance.ts';

test('every registered costume obeys the rig rules (box, arcs band, crown, ghost palette) and ids are stable', () => {
  for (const [id, c] of Object.entries(COSTUMES)) {
    assert.equal(id, c.id); assert.match(id, /^[a-z][a-z0-9-]*$/);
    const r = inspectCostume(c);
    assert.ok(r.layers.length > 0, `${id}: draws nothing`);
    assert.ok(r.insideBox, `${id}: outside the drawing box ${JSON.stringify(r.bounds)}`);
    assert.ok(r.arcsClear, `${id}: headgear intrudes into the speaking-arcs band`);
    assert.ok(r.crownOk, `${id}: declared crownY ${c.crownY} does not cover the drawn top ${r.bounds.minY}`);
    assert.ok(r.ghostPale, `${id}: a ghost fill is not pale`);
  }
});

test('the placeholder uses all four layers and raises the label above its cap', () => {
  const r = inspectCostume(COSTUMES['placeholder']!);
  assert.deepEqual(r.layers, [...LAYER_ORDER]);
  assert.ok(labelAnchorFor(COSTUMES['placeholder']) < RIG.labelAnchorY, 'label must move up for tall headgear');
  assert.equal(labelAnchorFor(null), RIG.labelAnchorY);
});

test('ghost tint is pale and bluish for any design colour; the context maps colours only for ghosts', () => {
  for (const c of [0x000000, 0xff0000, 0x6a7f94, 0xffffff, 0x3f8f7a]) {
    const g = ghostTint(c); const r = (g >> 16) & 255, gg = (g >> 8) & 255, b = g & 255;
    assert.ok(b >= r && b >= gg && r + gg + b >= 3 * 120, `not pale/bluish for ${c.toString(16)}: ${g.toString(16)}`);
  }
  const live = makeContext(new RecordingBrush(), false, 1), ghost = makeContext(new RecordingBrush(), true, 1);
  assert.equal(live.color(0xd9603b), 0xd9603b); assert.notEqual(ghost.color(0xd9603b), 0xd9603b);
});

test('costume is part of the appearance key, so dressing a seat re-bakes it', () => {
  const a = PRESETS[0]!;
  assert.notEqual(appearanceKey(a), appearanceKey({ ...a, costume: 'placeholder' }));
  assert.equal(appearanceKey(a), appearanceKey({ ...a, costume: undefined }));
});

import { choiceFor, outfitOf } from '../src/reconcile.ts';
import { TOP_COLORS } from '../src/appearance.ts';

test('choices reach the art: variant, colour, hat, front, back derive from the appearance; legacy extra maps to front/back', () => {
  const base = PRESETS[0]!;
  const duck = { ...base, outfit: 'duck', variant: 'ring', hat: 'duckCap', top: 'sand' as const, front: 'none', back: 'none' };
  assert.deepEqual(choiceFor(duck), { variant: 'ring', color: TOP_COLORS.sand, hat: 'duckCap', front: 'none', back: 'none' });
  assert.equal(outfitOf(duck), 'duck'); assert.equal(outfitOf(base), ''); assert.equal(outfitOf({ ...base, outfit: 'camper' }), '');
  const legacy = { ...base, extra: 'backpack' as const };
  assert.deepEqual(choiceFor(legacy), { variant: 'default', color: TOP_COLORS[base.top], hat: base.hat, front: 'none', back: 'backpack' });
  // the chosen hat drives crown and label clearance when crownY is a function
  const tall = { id: 't', crownY: (c: { hat: string }) => (c.hat === 'bigHat' ? -94 : -75), pieces: {} };
  assert.ok(labelAnchorFor(tall, choiceFor({ ...base, outfit: 't', hat: 'bigHat' })) < RIG.labelAnchorY);
  assert.equal(labelAnchorFor(tall, choiceFor({ ...base, outfit: 't', hat: 'none' })), RIG.labelAnchorY);
  // every choice field is part of the re-bake key
  for (const patch of [{ variant: 'plain' }, { hat: 'none' }, { front: 'scarf' }, { back: 'backpack' }, { top: 'clay' as const }])
    assert.notEqual(appearanceKey(duck), appearanceKey({ ...duck, ...patch }), JSON.stringify(patch));
});
