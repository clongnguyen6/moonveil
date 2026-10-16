// The acceptance seed table still produces its expected outcomes (in-process, same as a strict browser match),
// within seats + 3 days, and covers every required end path in both modes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_ACCEPTANCE, REQUIRED_PATHS } from './acceptance-seeds.ts';
import { simulateAcceptance } from './match-driver.ts';

for (const s of ALL_ACCEPTANCE) {
  test(`acceptance seed ${s.S} (${s.mode}, ${s.seats}) ends ${s.expect.winner}/${s.expect.reason}`, () => {
    const r = simulateAcceptance(s.mode, s.seats, s.S);
    assert.deepEqual(r.outcome, s.expect);
    assert.ok(r.day <= s.seats + 3, `ended on day ${r.day}`);
  });
}

test('the seed table covers every required end path in both modes', () => {
  for (const mode of ['automatic', 'moderator'] as const) {
    const paths = new Set(ALL_ACCEPTANCE.filter((s) => s.mode === mode).map((s) => `${s.expect.winner}/${s.expect.reason}`));
    for (const p of REQUIRED_PATHS) assert.ok(paths.has(p), `${mode}: missing ${p}`);
  }
});
