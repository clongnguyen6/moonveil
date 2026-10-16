import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWireMove, fromWirePoses, facingSign } from '../src/wire.ts';
import { WORLD } from '../src/map.ts';

test('normalized wire poses round-trip to world units within rounding', () => {
  const p = { seat: 's1', x: 850, y: 700, facing: -1 as const, moving: true };
  const m = toWireMove(p, 'normalized');
  assert.ok(m.x >= 0 && m.x <= 1 && m.y >= 0 && m.y <= 1);
  const back = fromWirePoses([{ seat: 's1', ...m }], 'normalized').poses[0]!;
  assert.ok(Math.abs(back.x - 850) < 0.5 && Math.abs(back.y - 700) < 0.5);
  assert.equal(back.facing, -1);
});

test('world units pass through as integers; facing is normalised to ±1; bad values are clamped', () => {
  const m = toWireMove({ seat: 's1', x: 100.6, y: 20.2, facing: 1, moving: false }, 'world');
  assert.deepEqual(m, { x: 101, y: 20, facing: 1, moving: false });
  const f = fromWirePoses([{ seat: 'a', x: 2, y: -1, facing: 3.5, moving: true }, { seat: 'b', x: NaN, y: 0.5, facing: -0.2, moving: false }], 'normalized');
  assert.deepEqual(f.poses[0], { seat: 'a', x: WORLD.w, y: 0, facing: 1, moving: true });
  assert.deepEqual(f.poses[1], { seat: 'b', x: 0, y: WORLD.h / 2, facing: -1, moving: false });
  assert.equal(facingSign(0), 1);
});
