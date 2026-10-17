// Diagnosis for the "day 13, nobody ever died" UI run: night actions that arrive after their step closed are
// rejected (error to the actor only) and the night passes with no death. Scripted clients, real engine.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServerMessage } from '@moonveil/protocol';
import { gv, idx, role, scripted, stepKind } from './match-driver.ts';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;

test('wolf picks that arrive after night.main closed are rejected; every night passes without a death', () => {
  const s = scripted('automatic', 7, 'late-picks');
  s.driver.send({ t: 'start' });
  const wolves = s.by('wolf');
  const targets = s.P.filter((p) => role(p) === 'villager');
  let lateNights = 0;
  let rejected = 0;
  for (let night = 1; night <= 6 && s.driver.view.status === 'playing'; night++) {
    s.advanceUntil(() => stepKind(s.driver) === 'night.main');
    // The step closes before the bots act (latency > night.main at the harness's time scale).
    s.toNext();
    assert.equal(stepKind(s.driver), 'night.witch');
    for (const w of wolves) {
      const before = w.frames.length;
      w.send({ t: 'act', ref: `late-${night}`, action: { type: 'wolf.pick', target: idx(targets[0]!) } });
      const err = w.frames.slice(before).find((f): f is Msg<'error'> => f.t === 'error');
      assert.ok(err && err.ref === `late-${night}` && /wrong_step|forbidden|bad_seat/.test(err.message), `late pick accepted: ${JSON.stringify(err)}`);
      rejected++;
    }
    s.advanceUntil(() => stepKind(s.driver).startsWith('day.'));
    const dawn = gv(s.driver).publicLog.filter((e) => e.t === 'dawn').at(-1) as { dead?: number[] } | undefined;
    assert.deepEqual(dawn?.dead ?? [], [], `night ${night}: a late pick still killed`);
    lateNights++;
    // Days pass without votes too; rules-12 F1-A ends three death-free cycles as a stalemate draw.
    s.advanceUntil(() => s.driver.view.status !== 'playing' || stepKind(s.driver) === 'night.main');
  }
  assert.ok(lateNights >= 2, `observed ${lateNights} late nights`);
  // Under rules-12 the no-death signature ends as a stalemate draw instead of running to day 13.
  assert.equal(s.driver.view.status, 'ended');
  assert.deepEqual(gv(s.driver).outcome, { winner: 'draw', reason: 'stalemate' });
  assert.equal(rejected, lateNights * wolves.length);
  // Nobody but the wolves saw those errors.
  for (const p of s.P.filter((x) => role(x) !== 'wolf')) assert.ok(!p.frames.some((f) => f.t === 'error'));
});

test('the same picks inside night.main kill as expected (control)', () => {
  const s = scripted('automatic', 7, 'late-picks');
  s.driver.send({ t: 'start' });
  const wolves = s.by('wolf');
  const target = s.P.find((p) => role(p) === 'villager')!;
  for (const w of wolves) w.send({ t: 'act', action: { type: 'wolf.pick', target: idx(target) } });
  s.advanceUntil(() => stepKind(s.driver).startsWith('day.'));
  const dawn = gv(s.driver).publicLog.filter((e) => e.t === 'dawn').at(-1) as { dead?: number[] };
  assert.deepEqual(dawn.dead, [idx(target)]);
});
