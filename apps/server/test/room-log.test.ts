// Room event lines (playtest diagnosis): created, started (mode, seats), ended (public outcome, day), closed (reason),
// restored; reconnect counts per seat. Never names, roles, seat ids, tokens or chat text.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '@moonveil/protocol';
import { createRulesEngine } from '@moonveil/rules';
import { Registry } from '../src/rooms.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { memoryRoomStore } from '../src/store.ts';
import { recordingVoiceGateway } from '../src/voice.ts';
import { FakeClient, ManualClock } from './harness.ts';
import { botAct, gv, rng, role } from './match-driver.ts';

const NAMES = ['Zephyrine', 'Quillon', 'Marisol', 'Thaddeus', 'Ondine', 'Bartholo', 'Ysolde', 'Caspian'];
const ROLE_WORD = /\b(wolf|seer|witch|guard|hunter|villager)\b/i;

function world(store = memoryRoomStore()) {
  const lines: string[] = [];
  const clock = new ManualClock();
  const reg = new Registry({
    engine: () => createRulesEngine() as RulesEngine<unknown>,
    voice: recordingVoiceGateway().gateway,
    scheduler: clock,
    now: clock.now,
    seed: () => 'room-log-seed',
    store,
    idleMs: 60_000,
    log: (l) => lines.push(l),
  });
  return { lines, clock, reg, store };
}
const profile = (name: string) => ({ name, appearance: { color: 'moss' as const, hat: 'none' as const } });

function assertClean(lines: string[], secrets: string[]) {
  for (const l of lines) {
    assert.match(l, /^room [A-Z0-9]{6} (created|started|ended|closed|restored)\b/, l);
    assert.doesNotMatch(l, ROLE_WORD, `role word in: ${l}`);
    for (const s of secrets) assert.ok(!l.includes(s), `secret/identity "${s}" in: ${l}`);
  }
}

test('automatic match: created, started, ended (outcome, day, reconnects), closed by idle sweep; nothing identifying', () => {
  const w = world();
  const ps: FakeClient[] = [];
  for (let i = 0; i < 7; i++) {
    const c = new FakeClient(w.reg);
    c.send(i === 0 ? { t: 'create', mode: 'automatic', profile: profile(NAMES[i]!) } : { t: 'join', code: ps[0]!.code!, profile: profile(NAMES[i]!) });
    ps.push(c);
  }
  for (const p of ps) p.send({ t: 'ready', ready: true });
  ps[0]!.send({ t: 'start' });
  // One wolf chats at night 1 (the text must never reach the log), and seat 3 reconnects twice.
  const wolf = ps.find((p) => role(p) === 'wolf')!;
  wolf.send({ t: 'say', channel: 'wolves', text: 'chat-marker-should-not-log' });
  const seat3 = { code: ps[3]!.code!, token: ps[3]!.token!, seat: ps[3]!.seat! };
  for (let k = 0; k < 2; k++) {
    ps[3]!.drop();
    const back = new FakeClient(w.reg);
    back.send({ t: 'resume', code: seat3.code, token: seat3.token });
    ps[3] = back;
  }
  const r = rng('room-log');
  for (let i = 0; i < 300 && ps[0]!.view.status === 'playing'; i++) {
    for (const p of ps) botAct(p, r);
    w.clock.tick(Math.max(0, ps[0]!.view.phaseEndsAt! - w.clock.now()));
  }
  assert.equal(ps[0]!.view.status, 'ended');
  const g = gv(ps[0]!) as GameView;
  for (const p of ps) p.drop();
  w.clock.tick(61_000);
  w.reg.sweep();

  const code = ps[0]!.code!;
  assert.deepEqual(w.lines.map((l) => l.split(' ')[2]), ['created', 'started', 'ended', 'closed']);
  assert.equal(w.lines[0], `room ${code} created mode=automatic voice=remote`);
  assert.equal(w.lines[1], `room ${code} started mode=automatic seats=7 voice=remote`);
  assert.equal(w.lines[2], `room ${code} ended outcome=${g.outcome!.winner}/${g.outcome!.reason} day=${g.day} reconnects=0,0,0,2,0,0,0`);
  assert.equal(w.lines[3], `room ${code} closed reason=idle status=ended reconnects=0,0,0,2,0,0,0`);
  const secrets = [...NAMES, 'chat-marker-should-not-log', seat3.token, ...ps.flatMap((p) => [p.token, p.seat]).filter((x): x is string => !!x)];
  assertClean(w.lines, secrets);
});

test('moderator mode: moderator leaving the lobby closes with a reason; restore logs status and seats', () => {
  const store = memoryRoomStore();
  const w = world(store);
  const mod = new FakeClient(w.reg);
  mod.send({ t: 'create', mode: 'moderator', profile: profile('Marisol') });
  const p = new FakeClient(w.reg);
  p.send({ t: 'join', code: mod.code!, profile: profile('Quillon') });
  // A restart: a second registry on the same store restores the room.
  const w2 = world(store);
  assert.equal(w2.reg.restoreAll(), 1);
  assert.deepEqual(w2.lines, [`room ${mod.code} restored status=lobby seats=1`]);
  mod.send({ t: 'leave' });
  assert.equal(w.lines.at(-1), `room ${mod.code} closed reason=moderator-left status=lobby reconnects=0 mod=0`);
  assertClean([...w.lines, ...w2.lines], ['Marisol', 'Quillon', mod.token!, p.token!, mod.seat!, p.seat!]);
});
