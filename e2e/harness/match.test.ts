// skippedSteps (strict pacing, 0006): steps the driver saw but the loop never acted in. No browsers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Player } from './index.ts';
import { type BrowserMatch, skippedSteps } from './match.ts';

const state = (night: number, day: number, kind: string, actions: unknown[] = [], status = 'playing') => ({
  msg: { t: 'state', view: { status, game: { night, day, step: { kind }, me: { actions } } } },
});
const player = (frames: unknown[]) => ({ frames }) as unknown as Player;

test('a step seen on the wire but never acted in is reported, with whether a seat had actions', () => {
  const driver = player([state(1, 0, 'night.main'), state(1, 0, 'night.witch'), state(1, 1, 'day.discussion'), state(1, 1, 'day.vote'), state(1, 1, 'ended', [], 'ended')]);
  const witch = player([state(1, 0, 'night.witch', [{ type: 'witch.heal' }])]);
  const m = { mode: 'automatic', moderator: null, players: [driver, witch], driver, steps: 3, acted: new Set(['1/0/night.main', '1/1/day.discussion', '1/1/day.vote']) } as BrowserMatch;
  assert.deepEqual(skippedSteps(m), [{ key: '1/0/night.witch', withActions: true }]);
  m.acted.add('1/0/night.witch');
  assert.deepEqual(skippedSteps(m), [], 'the ended view is not a step');
});

test('a skipped step with no actions for anyone is still reported (withActions false)', () => {
  const driver = player([state(1, 0, 'night.main'), state(1, 1, 'day.discussion')]);
  const m = { mode: 'moderator', moderator: null, players: [driver], driver, steps: 1, acted: new Set(['1/0/night.main']) } as BrowserMatch;
  assert.deepEqual(skippedSteps(m), [{ key: '1/1/day.discussion', withActions: false }]);
});
