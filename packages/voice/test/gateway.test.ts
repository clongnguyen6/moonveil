import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeBackend } from '../src/server/backend.ts';
import { LiveKitVoiceGateway } from '../src/server/gateway.ts';
import { readToken } from '../src/server/tokens.ts';
import type { VoiceGrantLike, VoiceSession } from '../src/server/types.ts';

const keys = { apiKey: 'k', apiSecret: 'secret-secret-secret-secret-secret-00' };
const g = (channel: string, speak: boolean, listen: boolean, visible?: boolean): VoiceGrantLike => ({ channel, speak, listen, ...(visible === undefined ? {} : { visible }) });

function make() {
  const backend = new FakeBackend();
  const pushed: { seat: string; sessions: VoiceSession[] }[] = [];
  const gw = new LiveKitVoiceGateway({ backend, keys, publicWsUrl: 'wss://camp.example/livekit', autoCommit: false, random: () => 0.5, onSessions: (_room, seat, sessions) => pushed.push({ seat, sessions }) });
  return { backend, gw, pushed };
}
// Simulate the browsers joining with their sessions.
async function joinAll(gw: LiveKitVoiceGateway, backend: FakeBackend, room: string, seats: string[]) {
  for (const seat of seats) for (const s of await gw.sessions(room, seat)) backend.connect(s.room, seat, { canPublish: s.speak, canSubscribe: s.listen, hidden: !s.visible });
}

test('day: tokens bind room, identity and grants; no token for seats without grants', async () => {
  const { gw, backend } = make();
  gw.setGrants('ROOM01', 'p1', [g('public', true, true)]);
  gw.setGrants('ROOM01', 'mod', [g('public', false, true, false), g('wolves', false, true, false), g('ghosts', false, true, false)]);
  gw.setGrants('ROOM01', 'p2', []); // in-person seat or no grant
  await gw.commit('ROOM01');
  const p1 = await gw.sessions('ROOM01', 'p1');
  assert.equal(p1.length, 1);
  const claims = await readToken(keys, p1[0]!.token);
  assert.equal(claims.identity, 'p1');
  assert.equal(claims.video?.room, 'ROOM01-public-g1');
  assert.equal(claims.video?.canPublish, true);
  assert.equal(claims.video?.hidden, false);
  assert.equal(claims.video?.roomList, undefined);
  const mod = await gw.sessions('ROOM01', 'mod');
  assert.deepEqual(mod.map((s) => [s.channel, s.speak, s.listen, s.visible]), [['public', false, true, false], ['wolves', false, true, false], ['ghosts', false, true, false]]);
  assert.equal((await readToken(keys, mod[0]!.token)).video?.hidden, true);
  assert.deepEqual(await gw.sessions('ROOM01', 'p2'), []);
  // Rooms were created explicitly before tokens were handed out (auto_create is off).
  assert.deepEqual([...backend.rooms.keys()].sort(), ['ROOM01-ghosts-g1', 'ROOM01-public-g1', 'ROOM01-wolves-g1']);
});

test('in-person: all-empty grants mint nothing and create nothing', async () => {
  const { gw, backend, pushed } = make();
  for (const s of ['p1', 'p2', 'mod']) gw.setGrants('INPERS', s, []);
  await gw.commit('INPERS');
  assert.equal(backend.rooms.size, 0);
  assert.equal(backend.calls.filter((c) => c.op !== 'list').length, 0);
  assert.equal(pushed.length, 0);
});

