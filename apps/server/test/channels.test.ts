// Approved channel policy (voice + text), enforced from engine channels() grants. REAL engine, scripted.
// Day: public for living. Night: wolf-only for living wolves. Defense: only accused speaks.
// Ghosts: own channel + listen public. Pending Hunter: no ghost access incl. history until resolved.
// Moderator: listen-only on every channel. No membership/speaking leaks. Poses: ghosts only.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServerMessage } from '@moonveil/protocol';
import { createRulesEngine } from '@moonveil/rules';
import { CORE, createMap, isWalkable } from '@moonveil/scene/map';
import type { RulesEngine } from '../src/rules/engine.ts';
import { type FakeClient, setup } from './harness.ts';
import { gv, idx, role, stepKind } from './match-driver.ts';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
const since = (c: FakeClient, mark: number) => c.frames.slice(mark);
const chats = (c: FakeClient, mark = 0) => since(c, mark).filter((f): f is Msg<'chat'> => f.t === 'chat');
const chatlogs = (c: FakeClient, mark = 0) => since(c, mark).filter((f): f is Msg<'chatlog'> => f.t === 'chatlog');
const lastErr = (c: FakeClient) => c.frames.filter((f): f is Msg<'error'> => f.t === 'error').at(-1);

function scenario(mode: 'automatic' | 'moderator') {
  const h = setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed: `channels-${mode}` });
  const room = h.room(mode, 8);
  let driver = room.moderator ?? room.creator;
  const P = room.players;
  // Reconnect a seat on a new connection; the new client replaces the old one everywhere.
  const resume = (old: FakeClient) => {
    old.drop();
    const c = h.client();
    c.send({ t: 'resume', code: room.code, token: old.token! });
    const i = P.indexOf(old);
    if (i >= 0) P[i] = c;
    if (driver === old) driver = c;
    return c;
  };
  const toNext = () => {
    if (driver.view.status !== 'playing') throw new Error(`toNext: status ${driver.view.status}`);
    if (mode === 'moderator') room.moderator!.send({ t: 'act', action: { type: 'step.close' } });
    else h.clock.tick(Math.max(0, driver.view.phaseEndsAt! - h.clock.now()));
  };
  // Bounded: a synchronous loop can't be stopped by test timeouts.
  const advanceUntil = (pred: () => boolean, max = 20) => {
    for (let i = 0; i < max; i++) {
      if (pred()) return;
      toNext();
    }
    throw new Error(`advanceUntil: gave up at step ${stepKind(driver)} status ${driver.view.status}`);
  };
  const by = (r: string) => P.filter((p) => role(p) === r);
  return {
    h,
    ...room,
    P,
    get driver() {
      return driver;
    },
    toNext,
    advanceUntil,
    by,
    resume,
  };
}

test('lobby: everyone (incl. moderator) chats on public; history on join', () => {
  const s = scenario('moderator');
  s.P[0]!.send({ t: 'say', channel: 'public', text: 'hello camp' });
  s.moderator!.send({ t: 'say', channel: 'public', text: 'welcome' });
  for (const c of [...s.P, s.moderator!]) assert.deepEqual(chats(c).map((m) => m.msg.text), ['hello camp', 'welcome']);
  const late = s.h.client();
  late.send({ t: 'join', code: s.code, profile: { name: 'Late', appearance: { color: 'moss', hat: 'none' } } });
  assert.deepEqual(chatlogs(late).find((l) => l.channel === 'public')!.messages.map((m) => m.text), ['hello camp', 'welcome']);
});

test('night: wolves-only for living wolves; others get no frame; public closed', () => {
  const s = scenario('automatic');
  s.driver.send({ t: 'start' });
  assert.equal(stepKind(s.driver), 'night.main');
  const wolves = s.by('wolf');
  const others = s.P.filter((p) => role(p) !== 'wolf');
  const marks = others.map((o) => o.frames.length);
  wolves[0]!.send({ t: 'say', channel: 'wolves', text: 'take the seer' });
  for (const w of wolves) assert.equal(chats(w).at(-1)!.msg.text, 'take the seer');
  others.forEach((o, i) => assert.equal(o.frames.length, marks[i], 'non-wolf got a frame from wolf chat'));
  others[0]!.send({ t: 'say', channel: 'wolves', text: 'x' });
  assert.equal(lastErr(others[0]!)!.code, 'not-allowed');
  others[0]!.send({ t: 'say', channel: 'public', text: 'x' });
  assert.equal(lastErr(others[0]!)!.code, 'not-allowed');
  for (const o of others) assert.ok(!o.frames.some((f) => JSON.stringify(f).includes('take the seer')));
});

