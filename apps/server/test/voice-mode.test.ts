// D5 (UI P17): host switches remote <-> in-person in the lobby. Every view follows; in-person = voice grants [] for
// every seat (no sessions, no tokens); remote = normal grants again. Host only, lobby only, valid values only.
// Text channels are unaffected (isolation holds either way).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClientMessage, type ServerMessage } from '@moonveil/protocol';
import { createRulesEngine } from '@moonveil/rules';
import { FakeBackend, LiveKitVoiceGateway } from '@moonveil/voice';
import { Registry } from '../src/rooms.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { recordingVoiceGateway, type VoiceGateway } from '../src/voice.ts';
import { FakeClient, ManualClock, profile } from './harness.ts';
import { role } from './match-driver.ts';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
const settle = () => new Promise((r) => setTimeout(r, 0));
const voiceMsgs = (c: FakeClient) => c.frames.filter((f): f is Msg<'voice'> => f.t === 'voice');
const lastSessions = (c: FakeClient) => voiceMsgs(c).at(-1)?.sessions ?? [];
const errors = (c: FakeClient) => c.frames.filter((f): f is Msg<'error'> => f.t === 'error');

function room(gateway: VoiceGateway, seats = 7, voiceMode?: 'remote' | 'inPerson') {
  const clock = new ManualClock();
  const reg = new Registry({ engine: () => createRulesEngine() as RulesEngine<unknown>, voice: gateway, scheduler: clock, now: clock.now, seed: () => 'voice-mode' });
  const host = new FakeClient(reg);
  host.send({ t: 'create', mode: 'automatic', profile: profile('P0'), ...(voiceMode ? { voiceMode } : {}) });
  const players = [host];
  while (players.length < seats) {
    const c = new FakeClient(reg);
    c.send({ t: 'join', code: host.code!, profile: profile(`P${players.length}`) });
    players.push(c);
  }
  return { reg, clock, host, players, code: host.code! };
}

test('host switches remote -> inPerson -> remote in the lobby: views follow, grants [] then back, sessions close then return', async () => {
  const rec = recordingVoiceGateway();
  const r = room(rec.gateway);
  await settle();
  for (const p of r.players) assert.deepEqual(lastSessions(p).map((s) => s.channel), ['public'], 'remote lobby: public voice');

  r.host.send({ t: 'voiceMode', voiceMode: 'inPerson' });
  await settle();
  for (const p of r.players) {
    assert.equal(p.view.voiceMode, 'inPerson', `seat ${p.seat} view`);
    assert.deepEqual(rec.grants.get(`${r.code}/${p.seat}`), [], 'voice grants synced as []');
    assert.deepEqual(lastSessions(p), [], 'sessions revoked');
    assert.ok(p.view.voice.some((g) => g.channel === 'public' && g.listen), 'text grants unchanged');
  }

  r.host.send({ t: 'voiceMode', voiceMode: 'remote' });
  await settle();
  for (const p of r.players) {
    assert.equal(p.view.voiceMode, 'remote');
    assert.deepEqual(lastSessions(p).map((s) => s.channel), ['public'], 'sessions back');
  }
});

test('rejected: non-host, outside the lobby, invalid value; nothing changes', async () => {
  const rec = recordingVoiceGateway();
  const r = room(rec.gateway);
  const other = r.players[2]!;
  other.send({ t: 'voiceMode', voiceMode: 'inPerson' });
  assert.equal(errors(other).at(-1)?.code, 'not-allowed');
  assert.equal(r.host.view.voiceMode, 'remote');
  assert.equal(parseClientMessage(JSON.stringify({ t: 'voiceMode', voiceMode: 'loud' })), null, 'invalid value refused by the parser');
  assert.equal(parseClientMessage(JSON.stringify({ t: 'voiceMode' })), null);
  for (const p of r.players) p.send({ t: 'ready', ready: true });
  r.host.send({ t: 'start' });
  assert.equal(r.host.view.status, 'playing');
  r.host.send({ t: 'voiceMode', voiceMode: 'inPerson' });
  assert.equal(errors(r.host).at(-1)?.code, 'not-allowed', 'locked once playing');
  assert.equal(r.host.view.voiceMode, 'remote');
});

test('in-person (switched in the lobby) never mints a token through the real gateway; text isolation holds; switched back = wolves-only at night', async () => {
  const backend = new FakeBackend();
  const keys = { apiKey: 'devkey', apiSecret: 'a-very-long-dev-secret-for-tests-only-0123' };
  const gw = new LiveKitVoiceGateway({ backend, keys, publicWsUrl: 'wss://voice.test', autoCommit: false });
  const r = room(gw);
  await settle();
  assert.ok(r.players.every((p) => p.frames.some((f) => /"token":"ey/.test(JSON.stringify(f)))), 'remote lobby carries real tokens (the check below is not vacuous)');
  r.host.send({ t: 'voiceMode', voiceMode: 'inPerson' });
  await settle();
  const mark = r.players.map((p) => p.frames.length);
  for (const p of r.players) p.send({ t: 'ready', ready: true });
  r.host.send({ t: 'start' });
  await settle();
  // Night 1: text isolation still holds in person (wolf chat reaches wolves only).
  assert.equal((r.host.view.game as { step: { kind: string } }).step.kind, 'night.main');
  const wolves = r.players.filter((p) => role(p) === 'wolf');
  wolves[0]!.send({ t: 'say', channel: 'wolves', text: 'pack-inperson' });
  for (const p of r.players) assert.equal(p.frames.some((f) => JSON.stringify(f).includes('pack-inperson')), role(p) === 'wolf', `seat ${p.seat}`);
  for (let i = 0; i < 4; i++) {
    r.clock.tick(r.host.view.phaseEndsAt! - r.clock.now());
    await settle();
  }
  r.players.forEach((p, i) => {
    const after = p.frames.slice(mark[i]);
    for (const f of after) if (f.t === 'voice') assert.deepEqual(f.sessions, [], `seat ${p.seat}: a session after the switch`);
    assert.ok(!after.some((f) => /"token":"ey/.test(JSON.stringify(f))), `seat ${p.seat}: a LiveKit token after the switch`);
  });

  // Fresh room, switched in-person then back to remote before start: at night only wolves hold a (wolves) session.
  const r2 = room(gw);
  await settle();
  r2.host.send({ t: 'voiceMode', voiceMode: 'inPerson' });
  r2.host.send({ t: 'voiceMode', voiceMode: 'remote' });
  for (const p of r2.players) p.send({ t: 'ready', ready: true });
  r2.host.send({ t: 'start' });
  await settle();
  await settle();
  for (const p of r2.players) assert.deepEqual(lastSessions(p).map((s) => s.channel), role(p) === 'wolf' ? ['wolves'] : [], `seat ${p.seat} (${role(p)})`);
});
