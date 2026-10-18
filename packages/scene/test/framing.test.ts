import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMap, frameRect } from '../src/map.ts';
import { frameCamera, focusRect, seatsRect, FOCUS_BELOW, FOCUS_MAX, BOTTOM_BAND } from '../src/framing.ts';

const map = createMap(8);
// rect inside the view; `band` = bottom fraction of the view that must stay clear
const inside = (r: { x: number; y: number; w: number; h: number }, f: { scale: number; cx: number; cy: number }, w: number, h: number, band = 0) =>
  r.x >= f.cx - w / f.scale / 2 - 0.01 && r.x + r.w <= f.cx + w / f.scale / 2 + 0.01 && r.y >= f.cy - h / f.scale / 2 - 0.01 && r.y + r.h <= f.cy + h / f.scale / 2 - (band * h) / f.scale + 0.01;

test('laptops keep the whole-camp framing exactly (camp fit at or above FOCUS_BELOW), in every phase', () => {
  const fr = frameRect(map);
  for (const [w, h] of [[1440, 900], [1280, 460], [1366, 768]] as const) for (const phase of ['lobby', 'day', 'night', 'ended'] as const) {
    const f = frameCamera(map, phase, w, h);
    assert.equal(f.focus, false);
    assert.deepEqual(f, { scale: Math.min(w / fr.w, h / fr.h), cx: fr.x + fr.w / 2, cy: fr.y + fr.h / 2, focus: false });
  }
});

test('small phone slots frame the seat ring by day: larger, capped, every seat and label in view', () => {
  for (const [w, h] of [[375, 128], [390, 420], [844, 300], [320, 200]] as const) {
    const camp = frameCamera(map, 'lobby', w, h);
    assert.ok(camp.scale < FOCUS_BELOW);
    for (const phase of ['day', 'ended'] as const) {
      const f = frameCamera(map, phase, w, h);
      assert.equal(f.focus, true, `${w}x${h}`);
      assert.ok(f.scale > camp.scale && f.scale <= FOCUS_MAX, `${w}x${h} ${f.scale}`);
      assert.ok(inside(seatsRect(map), f, w, h, BOTTOM_BAND), `${w}x${h}: seat ring cut or in the bottom band`);
      const g = frameCamera(map, phase, w, h, null, false);   // bottom safe area set by the UI: no band, larger
      assert.ok(g.scale >= f.scale && inside(seatsRect(map), g, w, h), `${w}x${h} no band`);
    }
  }
});

test('night: 10 tents on a narrow portrait slot keep the camp (gain < 10 %); fewer tents or a short slot frame tents + fire', () => {
  assert.equal(frameCamera(createMap(10), 'night', 390, 420).focus, false);
  assert.equal(frameCamera(createMap(7), 'night', 390, 420).focus, true);
  const f = frameCamera(map, 'night', 375, 128, null, false);
  assert.equal(f.focus, true);
  assert.ok(inside(focusRect(map, 'night', null)!, f, 375, 128));
});

test('the lobby is never focus-framed; a free-moving ghost stays in frame', () => {
  assert.equal(frameCamera(map, 'lobby', 375, 128).focus, false);
  for (const at of [{ x: 420, y: 420 }, { x: 1000, y: 620 }]) {   // far (inside the camp): camp frame; near: focus incl. the ghost
    const f = frameCamera(map, 'day', 844, 300, at);
    const ghost = { x: at.x - 50, y: at.y - 130, w: 100, h: 155 };
    assert.ok(inside(ghost, f, 844, 300), JSON.stringify(at));
    if (f.focus) assert.ok(inside(focusRect(map, 'day', at)!, f, 844, 300, BOTTOM_BAND));
  }
  assert.equal(frameCamera(map, 'day', 844, 300, { x: 1000, y: 620 }).focus, true);
});

test('larger rooms (3 tent rows, wider seat ring) frame the same way', () => {
  const big = createMap(15);
  const f = frameCamera(big, 'day', 390, 420);
  assert.equal(f.focus, true); assert.ok(inside(seatsRect(big), f, 390, 420, BOTTOM_BAND));
});
