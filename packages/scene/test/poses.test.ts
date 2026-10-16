import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PoseBuffer, POSE_DELAY_MS, POSE_STALE_MS } from '../src/poses.ts';

test('interpolates between the last two poses with a delay, and reports staleness', () => {
  const b = new PoseBuffer();
  b.push({ poses: [{ seat: 'a', x: 0, y: 0, facing: 1, moving: true }] }, 1000);
  b.push({ poses: [{ seat: 'a', x: 100, y: 0, facing: 1, moving: true }] }, 1100);
  const mid = b.sample('a', 1100 + POSE_DELAY_MS - 50)!;
  assert.ok(mid.x > 0 && mid.x < 100, `expected interpolated x, got ${mid.x}`);
  assert.equal(b.sample('a', 1100 + POSE_DELAY_MS + 10)!.x, 100);
  assert.equal(b.fresh('a', 1100 + POSE_STALE_MS - 1), true);
  assert.equal(b.fresh('a', 1100 + POSE_STALE_MS + 1), false);
  assert.equal(b.sample('zzz', 2000), null);
});