test('day/defense/ghosts/pending Hunter: acceptance, delivery and read-time history', () => {
  const s = scenario('automatic');
  s.driver.send({ t: 'start' });
  const wolves = s.by('wolf');
  const hunter = s.by('hunter')[0]!;
  const victim = s.P.find((p) => role(p) === 'villager')!;
  wolves[0]!.send({ t: 'say', channel: 'wolves', text: 'night1 wolf talk' });
  for (const w of wolves) w.send({ t: 'act', action: { type: 'wolf.pick', target: idx(victim) } });
  s.advanceUntil(() => stepKind(s.driver).startsWith('day.'));
  assert.equal(gv(victim).me!.alive, false, 'victim died at dawn');
  const living = s.P.filter((p) => gv(p).me!.alive);

  // Ghost talks on ghosts: only ghost listeners get it; ghost cannot speak public; ghost hears public.
  const lMarks = living.map((l) => l.frames.length);
  victim.send({ t: 'say', channel: 'ghosts', text: 'boo from beyond' });
  assert.equal(chats(victim).at(-1)!.msg.text, 'boo from beyond');
  living.forEach((l, i) => assert.equal(l.frames.length, lMarks[i], 'living got a ghost frame'));
  victim.send({ t: 'say', channel: 'public', text: 'x' });
  assert.equal(lastErr(victim)!.code, 'not-allowed');
  living[0]!.send({ t: 'say', channel: 'public', text: 'who did it' });
  assert.equal(chats(victim).at(-1)!.msg.text, 'who did it');

  // Wolf reconnecting by day gets no wolves history (read-time filter).
  const w = wolves[0]!;
  const w2 = s.resume(w);
  assert.deepEqual(chatlogs(w2).map((l) => l.channel).sort(), ['public']);

  // Ghost reconnecting gets public + ghosts history, never wolves.
  const v2 = s.resume(victim);
  assert.deepEqual(chatlogs(v2).map((l) => l.channel).sort(), ['ghosts', 'public']);
  assert.deepEqual(chatlogs(v2).find((l) => l.channel === 'ghosts')!.messages.map((m) => m.text), ['boo from beyond']);

  // Vote out the Hunter: everyone living nominates, then confirms yes.
  s.advanceUntil(() => stepKind(s.driver) === 'day.vote');
  const voters = [...living.filter((p) => p !== w), w2];
  for (const p of voters) p.send({ t: 'act', action: { type: 'vote.nominate', target: idx(hunter) } });
  s.toNext();
  assert.equal(stepKind(s.driver), 'day.defense');
  // Defense: only the accused speaks.
  hunter.send({ t: 'say', channel: 'public', text: 'I am innocent' });
  assert.equal(chats(voters.find((p) => p !== hunter)!).at(-1)!.msg.text, 'I am innocent');
  const other = voters.find((p) => p !== hunter)!;
  other.send({ t: 'say', channel: 'public', text: 'x' });
  assert.equal(lastErr(other)!.code, 'not-allowed');
  s.toNext();
  for (const p of voters) p.send({ t: 'act', action: { type: 'vote.confirm', choice: 'yes' } });
  const hMark = hunter.frames.length;
  s.toNext();
  assert.equal(stepKind(s.driver), 'hunter');

  // Pending Hunter: public listen only; no ghost chatlog, no ghost chat.
  assert.deepEqual(hunter.view.voice, [{ channel: 'public', listen: true, speak: false }]);
  assert.ok(!chatlogs(hunter, hMark).some((l) => l.channel === 'ghosts'), 'pending Hunter got ghost history');
  const pending = hunter.frames.length;
  v2.send({ t: 'say', channel: 'ghosts', text: 'hunter cannot hear this yet' });
  assert.ok(!chats(hunter, pending).length, 'pending Hunter got ghost chat');
  hunter.send({ t: 'say', channel: 'ghosts', text: 'x' });
  assert.equal(lastErr(hunter)!.code, 'not-allowed');

  // Resolve the turn (no shot): Hunter becomes a ghost and gets ghost history at read time.
  hunter.send({ t: 'act', action: { type: 'hunter.shoot', target: 'pass' } });
  const after = hunter.frames.length;
  s.toNext();
  const log = chatlogs(hunter, after).find((l) => l.channel === 'ghosts');
  assert.ok(log, 'resolved Hunter receives ghost history');
  assert.deepEqual(log.messages.map((m) => m.text), ['boo from beyond', 'hunter cannot hear this yet']);
  assert.ok(!hunter.frames.some((f) => JSON.stringify(f).includes('night1 wolf talk')), 'never wolf history');
});

test('chat ids are random, never a room counter', () => {
  const s = scenario('automatic');
  s.P[0]!.send({ t: 'say', channel: 'public', text: 'a' });
  s.P[0]!.send({ t: 'say', channel: 'public', text: 'b' });
  const ids = chats(s.P[1]!).map((m) => m.msg.id);
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids.every((id) => /^[A-Za-z0-9_-]{12}$/.test(id)));
});

