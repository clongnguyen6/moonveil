// Voice wiring (ADR 0004): Room -> VoiceGateway.sync once per changed grant map; each seat gets only its own
// sessions in a `voice` message; tokens never in `state`; in-person = no sessions; reconnect re-issues; stale async
// results dropped; failures retried. Plus the real LiveKitVoiceGateway (voice owner) on its FakeBackend.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SeatId, ServerMessage, VoiceGrant, VoiceSession } from '@moonveil/protocol';
import { createRulesEngine } from '@moonveil/rules';
import { FakeBackend, LiveKitVoiceGateway, readToken } from '@moonveil/voice';
import { Registry } from '../src/rooms.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { recordingVoiceGateway, type VoiceGateway } from '../src/voice.ts';
import { FakeClient, ManualClock, profile } from './harness.ts';
import { gv, role } from './match-driver.ts';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
const settle = () => new Promise((r) => setTimeout(r, 0));
const voiceMsgs = (c: FakeClient) => c.frames.filter((f): f is Msg<'voice'> => f.t === 'voice');
const lastSessions = (c: FakeClient) => voiceMsgs(c).at(-1)?.sessions ?? null;

function room(gateway: VoiceGateway, opts: { seats?: number; voiceMode?: 'remote' | 'inPerson' } = {}) {
  const clock = new ManualClock();
  const reg = new Registry({ engine: () => createRulesEngine() as RulesEngine<unknown>, voice: gateway, scheduler: clock, now: clock.now, seed: () => 'voice-seed' });
  const host = new FakeClient(reg);
  host.send({ t: 'create', mode: 'automatic', profile: profile('P0'), ...(opts.voiceMode ? { voiceMode: opts.voiceMode } : {}) });
  const players = [host];
  while (players.length < (opts.seats ?? 8)) {
    const c = new FakeClient(reg);
    c.send({ t: 'join', code: host.code!, profile: profile(`P${players.length}`) });
    players.push(c);
  }
  return { reg, clock, host, players, code: host.code! };
}

test('one sync per changed grant map; each seat gets only its own sessions; tokens never in state', async () => {
  const rec = recordingVoiceGateway();
  const r = room(rec.gateway);
  await settle();
  const syncsLobby = rec.calls.filter((c) => c.op === 'sync').length;
  for (const p of r.players) p.send({ t: 'ready', ready: true }); // grants unchanged
  await settle();
  assert.equal(rec.calls.filter((c) => c.op === 'sync').length, syncsLobby, 'sync without a grant change');
  r.host.send({ t: 'start' });
  await settle();
  for (const p of r.players) {
    const mine = lastSessions(p)!;
    assert.ok(mine.every((s) => s.token.endsWith(`-${p.seat}`)), 'got another seat\'s session');
    const others = r.players.filter((o) => o !== p).map((o) => o.seat!);
    const wire = p.frames.map((f) => JSON.stringify(f)).join('\n');
    for (const o of others) assert.ok(!wire.includes(`-${o}"`), `seat ${p.seat} saw a token of ${o}`);
    for (const f of p.frames) if (f.t === 'state') assert.ok(!JSON.stringify(f).includes('tok-'), 'token inside a state frame');
  }
  // Night: only living wolves hold a voice session (wolves channel).
  for (const p of r.players) {
    const ch = lastSessions(p)!.map((s) => s.channel);
    assert.deepEqual(ch, role(p) === 'wolf' ? ['wolves'] : [], `seat ${p.seat} (${role(p)})`);
  }
  // A hidden action changes no grant: no sync, no voice frame for anyone.
  const syncs = rec.calls.filter((c) => c.op === 'sync').length;
  const counts = r.players.map((p) => voiceMsgs(p).length);
  const wolf = r.players.find((p) => role(p) === 'wolf')!;
  const target = r.players.find((p) => role(p) !== 'wolf')!;
  wolf.send({ t: 'act', action: { type: 'wolf.pick', target: gv(target).me!.seat } });
  await settle();
  assert.equal(rec.calls.filter((c) => c.op === 'sync').length, syncs);
  r.players.forEach((p, i) => assert.equal(voiceMsgs(p).length, counts[i]));
});

test('in-person room: grants sync as [] for everyone, so no sessions ever', async () => {
  const rec = recordingVoiceGateway();
  const r = room(rec.gateway, { voiceMode: 'inPerson' });
  for (const p of r.players) p.send({ t: 'ready', ready: true });
  r.host.send({ t: 'start' });
  await settle();
  for (const p of r.players) {
    assert.deepEqual(rec.grants.get(`${r.code}/${p.seat}`), []);
    assert.deepEqual(lastSessions(p) ?? [], []);
  }
});

