// Public API of @moonveil/rules. See API.md.
export { createMatch, apply, check, isSecretStep, type CreateOptions, type CreateResult } from './engine.ts';
export { project, availableActions, type Viewer, type Projection, type SeatView, type StepView, type MeView, type PackView, type AvailableAction } from './projection.ts';
export {
  CONFIRM_SECONDS,
  DEFENSE_SECONDS,
  DISCUSSION_BASE_SECONDS,
  DISCUSSION_MAX_SECONDS,
  DISCUSSION_MIN_SECONDS,
  DISCUSSION_PER_ALIVE_SECONDS,
  HUNTER_SECONDS,
  NIGHT_MAIN_SECONDS,
  NIGHT_TOTAL_SECONDS,
  VOTE_SECONDS,
} from './config.ts';
export { STALEMATE_CYCLES, DEFAULT_CONFIG, DEFAULT_DECKS, ENUMS, MAX_PER_SPECIAL_ROLE, PLAYERS_MAX, PLAYERS_MIN, PROVISIONAL, resolveConfig, type RulesConfig, type DeckCounts, type DeepPartial } from './config.ts';
export {
  stepTiming,
  discussionSeconds,
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
export { channelsFor, isPendingHunter, type ChannelGrant, type ChannelId, type ChannelViewer } from './channels.ts';
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
  type TimerInfo,
} from './host.ts';
export { startClock, pauseClock, resumeClock, remainingMs, deadlineOf, isExpired, type PhaseClock } from './clock.ts';
