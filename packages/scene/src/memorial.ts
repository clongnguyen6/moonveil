// Memorial at a dead player's campfire seat: geometry and label policy. PURE.
// Public information only: shown for seats the projection marks dead (not 'removed': removal is not a gameplay death),
// from the moment that death is public (staging.ts decides when). A static prop, never a ghost position.
import type { MapLayout, Pt } from './map.ts';
import type { SceneInput, SeatId } from './types.ts';

export interface MemorialBox { x0: number; y0: number; x1: number; y1: number }
// stone (with its little flower / pumpkin) stands on the seat's own spot: base at (seat.x, seat.y - 2), 22 x 24 units
export const STONE = { w: 22, h: 24 } as const;
export const MEMORIAL_LABEL_GAP = 6;     // label bottom this far above the stone top
export const GHOST_NEAR = 130;           // a visible ghost this close stands for the memorial's name (one label)

export function memorialAt(map: MapLayout, index: number): { base: Pt; labelAt: Pt; box: MemorialBox } | null {
  const s = map.seats[index]; if (!s) return null;
  const base = { x: s.x, y: s.y - 2 };
  return { base, labelAt: { x: base.x, y: base.y - STONE.h - MEMORIAL_LABEL_GAP }, box: { x0: base.x - STONE.w / 2, y0: base.y - STONE.h, x1: base.x + STONE.w / 2, y1: base.y + 4 } };
}

// Seats that should carry a memorial in this snapshot once their death is shown (the timing is staging's): public dead,
// not removed, during a match (no lobby). Disconnection is not death.
export function memorialEligible(input: SceneInput, seat: SeatId): boolean {
  if (input.phase === 'lobby') return false;
  const s = input.seats.find((x) => x.seat === seat);
  return !!s && !s.alive && s.death?.cause !== 'removed' && input.players.some((p) => p.seat === seat);
}

// One name per player: the memorial shows it unless that player's ghost is visible to this viewer close by.
export function memorialNameShown(labelAt: Pt, ghost: { visible: boolean; x: number; y: number } | null): boolean {
  return !(ghost?.visible && Math.hypot(ghost.x - labelAt.x, ghost.y - labelAt.y) < GHOST_NEAR);
}
