// rules-12 (approved): only the separate moderator ends a match early: moderate {type:'match.end', confirm:'end-match'}
// -> outcome {winner:'aborted'}. Players and a playing host (automatic mode) are refused; a missing confirm is refused.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView, ServerMessage } from '@moonveil/protocol';
import { type FakeClient } from './harness.ts';
import { gv, scripted } from './match-driver.ts';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
const lastError = (c: FakeClient) => c.frames.filter((f): f is Msg<'error'> => f.t === 'error').at(-1);
const END = { type: 'match.end', confirm: 'end-match' };
const TODO = { todo: 'awaiting rules-12 (match.end) in dev; written against rules-12 5def39a API.md' };

test('moderator ends the match with confirm; players are refused (moderator mode)', TODO, () => {
  const s = scripted('moderator', 7, 'match-end-mod');
  const mod = s.moderator!;
  mod.send({ t: 'start' });
  const p = s.P[0]!;
  const others = s.P.slice(1).map((x) => x.frames.length);
  p.send({ t: 'act', ref: 'p', action: END });
  assert.equal(lastError(p)?.ref, 'p', 'player match.end must be refused');
  assert.equal(p.view.status, 'playing');
  s.P.slice(1).forEach((x, i) => assert.equal(x.frames.length, others[i], 'refusal leaked to others'));
  mod.send({ t: 'act', ref: 'm0', action: { type: 'match.end' } });
  assert.match(lastError(mod)?.message ?? '', /bad_value/, 'missing confirm must be refused');
  assert.equal(mod.view.status, 'playing');
  mod.send({ t: 'act', ref: 'm1', action: END });
  assert.deepEqual(mod.frames.filter((f) => f.t === 'ack').at(-1), { t: 'ack', ref: 'm1' });
  for (const c of [mod, ...s.P]) {
    assert.equal(c.view.status, 'ended');
    assert.equal((gv(c) as GameView).outcome?.winner, 'aborted');
  }
});

test('automatic mode: the playing host cannot end the match', TODO, () => {
  const s = scripted('automatic', 7, 'match-end-auto');
  s.creator.send({ t: 'start' });
  s.creator.send({ t: 'act', ref: 'h', action: END });
  assert.equal(lastError(s.creator)?.ref, 'h');
  assert.equal(s.creator.view.status, 'playing');
});