test('publish/subscribe flips without a visibility change are UpdateParticipant calls, no rotation, tokens re-minted only for changed seats', async () => {
  const { gw, backend, pushed } = make();
  for (const s of ['p1', 'p2', 'p3']) gw.setGrants('R', s, [g('public', true, true)]);
  await gw.commit('R');
  await joinAll(gw, backend, 'R', ['p1', 'p2', 'p3']);
  const before = Object.fromEntries(await Promise.all(['p1', 'p2', 'p3'].map(async (s) => [s, (await gw.sessions('R', s))[0]!.token])));
  pushed.length = 0;
  // p1 and p3 keep speaking but lose listen (hypothetical flip that keeps visibility): in-room updates
  gw.setGrants('R', 'p1', [g('public', true, false)]);
  gw.setGrants('R', 'p3', [g('public', true, false)]);
  await gw.commit('R');
  const updates = backend.calls.filter((c) => c.op === 'update');
  assert.deepEqual(updates.map((u) => u.identity).sort(), ['p1', 'p3']);
  assert.deepEqual(updates[0]!.permission, { canPublish: true, canSubscribe: false, hidden: false });
  assert.equal(backend.deleted.length, 0);
  assert.equal(gw.roomNameOf('R', 'public'), 'R-public-g1');
  assert.deepEqual(pushed.map((p) => p.seat).sort(), ['p1', 'p3']);
  assert.equal((await gw.sessions('R', 'p2'))[0]!.token, before.p2); // unchanged seat keeps its token
  assert.notEqual((await gw.sessions('R', 'p1'))[0]!.token, before.p1);
});

test('day -> night: public closes for everyone (rotation), wolves get the wolves room, villagers get nothing', async () => {
  const { gw, backend, pushed } = make();
  const seats = ['w1', 'w2', 'v1', 'v2'];
  for (const s of seats) gw.setGrants('N', s, [g('public', true, true)]);
  await gw.commit('N');
  await joinAll(gw, backend, 'N', seats);
  pushed.length = 0;
  gw.setGrants('N', 'w1', [g('wolves', true, true)]);
  gw.setGrants('N', 'w2', [g('wolves', true, true)]);
  gw.setGrants('N', 'v1', []);
  gw.setGrants('N', 'v2', []);
  await gw.commit('N');
  assert.deepEqual(backend.deleted, ['N-public-g1']);
  assert.equal(gw.roomNameOf('N', 'public'), 'N-public-g2');
  assert.deepEqual([...backend.rooms.keys()], ['N-wolves-g1']); // public not recreated: nobody holds a grant
  assert.deepEqual((await gw.sessions('N', 'w1')).map((s) => s.room), ['N-wolves-g1']);
  assert.deepEqual(await gw.sessions('N', 'v1'), []);
  // villagers were told their sessions are gone; wolves got new ones
  assert.deepEqual(pushed.map((p) => [p.seat, p.sessions.length]).sort(), [['v1', 0], ['v2', 0], ['w1', 1], ['w2', 1]]);
});

test('death: ghost rejoins public hidden; old visible token points at a deleted room', async () => {
  const { gw, backend } = make();
  for (const s of ['p1', 'p4']) gw.setGrants('D', s, [g('public', true, true)]);
  await gw.commit('D');
  await joinAll(gw, backend, 'D', ['p1', 'p4']);
  const oldPublic = (await gw.sessions('D', 'p4'))[0]!;
  gw.setGrants('D', 'p4', [g('public', false, true, false), g('ghosts', true, true)]);
  await gw.commit('D');
  assert.deepEqual(backend.deleted, ['D-public-g1']);
  assert.throws(() => backend.connect(oldPublic.room, 'p4', { canPublish: true, canSubscribe: true, hidden: false }), /does not exist/);
  const now = await gw.sessions('D', 'p4');
  assert.deepEqual(now.map((s) => [s.channel, s.room, s.visible]), [['public', 'D-public-g2', false], ['ghosts', 'D-ghosts-g1', true]]);
  assert.equal((await readToken(keys, now[0]!.token)).video?.hidden, true);
  // the living player also moved to g2 (uniform: everyone reconnects)
  assert.equal((await gw.sessions('D', 'p1'))[0]!.room, 'D-public-g2');
});

test('pending Hunter: no ghosts session until resolved; ghosts room untouched meanwhile', async () => {
  const { gw, backend } = make();
  gw.setGrants('H', 'g1', [g('public', false, true, false), g('ghosts', true, true)]);
  gw.setGrants('H', 'h', [g('public', false, true, false)]); // dead, shot pending
  await gw.commit('H');
  await joinAll(gw, backend, 'H', ['g1', 'h']);
  assert.deepEqual((await gw.sessions('H', 'h')).map((s) => s.channel), ['public']);
  assert.deepEqual(backend.participants('H-ghosts-g1').map((p) => p.identity), ['g1']);
  gw.setGrants('H', 'h', [g('public', false, true, false), g('ghosts', true, true)]);
  await gw.commit('H');
  assert.deepEqual((await gw.sessions('H', 'h')).map((s) => s.channel), ['public', 'ghosts']);
  assert.equal(backend.deleted.length, 0); // nobody had to leave, so no rotation
});

