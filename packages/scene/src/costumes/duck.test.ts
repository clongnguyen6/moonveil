import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RecordingBrush, makeContext, inspectCostume, labelAnchorFor, RIG,
  type Costume, type CostumeChoice,
} from '../rig.ts';
import { duck } from './duck.ts';
import { assertSelection, GeometryProbe } from './costume-test-utils.ts';

function choice(variant = 'ring', hat = 'duckCap', color = 0xe0b23c): CostumeChoice {
  return { variant, hat, color, front: 'none', back: 'none' };
}

test('duck: every variant/color/hat combination draws safely in living and ghost palettes', () => {
  for (const variant of ['ring', 'plain']) for (const hat of ['duckCap', 'none']) {
    for (const color of [0xe0b23c, 0xe08a3c]) {
      const selected = choice(variant, hat, color);
      const dressed: Costume = {
        ...duck,
        crownY: typeof duck.crownY === 'function' ? duck.crownY(selected) : duck.crownY,
        pieces: Object.fromEntries(Object.entries(duck.pieces).map(([layer, draw]) =>
          [layer, (ctx: Parameters<typeof draw>[0]) => draw({ ...ctx, choice: selected })])),
      };
      const report = inspectCostume(dressed);
      assert.ok(report.insideBox);
      assert.ok(report.arcsClear);
      assert.ok(report.crownOk);
      assert.ok(report.ghostPale);
      if (hat === 'duckCap') {
        assert.ok(Number.isFinite(report.bounds.minY), 'enabled headgear must draw');
        assert.ok(labelAnchorFor(duck, selected) <= report.bounds.minY - 6);
      }
      for (const ghost of [false, true]) {
        const back = new RecordingBrush(), front = new RecordingBrush();
        duck.pieces.back!(makeContext(back, ghost, 1, selected));
        duck.pieces.front!(makeContext(front, ghost, 1, selected));
        assert.equal(back.rec.ops.length > 0, variant === 'ring');
        assert.equal(front.rec.ops.length > 0, variant === 'ring');
        if (variant === 'ring') {
          assert.ok(back.rec.maxX - back.rec.minX + 2 <= 70);
          assert.ok(front.rec.maxY < -9, 'leave legs and ghost tail visible');
        }
      }
      for (const layer of ['hoodBack', 'hatFront'] as const) {
        const b = new RecordingBrush();
        duck.pieces[layer]!(makeContext(b, false, 1, selected));
        assert.equal(b.rec.ops.length > 0, hat === 'duckCap');
        if (hat === 'duckCap') assert.ok(b.rec.maxX + 1 <= RIG.arcsBand.minX);
      }
    }
  }
  assert.equal(duck.hidesHair, false, 'hat off must retain the base hair');
  assert.equal(labelAnchorFor(duck, choice('ring', 'none')), RIG.labelAnchorY);
});

test('duck ring front preserves both hand disks, the open center, legs and ghost tail', () => {
  const b = new GeometryProbe();
  duck.pieces.front!(makeContext(b, false, 1, choice()));
  for (const cx of [RIG.armL.x + 4, RIG.armR.x + 4]) {
    for (let dx = -4; dx <= 4; dx += 0.125) for (let dy = -4; dy <= 4; dy += 0.125) {
      if (dx * dx + dy * dy > 16) continue;
      assert.equal(b.covers(cx + dx, -22 + dy), false, `hand covered at ${cx + dx},${-22 + dy}`);
    }
  }
  assert.equal(b.covers(0, -24), false, 'keep the center open');
  assert.equal(b.covers(0, -6), false, 'keep ghost tail visible');
  for (const x of [-5, 5]) assert.equal(b.covers(x, -9), false, 'keep both legs visible');
  assert.equal(b.covers(0, -30), true, 'raised front tube must remain above stump tops');
});

test('duck plain removes only the ring; cap geometry, ghost colors and label clearance match ring', () => {
  for (const color of [0xe0b23c, 0xe08a3c]) for (const hat of ['duckCap', 'none']) {
    const plain = choice('plain', hat, color), ring = choice('ring', hat, color);
    assertSelection(duck, plain);
    assert.equal(labelAnchorFor(duck, plain), labelAnchorFor(duck, ring));
    for (const ghost of [false, true]) {
      for (const layer of ['hoodBack', 'hatFront'] as const) {
        const a = new GeometryProbe(), b = new GeometryProbe();
        duck.pieces[layer]!(makeContext(a, ghost, 1, plain));
        duck.pieces[layer]!(makeContext(b, ghost, 1, ring));
        assert.deepEqual(a.rec, b.rec);
        assert.deepEqual(a.shapes, b.shapes);
        assert.deepEqual(a.strokeColors, b.strokeColors);
      }
      for (const layer of ['back', 'front'] as const) {
        const b = new GeometryProbe();
        duck.pieces[layer]!(makeContext(b, ghost, 1, plain));
        assert.equal(b.rec.ops.length, 0, 'plain must not retain a ring half or duck nub');
      }
    }
  }
});


test('duck ring has broad visible lobes above the seat, a raised tube and an unhidden duck head', () => {
  const b = new GeometryProbe();
  duck.pieces.front!(makeContext(b, false, 1, choice()));
  // Screen-readability is for the next browser pass; these protect the structural change.
  for (const x of [-30, -27, 27, 30]) {
    assert.ok(b.covers(x, -33), `outer float lobe missing at ${x}`);
  }
  for (const y of [-32, -31, -30, -29]) assert.ok(b.covers(0, y), 'front tube became thin');
  assert.ok(b.covers(27, -41), 'duck head must sit outside the right arm');
  assert.equal(b.covers(0, -40), false, 'keep the chest opening');
});
