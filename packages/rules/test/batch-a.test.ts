// APPROVED Batch A (Human, 2026-10-16): 7-15 players; 2 Wolves at 7-12, 3 at 13-15; exactly one each of Seer, Witch,
// Guard, Hunter by default, the rest Villagers; host customization within limits (at most one of each special role,
// and no setup the Wolves could win on the first night). Fixed behaviour; not configurable.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMatch, createRulesEngine, DEFAULT_CONFIG, DEFAULT_DECKS, defaultDeck, PLAYERS_MAX, PLAYERS_MIN, resolveConfig, validateDeck,
  type DeckCounts,
} from '../src/index.ts';
import * as index from '../src/index.ts';

const deck = (wolf: number, seer: number, witch: number, guard: number, hunter: number, villager: number): DeckCounts => ({
  wolf, seer, witch, guard, hunter, villager,
});

describe('APPROVED Batch A: table sizes', () => {
  it('6 and 16 are rejected at match creation; 7 and 15 are accepted', () => {
    assert.equal(createMatch({ seed: 1, playerCount: 6 }).ok, false);
    assert.equal(createMatch({ seed: 1, playerCount: 16 }).ok, false);
    assert.equal(createMatch({ seed: 1, playerCount: 7 }).ok, true);
    assert.equal(createMatch({ seed: 1, playerCount: 15 }).ok, true);
    // Also via an explicit deck or seat list: size limits hold regardless of deck.
    assert.equal(createMatch({ seed: 1, playerCount: 6, deck: deck(1, 1, 1, 1, 1, 1) }).ok, false);
    assert.equal(createMatch({ seed: 1, playerCount: 16, deck: deck(3, 1, 1, 1, 1, 9) }).ok, false);
    assert.equal(createMatch({ seed: 1, roles: ['wolf', 'wolf', 'seer', 'witch', 'guard', 'hunter'] }).ok, false);
    assert.deepEqual([PLAYERS_MIN, PLAYERS_MAX], [7, 15]);
  });

  it('the host engine reports 7-15 and table size is not a setting', () => {
    const eng = createRulesEngine();
    assert.deepEqual([eng.minPlayers, eng.maxPlayers], [7, 15]);
    assert.throws(() => resolveConfig({ players: { min: 6, max: 16 } } as never), /unknown setting 'players'/);
    assert.throws(() => resolveConfig({ distribution: {} } as never), /unknown setting 'distribution'/);
    assert.throws(() => resolveConfig({ limits: { maxPerSpecialRole: 2 } } as never), /unknown setting 'limits'/);
    assert.equal('createMatchUnchecked' in index, false, 'the unchecked test constructor is not part of the public API');
  });
});

describe('APPROVED Batch A: default deck at every size 7-15', () => {
  it('2 Wolves at 7-12, 3 at 13-15; one each of Seer, Witch, Guard, Hunter; the rest Villagers', () => {
    for (let n = 6; n <= 16; n++) {
      if (n < 7 || n > 15) {
        assert.equal(defaultDeck(n), null, `${n}`);
        continue;
      }
      const w = n <= 12 ? 2 : 3;
      assert.deepEqual(defaultDeck(n), deck(w, 1, 1, 1, 1, n - w - 4), `${n}`);
      assert.deepEqual(DEFAULT_DECKS[n], defaultDeck(n));
      assert.equal(validateDeck(defaultDeck(n)!, n, DEFAULT_CONFIG), null, `${n} default deck valid`);
      const r = createMatch({ seed: n, playerCount: n });
      assert.ok(r.ok);
      const roles = r.state.seats.map((s) => s.role);
      assert.equal(roles.filter((x) => x === 'wolf').length, w);
      for (const special of ['seer', 'witch', 'guard', 'hunter'] as const) assert.equal(roles.filter((x) => x === special).length, 1);
    }
  });
});

describe('APPROVED Batch A: host customization within limits', () => {
  it('valid custom decks are accepted (e.g. fewer specials, one more Villager)', () => {
    assert.equal(createMatch({ seed: 1, playerCount: 9, deck: deck(2, 1, 0, 1, 0, 5) }).ok, true);
    assert.equal(createMatch({ seed: 1, playerCount: 13, deck: deck(4, 1, 1, 1, 1, 5) }).ok, true);
  });

  it('invalid custom decks are rejected', () => {
    const bad: [string, number, DeckCounts, RegExp][] = [
      ['two Seers', 9, deck(2, 2, 1, 1, 1, 2), /too many seer/],
      ['two Witches', 9, deck(2, 1, 2, 1, 1, 2), /too many witch/],
      ['two Guards', 9, deck(2, 1, 1, 2, 1, 2), /too many guard/],
      ['two Hunters', 9, deck(2, 1, 1, 1, 2, 2), /too many hunter/],
      ['no wolves', 9, deck(0, 1, 1, 1, 1, 5), /at least one wolf/],
      ['counts do not add up', 9, deck(2, 1, 1, 1, 1, 4), /roles for/],
      ['negative count', 9, deck(2, 1, 1, 1, 1, -1), /bad count/],
      ['first-night win by a bite: 7 = 3 Wolves + 4 Villagers', 7, deck(3, 0, 0, 0, 0, 4), /first night/],
      ['first-night win by bite + poison: 8 = 3 Wolves + Witch + 4', 8, deck(3, 1, 1, 0, 0, 3), /first night/],
      ['wolves not fewer than village', 8, deck(4, 1, 1, 1, 1, 0), /fewer than village|first night/],
    ];
    for (const [name, n, d, re] of bad) {
      const r = createMatch({ seed: 1, playerCount: n, deck: d });
      assert.equal(r.ok, false, name);
      assert.match(!r.ok ? r.error.message : '', re, name);
    }
  });

  it('host customization through the host engine is validated too', () => {
    const eng = createRulesEngine({ deck: () => deck(3, 0, 0, 0, 0, 4) });
    assert.throws(() => eng.setup({ seats: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], seed: 's' }), /first night/);
  });
});