test('one commit per flush: three setGrants coalesce into one reconcile (microtask) and one rotation', async () => {
  const backend = new FakeBackend();
  const gw = new LiveKitVoiceGateway({ backend, keys, publicWsUrl: 'wss://x', random: () => 0.5 }); // autoCommit on
  for (const s of ['a', 'b', 'c']) gw.setGrants('C', s, [g('public', true, true)]);
  await new Promise((r) => setTimeout(r, 0));
  await gw.commit('C');
  for (const s of ['a', 'b', 'c']) backend.connect('C-public-g1', s, { canPublish: true, canSubscribe: true, hidden: false });
  const listsBefore = backend.calls.filter((c) => c.op === 'list').length;
  for (const s of ['a', 'b', 'c']) gw.setGrants('C', s, [g('wolves', true, true)]);
  await new Promise((r) => setTimeout(r, 0));
  await gw.commit('C');
  assert.deepEqual(backend.deleted, ['C-public-g1']);
  // one reconcile => one list per channel (public + wolves), not three
  assert.equal(backend.calls.filter((c) => c.op === 'list').length - listsBefore, 2);
});

test('API call order is shuffled, not seat order', async () => {
  const { gw, backend } = make();
  const seats = ['s1', 's2', 's3', 's4', 's5', 's6'];
  for (const s of seats) gw.setGrants('S', s, [g('public', true, true)]);
  await gw.commit('S');
  await joinAll(gw, backend, 'S', seats);
  for (const s of seats) gw.setGrants('S', s, [g('public', true, false)]); // listen flips; visibility unchanged -> in-room updates
  await gw.commit('S');
  const order = backend.calls.filter((c) => c.op === 'update').map((c) => c.identity);
  assert.deepEqual([...order].sort(), seats);
  assert.notDeepEqual(order, seats);
});

test('closeRoom deletes every channel room of that game', async () => {
  const { gw, backend } = make();
  gw.setGrants('X', 'p1', [g('public', true, true)]);
  gw.setGrants('X', 'w1', [g('wolves', true, true)]);
  await gw.commit('X');
  await gw.closeRoom('X');
  assert.deepEqual(backend.deleted.sort(), ['X-public-g1', 'X-wolves-g1']);
  assert.deepEqual(await gw.sessions('X', 'p1'), []);
});

// ---- ADR 0004 seam: sync / sessionsFor ----

test('sync: one call per flush with every seat; omitted seats lose their grants; returns sessions ready to send', async () => {
  const { gw, backend } = make();
  const r1 = await gw.sync('S1', new Map([['p1', [g('public', true, true)]], ['p2', [g('public', true, true)]], ['p3', []]]));
  assert.deepEqual([...r1.keys()], ['p1', 'p2', 'p3']);
  assert.equal(r1.get('p1')!.length, 1);
  assert.deepEqual(r1.get('p3'), []);
  const s = r1.get('p1')![0]!;
  assert.deepEqual(Object.keys(s).sort(), ['channel', 'listen', 'room', 'speak', 'token', 'url', 'visible']); // ADR shape + room/visible extras
  for (const seat of ['p1', 'p2']) backend.connect(s.room, seat, { canPublish: true, canSubscribe: true, hidden: false });
  // next flush: p2 omitted entirely (left the room) -> must leave public -> rotation; p1 gets a new token
  const r2 = await gw.sync('S1', new Map([['p1', [g('public', true, true)]]]));
  assert.deepEqual(backend.deleted, ['S1-public-g1']);
  assert.equal(r2.get('p1')![0]!.room, 'S1-public-g2');
  assert.deepEqual(await gw.sessionsFor('S1', 'p2'), []);
  assert.equal((await gw.sessionsFor('S1', 'p1'))[0]!.room, 'S1-public-g2');
});

