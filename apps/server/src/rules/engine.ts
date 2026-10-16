// Host contract: what the server needs from a pure rules engine.
// Mirrors @moonveil/rules src/host.ts (API v0.3); rules tests prove createRulesEngine() satisfies it.
// Pure: no IO, randomness only via `seed`; time only via `now` arguments (automatic-mode clock lives in state).
import type { SeatId, VoiceGrant } from '@moonveil/protocol';

export type Viewer = { kind: 'seat'; seat: SeatId } | { kind: 'moderator' } | { kind: 'public' };

export interface PhaseInfo {
  // Engine-defined name, opaque to the server.
  name: string;
  // Secret phase: hidden actions happen. Server masks presence/timing for non-moderators.
  secret: boolean;
  // Automatic mode closes the phase after this long. Secret phases never close early (timing channel).
  durationMs: number;
  // Public phases only: everyone eligible has acted; automatic mode may close after a short grace.
  earlyClose: boolean;
  ended: boolean;
}

export interface TimerInfo {
  durationMs: number;
  remainingMs: number;
  // Absolute ms when the phase closes; null while paused (or no clock).
  deadline: number | null;
  paused: boolean;
}

export type Result<S> = { ok: true; state: S } | { ok: false; error: string; code?: string };

export interface RulesEngine<S> {
  readonly id: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  setup(input: { seats: readonly SeatId[]; seed: string }): S;
  phase(state: S): PhaseInfo;
  // Player action. Engine validates seat, phase, target. Server only routes.
  submit(state: S, seat: SeatId, action: unknown): Result<S>;
  // Moderator command (moderator mode only): act for a seat, close the step, etc.
  moderate(state: S, action: unknown): Result<S>;
  // System removal (server policy, e.g. long disconnect). Not used yet.
  remove(state: S, seat: SeatId): Result<S>;
  // Close the current phase now (moderator pacing, or the server's early close).
  advance(state: S): S;
  // Automatic mode only. After ANY change: starts a full clock when the phase changed.
  sync(state: S, now: number): S;
  // Closes the phase only if its clock is running and expired, then starts the next clock.
  tick(state: S, now: number): S;
  // Freeze / continue the remaining time (idempotent). Server: all player seats disconnected / any back.
  pause(state: S, now: number): S;
  resume(state: S, now: number): S;
  timer(state: S, now: number): TimerInfo | null;
  // The ONLY source of game data sent to a client. Must contain nothing the viewer may not know.
  view(state: S, viewer: Viewer): unknown;
  // Comm permissions (voice and text). Server forwards to the voice gateway and to the seat itself.
  channels(state: S, who: SeatId | Viewer): VoiceGrant[];
}
