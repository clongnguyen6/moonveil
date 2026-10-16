// Keeps the PROVISIONAL balance-screening tooling (sim/) working: bots terminate, are deterministic, and only make
// legal moves (an illegal move would be rejected and show up as a stalled match).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CONFIG, defaultDeck } from '../src/index.ts';
import { runCell, wilson } from '../sim/balance.ts';
import { playMatch } from '../sim/bots.ts';

describe('balance sim (provisional tooling)', () => {
  it('every default deck 6-16 terminates under both policies', () => {
    for (let n = 6; n <= 16; n++) {
      for (const policy of ['heuristic', 'random'] as const) {
        for (let seed = 0; seed < 3; seed++) {
          const r = playMatch({ seed: n * 100 + seed, players: n, policy });
          assert.ok(['wolves', 'village', 'draw'].includes(r.winner), `${n} ${policy} ${seed}: ${r.winner}`);
        }
      }
    }
  });

  it('is deterministic per seed', () => {
    assert.deepEqual(playMatch({ seed: 42, players: 9, policy: 'heuristic' }), playMatch({ seed: 42, players: 9, policy: 'heuristic' }));
    const deck = defaultDeck(8, DEFAULT_CONFIG)!;
    assert.deepEqual(runCell(8, 'heuristic', deck, 10), runCell(8, 'heuristic', deck, 10));
  });

  it('Wilson interval sanity', () => {
    assert.deepEqual(wilson(50, 100), [40, 60]);
    assert.deepEqual(wilson(0, 100), [0, 4]);
  });
});
