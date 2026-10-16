// Restart recovery: rooms survive a server restart via the RoomStore. Downtime counts as paused time.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createRulesEngine } from '@moonveil/rules';
import { Registry } from '../src/rooms.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { fileRoomStore, memoryRoomStore, type RoomStore } from '../src/store.ts';
import { FakeClient, ManualClock, profile } from './harness.ts';
import { gv, role, stepKind } from './match-driver.ts';

const realEngine = () => createRulesEngine() as RulesEngine<unknown>;
function registry(store: RoomStore, clock: ManualClock, engine = realEngine) {
  return new Registry({ engine, store, scheduler: clock, now: clock.now, seed: () => 'restart-seed' });
}
function seat8(reg: Registry, mode: 'automatic' | 'moderator') {
  const c = () => new FakeClient(reg);
  const creator = c();
  creator.send({ t: 'create', mode, profile: profile(mode === 'moderator' ? 'Mod' : 'P0') });
  const players = mode === 'automatic' ? [creator] : [];
  while (players.length < 8) {
    const p = c();
    p.send({ t: 'join', code: creator.code!, profile: profile(`P${players.length}`) });
    players.push(p);
  }
  for (const p of players) p.send({ t: 'ready', ready: true });
  creator.send({ t: 'start' });
  return { creator, players, moderator: mode === 'moderator' ? creator : null };
}
// A crashed server's timers never fire again: the restarted server gets a fresh clock at a later time.
function restartClock(old: ManualClock, downtimeMs: number) {
  const c = new ManualClock();
  c.t = old.t + downtimeMs;
  return c;
}
const resumeOn = (reg: Registry, old: FakeClient) => {
  const c = new FakeClient(reg);
  c.send({ t: 'resume', code: old.code!, token: old.token! });
  return c;
};

test('automatic: restart mid-night resumes the same match; downtime is paused time; chat + tokens survive', () => {
  const store = memoryRoomStore();
  const clock = new ManualClock();
  const reg1 = registry(store, clock);
  const { players } = seat8(reg1, 'automatic');
  const deadline = players[0]!.view.phaseEndsAt!;
  clock.tick(10_000);
  const wolves = players.filter((p) => role(p) === 'wolf');
  wolves[0]!.send({ t: 'say', channel: 'wolves', text: 'before the crash' }); // saved now
  const savedAt = clock.now();
  const before = players.map((p) => JSON.stringify(p.view.game));

  // Crash: sockets gone, server process gone. 10 min downtime.
  const clock2 = restartClock(clock, 10 * 60_000);
  const reg2 = registry(store, clock2);
  assert.equal(reg2.restoreAll(), 1);
  const back = players.map((p) => resumeOn(reg2, p));
  back.forEach((c, i) => {
    assert.equal(c.seat, players[i]!.seat, 'same seat');
    assert.equal(JSON.stringify(c.view.game), before[i], 'same game view');
  });
  assert.equal(stepKind(back[0]!), 'night.main');
  assert.equal(back[0]!.view.phaseEndsAt! - clock2.now(), deadline - savedAt, 'remaining time as of last save');
  const wlog = back.find((c) => role(c) === 'wolf')!.frames.find((f) => f.t === 'chatlog' && f.channel === 'wolves');
  assert.ok(wlog && wlog.t === 'chatlog' && wlog.messages[0]!.text === 'before the crash');
  const nonWolf = back.find((c) => role(c) !== 'wolf')!;
  assert.ok(!nonWolf.frames.some((f) => JSON.stringify(f).includes('before the crash')), 'wolf chat leaked on restore');
  // The match goes on.
  clock2.tick(back[0]!.view.phaseEndsAt! - clock2.now());
  assert.equal(stepKind(back[0]!), 'night.witch');
});

test('moderator mode: restart keeps moderator seat and secrets; players stay isolated', () => {
  const store = memoryRoomStore();
  const clock = new ManualClock();
  const reg1 = registry(store, clock);
  const { players, moderator } = seat8(reg1, 'moderator');
  const reg2 = registry(store, restartClock(clock, 60_000));
  reg2.restoreAll();
  const mod = resumeOn(reg2, moderator!);
  assert.equal(mod.view.me.kind, 'moderator');
  assert.notEqual(gv(mod).moderator, null);
  const p = resumeOn(reg2, players[0]!);
  assert.equal(gv(p).moderator, null);
  mod.send({ t: 'act', action: { type: 'step.close' } });
  assert.equal(stepKind(p), 'night.witch');
});

test('a room saved by another engine is skipped, not misread', () => {
  const store = memoryRoomStore();
  const clock = new ManualClock();
  seat8(registry(store, clock, () => createFixtureEngine() as RulesEngine<unknown>), 'automatic');
  const reg2 = registry(store, clock);
  assert.equal(reg2.restoreAll(), 0);
});

test('file store: atomic 0600 files, corrupt files skipped, closed rooms removed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mv-rooms-'));
  const clock = new ManualClock();
  const store = fileRoomStore(dir);
  const reg1 = registry(store, clock);
  const { creator } = seat8(reg1, 'automatic');
  const files = readdirSync(dir);
  assert.deepEqual(files, [`${creator.code}.json`]);
  assert.equal(statSync(join(dir, files[0]!)).mode & 0o777, 0o600);
  writeFileSync(join(dir, 'ZZZZZZ.json'), '{not json');
  const reg2 = registry(fileRoomStore(dir), restartClock(clock, 1_000));
  assert.equal(reg2.restoreAll(), 1);
  reg2.get(creator.code!).close();
  assert.ok(!readdirSync(dir).includes(`${creator.code}.json`), 'closed room file removed');
});
