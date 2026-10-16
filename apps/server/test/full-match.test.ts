// Full matches with the REAL engine, 7-10 seats, both modes, scripted clients at protocol level.
// Asserts per-seat isolation on every snapshot and a correct outcome (approved win conditions + Q14 draw).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '@moonveil/protocol';
import { assertBallotSecrecy, assertSeatIsolation, realMatch } from './match-driver.ts';

function assertOutcome(final: GameView) {
  assert.ok(final.outcome, 'outcome set');
  const roles = final.reveal!.roles;
  const alive = final.seats.filter((s) => s.alive);
  const lw = alive.filter((s) => roles[s.seat] === 'wolf').length;
  const lv = alive.length - lw;
  switch (final.outcome.winner) {
    case 'wolves':
      assert.ok(lw > 0 && lw >= lv, `wolves win needs parity: ${lw} vs ${lv}`);
      break;
    case 'village':
      assert.ok(lw === 0 && lv > 0, `village win needs no wolves: ${lw} vs ${lv}`);
      break;
    case 'draw':
      assert.equal(alive.length, 0, 'draw = zero survivors');
      break;
    default:
      assert.fail(`unexpected winner ${final.outcome.winner}`);
  }
}

const SEEDS = ['a', 'b', 'c'];
for (const mode of ['automatic', 'moderator'] as const) {
  for (const seats of [7, 8, 9, 10]) {
    test(`full match, ${mode}, ${seats} seats: isolation on every snapshot + correct outcome`, () => {
      for (const seed of SEEDS) {
        const m = realMatch({ mode, seats, seed: `${mode}-${seats}-${seed}` });
        m.run();
        assert.equal(m.driver.view.status, 'ended', `seed ${seed}: match ended`);
        const finals = m.players.map((p) => p.view.game as GameView);
        assertOutcome(finals[0]!);
        for (const f of finals) assert.deepEqual(f.outcome, finals[0]!.outcome, 'all seats agree on outcome');
        for (const p of m.players) assertSeatIsolation(p);
        if (m.moderator) {
          const mg = m.moderator.view.game as GameView;
          assert.notEqual(mg.moderator, null);
        }
      }
    });
  }
}

test('ballot secrecy (approved Q22): no ballots or interim tallies reach players before close', () => {
  const m = realMatch({ mode: 'automatic', seats: 8, seed: 'ballots' });
  m.run();
  const seen = m.players.reduce((n, p) => n + assertBallotSecrecy(p), 0);
  assert.ok(seen > 0, 'no vote steps observed');
});
