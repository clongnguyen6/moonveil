// Full matches with the REAL engine, 7-10 seats, both modes, scripted clients at protocol level.
// Asserts per-seat isolation on every snapshot and a correct outcome (approved win conditions + Q14 draw).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '@moonveil/protocol';
import { assertOutcome } from './assertions.ts';
import { assertOpenBallots, assertSeatIsolation, gv, realMatch } from './match-driver.ts';

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

test('open day ballots (approved): every seat sees each voter\'s choice live, incl. after a reconnect; night stays private', () => {
  for (const mode of ['automatic', 'moderator'] as const) {
    const m = realMatch({ mode, seats: 8, seed: `open-ballots-${mode}` });
    let checked = 0;
    let reconnected = false;
    m.run(400, () => {
      if (!assertOpenBallots(m.players)) return;
      checked++;
      if (!reconnected) {
        // Mid-vote reconnect: the snapshot carries the same live ballots.
        const i = m.players.findIndex((p) => gv(p).me!.alive);
        const old = m.players[i]!;
        old.drop();
        const back = m.h.client();
        back.send({ t: 'resume', code: m.code, token: old.token! });
        m.players[i] = back;
        assert.ok(assertOpenBallots(m.players), 'reconnect snapshot');
        reconnected = true;
      }
    });
    assert.ok(checked > 0 && reconnected, `${mode}: vote steps observed`);
    for (const p of m.players) assertSeatIsolation(p); // roles, pack and night inputs stay private
  }
});