test('sync resolves only after LiveKit changes were applied (a slow client that ignores the message is already cut off)', async () => {
  const backend = new FakeBackend();
  const order: string[] = [];
  const origDelete = backend.deleteRoom.bind(backend);
  backend.deleteRoom = async (room) => {
    await new Promise((r) => setTimeout(r, 20));
    order.push('deleted');
    return origDelete(room);
  };
  const gw = new LiveKitVoiceGateway({ backend, keys, publicWsUrl: 'wss://x', autoCommit: false });
  await gw.sync('T', new Map([['a', [g('public', true, true)]], ['b', [g('public', true, true)]]]));
  backend.connect('T-public-g1', 'a', { canPublish: true, canSubscribe: true, hidden: false });
  backend.connect('T-public-g1', 'b', { canPublish: true, canSubscribe: true, hidden: false });
  await gw.sync('T', new Map([['a', [g('wolves', true, true)]], ['b', []]]));
  order.push('resolved');
  assert.deepEqual(order, ['deleted', 'resolved']);
});

// ---- visibility derived from speak (ADR 0004 §1), evidence for the one row that differs ----

test('derived visibility: ghost/pending Hunter/moderator listen-only sessions are hidden without any explicit bit', async () => {
  const { gw } = make();
  const r = await gw.sync('V', new Map([
    ['ghost', [{ channel: 'public', listen: true, speak: false }, { channel: 'ghosts', listen: true, speak: true }]],
    ['hunter', [{ channel: 'public', listen: true, speak: false }]],
    ['mod', [{ channel: 'public', listen: true, speak: false }, { channel: 'wolves', listen: true, speak: false }, { channel: 'ghosts', listen: true, speak: false }]],
    ['p1', [{ channel: 'public', listen: true, speak: true }]],
  ]));
  assert.deepEqual(r.get('ghost')!.map((s) => [s.channel, s.visible]), [['public', false], ['ghosts', true]]);
  assert.deepEqual(r.get('hunter')!.map((s) => s.visible), [false]);
  assert.deepEqual(r.get('mod')!.map((s) => s.visible), [false, false, false]);
  assert.equal((await readToken(keys, r.get('mod')![0]!.token)).video?.hidden, true);
  assert.deepEqual(r.get('p1')!.map((s) => s.visible), [true]);
});

test('defense (ADR 0004 §1, measured): listeners become hidden, so the public room rotates at defense start and end', async () => {
  const a = make();
  await a.gw.sync('DEF', new Map([['acc', [g('public', true, true)]], ['v1', [g('public', true, true)]], ['v2', [g('public', true, true)]]]));
  for (const s of ['acc', 'v1', 'v2']) a.backend.connect('DEF-public-g1', s, { canPublish: true, canSubscribe: true, hidden: false });
  const r = await a.gw.sync('DEF', new Map([['acc', [g('public', true, true)]], ['v1', [g('public', false, true)]], ['v2', [g('public', false, true)]]]));
  assert.deepEqual(a.backend.deleted, ['DEF-public-g1']); // everyone reconnects as the defense starts
  assert.equal(r.get('v1')![0]!.visible, false);
  assert.equal(r.get('acc')![0]!.visible, true);
  for (const s of ['acc', 'v1', 'v2']) a.backend.connect('DEF-public-g2', s, { canPublish: s === 'acc', canSubscribe: true, hidden: s !== 'acc' });
  await a.gw.sync('DEF', new Map([['acc', [g('public', true, true)]], ['v1', [g('public', true, true)]], ['v2', [g('public', true, true)]]]));
  assert.deepEqual(a.backend.deleted, ['DEF-public-g1', 'DEF-public-g2']); // and again when the defense ends
  // Why not keep them visible ("sticky"): a seat that dies while connected (execution, Hunter) would stay
  // visible as a listen-only ghost in the public roster. Measured in the browser suite; policy forbids it.
});

test('backend errors are reported, not thrown into the server', async () => {
  const backend = new FakeBackend();
  backend.createRoom = async () => {
    throw new Error('livekit down');
  };
  const errors: unknown[] = [];
  const gw = new LiveKitVoiceGateway({ backend, keys, publicWsUrl: 'wss://x', autoCommit: false, onError: (_r, e) => errors.push(e) });
  gw.setGrants('E', 'p1', [g('public', true, true)]);
  await gw.commit('E');
  assert.equal(errors.length, 1);
});
