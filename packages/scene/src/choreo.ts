// Per-seat intent from a SceneInput. PURE. Where a seat should be and whether it may move,
// derived only from fields every viewer legitimately has.
import type { Phase, SceneInput, SeatId } from './types.ts';

export type SeatIntent =
  | { kind: 'absent' }                 // not a player (moderator, unknown seat)
  | { kind: 'free' }                   // lobby: free movement, position from poses / local input
  | { kind: 'seat'; index: number }    // day / ended: seated at the campfire
  | { kind: 'tent'; index: number }    // night: inside own tent
  | { kind: 'ghost' };                 // dead during play: free-floating; rendered only from entitled poses

export function playerIndex(input: SceneInput, seat: SeatId): number {
  return input.players.findIndex((p) => p.seat === seat);
}

export function isAlive(input: SceneInput, seat: SeatId): boolean {
  const s = input.seats.find((x) => x.seat === seat);
  return s ? s.alive : true;
}

export function intentFor(input: SceneInput, seat: SeatId): SeatIntent {
  const index = playerIndex(input, seat);
  if (index < 0) return { kind: 'absent' };
  if (input.phase === 'lobby') return { kind: 'free' };
  if (!isAlive(input, seat)) return { kind: 'ghost' };
  if (input.phase === 'night') return { kind: 'tent', index };
  return { kind: 'seat', index };
}

// May this seat send `move`? Lobby, or dead during play. Never the moderator, never after the end for the living.
export function canMove(input: SceneInput, seat: SeatId): boolean {
  if (input.me.kind !== 'player' || playerIndex(input, seat) < 0) return false;
  if (input.phase === 'lobby') return true;
  return !isAlive(input, seat);
}

// Lighting target: 1 = night, 0 = day.
export function nightLevelFor(phase: Phase): number {
  return phase === 'night' ? 1 : 0;
}

export function phaseLabel(input: SceneInput): string {
  switch (input.phase) {
    case 'lobby': return 'Lobby';
    case 'day': return `Day ${input.day}`;
    case 'night': return `Night ${input.night}`;
    case 'ended': return 'Match over';
  }
}
