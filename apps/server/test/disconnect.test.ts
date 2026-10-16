// Approved disconnect clarification (2026-10-16): no immunity while offline; a legitimately eliminated player
// reconnects as eliminated/ghost (never revived); an offline Hunter still gets the 20 s shot turn (shoot if back in
// time, no ghost access until resolved; else timeout, no shot). Reconnect grants nothing beyond that state.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServerMessage, VoiceGrant } from '@moonveil/protocol';
import type { FakeClient } from './harness.ts';
import { gv, idx, role, scripted, stepKind } from './match-driver.ts';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
const chatlogChannels = (c: FakeClient) => [...new Set(c.frames.filter((f): f is Msg<'chatlog'> => f.t === 'chatlog').map((f) => f.channel))].sort();
const grants = (c: FakeClient) => [...c.view.voice].sort((a, b) => a.channel.localeCompare(b.channel));
const GHOST: VoiceGrant[] = [
  { channel: 'ghosts', listen: true, speak: true },
  { channel: 'public', listen: true, speak: false },
];
const PENDING: VoiceGrant[] = [{ channel: 'public', listen: true, speak: false }];

// Ghost state only: dead, no actions, no pack, facts exactly as held before (keep, never gain), ghost grants/history.
function assertGhost(c: FakeClient, roleBefore: string, factsBefore: unknown) {
  const g = gv(c);
  assert.equal(g.me!.alive, false, 'revived on reconnect');
  assert.equal(g.me!.role, roleBefore);
  assert.deepEqual(g.me!.actions, [], 'ghost has actions');
  assert.equal(g.pack, null);
  assert.equal(g.moderator, null);
  assert.deepEqual(g.me!.facts, factsBefore, 'ghost gained or lost knowledge');
  assert.deepEqual(grants(c), GHOST);
  assert.deepEqual(chatlogChannels(c), ['ghosts', 'public']);
}

test('A: offline player can be nominated and executed; reconnects as ghost, nothing more', () => {
  const s = scripted('automatic', 8, 'disc-exec');
  s.driver.send({ t: 'start' });
  const wolves = s.by('wolf');
  s.setDriver(wolves[0]!); // stays connected
  s.advanceUntil(() => stepKind(s.driver) === 'day.vote');
  const x = s.P.find((p) => role(p) === 'villager')!;
  const roleBefore = role(x);
  const factsBefore = gv(x).me!.facts;
  x.drop();
  const voters = s.P.filter((p) => p !== x && gv(p).me!.alive);
  for (const p of voters) p.send({ t: 'act', action: { type: 'vote.nominate', target: idx(x) } });
  s.toNext();
  assert.equal(stepKind(s.driver), 'day.defense', 'offline player was nominated');
  s.toNext();
  for (const p of voters) p.send({ t: 'act', action: { type: 'vote.confirm', choice: 'yes' } });
  s.toNext();
  assert.equal(gv(s.driver).seats[idx(x)]!.alive, false, 'offline player executed');
  // Reconnect later: still dead, ghost only.
  s.advanceUntil(() => stepKind(s.driver) === 'night.main');
  const x2 = s.resume(x);
  assertGhost(x2, roleBefore, factsBefore);
});

test('B: offline Seer killed at night keeps prior facts, gains none, reconnects as ghost', () => {
  const s = scripted('automatic', 8, 'disc-night');
  s.driver.send({ t: 'start' });
  const wolves = s.by('wolf');
  s.setDriver(wolves[0]!);
  const seer = s.by('seer')[0]!;
  const target = s.P.find((p) => role(p) === 'villager')!;
  seer.send({ t: 'act', action: { type: 'seer.inspect', target: idx(target) } });
  s.advanceUntil(() => stepKind(s.driver) === 'day.discussion');
  const factsBefore = gv(seer).me!.facts;
  assert.ok(factsBefore.some((f) => f.k === 'inspect'), 'seer learned something on night 1');
  s.advanceUntil(() => stepKind(s.driver) === 'night.main');
  seer.drop();
  for (const w of wolves) w.send({ t: 'act', action: { type: 'wolf.pick', target: idx(seer) } });
  s.advanceUntil(() => stepKind(s.driver) === 'day.discussion');
  assert.equal(gv(s.driver).seats[idx(seer)]!.alive, false, 'offline seer killed at night');
  const back = s.resume(seer);
  assertGhost(back, 'seer', factsBefore);
});

