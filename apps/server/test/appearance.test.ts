// Appearance contract (ADR 0011): canonical CostumeAppearance on every seat; costume input validated against the
// catalog (whole-profile `invalid-appearance` refusal); legacy {color, hat} accepted and upgraded to the camper with
// the seat-seeded front/back; real 3b1dbde snapshots (lobby and mid-match) restore to identical looks; appearance is
// independent of the role deal.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { type CostumeAppearance, normalizeCostume, OUTFITS, type PublicSeat, type ServerMessage } from '@moonveil/protocol';
import { seededBody, seededExtras } from '@moonveil/scene/seed';
import { createHostedRulesEngine } from '../src/rules/decks.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { Registry } from '../src/rooms.ts';
import { memoryRoomStore, type RoomSnapshot } from '../src/store.ts';
import { FakeClient, ManualClock } from './harness.ts';
import { role } from './match-driver.ts';

// The scene's legacy adapter (what the scene drew for {color, hat}). Non-literal specifier: its main entry is DOM
// code, which the server's tsconfig (no DOM lib) must not typecheck; it runs fine in Node.
const sceneMain = '@moonveil/scene';
const { appearanceFromProtocol } = (await import(sceneMain)) as {
  appearanceFromProtocol: (p: { color: string; hat: string }, seat: string) => { skin: string; top: string; hair: string; hairColor: string; hat: string; extra: string };
};
type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
const lastErr = (c: FakeClient) => c.frames.filter((f): f is Msg<'error'> => f.t === 'error').at(-1);
const registry = (seed = 'appearance', store = memoryRoomStore()) => {
  const clock = new ManualClock();
  return new Registry({ engine: () => createHostedRulesEngine() as RulesEngine<unknown>, scheduler: clock, now: clock.now, seed: () => seed, store });
};
const seatOf = (c: FakeClient, name: string) => c.view.players.find((p) => p.name === name) as PublicSeat;
const fixture = (f: string) => JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/rooms-3b1dbde', `${f}.json`), 'utf8')) as RoomSnapshot;

test('normalizeCostume: defaults from the outfit, every catalog combination valid, unknown or mismatched refused', () => {
  assert.deepEqual(normalizeCostume({ outfit: 'fish' }), { ok: true, value: { outfit: 'fish', variant: 'puffer', color: 'clay', hat: 'fishHeadgear', front: 'none', back: 'none' } });
  let n = 0;
  for (const [outfit, o] of Object.entries(OUTFITS)) {
    for (const variant of o.variants) for (const color of o.colors) for (const hat of o.hats) for (const front of o.fronts) for (const back of o.backs) {
      const r = normalizeCostume({ outfit, variant, color, hat, front, back });
      assert.ok(r.ok, `${outfit}/${variant}/${color}/${hat}/${front}/${back}`);
      n++;
    }
  }
  assert.ok(n > 100, `${n} combinations`);
  for (const bad of [
    { outfit: 'dragon' },
    { outfit: 'bowCat', hat: 'robotHood' }, // another outfit's headgear
    { outfit: 'fish', color: 'pine' }, // colour not offered by fish
    { outfit: 'fish', variant: 'whale' },
    { outfit: 'duck', back: 'finPouch' }, // fish-only back item
    { outfit: 'camper', front: 'backpack' }, // back item in the front slot
    { outfit: 'camper', body: { skin: 'green', hair: 'short', hairColor: 'black' } },
  ]) assert.equal(normalizeCostume(bad).ok, false, JSON.stringify(bad));
});

test('server: costume create and profile change broadcast canonically; invalid or mismatched refused as a whole', () => {
  const reg = registry();
  const host = new FakeClient(reg);
  host.send({ t: 'create', mode: 'automatic', profile: { name: 'Ann', appearance: { outfit: 'duck', variant: 'plain' } } });
  const bob = new FakeClient(reg);
  bob.send({ t: 'join', code: host.code!, profile: { name: 'Bob', appearance: { outfit: 'mushroom', back: 'none' } } });
  assert.deepEqual(seatOf(bob, 'Ann').appearance, { outfit: 'duck', variant: 'plain', color: 'sand', hat: 'duckCap', front: 'none', back: 'none' });
  assert.deepEqual(seatOf(host, 'Bob').appearance, { outfit: 'mushroom', variant: 'default', color: 'bark', hat: 'mushroomCap', front: 'scarf', back: 'none' });
  // A variant change is an appearance change other seats see.
  host.send({ t: 'profile', profile: { name: 'Ann', appearance: { outfit: 'duck', variant: 'ring' } } });
  assert.equal((seatOf(bob, 'Ann').appearance as CostumeAppearance).variant, 'ring');
  // Refusals: whole profile, error to the sender only, nothing changes (not even the name).
  const before = JSON.stringify(seatOf(bob, 'Ann'));
  const bobFrames = bob.frames.length;
  for (const appearance of [{ outfit: 'duck', hat: 'catHood' }, { outfit: 'nope' }, { color: 'neon', hat: 'none' }]) {
    host.send({ t: 'profile', profile: { name: 'Annie', appearance } });
    assert.equal(lastErr(host)?.code, 'invalid-appearance', JSON.stringify(appearance));
  }
  assert.equal(JSON.stringify(seatOf(bob, 'Ann')), before);
  assert.ok(!bob.frames.slice(bobFrames).some((f) => f.t === 'error'));
  const late = new FakeClient(reg);
  late.send({ t: 'join', code: host.code!, profile: { name: 'Cy', appearance: { outfit: 'frog', color: 'rose' } } });
  assert.equal(lastErr(late)?.code, 'invalid-appearance');
  assert.ok(!host.view.players.some((p) => p.name === 'Cy'), 'refused join leaves no seat');
});

