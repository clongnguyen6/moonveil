import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQuality, frameCap, readQualityEnv, SCENE_OVERRIDE_KEY } from '../src/quality.ts';

test('explicit option wins; then page override; then automation and device heuristics', () => {
  assert.equal(resolveQuality('high', { override: 'off', webdriver: true }), 'high');
  assert.equal(resolveQuality('auto', { override: 'off' }), 'off');
  assert.equal(resolveQuality(undefined, { override: 'low' }), 'low');
  assert.equal(resolveQuality('auto', { override: 'bogus' , webdriver: true }), 'low');
  assert.equal(resolveQuality('auto', { webdriver: false, cores: 4 }), 'low');
  assert.equal(resolveQuality('auto', { memoryGb: 2 }), 'low');
  assert.equal(resolveQuality('auto', { cores: 8, memoryGb: 8 }), 'high');
  assert.equal(resolveQuality('auto', {}), 'high');
});

test('frame caps: off=0, reduced motion=4 regardless, low=30, high=60', () => {
  assert.equal(frameCap('off', false), 0);
  assert.equal(frameCap('high', true), 4);
  assert.equal(frameCap('low', true), 4);
  assert.equal(frameCap('low', false), 30);
  assert.equal(frameCap('high', false), 60);
});

test('reads the override and navigator hints from a global object', () => {
  const g = { [SCENE_OVERRIDE_KEY]: 'off', navigator: { webdriver: true, hardwareConcurrency: 2, deviceMemory: 4 }, matchMedia: () => ({ matches: true }) } as unknown as typeof globalThis;
  assert.deepEqual(readQualityEnv(g), { override: 'off', webdriver: true, reducedMotion: true, cores: 2, memoryGb: 4 });
  assert.deepEqual(readQualityEnv({} as typeof globalThis), { override: undefined, webdriver: false, reducedMotion: false, cores: undefined, memoryGb: undefined });
});
