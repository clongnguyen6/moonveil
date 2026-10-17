// APPROVED Batch B (Human, 2026-10-17), fixed behaviour, not config:
// B1 night 40 s + 20 s (Witch); B2 discussion 60 s + 15 s per living player, clamped to 90-240 s;
// B3 nomination 30 s, defense 30 s, Yes/No 15 s, Hunter 20 s; B4 the Hunter turn ends once the shot is taken.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMatch,
  createRulesEngine,
  discussionSeconds,
  PROVISIONAL,
  resolveConfig,
  stepTiming,
  type HostState,
  type MatchState,
} from '../src/index.ts';
import { close, match, night, ok, S } from './helpers.ts';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // ROLES7: 0,1 wolf; 2 seer; 3 guard; 4 witch; 5 hunter; 6 villager
const eng = createRulesEngine();
const host = (m: MatchState): HostState => ({ seatIds: IDS, match: m, clock: null });
const secs = (s: MatchState) => stepTiming(s).seconds;

describe('APPROVED Batch B step durations', () => {
  it('every step of a full 7-player cycle', () => {
    let s = match();
    const seen: [string, number][] = [];
    const at = () => seen.push([s.step.kind, secs(s)]);
    at(); // night.main
    s = close(s);
    at(); // night.witch
    s = close(s);
    at(); // day.discussion, 7 alive
    s = close(s);
    at(); // day.vote
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(s);
    at(); // day.defense
    s = close(s);
    at(); // day.confirm
    assert.deepEqual(seen, [
      ['night.main', 40],
      ['night.witch', 20],
      ['day.discussion', 165],
      ['day.vote', 30],
      ['day.defense', 30],
      ['day.confirm', 15],
    ]);
    const h = night(match(), { bite: 5 });
    assert.deepEqual(stepTiming(h), { seconds: 20, earlyCloseReady: false }, 'Hunter turn');
  });

  it('B2: discussion = 60 + 15 x living, clamped to 90..240', () => {
    const want: Record<number, number> = { 0: 90, 1: 90, 2: 90, 3: 105, 7: 165, 8: 180, 11: 225, 12: 240, 13: 240, 15: 240 };
    for (const [n, sec] of Object.entries(want)) assert.equal(discussionSeconds(Number(n)), sec, `${n} alive`);
  });

  it('B2 on real tables: discussion counts the living at day start', () => {
    for (const [n, sec] of [[7, 165], [12, 240], [15, 240]] as const) {
      const r = createMatch({ seed: `b2-${n}`, playerCount: n });
      assert.ok(r.ok);
      const s = close(close(r.state));
      assert.equal(s.step.kind, 'day.discussion');
      assert.equal(secs(s), sec, `${n} players`);
    }
    assert.equal(secs(night(match(), { bite: 6 })), 150, '6 alive after a bite');
  });

  it('B4: the Hunter turn may end once the shot is taken or fire is held', () => {
    for (const target of [0, 'pass'] as const) {
      let s = night(match(), { bite: 5 });
      assert.equal(stepTiming(s).earlyCloseReady, false, 'open until the Hunter acts');
      s = ok(s, S(5), { type: 'hunter.shoot', seat: 5, target });
      assert.deepEqual(stepTiming(s), { seconds: 20, earlyCloseReady: true }, String(target));
    }
  });

  it('host: durations and Hunter early close through the automatic clock', () => {
    let h = eng.sync(host(match()), 0);
    assert.equal(eng.phase(h).durationMs, 40_000);
    h = eng.tick(h, 40_000);
    assert.equal(eng.phase(h).durationMs, 20_000);
    assert.equal(eng.tick(h, 59_999).match.step.kind, 'night.witch', 'night total stays 60 s');
    h = eng.tick(h, 60_000);
    assert.deepEqual([eng.phase(h).name, eng.phase(h).durationMs], ['day.discussion', 165_000]);

    let k = eng.sync(host(night(match(), { bite: 5 })), 0);
    assert.deepEqual([eng.phase(k).durationMs, eng.phase(k).earlyClose], [20_000, false]);
    const r = eng.submit(k, 'f', { type: 'hunter.shoot', target: 0 });
    assert.ok(r.ok);
    k = r.state;
    assert.equal(eng.phase(k).earlyClose, true, 'server may close at 5 s instead of 20 s');
    k = eng.sync(eng.advance(k), 5_000);
    assert.equal(k.match.seats[0]?.alive, false);
    assert.notEqual(k.match.step.kind, 'hunter');
  });

  it('durations are not settings: timing config is rejected and none is provisional', () => {
    assert.equal(Object.keys(PROVISIONAL).some((k) => k.startsWith('timing')), false);
    assert.equal('timing' in resolveConfig(), false);
    for (const key of ['nightMain', 'discussionBase', 'discussionPerAlive', 'discussionMin', 'discussionMax', 'vote', 'confirm', 'hunter']) {
      const bad = { timing: { [key]: 1 } } as never;
      assert.throws(() => resolveConfig(bad), /unknown setting 'timing'/, key);
      assert.throws(() => createRulesEngine({ config: bad }), /invalid rules config/, key);
      assert.equal(createMatch({ seed: 1, playerCount: 7, config: bad }).ok, false, key);
    }
  });

  it('a state saved with the old timing settings runs on the approved values', () => {
    const saved = JSON.parse(JSON.stringify(match())) as MatchState;
    const timing = { nightMain: 30, discussionBase: 10, discussionPerAlive: 1, discussionMin: 1, discussionMax: 999, vote: 99, confirm: 99, hunter: 99 };
    (saved.config as unknown as Record<string, unknown>).timing = timing;
    assert.equal(secs(saved), 40);
    assert.equal(secs(close(saved)), 20);
    assert.equal(secs(close(close(saved))), 165);
    assert.equal(secs(night(saved, { bite: 5 })), 20);
  });
});
