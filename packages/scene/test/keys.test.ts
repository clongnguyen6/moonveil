import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyboardTargetIgnored, sceneHandlesKey, keysToDir } from '../src/keys.ts';

const el = (tagName: string, extra: Partial<{ isContentEditable: boolean; underUi: boolean }> = {}) => ({
  tagName, isContentEditable: !!extra.isContentEditable, closest: (sel: string) => (sel === '[data-ui]' && extra.underUi ? {} : null),
});

test('editable targets and HUD descendants are ignored; canvas/body are not', () => {
  assert.equal(keyboardTargetIgnored(el('INPUT')), true);
  assert.equal(keyboardTargetIgnored(el('textarea')), true);
  assert.equal(keyboardTargetIgnored(el('SELECT')), true);
  assert.equal(keyboardTargetIgnored(el('DIV', { isContentEditable: true })), true);
  assert.equal(keyboardTargetIgnored(el('BUTTON', { underUi: true })), true);
  assert.equal(keyboardTargetIgnored(el('CANVAS')), false);
  assert.equal(keyboardTargetIgnored(el('BODY')), false);
  assert.equal(keyboardTargetIgnored(null), false);
});

test('scene claims WASD/arrows/Space only outside editable targets; never Escape or other keys', () => {
  assert.equal(sceneHandlesKey('Space', el('CANVAS')), true);
  assert.equal(sceneHandlesKey('Space', el('TEXTAREA')), false);     // chat keeps its spaces
  assert.equal(sceneHandlesKey('KeyW', el('INPUT')), false);         // typing "w" does not walk
  assert.equal(sceneHandlesKey('KeyW', el('BODY')), true);
  assert.equal(sceneHandlesKey('ArrowLeft', el('DIV', { underUi: true })), false);
  assert.equal(sceneHandlesKey('Escape', el('CANVAS')), false);      // HUD panels can always close
  assert.equal(sceneHandlesKey('KeyQ', el('CANVAS')), false);
});

test('key set to direction vector is normalised', () => {
  assert.deepEqual(keysToDir(new Set(['KeyW'])), { x: 0, y: -1 });
  const diag = keysToDir(new Set(['ArrowRight', 'ArrowDown']));
  assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-9 && diag.x > 0 && diag.y > 0);
  assert.deepEqual(keysToDir(new Set(['KeyA', 'KeyD'])), { x: 0, y: 0 });
});
