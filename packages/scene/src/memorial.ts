// Memorial at a dead player's campfire seat: geometry, label placement and policy. PURE.
// Public information only: shown for seats the projection marks dead (not 'removed': removal is not a gameplay death),
// from the moment that death is public (staging.ts decides when). A static prop, never a ghost position.
import { FIRE, isWalkable, type MapLayout, type Pt } from './map.ts';
import { type Box, seatBox, boxesHit } from './boxes.ts';
import { halloweenLayout, pumpkinBox } from './themes/halloween-layout.ts';   // pure placement only (no drawing): stone spots are the same in both themes
import type { SceneInput, SeatId } from './types.ts';

export type MemorialBox = Box;
export const STONE = { w: 22, h: 24 } as const;
export const MEMORIAL_LABEL_GAP = 6;     // label bottom this far above the stone top (default spot)
export const GHOST_NEAR = 130;           // a visible ghost this close stands for the memorial's name (one label)

const stoneBox = (base: Pt): Box => ({ x0: base.x - STONE.w / 2, y0: base.y - STONE.h, x1: base.x + STONE.w / 2, y1: base.y + 4 });

// Stone spots for every seat of a map (any seat may die): the nearest spot to the seat (just behind its stump, raised)
// whose stone box touches no other seat's camper box (head, body, ring; in front or behind), no Halloween pumpkin and no
// other seat's stone. Offsets go outward from the fire and sideways; seats themselves never move. Deterministic.
export interface Spot { base: Pt; box: Box; offset: number; clear: boolean }
const cache = new WeakMap<MapLayout, Spot[]>();
export function memorialSpots(map: MapLayout): Spot[] {
  const hit = cache.get(map); if (hit) return hit;
  const pumpkins = halloweenLayout(map).pumpkins.map(pumpkinBox);
  // candidates: r = outward from the fire, t = sideways, raise = up behind the stump; nearest first
  const cands: { r: number; t: number; raise: number; cost: number }[] = [];
  for (let r = 0; r <= 98; r += 14) for (let t = -56; t <= 56; t += 14) for (const raise of [14, 8, 2])
    cands.push({ r, t, raise, cost: r + Math.abs(t) + (14 - raise) * 0.5 });
  cands.sort((a, b) => a.cost - b.cost);
  const spots: Spot[] = [];
  map.seats.forEach((s, i) => {
    // outward (away from the fire, on the seat ellipse) and tangential unit vectors
    const ox = s.x - FIRE.x, oy = (s.y - FIRE.y) * 1.6, len = Math.hypot(ox, oy) || 1;
    const out = { x: ox / len, y: oy / len / 1.6 }, tan = { x: -out.y, y: out.x };
    let best: Spot | null = null;
    for (const c of cands) {
      const base = { x: s.x + out.x * c.r + tan.x * c.t, y: s.y - c.raise + out.y * c.r + tan.y * c.t };
      const box = stoneBox(base);
      if (!isWalkable(map, base.x, base.y + 2)) continue;   // not on the fire pit, a tent or the stream
      if (map.seats.some((o, j) => j !== i && boxesHit(box, seatBox(o.sit), 0))) continue;   // campers sit at seat.sit
      if (pumpkins.some((p) => boxesHit(box, p, 2))) continue;
      if (spots.some((o) => boxesHit(box, o.box, 2))) continue;
      best = { base, box, offset: Math.hypot(base.x - s.x, base.y - s.y), clear: true }; break;
    }
    // no clear spot in reach (not expected for 4-16 players; tested): stand right behind the stump
    spots.push(best ?? { base: { x: s.x, y: s.y - 2 }, box: stoneBox({ x: s.x, y: s.y - 2 }), offset: 2, clear: false });
  });
  cache.set(map, spots);
  return spots;
}

export function memorialAt(map: MapLayout, index: number): { base: Pt; labelAt: Pt; box: MemorialBox; clear: boolean } | null {
  const sp = memorialSpots(map)[index]; if (!sp) return null;
  return { base: sp.base, box: sp.box, clear: sp.clear, labelAt: { x: sp.base.x, y: sp.base.y - STONE.h - MEMORIAL_LABEL_GAP } };
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

// ---- name label placement, SCREEN space (after the living labels are laid out) ----
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface View { w: number; h: number; top: number; right: number; bottom: number; left: number }
export const LABEL_PAD = 3;   // px kept free around a memorial name
const overlap = (a: Rect, b: Rect, pad: number) => a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;

// Place one memorial name (w x h px) near its stone (screen rect) so it touches none of `obstacles` (living labels,
// visible campers' head boxes, stones, names already placed) and stays inside the view minus safe insets. Candidates:
// above the stone, below, left, right, then further above / below. Returns the label rect (null = no clear spot: hide
// the name rather than overlap). `displaced` = not the default spot (draw a leader to the stone).
export function placeMemorialLabel(stone: Rect, w: number, h: number, obstacles: readonly Rect[], view: View, gap = 4): { rect: Rect; displaced: boolean } | null {
  const cx = (stone.x0 + stone.x1) / 2, cy = (stone.y0 + stone.y1) / 2;
  const at = (x: number, bottom: number): Rect => ({ x0: x - w / 2, y0: bottom - h, x1: x + w / 2, y1: bottom });
  const cands: Rect[] = [
    at(cx, stone.y0 - gap),                         // above (default)
    at(cx, stone.y1 + gap + h),                     // below
    at(stone.x0 - gap - w / 2, cy + h / 2),         // left
    at(stone.x1 + gap + w / 2, cy + h / 2),         // right
  ];
  for (let k = 1; k <= 4; k++) cands.push(at(cx, stone.y0 - gap - k * (h + gap)), at(cx, stone.y1 + gap + h + k * (h + gap)),
    at(stone.x0 - gap - w / 2 - k * 12, stone.y0 - gap), at(stone.x1 + gap + w / 2 + k * 12, stone.y0 - gap),
    at(stone.x0 - gap - w / 2 - k * 12, stone.y1 + gap + h), at(stone.x1 + gap + w / 2 + k * 12, stone.y1 + gap + h));
  const inside = (r: Rect) => r.x0 >= view.left + 2 && r.x1 <= view.w - view.right - 2 && r.y0 >= view.top + 2 && r.y1 <= view.h - view.bottom - 2;
  for (let i = 0; i < cands.length; i++) {
    const r = cands[i]!;
    if (inside(r) && !obstacles.some((o) => overlap(r, o, LABEL_PAD))) return { rect: r, displaced: i > 0 };
  }
  return null;
}