test('reconnect: the new connection gets fresh sessions via sessionsFor; the old one gets nothing more', async () => {
  const rec = recordingVoiceGateway();
  const r = room(rec.gateway);
  await settle();
  const p = r.players[3]!;
  const old = voiceMsgs(p).length;
  p.drop();
  const back = new FakeClient(r.reg);
  back.send({ t: 'resume', code: r.code, token: p.token! });
  await settle();
  assert.ok(rec.calls.some((c) => c.op === 'sessionsFor' && c.seat === p.seat));
  assert.deepEqual(lastSessions(back)!.map((s) => s.channel), ['public']);
  assert.equal(voiceMsgs(back).at(-1)!.gen, 1, 'gen counts per connection');
  assert.equal(voiceMsgs(p).length, old);
});

test('stale sync results are dropped; a failed sync is retried on the next flush; closeRoom on close', async () => {
  const pending: { resolve: (m: Map<SeatId, VoiceSession[]>) => void; reject: (e: unknown) => void; grants: ReadonlyMap<SeatId, readonly VoiceGrant[]> }[] = [];
  let failNext = false;
  let attempts = 0;
  let failures = 0;
  const closed: string[] = [];
  const gw: VoiceGateway = {
    sync: (_room, grants) => {
      attempts++;
      if (failNext) {
        failNext = false;
        failures++;
        return Promise.reject(new Error('down (expected in this test)'));
      }
      return new Promise((resolve, reject) => pending.push({ resolve, reject, grants }));
    },
    sessionsFor: async () => [],
    closeRoom: async (room) => void closed.push(room),
  };
  const sessionsFor = (grants: ReadonlyMap<SeatId, readonly VoiceGrant[]>, tag: string) =>
    new Map([...grants].map(([seat, g]) => [seat, g.map((x) => ({ channel: x.channel, url: 'wss://x', token: `${tag}-${seat}`, listen: x.listen, speak: x.speak }))]));
  const r = room(gw, { seats: 7 }); // approved range starts at 7 (rules Batch A)
  await settle();
  // Two grant changes in flight (lobby -> playing -> ...): resolve the newer first, then the older.
  for (const p of r.players) p.send({ t: 'ready', ready: true });
  r.host.send({ t: 'start' });
  assert.equal(r.host.view.status, 'playing', 'match started');
  const older = pending.at(-2)!;
  const newer = pending.at(-1)!;
  newer.resolve(sessionsFor(newer.grants, 'new'));
  await settle();
  older.resolve(sessionsFor(older.grants, 'old'));
  await settle();
  for (const p of r.players) assert.ok(!JSON.stringify(voiceMsgs(p)).includes('"old-'), 'stale sessions delivered');
  // Failure, then retry: advance phases until a sync fails, then until the next grant change syncs again.
  failNext = true;
  for (let i = 0; i < 10 && failures === 0; i++) {
    r.clock.tick(r.host.view.phaseEndsAt! - r.clock.now());
    await settle();
  }
  assert.equal(failures, 1, 'a sync failed');
  const after = attempts;
  for (let i = 0; i < 10 && attempts === after; i++) {
    r.clock.tick(r.host.view.phaseEndsAt! - r.clock.now());
    await settle();
  }
  assert.ok(attempts > after && pending.length > 0, 'sync retried after the failure');
  r.reg.get(r.code).close();
  await settle();
  assert.deepEqual(closed, [r.code]);
});

test('real LiveKitVoiceGateway (FakeBackend): tokens carry this seat\'s identity and its channel room only', async () => {
  const keys = { apiKey: 'devkey', apiSecret: 'a-very-long-dev-secret-for-tests-only-0123' };
  const backend = new FakeBackend();
  const gw = new LiveKitVoiceGateway({ backend, keys, publicWsUrl: 'wss://voice.test', autoCommit: false });
  const r = room(gw);
  await settle();
  for (const p of r.players) p.send({ t: 'ready', ready: true });
  r.host.send({ t: 'start' });
  await settle();
  await settle();
  for (const p of r.players) {
    const sessions = lastSessions(p)!;
    assert.deepEqual(sessions.map((s) => s.channel), role(p) === 'wolf' ? ['wolves'] : []);
    for (const s of sessions) {
      const t = await readToken(keys, s.token);
      assert.equal(t.identity, p.seat);
      assert.equal(t.video?.room, s.room);
      assert.ok(String(s.room).includes('wolves'));
    }
  }
});
