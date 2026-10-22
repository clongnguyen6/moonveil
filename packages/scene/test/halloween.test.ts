import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTheme, ThemeController } from '../src/themes/index.ts';
import { halloweenLayout, inSeatRing, nearSeat, onSeat, pumpkinBox, seatBox, boxesHit, SEAT_CLEAR, FIRE_DIRT } from '../src/themes/halloween-layout.ts';
import { createMap, FIRE, isWalkable, streamX, MIN_PLAYERS, MAX_PLAYERS } from '../src/map.ts';
import { toSceneInput } from '../src/adapter.ts';

test('theme option: only the exact id selects halloween; everything else is normal; never in SceneInput', () => {
  assert.equal(normalizeTheme('halloween'), 'halloween');
  for (const v of [undefined, null, '', 'normal', 'Halloween', 'xmas', true, 1]) assert.equal(normalizeTheme(v), 'normal');
  const input = toSceneInput({ me: { seat: 's1', kind: 'player' }, status: 'lobby', phaseEndsAt: null, voice: [], players: [{ seat: 's1', name: 'A', connected: true, appearance: { color: 'ember', hat: 'none' } }] }, null);
  assert.ok(!('theme' in input), 'the wire never carries a theme');
});

// fake overlay + loader: logs load/attach/detach/shown/normal/error and lets a test hold or fail the "chunk download"
function rig() {
  const log: string[] = [];
  let release!: () => void; let fail = false;
  const gate = () => new Promise<void>((ok, no) => { release = () => (fail ? no(new Error('chunk')) : ok()); });
  const ov = { id: 'halloween', night: { ambient: 1, wash: 2 }, detach: () => log.push('detach') };
  const c = new ThemeController(async () => { log.push('load'); await gate(); return () => { log.push('attach'); return ov; }; },
    (o) => log.push(o ? 'shown' : 'normal'), () => log.push('error'));
  return { c, log, release: () => release(), failNext: () => { fail = true; }, okNext: () => { fail = false; } };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('setTheme success: resolves "halloween" only once the overlay is attached; default normal loads nothing', async () => {
  const { c, log, release } = rig();
  c.sceneReady();
  assert.equal(await c.set('normal'), 'normal'); assert.equal(c.loads, 0); assert.deepEqual(log, []);
  const p = c.set('halloween'); await tick(); release();
  assert.equal(await p, 'halloween'); assert.deepEqual(log, ['load', 'attach', 'shown']); assert.equal(c.shown, 'halloween');
  assert.equal(await c.set('normal'), 'normal'); assert.deepEqual(log.slice(-2), ['detach', 'normal']);
  assert.equal(await c.set('halloween'), 'halloween', 'toggling back re-attaches'); assert.equal(c.loads, 1, 'no second load');
});

test('setTheme failure: resolves "normal" (never rejects), reports the error, and the next "halloween" retries', async () => {
  const { c, log, release, failNext, okNext } = rig();
  c.sceneReady();
  failNext(); const p = c.set('halloween'); await tick(); release();
  assert.equal(await p, 'normal'); assert.ok(log.includes('error')); assert.ok(!log.includes('shown'));
  okNext(); const q = c.set('halloween'); await tick(); release();
  assert.equal(await q, 'halloween'); assert.equal(c.loads, 2);
});

test('setTheme before the scene is built: waits, resolves "halloween" only after the scene is ready and the overlay attached', async () => {
  const { c, log, release } = rig();
  let settled: string | null = null;
  const p = c.set('halloween').then((v) => { settled = v; return v; }); await tick(); release(); await tick(); await tick();
  assert.equal(settled, null, 'still waiting for the scene'); assert.deepEqual(log, ['load']);
  c.sceneReady();
  assert.equal(await p, 'halloween'); assert.deepEqual(log, ['load', 'attach', 'shown']);
  // destroyed before it was ever built: pending calls settle as normal, nothing attaches
  const d = rig(); const r = d.c.set('halloween'); await tick(); d.release(); await tick();
  d.c.destroy(); assert.equal(await r, 'normal'); assert.ok(!d.log.includes('attach'));
});

test('overlapping setTheme calls: each resolves with what is shown when it settles; the last choice wins; one load', async () => {
  const a = rig(); a.c.sceneReady();
  const h = a.c.set('halloween'); await tick();
  const n = a.c.set('normal');
  a.release();
  assert.deepEqual([await h, await n], ['normal', 'normal']); assert.ok(!a.log.includes('attach'), 'superseded load not shown');
  const b = rig(); b.c.sceneReady();
  const h1 = b.c.set('halloween'), h2 = b.c.set('halloween'); await tick(); b.release();
  assert.deepEqual([await h1, await h2], ['halloween', 'halloween']); assert.equal(b.c.loads, 1);
  assert.equal(b.log.filter((x) => x === 'attach').length, 1, 'attached once');
  const n2 = b.c.set('normal'), h3 = b.c.set('halloween');
  assert.deepEqual([await n2, await h3], ['halloween', 'halloween'], 'a quick normal->halloween ends shown');
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
    assert.ok(L.leaves.length >= 30 && L.leaves.length <= 60, `${n}: sparse leaf clusters (${L.leaves.length})`);
    assert.ok(L.strands.every((s) => s.bulbs.filter((b) => b.color === 'orange').length > s.bulbs.length / 2), `${n}: amber-majority lights`);
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
