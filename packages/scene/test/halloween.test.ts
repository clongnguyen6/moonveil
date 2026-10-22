import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeTheme, isDevBuild } from '../src/themes/index.ts';
import { halloweenLayout, inSeatRing, nearSeat, onSeat, pumpkinBox, seatBox, boxesHit, SEAT_CLEAR, FIRE_DIRT } from '../src/themes/halloween-layout.ts';
import { createMap, FIRE, isWalkable, streamX, MIN_PLAYERS, MAX_PLAYERS } from '../src/map.ts';
import { toSceneInput } from '../src/adapter.ts';

test('the theme is dev-only: never active outside a dev build, only for the exact id; never in SceneInput', () => {
  assert.equal(activeTheme('halloween', false), null, 'production build');
  assert.equal(activeTheme('halloween', true), 'halloween');
  for (const v of [undefined, null, '', 'Halloween', 'xmas', true, 1]) assert.equal(activeTheme(v, true), null);
  assert.equal(isDevBuild(), false, 'node / non-Vite: off');
  const input = toSceneInput({ me: { seat: 's1', kind: 'player' }, status: 'lobby', phaseEndsAt: null, voice: [], players: [{ seat: 's1', name: 'A', connected: true, appearance: { color: 'ember', hat: 'none' } }] }, null);
  assert.ok(!('theme' in input), 'the wire never carries a theme');
});

test('decorations keep clear of seats, speaking rings, the seated ring, the fire ring dirt and the stream, for every room size', () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const map = createMap(n), L = halloweenLayout(map);
    const r = { rx: Math.max(...map.seats.map((s) => Math.abs(s.x - FIRE.x))) + 120, ry: Math.max(...map.seats.map((s) => Math.abs(s.y - FIRE.y))) + 80 };
    const nearFire = L.pumpkins.filter((p) => ((p.x - FIRE.x) / r.rx) ** 2 + ((p.y - FIRE.y) / r.ry) ** 2 < 1);
    assert.ok(nearFire.length >= 2, `${n}: pumpkins around the campfire (${nearFire.length})`);
    for (const p of L.pumpkins) {
      assert.ok(!nearSeat(map, p, SEAT_CLEAR), `${n}: pumpkin on a seat ${JSON.stringify(p)}`);
      assert.ok(!onSeat(map, pumpkinBox(p)), `${n}: pumpkin overlaps a seated camper (head, body, stump or ring) ${JSON.stringify(p)}`);
      assert.ok(!inSeatRing(map, p), `${n}: pumpkin inside the seated ring`);
      assert.ok(isWalkable(map, p.x, p.y), `${n}: pumpkin on a tent/fire pit/stream`);
    }
    assert.ok(L.strands.length <= 2 && L.strands.every((s) => s.bulbs.length <= 8), `${n}: sparse lights`);
    for (const s of L.strands) for (const p of [s.a, s.b, ...s.bulbs, ...s.ghosts]) {
      assert.ok(!inSeatRing(map, p) && !nearSeat(map, p, 120), `${n}: string lights / ornament near the seats`);
      assert.ok(p.y < FIRE.y - 150, `${n}: string lights hang behind the camp`);
    }
    for (const l of L.leaves) {
      assert.ok(((l.x - FIRE.x) / FIRE_DIRT.rx) ** 2 + ((l.y - FIRE.y) / FIRE_DIRT.ry) ** 2 >= 1, `${n}: leaf on the fire ring`);
      assert.ok(Math.abs(l.x - streamX(l.y)) >= 95, `${n}: leaf in the stream`);
    }
  }
});

test('the seat box check catches a pumpkin just behind a seated camper (at head height)', () => {
  const s = { x: 900, y: 690 };
  assert.ok(boxesHit(seatBox(s), pumpkinBox({ x: s.x - 5, y: s.y - 40, scale: 1 })), 'behind, at the head');
  assert.ok(boxesHit(seatBox(s), pumpkinBox({ x: s.x + 20, y: s.y + 25, scale: 1 })), 'in front, on the stump');
  assert.ok(!boxesHit(seatBox(s), pumpkinBox({ x: s.x + 60, y: s.y, scale: 1 })), 'beside, clear');
});

test('layout is deterministic (same camp for every viewer)', () => {
  assert.deepEqual(halloweenLayout(createMap(8)), halloweenLayout(createMap(8)));
});
