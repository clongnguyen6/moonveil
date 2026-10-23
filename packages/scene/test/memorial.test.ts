// Memorials at dead seats: when they exist (staging.ts) and where / which name shows (memorial.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Staging, T, type Actor } from '../src/staging.ts';
import { memorialAt, memorialEligible, memorialNameShown, GHOST_NEAR } from '../src/memorial.ts';
import { createMap, MIN_PLAYERS, MAX_PLAYERS, type Pt } from '../src/map.ts';
import { makeInput, seatId } from '../fixtures/index.ts';
import { halloweenLayout, seatBox, pumpkinBox, boxesHit } from '../src/themes/halloween-layout.ts';
import type { AvatarMode } from '../src/avatar.ts';
import type { SceneInput, SeatId } from '../src/types.ts';

class Fake implements Actor {
  mode: AvatarMode = 'hidden'; alpha = 1; x = 0; y = 0; facing: 1 | -1 = 1; speed = 190; target: Pt | null = null; onArrive: (() => void) | null = null;
  setPos(x: number, y: number) { this.x = x; this.y = y; }
  walkTo(x: number, y: number, cb?: () => void) { this.target = { x, y }; this.onArrive = cb ?? null; }
  update(dt: number) { if (!this.target) return; const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy); if (d < 4) { this.target = null; const cb = this.onArrive; this.onArrive = null; cb?.(); return; } const sp = Math.min(this.speed, d / dt); this.x += (dx / d) * sp * dt; this.y += (dy / d) * sp * dt; }
}
function rig(start: SceneInput, n = 8) {
  const map = createMap(n), wisps: number[] = [], events: string[] = [];
  const st = new Staging({ lantern: () => {}, wisp: () => wisps.push(st.now), spawn: () => ({ x: 0, y: 0 }),
    memorial: (seat, i, name, on, fade) => events.push(`${on ? '+' : '-'}${seat}${on ? `#${i}:${name}${fade ? ':fade' : ''}` : ''}`) }, true);
  const actors = new Map<SeatId, Fake>(); for (let i = 0; i < n; i++) actors.set(seatId(i), new Fake());
  let input = start; st.apply(input, input, actors, map, true, () => false);
  return {
    st, map, wisps, events, set(next: SceneInput, snap = false) { const prev = input; input = next; st.apply(prev, next, actors, map, snap, () => false); },
    run(sec: number) { for (let t = 0; t < sec - 1e-9; t += 1 / 30) { st.tick(1 / 30); for (const a of actors.values()) a.update(1 / 30); } },
  };
}
const day = (dead: SeatId[] = [], n = 8) => makeInput('day', n, { viewer: seatId(0), dead });
const S3 = seatId(2), S5 = seatId(4), S6 = seatId(5);

test('public dead only: a memorial for each dead seat (with its name), none for the living or the disconnected', () => {
  const offline = day([S3]); offline.players = offline.players.map((p) => (p.seat === S6 ? { ...p, connected: false } : p));
  const r = rig(offline);
  assert.deepEqual(r.st.memorialSeats(), [S3]);
  assert.ok(r.events.includes(`+${S3}#2:Huy`), 'named, at its own seat index, no fade on placement');
  assert.equal(memorialEligible(offline, S6), false, 'disconnected is not dead');
});

test('removal by the moderator is not a death: no memorial, no wisp (public cause "removed")', () => {
  const removed = day([S3]); removed.seats = removed.seats.map((s) => (s.seat === S3 ? { ...s, death: { cause: 'removed', night: 0, day: 1 } } : s));
  const r = rig(day()); r.run(10); r.set(removed); r.run(2);
  assert.deepEqual(r.st.memorialSeats(), []); assert.equal(r.wisps.length, 0);
});

test('night victim: no memorial during the night or before its tent would open; then one (with the lantern beat)', () => {
  const r = rig(makeInput('night', 8, { viewer: seatId(0) }));
  assert.deepEqual(r.st.memorialSeats(), []);
  r.set(day([S3]));
  r.run(T.emerge(2) - 0.05); assert.deepEqual(r.st.memorialSeats(), [], 'not before dawn reaches its tent');
  r.run(0.2); assert.deepEqual(r.st.memorialSeats(), [S3]); assert.ok(r.events.at(-1)!.endsWith(':fade'));
  assert.equal(r.wisps.length, 1);
});

test('day death (execution): the memorial appears when the death fade ends, not before', () => {
  const r = rig(day()); r.run(10);
  r.set(day([S5]));
  r.run(T.deathFade - 0.05); assert.deepEqual(r.st.memorialSeats(), []);
  r.run(0.1); assert.deepEqual(r.st.memorialSeats(), [S5]);
});

test('Hunter killed at night, shot at dawn: memorials for the Hunter (at dawn) and the target, no conflict, nothing pending', () => {
  const hunter = seatId(6), target = seatId(1);
  const r = rig(makeInput('night', 8, { viewer: seatId(0) }));
  r.set(day([hunter]));             // dawn: hunter step (the scene shows day)
  r.run(1.0);
  r.set(day([hunter, target]));     // the shot lands before either tent opens
  r.run(8);
  assert.deepEqual(r.st.memorialSeats(), [target, hunter].sort());
  assert.equal(r.st.pending(hunter) + r.st.pending(target), 0);
});

test('reload / remount: snap places every memorial at once (no fade, no pending steps)', () => {
  const r = rig(day([S3, S5]));
  assert.deepEqual(r.st.memorialSeats(), [S3, S5]); assert.equal(r.st.pending(), 0);
  assert.ok(r.events.every((e) => !e.endsWith(':fade')));
});

test('next match / lobby clear every memorial', () => {
  const a = rig(day([S3, S5]));
  a.set(makeInput('lobby', 8, { viewer: seatId(0) }));
  assert.deepEqual(a.st.memorialSeats(), []);
  const b = rig(day([S3, S5]));
  b.set(makeInput('seating', 8, { viewer: seatId(0) }), true);   // a new match: everyone alive again
  assert.deepEqual(b.st.memorialSeats(), []);
  assert.equal(memorialEligible(makeInput('lobby', 8), S3), false);
});

// Seat boxes of neighbours already overlap at the ring's sides (seats stacked ~50-100 units apart), so the rule is about
// covering: depth sorting draws a stone over campers sitting behind it (smaller y) and under campers in front of it.
test('placement: each stone stays on its own seat, never over a camper behind it (head, body, ring), clear of pumpkins, 4-16 players', () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const map = createMap(n), pumpkins = halloweenLayout(map).pumpkins;
    map.seats.forEach((s, i) => {
      const m = memorialAt(map, i)!;
      assert.ok(boxesHit(m.box, seatBox(s), 0), `${n}: stone on its own seat`);
      map.seats.forEach((o, j) => { if (j !== i && o.y < m.base.y) assert.ok(!boxesHit(m.box, seatBox(o), 0), `${n}: stone ${i} would cover the camper at seat ${j}`); });
      for (const p of pumpkins) assert.ok(!boxesHit(m.box, pumpkinBox(p), 2), `${n}: stone ${i} overlaps a pumpkin`);
    });
  }
});

test('one name per player: the memorial name hides while that player’s ghost is visible close by, shows otherwise', () => {
  const at = { x: 500, y: 600 };
  assert.equal(memorialNameShown(at, null), true, 'living view: never sees the ghost');
  assert.equal(memorialNameShown(at, { visible: false, x: at.x, y: at.y }), true);
  assert.equal(memorialNameShown(at, { visible: true, x: at.x + 20, y: at.y + 40 }), false, 'ghost beside it carries the name');
  assert.equal(memorialNameShown(at, { visible: true, x: at.x + GHOST_NEAR + 5, y: at.y }), true, 'ghost far away');
});
