// Saved-match compatibility (foundation deploy review, 2026-10-18). The host id stays 'moonveil-werewolf';
// MatchState.v carries the rules version and restoreCheck() decides. Lobby rooms have no engine state (server-side).
// Fixtures: real 35151f2 host states (deployed revision), made by driving 35151f2's own createRulesEngine():
// `git archive 35151f2 packages/rules/src | tar -x -C packages/rules/.cache/old-35151f2`, then a script that plays
// seed 'fixture-35151f2' to day 1 defense (-defense.json) and on to a Village win (-ended.json).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { createRulesEngine, createMatch, ENDED_READABLE_VERSIONS, restoreCheck, STATE_VERSION, type HostState, type HostViewer } from '../src/index.ts';
import { createMatchUnchecked } from '../src/engine.ts';

const eng = createRulesEngine();
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/host-35151f2-${name}.json`, import.meta.url), 'utf8')) as HostState;
const persist = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const viewers = (h: HostState): HostViewer[] => [{ kind: 'public' }, { kind: 'moderator' }, ...h.seatIds.map((seat) => ({ kind: 'seat' as const, seat }))];

describe('saved matches: version check', () => {
  it('new matches carry the current version', () => {
    assert.equal(STATE_VERSION, 2);
    assert.equal(eng.setup({ seats: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], seed: 'v' }).match.v, STATE_VERSION);
    const r = createMatch({ seed: 1, playerCount: 9 });
    assert.ok(r.ok && r.state.v === STATE_VERSION);
    const u = createMatchUnchecked({ seed: 1, roles: ['wolf', 'villager', 'villager'] });
    assert.ok(u.ok && u.state.v === STATE_VERSION);
  });

  it('an in-progress 35151f2 match (defense step, old rules) is refused with a reason', () => {
    const old = fixture('defense');
    assert.equal(old.match.v, 1);
    assert.equal(old.match.step.kind, 'day.defense');
    const why = eng.restoreCheck(old);
    assert.equal(why, 'in-progress match saved under rules version 1; this engine runs version 2');
    assert.equal(restoreCheck(old.match), why);
  });

  it('a finished 35151f2 match restores and reads correctly for every viewer', () => {
    const old = fixture('ended');
    assert.equal(old.match.v, 1);
    assert.ok(ENDED_READABLE_VERSIONS.includes(1));
    assert.equal(eng.restoreCheck(old), null);
    assert.deepEqual(eng.phase(old), { name: 'ended', secret: false, durationMs: 0, earlyClose: false, ended: true });
    const h = eng.sync(old, 5_000);
    assert.equal(eng.timer(h, 5_000), null);
    const roles = old.match.seats.map((s) => s.role);
    for (const v of viewers(old)) {
      const p = eng.view(old, v);
      assert.deepEqual(p.outcome, { winner: 'village', reason: 'noWolves' }, JSON.stringify(v));
      assert.deepEqual(p.reveal?.roles, roles);
      assert.deepEqual(p.seatIds, old.seatIds);
      assert.deepEqual(p.me?.actions ?? [], []);
    }
    for (const id of old.seatIds) assert.deepEqual(eng.channels(old, id), [{ channel: 'public', listen: true, speak: true }]);
    assert.equal(eng.submit(old, old.seatIds[1]!, { type: 'vote.nominate', target: 0 }).ok, false, 'nothing to play');
  });

  it('a current in-progress match round-trips: accepted, same views/grants/clock, and play continues identically', () => {
    const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    let h = eng.sync(eng.setup({ seats: IDS, seed: 'round-trip' }), 0);
    h = eng.sync(eng.advance(h), 1_000); // night.witch
    h = eng.pause(h, 3_000);
    const saved = persist(h);
    assert.equal(eng.restoreCheck(saved), null);
    assert.deepEqual(saved, h);
    for (const v of viewers(h)) assert.deepEqual(eng.view(saved, v), eng.view(h, v));
    for (const id of IDS) assert.deepEqual(eng.channels(saved, id), eng.channels(h, id));
    assert.deepEqual(eng.timer(saved, 9_000), eng.timer(h, 9_000));
    const go = (s: HostState) => eng.tick(eng.resume(s, 10_000), 10_000 + 18_000);
    assert.deepEqual(go(saved), go(h));
    assert.equal(go(saved).match.step.kind, 'day.discussion');
  });

  it('a current finished match round-trips', () => {
    const h = eng.setup({ seats: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], seed: 'end' });
    const r = eng.moderate(h, { type: 'match.end', confirm: 'end-match' });
    assert.ok(r.ok);
    assert.equal(eng.restoreCheck(persist(r.state)), null);
  });

  it('unknown or malformed states are refused, never thrown on', () => {
    for (const bad of [null, undefined, 1, 'x', {}, { seatIds: [] }, { seatIds: [], match: {} }, { seatIds: [], match: { v: '2', step: { kind: 'ended' } } }]) {
      const why = eng.restoreCheck(bad);
      assert.equal(typeof why, 'string', JSON.stringify(bad));
    }
    const future = persist(fixture('ended'));
    future.match.v = STATE_VERSION + 1;
    assert.match(eng.restoreCheck(future) ?? '', /can't read/, 'a finished match from an unknown version');
    const futureLive = persist(fixture('defense'));
    futureLive.match.v = STATE_VERSION + 1;
    assert.match(eng.restoreCheck(futureLive) ?? '', /rules version 3/);
  });
});

describe('saved matches: version bump guard', () => {
  // Any src change must be a deliberate decision about STATE_VERSION. If this fails: when the change alters the meaning
  // of a saved in-progress match (API.md "Saved matches"), bump STATE_VERSION in src/version.ts; either way, set
  // REVIEWED to the new version and hash.
  const REVIEWED = { version: 2, src: '21f2c65afb2d4e98' };
  it('src is unchanged since the last version review', () => {
    const dir = new URL('../src/', import.meta.url);
    const h = createHash('sha256');
    for (const f of readdirSync(dir).sort()) h.update(f).update(readFileSync(new URL(f, dir)));
    assert.deepEqual({ version: STATE_VERSION, src: h.digest('hex').slice(0, 16) }, REVIEWED);
  });
});
