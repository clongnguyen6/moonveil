import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desiredByChannel, isActive, planChannel, roomName, shuffle, toPermission, visibilityOf } from '../src/server/mapping.ts';
import type { RoomPermission, VoiceGrantLike } from '../src/server/types.ts';

const g = (channel: string, speak: boolean, listen: boolean, visible?: boolean): VoiceGrantLike => ({ channel, speak, listen, ...(visible === undefined ? {} : { visible }) });
const P = (canPublish: boolean, canSubscribe: boolean, hidden = false): RoomPermission => ({ canPublish, canSubscribe, hidden });

test('grant -> permission follows the approved policy table', () => {
  assert.deepEqual(toPermission(g('public', true, true)), P(true, true)); // day, living
  assert.deepEqual(toPermission(g('public', false, true), true), P(false, true)); // defense, not accused (already present, visible)
  assert.deepEqual(toPermission(g('public', false, true)), P(false, true, true)); // ghost / pending Hunter / moderator: hidden
  assert.deepEqual(toPermission(g('wolves', true, true)), P(true, true)); // night, wolf
  assert.equal(isActive(g('public', false, false)), false); // no grant = not connected
});

test('visibility (ADR 0004): derived from speak on entry, sticky while present, explicit bit wins', () => {
  const listenOnly: VoiceGrantLike = { channel: 'public', listen: true, speak: false };
  assert.equal(visibilityOf(listenOnly), false); // ghost, pending Hunter, moderator: hidden newcomers
  assert.equal(visibilityOf({ ...listenOnly, speak: true }), true);
  assert.equal(visibilityOf(listenOnly, true), true); // defense: a living listener who entered visible stays visible
  assert.equal(visibilityOf(listenOnly, false), false); // a hidden listener stays hidden
  assert.equal(visibilityOf({ ...listenOnly, visible: true }), true); // explicit override
  assert.deepEqual(toPermission(listenOnly), P(false, true, true));
});

test('room names carry code, channel and generation; unsafe chars are replaced', () => {
  assert.equal(roomName('ABC234', 'public', 1), 'ABC234-public-g1');
  assert.equal(roomName('a b/c', 'wolves', 7), 'a_b_c-wolves-g7');
});

test('desiredByChannel groups active grants per channel', () => {
  const d = desiredByChannel(
    new Map([
      ['p1', [g('public', true, true)]],
      ['p2', [g('public', false, true, false), g('ghosts', true, true)]],
      ['p3', [g('public', false, false)]],
    ]),
  );
  assert.deepEqual([...d.keys()].sort(), ['ghosts', 'public']);
  assert.deepEqual(d.get('public')!.get('p2'), P(false, true, true));
  // sticky: p1 present and visible, now listen-only -> stays visible; p2 present hidden -> stays hidden
  const d2 = desiredByChannel(new Map([['p1', [g('public', false, true)]], ['p2', [g('public', false, true)]]]), new Map([['public', [{ identity: 'p1', permission: P(true, true, false) }, { identity: 'p2', permission: P(false, true, true) }]]]));
  assert.deepEqual(d2.get('public')!.get('p1'), P(false, true, false));
  assert.deepEqual(d2.get('public')!.get('p2'), P(false, true, true));
  assert.equal(d.get('public')!.has('p3'), false);
});

test('plan: permission flip inside a room is an update, never a rotation', () => {
  const plan = planChannel('public', new Map([['p1', P(false, true)], ['p2', P(true, true)]]), [
    { identity: 'p1', permission: P(true, true) },
    { identity: 'p2', permission: P(true, true) },
  ]);
  assert.equal(plan.rotate, false);
  assert.deepEqual(plan.updates, [{ identity: 'p1', permission: P(false, true) }]);
});

test('plan: a present participant without a grant forces rotation (OSS LiveKit cannot revoke tokens)', () => {
  const plan = planChannel('wolves', new Map([['p2', P(true, true)]]), [
    { identity: 'p1', permission: P(true, true) },
    { identity: 'p2', permission: P(true, true) },
  ]);
  assert.equal(plan.rotate, true);
  assert.deepEqual(plan.updates, []);
});

test('plan: a visibility change (alive -> ghost in public) forces rotation', () => {
  const plan = planChannel('public', new Map([['p4', P(false, true, true)]]), [{ identity: 'p4', permission: P(true, true, false) }]);
  assert.equal(plan.rotate, true);
});

test('plan: nothing present and nothing desired is a no-op; desired-but-absent needs nothing', () => {
  assert.deepEqual(planChannel('ghosts', undefined, []), { channel: 'ghosts', rotate: false, updates: [] });
  assert.deepEqual(planChannel('ghosts', new Map([['p9', P(true, true)]]), []), { channel: 'ghosts', rotate: false, updates: [] });
});

test('shuffle is a permutation and uses the injected randomness', () => {
  const items = [1, 2, 3, 4, 5];
  const out = shuffle(items, () => 0);
  assert.deepEqual([...out].sort(), items);
  assert.notDeepEqual(out, items); // random()=0 swaps every element to the front
});