function hunterKilledOffline(seed: string) {
  const s = scripted('automatic', 8, seed);
  s.driver.send({ t: 'start' });
  const wolves = s.by('wolf');
  s.setDriver(wolves[0]!);
  const hunter = s.by('hunter')[0]!;
  const ghostFirst = s.P.find((p) => role(p) === 'villager')!;
  // Night 1: a villager dies, so a ghost exists with ghost chat before the Hunter's turn.
  for (const w of wolves) w.send({ t: 'act', action: { type: 'wolf.pick', target: idx(ghostFirst) } });
  s.advanceUntil(() => stepKind(s.driver) === 'day.discussion');
  ghostFirst.send({ t: 'say', channel: 'ghosts', text: 'ghost secret talk' });
  s.advanceUntil(() => stepKind(s.driver) === 'night.main');
  const factsBefore = gv(hunter).me!.facts;
  hunter.drop();
  for (const w of wolves) w.send({ t: 'act', action: { type: 'wolf.pick', target: idx(hunter) } });
  s.advanceUntil(() => stepKind(s.driver) === 'hunter');
  assert.equal(s.driver.view.phaseEndsAt! - s.h.clock.now(), 20_000, '20 s shot window');
  return { s, wolves, hunter, factsBefore };
}

test('C: offline Hunter reconnects inside 20 s: pending state only, can shoot, ghost access only after', () => {
  const { s, wolves, hunter, factsBefore } = hunterKilledOffline('disc-hunter-back');
  s.h.clock.tick(10_000);
  const h2 = s.resume(hunter);
  const g = gv(h2);
  assert.equal(g.me!.alive, false, 'revived');
  assert.deepEqual(g.me!.actions.map((a) => a.type), ['hunter.shoot']);
  assert.deepEqual(grants(h2), PENDING, 'pending Hunter grants');
  assert.deepEqual(chatlogChannels(h2), ['public'], 'pending Hunter got ghost history');
  assert.ok(!h2.frames.some((f) => JSON.stringify(f).includes('ghost secret talk')));
  assert.deepEqual(g.me!.facts, factsBefore, 'pending Hunter gained knowledge');
  assert.equal(g.pack, null);
  const victim = wolves[0]!;
  h2.send({ t: 'act', ref: 'shot', action: { type: 'hunter.shoot', target: idx(victim) } });
  assert.deepEqual(h2.frames.at(-1), { t: 'ack', ref: 'shot' });
  s.setDriver(h2);
  s.advanceUntil(() => stepKind(s.driver) !== 'hunter');
  assert.equal(gv(h2).seats[idx(victim)]!.alive, false, 'shot resolved');
  assert.deepEqual(grants(h2), GHOST, 'ghost access after resolution');
  const log = h2.frames.filter((f): f is Msg<'chatlog'> => f.t === 'chatlog' && f.channel === 'ghosts').at(-1);
  assert.deepEqual(log?.messages.map((m) => m.text), ['ghost secret talk']);
});

test('D: offline Hunter misses the window: times out, no shot; reconnects as plain ghost', () => {
  const { s, hunter, factsBefore } = hunterKilledOffline('disc-hunter-away');
  const livingBefore = gv(s.driver).seats.filter((x) => x.alive).length;
  s.toNext();
  assert.notEqual(stepKind(s.driver), 'hunter');
  assert.equal(gv(s.driver).seats.filter((x) => x.alive).length, livingBefore, 'a shot happened without the Hunter');
  const shot = gv(s.driver).publicLog.filter((e) => e.t === 'shot');
  assert.ok(shot.every((e) => e.target === null), 'timeout must not shoot');
  const back = s.resume(hunter);
  assertGhost(back, 'hunter', factsBefore);
});
