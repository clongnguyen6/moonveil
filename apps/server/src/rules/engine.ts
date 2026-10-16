// Host contract: what the server needs from a pure rules engine.
// Mirrors @moonveil/rules src/host.ts (rules 01fbb49, read via git show; not yet in dev). Wiring = pass
// createRulesEngine() where main.ts passes the fixture. Pure: no clock, no IO, randomness only via `seed`.
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
  // Close the current phase (moderator `advance` or automatic timer).
  advance(state: S): S;
  // The ONLY source of game data sent to a client. Must contain nothing the viewer may not know.
  view(state: S, viewer: Viewer): unknown;
  // Comm permissions (voice and text). Server forwards to the voice gateway and to the seat itself.
  channels(state: S, who: SeatId | Viewer): VoiceGrant[];
}
