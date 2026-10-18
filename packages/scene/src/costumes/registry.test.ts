import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COSTUMES, costumeById } from './index.ts';

test('registry resolves only own costume IDs, never inherited URL query names', () => {
  for (const [id, costume] of Object.entries(COSTUMES)) {
    assert.equal(costumeById(id), costume);
    assert.ok(costume.options, `${id}: the adapter requires declared options`);
  }
  for (const id of [null, undefined, '', 'missing', 'toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.equal(costumeById(id), null, `unexpected costume for ${String(id)}`);
  }
});
