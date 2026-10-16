// Phase clock for automatic mode (approved 2026-10-16: pause while ALL player seats are disconnected; exact remaining
// time is preserved; nothing expires while paused). Pure: the caller supplies `now` (ms); no timers here.
import { stepTiming } from './policies.ts';
import type { MatchState } from './types.ts';

export interface PhaseClock {
  /** MatchState.stepSeq this clock belongs to. A different stepSeq means a new phase. */
  stepSeq: number;
  durationMs: number;
  /** Remaining time as of `runningSince` (or as frozen while paused). */
  remainingMs: number;
  /** When the clock last started running; null while paused. */
  runningSince: number | null;
}

const elapsed = (c: PhaseClock, now: number) => (c.runningSince === null ? 0 : Math.max(0, now - c.runningSince));

/** Fresh clock for the current step, full duration. Starts paused if `paused`. */
export function startClock(state: MatchState, now: number, paused = false): PhaseClock {
  const durationMs = stepTiming(state).seconds * 1000;
  return { stepSeq: state.stepSeq, durationMs, remainingMs: durationMs, runningSince: paused ? null : now };
}

/** Freeze the remaining time. No-op if already paused. */
export function pauseClock(c: PhaseClock, now: number): PhaseClock {
  if (c.runningSince === null) return c;
  return { ...c, remainingMs: Math.max(0, c.remainingMs - elapsed(c, now)), runningSince: null };
}

/** Continue from the frozen remaining time. No-op if running. */
export function resumeClock(c: PhaseClock, now: number): PhaseClock {
  return c.runningSince === null ? { ...c, runningSince: now } : c;
}

export function remainingMs(c: PhaseClock, now: number): number {
  return Math.max(0, c.remainingMs - elapsed(c, now));
}

/** Absolute deadline (ms) while running; null while paused. */
export function deadlineOf(c: PhaseClock): number | null {
  return c.runningSince === null ? null : c.runningSince + c.remainingMs;
}

/** True only while running and out of time. A paused clock never expires. */
export function isExpired(c: PhaseClock, now: number): boolean {
  return c.runningSince !== null && remainingMs(c, now) === 0;
}
