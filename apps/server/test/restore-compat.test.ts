// Saved-match compatibility (rules API.md "Saved matches"): Room.restore asks engine.restoreCheck for rooms with a game.
// Real 35151f2 host states from the rules owner (packages/rules/test/fixtures): an old in-progress room is skipped with
// the engine's reason (`room … skipped`), an old finished room is restored and readable, a current room round-trips.
// The real entry's startup line counts both.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { GameView } from '@moonveil/protocol';
import { createHostedRulesEngine } from '../src/rules/decks.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { Registry } from '../src/rooms.ts';
import { fileRoomStore, memoryRoomStore, type RoomSnapshot, type RoomStore } from '../src/store.ts';
import { FakeClient, ManualClock, profile } from './harness.ts';
import { gv } from './match-driver.ts';

const fixture = (name: string) => JSON.parse(readFileSync(join(import.meta.dirname, `../../../packages/rules/test/fixtures/host-35151f2-${name}.json`), 'utf8')) as { seatIds: string[]; match: { step: { kind: string } } };
const TOKEN = (i: number) => `restore-compat-token-${i}-abcdefghij`;

// A room snapshot as 35151f2's server wrote it, around the rules owner's saved host state.
function oldSnapshot(code: string, game: ReturnType<typeof fixture>): RoomSnapshot {
  const seat = (id: string, i: number) => ({ id, kind: 'player', name: `Old${i}`, appearance: { color: 'moss', hat: 'none' }, ready: true, token: TOKEN(i) });
  return {
    v: 1,
    engine: 'moonveil-werewolf',
    code,
    savedAt: 1_000,
    room: { mode: 'automatic', voiceMode: 'remote', status: game.match.step.kind === 'ended' ? 'ended' : 'playing', hostId: game.seatIds[0], players: game.seatIds.map(seat), moderator: null, game, published: [], chat: [], lastActive: 1_000, customDeck: null },
  };
}

function registry(store: RoomStore, lines: string[]) {
  const clock = new ManualClock();
  return new Registry({ engine: () => createHostedRulesEngine() as RulesEngine<unknown>, scheduler: clock, now: clock.now, seed: () => 'restore-compat', store, log: (l) => lines.push(l) });
}

test('old in-progress room skipped with the reason; old finished room restored and readable; current room round-trips', () => {
  const store = memoryRoomStore();
  store.save(oldSnapshot('KDEF22', fixture('defense')));
  store.save(oldSnapshot('KEND33', fixture('ended')));
  // A current room, mid-match, saved by today's engine.
  const live: string[] = [];
  const a = registry(store, live);
  const host = new FakeClient(a);
  host.send({ t: 'create', mode: 'automatic', profile: profile('Now0') });
  const ps = [host];
  for (let i = 1; i < 7; i++) {
    const c = new FakeClient(a);
    c.send({ t: 'join', code: host.code!, profile: profile(`Now${i}`) });
    ps.push(c);
  }
  for (const p of ps) p.send({ t: 'ready', ready: true });
  host.send({ t: 'start' });
  const before = gv(ps[2]!);

  const lines: string[] = [];
  const b = registry(store, lines);
  assert.deepEqual(b.restoreAll(), { restored: 2, skipped: 1 });
  assert.ok(lines.includes('room KDEF22 skipped reason=in-progress match saved under rules version 1; this engine runs version 2'), lines.join('\n'));
  assert.ok(lines.includes('room KEND33 restored status=ended seats=7'), lines.join('\n'));
  assert.ok(lines.includes(`room ${host.code} restored status=playing seats=7`), lines.join('\n'));
  for (const l of lines) for (let i = 0; i < 7; i++) assert.ok(!l.includes(TOKEN(i)) && !l.includes(`Old${i}`), `identity in: ${l}`);

  // The skipped room isn't there; joining or resuming it fails like an unknown room.
  const ghost = new FakeClient(b);
  ghost.send({ t: 'resume', code: 'KDEF22', token: TOKEN(0) });
  assert.equal(ghost.frames.find((f) => f.t === 'error')?.code, 'room-not-found');
  // The old finished room reads correctly for its seats.
  const ended = new FakeClient(b);
  ended.send({ t: 'resume', code: 'KEND33', token: TOKEN(3) });
  assert.equal(ended.view.status, 'ended');
  assert.deepEqual((ended.view.game as GameView).outcome, { winner: 'village', reason: 'noWolves' });
  // The current room comes back as it was.
  const back = new FakeClient(b);
  back.send({ t: 'resume', code: host.code!, token: ps[2]!.token! });
  assert.equal(gv(back).step.kind, before.step.kind);
  assert.equal(gv(back).me!.role, before.me!.role);
});

test('real entry, file store: the startup line counts restored and skipped rooms', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mv-compat-'));
  const fs = fileRoomStore(join(dir, 'rooms'));
  fs.save(oldSnapshot('KDEF22', fixture('defense')));
  fs.save(oldSnapshot('KEND33', fixture('ended')));
  const port = await new Promise<number>((r) => {
    const n = createServer().listen(0, '127.0.0.1', () => {
      const p = (n.address() as { port: number }).port;
      n.close(() => r(p));
    });
  });
  const p = spawn(process.execPath, ['apps/server/src/main.ts'], {
    cwd: join(import.meta.dirname, '../../..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_DATA_DIR: join(dir, 'rooms') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  try {
    await new Promise<void>((r, j) => {
      p.stdout.on('data', () => out.includes('moonveil server') && r());
      p.once('exit', (c) => j(new Error(`exited ${c}: ${out}`)));
    });
    assert.match(out, /engine=rules .*restoredRooms=1 skippedRooms=1/);
    assert.match(out, /room KDEF22 skipped reason=in-progress match saved under rules version 1; this engine runs version 2/);
    assert.match(out, /room KEND33 restored status=ended seats=7/);
    assert.ok(!out.includes(TOKEN(0)), 'a token in the output');
    assert.deepEqual(fs.loadAll().map((s) => s.code).sort(), ['KDEF22', 'KEND33'], 'the skipped room\'s file is kept');
  } finally {
    p.kill('SIGKILL');
  }
});