test('chat rate limit applies to the sender only', () => {
  const s = scenario('automatic');
  for (let i = 0; i < 6; i++) s.P[0]!.send({ t: 'say', channel: 'public', text: `m${i}` });
  assert.equal(lastErr(s.P[0]!)!.code, 'rate-limited');
  assert.equal(chats(s.P[1]!).length, 5);
  assert.ok(!s.P[1]!.frames.some((f) => f.t === 'error'));
});

test('moderator: hears every channel during play', () => {
  const s = scenario('moderator');
  s.moderator!.send({ t: 'start' });
  const wolves = s.by('wolf');
  wolves[0]!.send({ t: 'say', channel: 'wolves', text: 'mod hears' });
  assert.equal(chats(s.moderator!).at(-1)!.msg.text, 'mod hears');
  const g = s.moderator!.view.voice.map((x) => x.channel).sort();
  assert.deepEqual(g, ['ghosts', 'public', 'wolves']);
  assert.ok(s.moderator!.view.voice.every((x) => x.listen));
});

test('moderator: listen-only on every channel during play (approved)', { todo: 'records conflict: ROOM_STATE Q25 says listen-only; rules API v0.3 keeps moderator.speaksInPublic provisional (default true)' }, () => {
  const s = scenario('moderator');
  s.moderator!.send({ t: 'start' });
  assert.ok(s.moderator!.view.voice.every((x) => x.listen && !x.speak), JSON.stringify(s.moderator!.view.voice));
  s.moderator!.send({ t: 'say', channel: 'public', text: 'x' });
  assert.equal(lastErr(s.moderator!)!.code, 'not-allowed');
});

test('speaking indicators: per viewer by listen grant; no leak of wolf or ghost speech', () => {
  const s = scenario('moderator');
  s.moderator!.send({ t: 'start' });
  const room = s.h.registry.get(s.code);
  const wolves = s.by('wolf');
  const others = s.P.filter((p) => role(p) !== 'wolf');
  const marks = others.map((o) => o.frames.length);
  room.setSpeaking(wolves[0]!.seat!, 'wolves', true);
  s.h.clock.tick(250);
  for (const w of wolves) assert.deepEqual(w.frames.filter((f) => f.t === 'speaking').at(-1), { t: 'speaking', seats: [wolves[0]!.seat] });
  assert.deepEqual(s.moderator!.frames.filter((f) => f.t === 'speaking').at(-1), { t: 'speaking', seats: [wolves[0]!.seat] });
  others.forEach((o, i) => assert.equal(o.frames.length, marks[i], 'non-wolf got a speaking frame'));
  // A speaker without a speak grant on that channel is never shown.
  room.setSpeaking(others[0]!.seat!, 'public', true);
  s.h.clock.tick(250);
  others.forEach((o, i) => assert.equal(o.frames.length, marks[i]));
});

test('poses: lobby all; during play living never receive poses, ghosts move and see ghosts; moderator sees ghosts', () => {
  const s = scenario('moderator');
  // Scene world coords. A walkable lobby point from the same map the renderer builds.
  const map = createMap(8);
  const walk = { x: CORE.x + 200, y: CORE.y + 600 };
  assert.ok(isWalkable(map, walk.x, walk.y), 'test point must be walkable');
  const move = (c: FakeClient, x: number, y = walk.y) => c.send({ t: 'move', x, y, facing: 1, moving: true });
  move(s.P[1]!, -150, 50); // outside walk bounds: dropped
  move(s.P[0]!, walk.x);
  s.h.clock.tick(150);
  for (const c of [...s.P, s.moderator!]) {
    const last = c.frames.filter((f): f is Msg<'poses'> => f.t === 'poses').at(-1)!;
    assert.deepEqual(last.poses.map((p) => p.seat), [s.P[0]!.seat], 'only the valid lobby move is published');
  }

  s.moderator!.send({ t: 'start' });
  const wolves = s.by('wolf');
  const victim = s.P.find((p) => role(p) === 'villager')!;
  for (const w of wolves) w.send({ t: 'act', action: { type: 'wolf.pick', target: idx(victim) } });
  s.advanceUntil(() => stepKind(s.moderator!).startsWith('day.'));
  const living = s.P.filter((p) => gv(p).me!.alive);
  const marks = living.map((l) => l.frames.filter((f) => f.t === 'poses').length);
  move(living[0]!, walk.x + 20); // living may not move during play: dropped
  move(victim, 1650, 100); // ghost drifts anywhere in the world (not walkable for the living)
  s.h.clock.tick(150);
  living.forEach((l, i) => assert.equal(l.frames.filter((f) => f.t === 'poses').length, marks[i], 'living got poses'));
  const vp = victim.frames.filter((f): f is Msg<'poses'> => f.t === 'poses').at(-1)!;
  assert.deepEqual(vp.poses.map((p) => p.seat), [victim.seat]);
  const mp = s.moderator!.frames.filter((f): f is Msg<'poses'> => f.t === 'poses').at(-1)!;
  assert.deepEqual(mp.poses.map((p) => [p.seat, p.x, p.y]), [[victim.seat, 1650, 100]]);
});
