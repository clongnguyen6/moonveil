// Host deck customization (approved Batch A) on top of @moonveil/rules: the engine validates; a custom deck
// applies at setup through createRulesEngine({ deck }). Pure glue; no rules logic here.
import { createRulesEngine, type DeckCounts, defaultDeck, type HostState, type RulesConfig, resolveConfig, validateDeck } from '@moonveil/rules';
import type { RulesEngine } from './engine.ts';

// defaultDeck(n) on newer rules, defaultDeck(n, config) on older: call compatibly.
const defaultFor = defaultDeck as (n: number, config?: RulesConfig) => DeckCounts | null;

export function createHostedRulesEngine(): RulesEngine<HostState> {
  const config = resolveConfig();
  const base = createRulesEngine();
  return {
    ...base,
    decks: {
      default: (n) => defaultFor(n, config),
      validate: (counts, n) => validateDeck(counts as DeckCounts, n, config),
    },
    setup({ seats, seed, deck }) {
      return deck ? createRulesEngine({ deck: () => deck as DeckCounts }).setup({ seats, seed }) : base.setup({ seats, seed });
    },
  };
}
