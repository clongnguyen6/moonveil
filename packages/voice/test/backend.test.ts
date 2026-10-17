import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeBackend, isNotFound } from '../src/server/backend.ts';

// Shape of livekit-server-sdk's ServerError (TwirpRPC.js): Error + status (HTTP) + code (twirp code).
function serverError(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code });
}

test('isNotFound is code-based: twirp not_found or HTTP 404, never message text', () => {
  assert.equal(isNotFound(serverError('requested room does not exist', 404, 'not_found')), true);
  assert.equal(isNotFound(serverError('whatever wording the server uses', 404, 'not_found')), true);
  assert.equal(isNotFound({ code: 'not_found' }), true);
  assert.equal(isNotFound({ status: 404 }), true);
  assert.equal(isNotFound(serverError('participant not found in text only', 500, 'internal')), false);
  assert.equal(isNotFound(new Error('room not found')), false); // plain Error without twirp fields
  assert.equal(isNotFound(null), false);
  assert.equal(isNotFound('not found'), false);
});

test('FakeBackend.removeParticipant records the revocation timestamp and drops the participant', async () => {
  const b = new FakeBackend();
  await b.createRoom('R-public-g1');
  b.connect('R-public-g1', 'p1', { canPublish: true, canSubscribe: true, hidden: false });
  await b.removeParticipant('R-public-g1', 'p1', 1_700_000_000);
  assert.deepEqual(b.participants('R-public-g1'), []);
  assert.deepEqual(b.calls.at(-1), { op: 'remove', room: 'R-public-g1', identity: 'p1', revokeTokenTs: 1_700_000_000 });
  await b.removeParticipant('R-public-g1', 'ghost'); // absent participant: no-op, no throw
});