test('legacy {color, hat} input accepted: camper with the seat-seeded front/back (as the scene drew it)', () => {
  const reg = registry();
  const host = new FakeClient(reg);
  host.send({ t: 'create', mode: 'automatic', profile: { name: 'Old', appearance: { color: 'dusk', hat: 'bucket' } } });
  const seat = host.seat!;
  assert.deepEqual(seatOf(host, 'Old').appearance, { outfit: 'camper', variant: 'default', color: 'dusk', hat: 'bucket', ...seededExtras(seat) });
  host.send({ t: 'profile', profile: { name: 'Old', appearance: { color: 'rose', hat: 'flower' } } });
  assert.equal((seatOf(host, 'Old').appearance as CostumeAppearance).color, 'rose');
});

test('real 3b1dbde snapshots (lobby and mid-match) restore; every seat upgrades to an identical look and resumes', () => {
  for (const name of ['lobby', 'playing']) {
    const snap = fixture(name);
    const store = memoryRoomStore();
    store.save(snap);
    const reg = registry('restore', store);
    assert.deepEqual(reg.restoreAll(), { restored: 1, skipped: 0 }, name);
    const players = (snap.room as { players: { id: string; token: string; name: string; appearance: { color: string; hat: string } }[] }).players;
    const c = new FakeClient(reg);
    c.send({ t: 'resume', code: snap.code, token: players[0]!.token });
    assert.equal(c.view.status, name === 'lobby' ? 'lobby' : 'playing');
    for (const p of players) {
      const a = seatOf(c, p.name).appearance as CostumeAppearance;
      // Canonical camper, same colour and hat, front/back = the seat seed, body left to the same seed.
      assert.deepEqual(a, { outfit: 'camper', variant: 'default', color: p.appearance.color, hat: p.appearance.hat, ...seededExtras(p.id) }, `${name}/${p.name}`);
      // Identical look: what the scene's legacy adapter drew for this seat is exactly this costume + seeded body.
      const old = appearanceFromProtocol(p.appearance, p.id);
      assert.equal(old.top, a.color);
      assert.equal(old.hat, a.hat);
      assert.equal(old.extra, a.front !== 'none' ? a.front : a.back !== 'none' ? a.back : 'none');
      assert.deepEqual({ skin: old.skin, hair: old.hair, hairColor: old.hairColor }, seededBody(p.id));
    }
    // The upgrade covers both seeded extras across the two fixtures (not a vacuous pass).
    if (name === 'lobby') assert.ok(players.some((p) => seededExtras(p.id).front === 'scarf') && players.some((p) => seededExtras(p.id).back === 'backpack'));
  }
});

test('appearance is independent of the role deal and of the viewer', () => {
  const looks = [
    { outfit: 'bowCat' }, { outfit: 'robotCat', front: 'none' }, { outfit: 'fish', variant: 'shark', back: 'finPouch' }, { outfit: 'frog', hat: 'none' },
    { outfit: 'duck' }, { outfit: 'mushroom', color: 'pine' }, { outfit: 'camper', color: 'clay', hat: 'cap', front: 'scarf' },
  ] as const;
  const deal = (seed: string) => {
    const reg = registry(seed);
    const ps: FakeClient[] = [];
    looks.forEach((appearance, i) => {
      const c = new FakeClient(reg);
      const profile = { name: `P${i}`, appearance };
      c.send(i === 0 ? { t: 'create', mode: 'automatic', profile } : { t: 'join', code: ps[0]!.code!, profile });
      ps.push(c);
    });
    const lobby = ps.map((p) => JSON.stringify(p.view.players.map((s) => [s.name, s.appearance])));
    for (const p of ps) p.send({ t: 'ready', ready: true });
    ps[0]!.send({ t: 'start' });
    return { ps, lobby, roles: ps.map(role).join(',') };
  };
  const a = deal('deal-A');
  const b = deal('deal-B');
  assert.notEqual(a.roles, b.roles, 'the two seeds deal different roles');
  const all = [...a.ps, ...b.ps].map((p) => JSON.stringify(p.view.players.map((s) => [s.name, s.appearance])));
  assert.equal(new Set([...all, ...a.lobby, ...b.lobby]).size, 1, 'same looks for every viewer, both deals, before and after the deal');
  // During play the look is locked (profile refused), so it can't be changed to signal a role either.
  a.ps[1]!.send({ t: 'profile', profile: { name: 'P1', appearance: { outfit: 'duck' } } });
  assert.equal(lastErr(a.ps[1]!)?.code, 'not-allowed');
});
