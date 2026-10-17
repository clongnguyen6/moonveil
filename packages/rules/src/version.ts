// Saved-match compatibility. MatchState.v = STATE_VERSION at creation. The host id ('moonveil-werewolf') stays fixed:
// clients select the game view by it. Bump rules: API.md "Saved matches".
import type { MatchState } from './types.ts';

/**
 * Bump when a change would alter the meaning of a saved IN-PROGRESS match (rule behaviour reachable mid-match,
 * or the state shape the engine reads). 1 = up to and including 35151f2. 2 = open defense speech (2026-10-18).
 */
export const STATE_VERSION = 2;
/** Versions whose ENDED matches project correctly under this code (no rules run after the end). Drop one only if
 * a state-shape change breaks project()/channelsFor() on its ended states. */
export const ENDED_READABLE_VERSIONS: readonly number[] = [1, 2];

/** null = safe to restore; else why not. In-progress matches need the current version; ended ones a readable one. */
export function restoreCheck(match: unknown): string | null {
  const m = match as Partial<MatchState> | null;
  if (typeof m !== 'object' || m === null || typeof m.v !== 'number' || typeof m.step?.kind !== 'string') {
    return 'not a Moonveil match state';
  }
  if (m.v === STATE_VERSION) return null;
  if (m.step.kind === 'ended') {
    return ENDED_READABLE_VERSIONS.includes(m.v) ? null : `finished match saved under state version ${m.v}, which this engine can't read`;
  }
  return `in-progress match saved under rules version ${m.v}; this engine runs version ${STATE_VERSION}`;
}
