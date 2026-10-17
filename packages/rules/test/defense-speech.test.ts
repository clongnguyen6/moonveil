// APPROVED (Human, 2026-10-18), supersedes the Q25 clause "defense: only the accused speaks":
// during the 30 s defense every living player may speak publicly, as well as the accused. The accused keeps the
// defense focus and timer; no push-to-talk queue. Unchanged: ghosts (own channel + hear public), pending-Hunter
// isolation, the moderator listening (speech provisional), night privacy, every other channel rule.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { channelsFor, createRulesEngine, project, stepTiming, type HostState, type MatchState, type Role } from '../src/index.ts';
import { close, match, night, ok, S } from './helpers.ts';

const PUB_TALK = { channel: 'public', listen: true, speak: true };
const PUB_LISTEN = { channel: 'public', listen: true, speak: false };
const GHOSTS = { channel: 'ghosts', listen: true, speak: true };
const MOD = (speak: boolean) => [
  { channel: 'public', listen: true, speak },
  { channel: 'wolves', listen: true, speak: false },
  { channel: 'ghosts', listen: true, speak: false },
];
// 0,1,2 wolf; 3 seer; 4 guard; 5 witch; 6 hunter; 7-9 villager
const R10: Role[] = ['wolf', 'wolf', 'wolf', 'seer', 'guard', 'witch', 'hunter', 'villager', 'villager', 'villager'];

/** Night 1 bites villager 9 (ghost); day 1 puts `accused` on trial. Returns the day.defense state. */
function defense(accused: number, config = {}): MatchState {
  let s = close(night(match(R10, config), { bite: 9 })); // day.vote
  for (const v of [3, 4, 5].filter((x) => x !== accused)) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: accused });
  s = close(s);
  assert.deepEqual(s.step, { kind: 'day.defense', day: 1, accused });
  return s;
}

describe('APPROVED 2026-10-18 open speech during defense', () => {
  it('every living seat (accused, wolves, every role) speaks in public; ghosts unchanged; no wolf channel', () => {
    for (const accused of [0, 7]) {
      const s = defense(accused);
      for (const x of s.seats) {
        const want = x.alive ? [PUB_TALK] : [PUB_LISTEN, GHOSTS];
        assert.deepEqual(channelsFor(s, { kind: 'seat', seat: x.seat }), want, `accused ${accused}, seat ${x.seat}`);
      }
      assert.equal(s.seats[9]?.alive, false, 'seat 9 is a ghost');
    }
  });

  it('moderator unchanged: listens everywhere; public speech still follows the provisional setting only', () => {
    assert.deepEqual(channelsFor(defense(7), { kind: 'moderator' }), MOD(false));
    assert.deepEqual(channelsFor(defense(7, { moderator: { speaksInPublic: true } }), { kind: 'moderator' }), MOD(true));
  });

  it('the accused keeps the focus and the 30 s timer, in every view and after reconnect', () => {
    const s = defense(7);
    assert.deepEqual(stepTiming(s), { seconds: 30, earlyCloseReady: false });
    const saved = JSON.parse(JSON.stringify(s)) as MatchState;
    for (const v of [{ kind: 'public' }, { kind: 'moderator' }, { kind: 'seat', seat: 0 }, { kind: 'seat', seat: 9 }] as const) {
      assert.deepEqual(project(s, v).step, { kind: 'day.defense', day: 1, accused: 7 }, JSON.stringify(v));
    }
    for (const x of s.seats) assert.deepEqual(channelsFor(saved, { kind: 'seat', seat: x.seat }), channelsFor(s, { kind: 'seat', seat: x.seat }));
    const eng = createRulesEngine();
    const h: HostState = eng.sync({ seatIds: R10.map((_, i) => `p${i}`), match: s, clock: null }, 0);
    assert.deepEqual(eng.channels(h, 'p3'), [PUB_TALK], 'host channels(): non-accused speaks');
    assert.equal(eng.timer(h, 0)?.durationMs, 30_000);
  });

  it('around defense nothing else changed: Yes/No open to all; executed Hunter isolated; next night private', () => {
    let s = close(defense(6)); // Hunter 6 accused -> day.confirm
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 3 }), [PUB_TALK]);
    for (const v of [0, 1, 2, 3, 4, 5]) s = ok(s, S(v), { type: 'vote.confirm', seat: v, choice: 'yes' });
    s = close(s); // executed -> pending Hunter turn
    assert.equal(s.step.kind, 'hunter');
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 6 }), [PUB_LISTEN], 'pending Hunter: public-listen only');
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 9 }), [PUB_LISTEN, GHOSTS]);
    s = close(ok(s, S(6), { type: 'hunter.shoot', seat: 6, target: 'pass' }));
    assert.equal(s.step.kind, 'night.main');
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 3 }), [], 'night: non-wolves silent');
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 0 }), [{ channel: 'wolves', listen: true, speak: true }]);
  });
});
