// Memorial at a dead player's campfire seat: geometry and label policy. PURE.
// Public information only: shown for seats the projection marks dead (not 'removed': removal is not a gameplay death),
// from the moment that death is public (staging.ts decides when). A static prop, never a ghost position.
import type { MapLayout, Pt } from './map.ts';
import { type Box, seatBox, boxesHit } from './boxes.ts';
import type { SceneInput, SeatId } from './types.ts';

export type MemorialBox = Box;
// stone (with its little flower / pumpkin) stands just behind its seat's stump/log, raised as far as the ring allows so
// the tablet shows above it: base y = seat.y - RAISE.max where there is room, less in dense rings (never over a camper
// sitting behind it; covering = a box overlap with a seat at smaller y, which the stone would be drawn over)
export const STONE = { w: 22, h: 24 } as const;
export const RAISE = { max: 14, min: 2 } as const;
export const MEMORIAL_LABEL_GAP = 6;     // label bottom this far above the stone top
export const GHOST_NEAR = 130;           // a visible ghost this close stands for the memorial's name (one label)

const stoneBox = (base: Pt): Box => ({ x0: base.x - STONE.w / 2, y0: base.y - STONE.h, x1: base.x + STONE.w / 2, y1: base.y + 4 });
export function memorialAt(map: MapLayout, index: number): { base: Pt; labelAt: Pt; box: MemorialBox; raise: number } | null {
  const s = map.seats[index]; if (!s) return null;
  let raise: number = RAISE.min;
  for (let r = RAISE.max; r >= RAISE.min; r--) {
    const b = stoneBox({ x: s.x, y: s.y - r });
    if (!map.seats.some((o, j) => j !== index && o.y < s.y - r && boxesHit(b, seatBox(o), 0))) { raise = r; break; }
  }
  const base = { x: s.x, y: s.y - raise };
  return { base, labelAt: { x: base.x, y: base.y - STONE.h - MEMORIAL_LABEL_GAP }, box: stoneBox(base), raise };
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
