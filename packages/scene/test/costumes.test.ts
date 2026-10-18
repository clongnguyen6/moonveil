import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COSTUMES } from '../src/costumes/index.ts';
import { inspectCostume, ghostTint, labelAnchorFor, RIG, LAYER_ORDER, makeContext, RecordingBrush } from '../src/rig.ts';
import { appearanceKey } from '../src/reconcile.ts';
import { PRESETS } from '../src/appearance.ts';

test('every registered costume obeys the rig rules (box, arcs band, crown, ghost palette) and ids are stable', () => {
  for (const [id, c] of Object.entries(COSTUMES)) {
    assert.equal(id, c.id); assert.match(id, /^[a-z][a-zA-Z0-9]*$/, `${id}: ids are wire OutfitIds (camelCase)`);
    const r = inspectCostume(c);
    assert.deepEqual(r.failures, [], id);
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

import type { Costume } from '../src/rig.ts';
import { inspectCostume as inspect, shadeColor, choicesOf } from '../src/rig.ts';
import { baseItems } from '../src/reconcile.ts';

test('costume ids are wire OutfitIds: camelCase passes the id rule', () => {
  for (const id of ['camper', 'bowCat', 'robotCat', 'fish', 'duck']) assert.match(id, /^[a-z][a-zA-Z0-9]*$/);
});

// Synthetic costume: draws a hat only for the chosen hat id, like the real catalog looks.
const hatty = (draw: Costume['pieces'], crownY: Costume['crownY'] = -90): Costume =>
  ({ id: 'hatty', crownY, options: { variants: ['default'], hats: ['none', 'tall'], fronts: ['none', 'pocket'], backs: ['none'] }, pieces: draw });

test('inspection runs every declared choice: a fault in a non-default hat or front is caught', () => {
  const ok = hatty({ hatFront: (c) => { if (c.choice.hat === 'tall') c.b.roundRect(-10, -88, 20, 14, 3).fill(c.color(0x5c6e82)).stroke(c.outline(0x5c6e82)); } });
  assert.deepEqual(inspect(ok).failures, []);
  assert.equal(choicesOf(ok).length, 12 * 2 * 2);   // all top colours x hats x fronts
  const tooTall = hatty({ hatFront: (c) => { if (c.choice.hat === 'tall') c.b.roundRect(-10, -99, 20, 20, 3).fill(c.color(0x5c6e82)); } }, -100);
  assert.equal(inspect(tooTall).insideBox, false);
  const crownLow = hatty({ hatFront: (c) => { if (c.choice.hat === 'tall') c.b.roundRect(-10, -92, 20, 14, 3).fill(c.color(0x5c6e82)); } }, (ch) => (ch.hat === 'tall' ? -80 : -75));
  assert.equal(inspect(crownLow).crownOk, false);
  const frontInArcs = hatty({ front: (c) => { if (c.choice.front === 'pocket') c.b.roundRect(18, -60, 6, 6, 2).fill(c.color(0xd9c38a)); } });
  assert.equal(inspect(frontInArcs).arcsClear, false, 'the front layer is checked against the arcs band');
  const rawGhostFill = hatty({ hatFront: (c) => { if (c.choice.hat === 'tall') c.b.circle(0, -80, 6).fill(0xd9603b); } });
  assert.equal(inspect(rawGhostFill).ghostPale, false);
  const rawGhostStroke = hatty({ hatFront: (c) => { if (c.choice.hat === 'tall') c.b.circle(0, -80, 6).fill(c.color(0xd9603b)).stroke(0x3a2a20); } });
  assert.equal(inspect(rawGhostStroke).ghostPale, false, 'ghost outlines are checked too');
});

test('bounds are exact for curves and include stroke width', () => {
  // control point at y -99 lies outside the box, the curve itself peaks at -87; stroke 2 adds 1
  const c = hatty({ hatFront: (x) => { if (x.choice.hat === 'tall') x.b.moveTo(-10, -75).quadraticCurveTo(0, -99, 10, -75).closePath().fill(x.color(0x5c6e82)).stroke(x.outline(0x5c6e82), 2); } });
  const r = inspect(c);
  assert.deepEqual(r.failures, []); assert.equal(r.bounds.minY, -88);
});

test('a costume whose pieces read ctx.choice must declare options', () => {
  const undeclared: Costume = { id: 'u', pieces: { hatFront: (c) => { if (c.choice.hat === 'tall') c.b.circle(0, -80, 6).fill(c.color(0x5c6e82)); } } };
  assert.equal(inspect(undeclared).choicesDeclared, false);
  const crownOnly: Costume = { id: 'v', crownY: (ch) => (ch.hat === 'tall' ? -90 : -75), pieces: { back: (c) => { c.b.circle(-20, -30, 4).fill(c.color(0x5c6e82)); } } };
  assert.equal(inspect(crownOnly).choicesDeclared, false, 'a choice-dependent crown counts as branching');
  assert.equal(inspect(COSTUMES['placeholder']!).choicesDeclared, true, 'a costume that ignores choices needs no options');
});

test('ghost outlines take the ghost tint; living outlines are unchanged', () => {
  const live = makeContext(new RecordingBrush(), false, 1), ghost = makeContext(new RecordingBrush(), true, 1);
  for (const c of [0x5c6e82, 0xd9603b, 0x2a2a30, 0xe9e0c8]) {
    assert.equal(live.outline(c), shadeColor(c, 0.55));
    assert.equal(ghost.outline(c), ghostTint(shadeColor(c, 0.55)));
    const o = ghost.outline(c), r = (o >> 16) & 255, g = (o >> 8) & 255, b = o & 255;
    assert.ok(b >= r && b >= g && r + g + b >= 360, c.toString(16));
  }
});

test('base hat, scarf and backpack are drawn only for the camper look; a costume draws its own (no double scarf)', () => {
  const a = { ...PRESETS[0]!, hat: 'beanie', front: 'scarf', back: 'backpack' };
  assert.deepEqual(baseItems(a, null), { hair: true, hat: true, scarf: true, backpack: true });
  assert.deepEqual(baseItems({ ...a, extra: 'none' as const, front: undefined, back: undefined }, null).scarf, false);
  assert.equal(baseItems({ ...a, front: undefined, back: undefined, extra: 'scarf' as const }, null).scarf, true, 'legacy extra still draws for campers');
  const mushroomLike: Costume = { id: 'm', options: { variants: ['default'], hats: ['none'], fronts: ['scarf', 'none'], backs: ['none'] }, pieces: {} };
  assert.deepEqual(baseItems({ ...a, outfit: 'm', hat: 'none' }, mushroomLike), { hair: true, hat: false, scarf: false, backpack: false });
  assert.equal(baseItems(a, { id: 'h', hidesHair: true, pieces: {} }).hair, false);
});
