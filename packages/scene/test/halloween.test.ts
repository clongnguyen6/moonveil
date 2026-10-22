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

// fake overlay + loader: counts attaches/detaches and lets a test hold the "chunk download"
function rig() {
  const log: string[] = [];
  let release!: () => void; let fail = false;
  const gate = () => new Promise<void>((ok, no) => { release = () => (fail ? no(new Error('chunk')) : ok()); });
  const ov = { id: 'halloween', night: { ambient: 1, wash: 2 }, detach: () => log.push('detach') };
  const c = new ThemeController(async () => { log.push('load'); await gate(); return () => { log.push('attach'); return ov; }; }, (o) => log.push(o ? 'shown' : 'normal'));
  return { c, log, release: () => release(), failNext: () => { fail = true; }, okNext: () => { fail = false; }, ov };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('theme controller: default normal loads nothing; choosing halloween loads once and shows after the scene is ready', async () => {
  const { c, log, release } = rig();
  await c.sceneReady();
  assert.equal(c.theme, 'normal'); assert.equal(c.loads, 0); assert.deepEqual(log, []);
  const p = c.set('halloween'); await tick(); release(); await p;
  assert.deepEqual(log, ['load', 'attach', 'shown']); assert.equal(c.overlay?.id, 'halloween');
});

test('theme controller: switching back to normal removes it; again halloween re-attaches without a second load', async () => {
  const { c, log, release } = rig();
  await c.sceneReady();
  const p = c.set('halloween'); await tick(); release(); await p;
  await c.set('normal');
  assert.equal(c.overlay, null); assert.deepEqual(log.slice(-2), ['detach', 'normal']);
  await c.set('halloween');
  assert.equal(c.loads, 1); assert.deepEqual(log.slice(-2), ['attach', 'shown']);
});

test('theme controller: a choice made before the scene is built waits; a newer choice wins over a pending load; destroy is final', async () => {
  const a = rig();
  const p = a.c.set('halloween'); await tick(); a.release(); await p;
  assert.deepEqual(a.log, ['load'], 'loaded but not shown before the scene exists');
  await a.c.sceneReady(); assert.deepEqual(a.log, ['load', 'attach', 'shown']);
  const b = rig(); await b.c.sceneReady();
  const q = b.c.set('halloween'); await tick(); await b.c.set('normal'); b.release(); await q;
  assert.equal(b.c.overlay, null); assert.ok(!b.log.includes('attach'), 'stale load is not shown');
  const d = rig(); await d.c.sceneReady();
  const r = d.c.set('halloween'); await tick(); d.release(); await r;
  d.c.destroy(); await d.c.set('halloween');
  assert.equal(d.c.overlay, null); assert.deepEqual(d.log.slice(-2), ['detach', 'normal']);
});

test('theme controller: a failed chunk load leaves the scene normal and can be retried', async () => {
  const { c, log, release, failNext, okNext } = rig();
  await c.sceneReady();
  failNext(); const p = c.set('halloween'); await tick(); release();
  await assert.rejects(p); assert.equal(c.overlay, null); assert.ok(!log.includes('shown'));
  okNext(); const q = c.set('halloween'); await tick(); release(); await q;
  const shown = (): { id: string } | null => c.overlay;   // re-read (TS narrowed it to null above)
  assert.equal(c.loads, 2); assert.equal(shown()?.id, 'halloween');
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
