// Host contract: what the server needs from a pure rules engine.
// packages/rules (other owner) has not published an API yet; an adapter will map it onto this.
// Proposed to the rules owner; open to change. Pure: no clock, no IO, randomness only via `seed`.
import type { SeatId, VoiceGrant } from '@moonveil/protocol';

export type Viewer = { kind: 'seat'; seat: SeatId } | { kind: 'moderator' };

export interface PhaseInfo {
  // Engine-defined name, opaque to the server.
  name: string;
  // Secret phase: hidden actions happen. Server masks presence/timing for non-moderators.
  secret: boolean;
  // Automatic mode closes the phase after this long. Secret phases never close early (timing channel).
  durationMs: number;
  ended: boolean;
}

export type Result<S> = { ok: true; state: S } | { ok: false; error: string };

export interface RulesEngine<S> {
  readonly id: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  setup(input: { seats: readonly SeatId[]; seed: string }): S;
  phase(state: S): PhaseInfo;
  // Engine validates seat, phase, target. Server only routes.
  submit(state: S, seat: SeatId, action: unknown): Result<S>;
  // Close the current phase (moderator command or automatic timer).
  advance(state: S): S;
  // The ONLY source of game data sent to a client. Must contain nothing the viewer may not know.
  view(state: S, viewer: Viewer): unknown;
  // Comm permissions for voice/text. Server forwards to the voice gateway and to the seat itself.
  channels(state: S, seat: SeatId): VoiceGrant[];
}
