// Dawn and death choreography on the scene clock (staging.ts), with fake avatars and the scene's per-frame rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Staging, T, livingMode, type Actor } from '../src/staging.ts';
import { createMap, type Pt } from '../src/map.ts';
import { makeInput, seatId } from '../fixtures/index.ts';
import { frameStep } from '../src/quality.ts';
import type { AvatarMode } from '../src/avatar.ts';
import type { SceneInput, SeatId } from '../src/types.ts';

class Fake implements Actor {
  mode: AvatarMode = 'hidden'; alpha = 1; x = 0; y = 0; facing: 1 | -1 = 1; speed = 190;
  target: Pt | null = null; onArrive: (() => void) | null = null;
  setPos(x: number, y: number) { this.x = x; this.y = y; }
  walkTo(x: number, y: number, cb?: () => void) { this.target = { x, y }; this.onArrive = cb ?? null; }
  update(dt: number) {   // straight-line walk like Avatar.update (no obstacles)
    if (!this.target) { if (this.mode === 'walk') this.mode = 'idle'; return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
    if (d < 4) { this.x = this.target.x; this.y = this.target.y; this.target = null; const cb = this.onArrive; this.onArrive = null; cb?.(); return; }
    const sp = Math.min(this.speed, d / dt); this.x += (dx / d) * sp * dt; this.y += (dy / d) * sp * dt;
    if (this.mode === 'idle') this.mode = 'walk';
  }
}

// one viewer's scene: staging + fakes + the per-frame rules of scene.ts (remote ghosts: entitled pose -> ghost, else hidden)
function world(viewer: SeatId | 'moderator', n = 8) {
  const map = createMap(n), lanterns = Array(n).fill(0) as number[], wisps: { t: number; at: Pt }[] = [];
  const st = new Staging({ lantern: (i, lv) => { lanterns[i] = lv; }, wisp: (at) => wisps.push({ t: st.now, at }), spawn: () => ({ x: 0, y: 0 }) }, true);
  const actors = new Map<SeatId, Fake>(); for (let i = 0; i < n; i++) actors.set(seatId(i), new Fake());
  let input: SceneInput = makeInput('night', n, { viewer });
  const entitled = () => viewer === 'moderator' || input.seats.find((s) => s.seat === viewer)?.alive === false;
  const hasPose = (seat: SeatId) => entitled() && seat !== viewer && input.seats.find((s) => s.seat === seat)?.alive === false;
  const modes = new Map<SeatId, AvatarMode[]>();
  st.apply(input, input, actors, map, true, hasPose);
  return {
    st, map, lanterns, wisps, actors, modes,
    set(next: SceneInput) { const prev = input; input = next; st.apply(prev, next, actors, map, false, hasPose); },
    run(sec: number, step = 1 / 60) {
      for (let t = 0; t < sec - 1e-9; t += step) {
        st.tick(step);
        for (const [seat, a] of actors) {
          if (st.intent(seat) === 'ghost' && seat !== viewer) {
            if (hasPose(seat) && !st.dying(seat)) { if (a.mode !== 'ghost') { a.mode = 'ghost'; a.alpha = 1; } }
            else if (!st.dying(seat)) a.mode = 'hidden';
          }
          a.update(step);
          (modes.get(seat) ?? modes.set(seat, []).get(seat)!).push(a.mode);
        }
      }
    },
    day: (dead: SeatId[] = []) => makeInput('day', n, { viewer, dead }),
  };
}
const S4 = seatId(3), S8 = seatId(7), S3 = seatId(2);
const livingAfter = (w: ReturnType<typeof world>, seat: SeatId) => (w.modes.get(seat) ?? []).filter(livingMode);

test('race (Hunter shot at dawn): a seat that dies before its emergence step is never drawn as a living camper, in any view', () => {
  for (const viewer of [seatId(0), S4, 'moderator'] as const) {
    const w = world(viewer);
    w.set(w.day());                 // dawn
    w.run(1.1);                     // before S4 (3.4 s) and S8 (4.6 s) come out
    w.modes.clear();
    w.set(w.day([S4, S8]));         // the shot lands
    w.run(8);
    for (const seat of [S4, S8]) assert.deepEqual(livingAfter(w, seat), [], `${viewer}: ${seat} drawn alive after its death`);
    assert.equal(w.st.pending(S4) + w.st.pending(S8), 0, `${viewer}: stale steps left`);
    // living view: hidden (no ghost poses); the victim's own view and the moderator: ghosts
    for (const seat of [S4, S8]) assert.equal(w.actors.get(seat)!.mode, viewer === seatId(0) ? 'hidden' : 'ghost', `${viewer}: ${seat} end state`);
    assert.equal(w.actors.get(seatId(0))!.mode, 'seated', 'the living still sit down');
  }
});

test('race variant: shot just after the target came out (fading in / walking): a short fade where they are, then never alive again', () => {
  const w = world(seatId(0));
  w.set(w.day()); w.run(T.emerge(3) + 0.3);
  assert.ok(livingMode(w.actors.get(S4)!.mode), 'S4 is out of the tent');
  w.modes.clear(); w.set(w.day([S4]));
  assert.ok(w.st.dying(S4)); assert.equal(w.wisps.length, 1, 'wisp at the seat');
  w.run(T.deathFade + 0.05);
  assert.equal(w.actors.get(S4)!.mode, 'hidden'); assert.ok(!w.st.dying(S4));
  w.modes.clear(); w.run(6); assert.deepEqual(livingAfter(w, S4), []);
});

test('night victim at dawn, living view: never comes out; at its emergence time the lantern gutters out and a wisp rises at its tent', () => {
  const w = world(seatId(0));
  w.lanterns.fill(0.4);   // everyone inside, lanterns low
  w.set(w.day([S3]));
  w.run(T.emerge(2) - 0.05);
  assert.equal(w.wisps.length, 0); assert.equal(w.lanterns[2], 0.4);
  w.run(1);
  assert.equal(w.wisps.length, 1); const tent = w.map.tents[2]!;
  assert.deepEqual(w.wisps[0]!.at, { x: tent.x, y: tent.y - 60 }, 'beat at the victim’s tent');
  assert.equal(w.lanterns[2], 0, 'lantern out');
  w.run(8);
  assert.ok((w.modes.get(S3) ?? []).every((m) => m === 'hidden'), 'never drawn for a living view (no ghost pose)');
  assert.ok([0, 1, 3, 4, 5, 6, 7].every((i) => w.lanterns[i] === 0 && w.actors.get(seatId(i))!.mode === 'seated'), 'others out and seated, all lanterns out');
});

test('night victim, own view: stays in the tent until dawn opens it, then appears as a ghost at its tent door (not at the fire)', () => {
  const w = world(S3);
  w.set(w.day([S3]));
  w.run(T.emerge(2) - 0.05);
  assert.ok((w.modes.get(S3) ?? []).every((m) => m === 'hidden'), 'hidden while the camp is still in the tents');
  w.run(1);
  const a = w.actors.get(S3)!, door = w.map.tents[2]!.door;
  assert.equal(a.mode, 'ghost'); assert.deepEqual([a.x, a.y], [door.x, door.y]); assert.equal(a.alpha, 1);
});

test('day death (execution): fade + wisp at the seat; living view then hidden (never a ghost), moderator then sees the ghost', () => {
  for (const viewer of [seatId(0), 'moderator'] as const) {
    const w = world(viewer);
    w.set(w.day()); w.run(10);
    const a = w.actors.get(seatId(4))!; assert.equal(a.mode, 'seated');
    w.modes.clear(); w.set(w.day([seatId(4)]));
    w.run(T.deathFade / 2);
    assert.ok(a.alpha > 0.2 && a.alpha < 0.8 && a.mode === 'seated', `${viewer}: fading at the seat`);
    w.run(T.deathFade);
    assert.equal(a.mode, viewer === 'moderator' ? 'ghost' : 'hidden');
    assert.equal(w.wisps.length, 1);
    assert.ok(!(w.modes.get(seatId(4)) ?? []).includes('ghost') || viewer === 'moderator', 'a living view never shows the ghost');
  }
});

test('reload / remount during dawn: snap to a consistent end state, nothing pending', () => {
  const map = createMap(8), lanterns = Array(8).fill(0.4) as number[];
  const st = new Staging({ lantern: (i, lv) => { lanterns[i] = lv; }, wisp: () => {}, spawn: () => ({ x: 0, y: 0 }) }, true);
  const actors = new Map<SeatId, Fake>(); for (let i = 0; i < 8; i++) actors.set(seatId(i), new Fake());
  const day = makeInput('day', 8, { viewer: seatId(0), dead: [S3] });
  st.apply(day, day, actors, map, true, () => false);
  assert.equal(st.pending(), 0);
  assert.ok(lanterns.every((l) => l === 0), 'all lanterns out by day (incl. the victim’s)');
  assert.equal(actors.get(S3)!.mode, 'hidden'); assert.equal(actors.get(seatId(0))!.mode, 'seated');
});

test('low / reduced motion: the lantern goes straight out (no gutter flicker), same timing', () => {
  const map = createMap(8), lanterns = Array(8).fill(0.4) as number[], wisps: number[] = [];
  const st = new Staging({ lantern: (i, lv) => { lanterns[i] = lv; }, wisp: () => wisps.push(st.now), spawn: () => ({ x: 0, y: 0 }) }, false);
  const actors = new Map<SeatId, Fake>(); for (let i = 0; i < 8; i++) actors.set(seatId(i), new Fake());
  const night = makeInput('night', 8, { viewer: seatId(0) }); st.apply(night, night, actors, map, true, () => false);
  st.apply(night, makeInput('day', 8, { viewer: seatId(0), dead: [S3] }), actors, map, false, () => false);
  for (let t = 0; t < T.emerge(2) + 0.01; t += 0.25) st.tick(0.25);
  assert.equal(lanterns[2], 0); assert.equal(wisps.length, 1, 'the scene decides how a wisp looks (static / none)');
});

test('reduced motion clock: at the 4 fps cap dawn takes the same real time as at 60 fps (no 2.5x slowdown)', () => {
  const seatedAt = (fps: number, cap: number) => {
    const w = world(seatId(0)); w.set(w.day());
    let real = 0; const dt = frameStep(1000 / fps, cap);
    while (![...w.actors.values()].every((a) => a.mode === 'seated') && real < 60) { w.run(dt, dt); real += 1 / fps; }
    return real;
  };
  const a = seatedAt(60, 60), b = seatedAt(4, 4);
  assert.ok(Math.abs(a - b) < 0.6, `60 fps ${a.toFixed(2)} s vs 4 fps ${b.toFixed(2)} s`);
  assert.equal(frameStep(5000, 60), 0.1, 'a long stall is still clamped');
});
