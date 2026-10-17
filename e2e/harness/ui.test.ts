// Scene cost knob (visual-7): suite default unless MOONVEIL_SCENE is set; junk is an error, not a silent fallback.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sceneMode } from './ui.ts';

test('sceneMode: suite default, env override, invalid value throws', () => {
  const saved = process.env.MOONVEIL_SCENE;
  try {
    delete process.env.MOONVEIL_SCENE;
    assert.equal(sceneMode('off'), 'off');
    assert.equal(sceneMode('auto'), 'auto');
    process.env.MOONVEIL_SCENE = 'high';
    assert.equal(sceneMode('off'), 'high');
    process.env.MOONVEIL_SCENE = '';
    assert.equal(sceneMode('auto'), 'auto');
    process.env.MOONVEIL_SCENE = 'ultra';
    assert.throws(() => sceneMode('off'), /off\|low\|high\|auto/);
  } finally {
    if (saved === undefined) delete process.env.MOONVEIL_SCENE;
    else process.env.MOONVEIL_SCENE = saved;
  }
});
