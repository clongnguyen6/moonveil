import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOSE } from '@moonveil/protocol';
import { type FakeClient, game, profile, setup } from './harness.ts';

const frameText = (c: FakeClient) => c.frames.map((f) => JSON.stringify(f));

// Each player's own secret, read from their own view (no server back door).
function secrets(players: FakeClient[]) {
  return new Map(players.map((p) => [p.seat!, game(p).me!.secret]));
}

// Asserts no frame received so far leaks another seat's secret or the group key to a non-member.
function assertNoLeaks(players: FakeClient[], groupKey: string, group: string[]) {
  const sec = secrets(players);
  for (const p of players) {
    const text = frameText(p).join('\n');
    for (const [seat, s] of sec) if (seat !== p.seat) assert.ok(!text.includes(s), `${p.seat} saw secret of ${seat}`);
    if (!group.includes(p.seat!)) {
      assert.ok(!text.includes(groupKey), `${p.seat} saw group key`);
      assert.ok(!text.includes('"inGroup":true'), `${p.seat} saw group membership`);
      assert.ok(!text.includes('"group"'), `${p.seat} received a group object`);
    }
  }
}

test('lobby: create, join, profile, ready, start guarded', () => {
  const h = setup();
  const a = h.client();
  a.send({ t: 'create', mode: 'automatic', profile: profile('Ann') });
  assert.equal(a.view.me.host, true);
  assert.equal(a.view.me.kind, 'player');
  const b = h.client();
  b.send({ t: 'join', code: a.code!, profile: profile('ann') });
  assert.equal(b.errors()[0]?.t === 'error' && b.errors()[0]!.code, 'name-taken');
  b.send({ t: 'join', code: a.code!.toLowerCase(), profile: profile('Bo', 'dusk') });
  assert.equal(b.view.players.length, 2);
  assert.equal(a.view.players[1]!.appearance.color, 'dusk');
  b.send({ t: 'profile', profile: { name: 'Bob', appearance: { color: 'sand', hat: 'cap' } } });
  assert.equal(a.view.players[1]!.name, 'Bob');
  b.send({ t: 'start', ref: 'x' });
  assert.deepEqual(b.frames.at(-1), { t: 'error', code: 'not-allowed', message: 'host only', ref: 'x' });
  const c = h.client();
  c.send({ t: 'join', code: a.code!, profile: profile('Cy') });
  for (const p of [a, b]) p.send({ t: 'ready', ready: true });
  assert.equal(a.view.canStart, false, 'Cy not ready');
  c.send({ t: 'ready', ready: true });
  assert.equal(a.view.canStart, true);
  assert.equal(b.view.canStart, false, 'only host sees canStart');
  a.send({ t: 'start' });
  assert.equal(a.view.status, 'playing');
  const late = h.client();
  late.send({ t: 'join', code: a.code!, profile: profile('Late') });
  assert.equal(late.errors()[0]!.t === 'error' && late.errors()[0]!.code, 'game-started');
});

test('automatic mode: each seat receives only what it may know (8 players, creator plays)', () => {
  const h = setup({ fixture: { rounds: 2, hiddenMs: 30_000, openMs: 30_000 } });
  const { players, creator } = h.room('automatic', 8);
  creator.send({ t: 'start' });
  const groupMembers = players.filter((p) => game(p).me!.inGroup);
  assert.equal(groupMembers.length, 2);
  const key = game(groupMembers[0]!).group!.key;
  const group = groupMembers.map((p) => p.seat!);
  assert.deepEqual([...game(groupMembers[0]!).group!.members].sort(), [...group].sort());
  assert.equal(creator.view.moderator, null);

  // Hidden action: only group members receive any frame (no timing/seq signal to others).
  const before = players.map((p) => p.frames.length);
  const outsider = players.find((p) => !group.includes(p.seat!))!;
  groupMembers[0]!.send({ t: 'act', ref: 'm1', action: { kind: 'mark', target: outsider.seat } });
  players.forEach((p, i) => {
    const got = p.frames.length - before[i]!;
    if (group.includes(p.seat!)) assert.ok(got >= 1, 'group member sees mark');
    else assert.equal(got, 0, `outsider ${p.seat} got ${got} frames from a hidden action`);
  });
  // Outsider attempting a hidden action: only it gets an error.
  const before2 = players.map((p) => p.frames.length);
  outsider.send({ t: 'act', action: { kind: 'mark', target: outsider.seat } });
  players.forEach((p, i) => assert.equal(p.frames.length - before2[i]!, p === outsider ? 1 : 0));

  // Voice grants follow game permissions.
  const g = (c: FakeClient) => h.voice.grants.get(`${c.code}/${c.seat}`);
  assert.deepEqual(g(outsider), []);
  assert.deepEqual(g(groupMembers[0]!)!.map((x) => x.channel), [`group:${key}`]);
  assert.deepEqual(outsider.view.voice, []);

  // Run to end; before the reveal nothing leaks.
  h.clock.tick(30_000);
  assert.equal(game(outsider).phase, 'open');
  assert.deepEqual(g(outsider)!.map((x) => x.channel), ['public']);
  assertNoLeaks(players, key, group);
  h.clock.tick(30_000);
  h.clock.tick(30_000);
  assertNoLeaks(players, key, group);
  h.clock.tick(30_000);
  assert.equal(creator.view.status, 'ended');
  assert.equal(game(outsider).reveal!.length, 8, 'reveal at end');
});

