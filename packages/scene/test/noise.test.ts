import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Noise } from '../src/noise.ts';

test('noise is deterministic, bounded and smooth', () => {
  const a = new Noise(7), b = new Noise(7), c = new Noise(8);
  assert.equal(a.fbm(3.3, 4.4), b.fbm(3.3, 4.4));
  assert.notEqual(a.fbm(3.3, 4.4), c.fbm(3.3, 4.4));
  let min = 1, max = 0;
  for (let i = 0; i < 2000; i++) { const v = a.fbm(i * 0.37, i * 0.11, 5); min = Math.min(min, v); max = Math.max(max, v); assert.ok(v >= 0 && v <= 1); }
  assert.ok(max - min > 0.3, `too flat: ${min}..${max}`);
  assert.ok(Math.abs(a.value(10.5, 10.5) - a.value(10.51, 10.5)) < 0.05);
});
