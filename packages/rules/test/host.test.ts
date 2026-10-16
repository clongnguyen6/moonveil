import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { channelsFor, createRulesEngine, parseCommand } from '../src/index.ts';
import { close, day, match, night, ok, S } from './helpers.ts';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('host contract (server adapter)', () => {
  const eng = createRulesEngine();

  it('setup + phase: night is secret, fixed length, never early', () => {
    const s = eng.setup({ seats: IDS, seed: 's1' });
    assert.deepEqual(eng.phase(s), { name: 'night.main', secret: true, durationMs: 40_000, earlyClose: false, ended: false });
    assert.equal(eng.minPlayers, 7);
    assert.equal(eng.maxPlayers, 15);
  });

  it('submit injects the actor seat; players cannot act for others or drive steps', () => {
    let s = eng.setup({ seats: IDS, seed: 's1' });
    const wolfIdx = s.match.seats.findIndex((x) => x.role === 'wolf');
    const victim = s.match.seats.findIndex((x) => x.role !== 'wolf');
    const r = eng.submit(s, IDS[wolfIdx] as string, { type: 'wolf.pick', seat: 99, target: victim });
    assert.ok(r.ok);
    s = r.state;
    assert.equal(s.match.nightRec?.wolfPicks[wolfIdx], victim);
    const other = IDS[victim] as string;
    assert.equal(eng.submit(s, other, { type: 'wolf.pick', target: victim }).ok, false);
    assert.equal(eng.submit(s, other, { type: 'step.close' }).ok, false);
    assert.equal(eng.submit(s, 'zzz', { type: 'step.close' }).ok, false);
    assert.equal(eng.submit(s, other, 'garbage').ok, false);
  });

  it('view maps seats; moderate/advance/remove work; votes never report earlyClose (approved: run to deadline)', () => {
    let s = eng.setup({ seats: IDS, seed: 's2' });
    const v = eng.view(s, { kind: 'seat', seat: 'c' });
    assert.deepEqual(v.seatIds, IDS);
    assert.equal(v.me?.seat, 2);
    s = eng.advance(eng.advance(s));
    assert.equal(eng.phase(s).name, 'day.discussion');
    assert.equal(eng.remove(s, 'g').ok, true);
    s = eng.advance(s);
    for (const [i, id] of IDS.entries()) {
      if (!s.match.seats[i]?.alive) continue;
      const r = eng.submit(s, id, { type: 'vote.nominate', target: 'skip' });
      assert.ok(r.ok);
      s = r.state;
    }
    assert.equal(eng.phase(s).earlyClose, false);
    const m = eng.moderate(s, { type: 'match.abort' });
    assert.ok(m.ok && eng.phase(m.state).ended);
  });

  it('channels by SeatId and for moderator', () => {
    const s = eng.setup({ seats: IDS, seed: 's1' });
    const wolf = IDS[s.match.seats.findIndex((x) => x.role === 'wolf')] as string;
    assert.deepEqual(eng.channels(s, wolf), [{ channel: 'wolves', listen: true, speak: true }]);
    assert.ok(eng.channels(s, { kind: 'moderator' }).some((g) => g.channel === 'wolves' && g.listen));
  });

  it('parseCommand rejects malformed or extra fields', () => {
    assert.equal(parseCommand({ type: 'wolf.pick', seat: 0, target: 9 }, 7), null);
    assert.equal(parseCommand({ type: 'wolf.pick', seat: 0, target: 1, x: 1 }, 7), null);
    assert.equal(parseCommand({ type: 'nope' }, 7), null);
    assert.equal(parseCommand(null, 7), null);
    assert.deepEqual(parseCommand({ type: 'vote.nominate', seat: 1, target: 'skip' }, 7), { type: 'vote.nominate', seat: 1, target: 'skip' });
  });
});

describe('channels (Q25)', () => {
  it('night: only living wolves talk (wolves channel); others silent; ghosts on ghost channel + hear public', () => {
    let s = match();
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 0 }), [{ channel: 'wolves', listen: true, speak: true }]);
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 6 }), []);
    s = night(s, { bite: 6 });
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 6 }), [
      { channel: 'public', listen: true, speak: false },
      { channel: 'ghosts', listen: true, speak: true },
    ]);
  });

  it('dead wolf loses the wolf channel', () => {
    const s = day(night(match(), { bite: 'pass' }), 0);
    assert.equal(s.step.kind, 'night.main');
    assert.ok(!channelsFor(s, { kind: 'seat', seat: 0 }).some((g) => g.channel === 'wolves'));
    assert.ok(channelsFor(s, { kind: 'seat', seat: 1 }).some((g) => g.channel === 'wolves'));
  });

  it('day: everyone living speaks; defense: only the accused speaks', () => {
    let s = night(match(), { bite: 'pass' });
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 3 }), [{ channel: 'public', listen: true, speak: true }]);
    s = close(s);
    for (const v of [1, 2, 3]) s = ok(s, S(v), { type: 'vote.nominate', seat: v, target: 0 });
    s = close(s);
    assert.equal(s.step.kind, 'day.defense');
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 0 }), [{ channel: 'public', listen: true, speak: true }]);
    assert.deepEqual(channelsFor(s, { kind: 'seat', seat: 3 }), [{ channel: 'public', listen: true, speak: false }]);
  });
});
