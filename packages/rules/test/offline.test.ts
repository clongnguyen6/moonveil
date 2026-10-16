// BINDING clarification (Human, 2026-10-16): no immunity for being offline; reconnect never resurrects; an offline
// Hunter still gets the pending shot turn. The engine has no presence: "offline" = the seat sends nothing;
// "reconnect" = the server rebuilds from persisted state (JSON) and the seat receives view() + channels() again.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { channelsFor, createRulesEngine, project, type HostState, type MatchState } from '../src/index.ts';
import { alive, close, day, lastLog, match, night, ok, S } from './helpers.ts';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // seat i <-> IDS[i]; ROLES7: 0,1 wolf; 2 seer; 3 guard; 4 witch; 5 hunter; 6 villager
const eng = createRulesEngine({ config: { players: { min: 1, max: 99 } } });
const host = (m: MatchState): HostState => ({ seatIds: IDS, match: m, clock: null });
const persist = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const GHOST = [{ channel: 'public', listen: true, speak: false }, { channel: 'ghosts', listen: true, speak: true }];
const PENDING = [{ channel: 'public', listen: true, speak: false }];

/** Assert a reconnecting seat gets exactly the ghost state: dead, frozen facts, no actions, ghost grants, nothing extra. */
function assertGhostOnReconnect(s: MatchState, seat: number, factsAtDeath: unknown) {
  const r = persist(s);
  const v = project(r, { kind: 'seat', seat });
  assert.deepEqual(v, project(s, { kind: 'seat', seat }), 'reconnect view = live view');
  assert.equal(v.me?.alive, false, 'reconnect never resurrects');
  assert.equal(v.seats[seat]?.alive, false);
  assert.deepEqual(v.me?.facts, factsAtDeath, 'knowledge frozen at death');
  assert.deepEqual(v.me?.actions, []);
  assert.equal(v.moderator, null);
  assert.ok(v.pack === null || v.pack.picks === null, 'no live pack picks');
  assert.deepEqual(channelsFor(r, { kind: 'seat', seat }), GHOST);
}

describe('BINDING: no immunity for being offline', () => {
  it('an offline player can be nominated and executed (counts as living in the threshold, casts nothing)', () => {
    let s = close(night(match(), { bite: 'pass' }));
    // Seat 6 is offline: sends nothing. Others nominate and convict it.
    for (const v of [0, 1, 2]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 6 });
    s = close(close(s));
    assert.deepEqual(s.step.kind === 'day.confirm' && s.step.accused, 6);
    for (const v of [0, 1, 2, 3]) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
    s = close(s); // 4 of 7 living (incl. the offline seat) -> executed
    assert.equal(s.seats[6]?.alive, false);
    assert.deepEqual(lastLog(s, 'executed'), { t: 'executed', day: 1, seat: 6 });
  });

  it('offline players can be bitten and poisoned at night', () => {
    const s = night(match(), { bite: 6, poison: 3 }); // 6 and 3 offline all night
    assert.deepEqual(alive(s), [0, 1, 2, 4, 5]);
  });
});

describe('BINDING: reconnect never resurrects', () => {
  it('eliminated by day while offline: reconnect restores the ghost state, nothing extra', () => {
    let s = ok(match(), S(2), { type: 'seer.inspect', seat: 2, target: 0 }); // seer learns something, then goes offline
    s = night(s, { bite: 'pass' });
    const facts = persist(s.knowledge[2]);
    s = day(s, 2); // executed while offline
    assert.equal(s.seats[2]?.alive, false);
    s = night(s, { bite: 6 }); // play continues; the ghost must gain nothing
    assertGhostOnReconnect(s, 2, facts);
  });

  it('bitten while offline: reconnect restores the ghost state', () => {
    const before = match();
    const facts = persist(before.knowledge[6]);
    const s = night(before, { bite: 6 });
    assertGhostOnReconnect(s, 6, facts);
  });

  it('a dead wolf reconnecting keeps the pack list only: no picks, no wolf channel', () => {
    let s = day(night(match(), { bite: 'pass' }), 0); // wolf 0 executed while offline; now night 2
    s = ok(s, S(1), { type: 'wolf.pick', seat: 1, target: 6 });
    const r = persist(s);
    const v = project(r, { kind: 'seat', seat: 0 });
    assert.deepEqual(v.pack, { seats: [0, 1], picks: null, decision: null });
    assert.deepEqual(channelsFor(r, { kind: 'seat', seat: 0 }), GHOST);
  });
});

describe('BINDING: offline Hunter still gets the pending shot turn', () => {
  it('bitten while offline: the turn opens; reconnecting within 20 s, they shoot with no ghost access until it resolves', () => {
    const facts = persist(match().knowledge[5]);
    let h = eng.sync(host(night(match(), { bite: 5 })), 0); // Hunter 5 offline when killed
    assert.equal(eng.phase(h).name, 'hunter');
    assert.equal(eng.timer(h, 0)?.durationMs, 20_000);
    // Reconnect at 12 s: rebuild from persisted state.
    h = persist(h);
    const v = eng.view(h, { kind: 'seat', seat: 'f' });
    assert.equal(v.me?.alive, false, 'no resurrection');
    assert.deepEqual(v.me?.facts, facts, 'nothing extra');
    assert.deepEqual(v.me?.actions.map((a) => a.type), ['hunter.shoot']);
    assert.deepEqual(eng.channels(h, 'f'), PENDING, 'no ghost access while pending');
    assert.equal(eng.tick(h, 12_000).match.stepSeq, h.match.stepSeq, 'still open at 12 s');
    const r = eng.submit(h, 'f', { type: 'hunter.shoot', target: 0 });
    assert.ok(r.ok);
    h = eng.sync(eng.advance(r.state), 12_500); // the Hunter step may close once the shot is in
    assert.equal(h.match.seats[0]?.alive, false);
    assert.deepEqual(eng.channels(h, 'f'), GHOST, 'ghost access after the turn resolves');
  });

  it('offline the whole 20 s: the turn times out with no shot; reconnecting later gives the plain ghost state', () => {
    const facts = persist(match().knowledge[5]);
    let h = eng.sync(host(night(match(), { bite: 5 })), 0);
    assert.equal(eng.tick(h, 19_999).match.stepSeq, h.match.stepSeq);
    h = eng.tick(h, 20_000);
    assert.deepEqual(lastLog(h.match, 'shot'), { t: 'shot', by: 5, target: null });
    assert.deepEqual(alive(h.match), [0, 1, 2, 3, 4, 6], 'no one else died');
    assertGhostOnReconnect(h.match, 5, facts);
    assert.equal(project(h.match, { kind: 'public' }).seats[5]?.role, 'hunter', 'Q20: revealed when the turn opened');
  });

  it('executed while offline: same pending turn and isolation', () => {
    const s = day(night(match(), { bite: 'pass' }), 5);
    assert.equal(s.step.kind, 'hunter');
    const r = persist(s);
    assert.deepEqual(channelsFor(r, { kind: 'seat', seat: 5 }), PENDING);
    assert.deepEqual(project(r, { kind: 'seat', seat: 5 }).me?.actions.map((a) => a.type), ['hunter.shoot']);
  });
});
