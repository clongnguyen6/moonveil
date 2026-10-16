// Public API of @moonveil/rules. See API.md.
export { createMatch, apply, check, isSecretStep, type CreateOptions, type CreateResult } from './engine.ts';
export { project, availableActions, type Viewer, type Projection, type SeatView, type StepView, type MeView, type PackView, type AvailableAction } from './projection.ts';
export { DEFAULT_CONFIG, PROVISIONAL, resolveConfig, type RulesConfig, type DeckCounts, type DeepPartial } from './config.ts';
export {
  stepTiming,
  nightInputsComplete,
  evaluateVictory,
  resolveWolfTarget,
  tallyNomination,
  tallyConfirm,
  nightDeaths,
  seerResult,
  hunterTriggers,
  defaultDeck,
  validateDeck,
} from './policies.ts';
export * from './types.ts';
export { channelsFor, type ChannelGrant, type ChannelId, type ChannelViewer } from './channels.ts';
export {
  createRulesEngine,
  parseCommand,
  type RulesEngine,
  type HostState,
  type HostView,
  type HostViewer,
  type HostOptions,
  type HostResult,
  type PhaseInfo,
  type SeatId,
} from './host.ts';