test('automatic mode: secret phase never closes early, timer is the only clock', () => {
  const h = setup({ fixture: { hiddenMs: 30_000, openMs: 10_000 } });
  const { players, creator } = h.room('automatic', 4);
  creator.send({ t: 'start' });
  for (const p of players) if (game(p).me!.inGroup) p.send({ t: 'act', action: { kind: 'mark', target: p.seat } });
  h.clock.tick(29_999);
  assert.equal(game(creator).phase, 'hidden');
  assert.equal(creator.view.phaseEndsAt, 1_000_000 + 30_000);
  h.clock.tick(1);
  assert.equal(game(creator).phase, 'open');
  creator.send({ t: 'advance' });
  assert.equal(creator.errors().at(-1)!.t === 'error' && creator.errors().at(-1)!.code, 'not-allowed');
});

test('moderator mode: moderator sees secrets and drives phases; players do not', () => {
  const h = setup();
  const { players, moderator } = h.room('moderator', 7);
  const mod = moderator!;
  assert.equal(mod.view.me.kind, 'moderator');
  assert.equal(mod.view.players.length, 7, 'moderator holds no player seat');
  mod.send({ t: 'start' });
  const mv = game(mod);
  assert.equal(mv.reveal!.length, 7);
  assert.ok(mv.group!.key);
  const group = mv.group!.members;
  assertNoLeaks(players, mv.group!.key, group);
  // Moderator sees each player's real secret.
  for (const p of players) assert.equal(mv.reveal!.find((r) => r.seat === p.seat)!.secret, game(p).me!.secret);
  players[0]!.send({ t: 'advance' });
  assert.equal(game(mod).phase, 'hidden');
  h.clock.tick(10 * 60_000);
  assert.equal(game(mod).phase, 'hidden', 'no timer in moderator mode');
  mod.send({ t: 'advance' });
  assert.equal(game(players[0]!).phase, 'open');
  assert.equal(players[0]!.view.phaseEndsAt, null);
});

test('reconnect: same seat, same view, no extra knowledge; old connection loses authority', () => {
  const h = setup();
  const { players, creator } = h.room('automatic', 5);
  creator.send({ t: 'start' });
  const p = players.find((x) => !game(x).me!.inGroup)!;
  const viewBefore = JSON.stringify(p.view);

  // Network drop then resume on a new connection.
  p.drop();
  const p2 = h.client();
  p2.send({ t: 'resume', code: p.code!, token: p.token! });
  const w = p2.frames[0]!;
  assert.ok(w.t === 'welcome' && w.seat === p.seat && w.token === undefined, 'resume does not re-issue token');
  assert.equal(JSON.stringify(p2.view), viewBefore, 'identical view after reconnect');

  // Second tab (reload without close) replaces the first.
  const p3 = h.client();
  p3.send({ t: 'resume', code: p.code!, token: p.token! });
  assert.equal(p2.closedWith, CLOSE.replaced);
  assert.deepEqual(p2.frames.at(-1), { t: 'bye', reason: 'replaced' });
  assert.equal(JSON.stringify(p3.view), viewBefore);

  // Bad token.
  const x = h.client();
  x.send({ t: 'resume', code: p.code!, token: 'A'.repeat(32) });
  assert.equal(x.errors()[0]!.t === 'error' && x.errors()[0]!.code, 'bad-token');
});

test('presence is frozen for players during secret phases, live for moderator', () => {
  const h = setup();
  const { players, moderator } = h.room('moderator', 6);
  moderator!.send({ t: 'start' });
  const [a, b] = players as [FakeClient, FakeClient];
  const bBefore = b.frames.length;
  const modBefore = moderator!.frames.length;
  a.drop(); // e.g. phone screen off at night
  assert.equal(b.frames.length, bBefore, 'no frame to players when someone drops in a secret phase');
  assert.equal(moderator!.frames.length, modBefore + 1);
  assert.equal(moderator!.view.players.find((p) => p.seat === a.seat)!.connected, false);
  const a2 = h.client();
  a2.send({ t: 'resume', code: a.code!, token: a.token! });
  assert.equal(b.frames.length, bBefore, 'reconnect at night also invisible');
  a2.drop();
  moderator!.send({ t: 'advance' }); // -> open phase: presence published
  assert.equal(b.view.players.find((p) => p.seat === a.seat)!.connected, false);
});

test('leave in lobby frees the seat and invalidates the token; host passes on', () => {
  const h = setup();
  const { players } = h.room('automatic', 3);
  const [a, b] = players as [FakeClient, FakeClient];
  a.send({ t: 'leave' });
  assert.equal(a.closedWith, CLOSE.left);
  assert.equal(b.view.players.length, 2);
  assert.equal(b.view.me.host, true);
  const again = h.client();
  again.send({ t: 'resume', code: a.code!, token: a.token! });
  assert.equal(again.errors()[0]!.t === 'error' && again.errors()[0]!.code, 'bad-token');
});
