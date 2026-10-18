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
