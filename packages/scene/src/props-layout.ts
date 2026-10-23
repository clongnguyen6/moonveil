// Theme-neutral prop placement around the campfire. PURE. Used by default code (memorial stones keep clear of pumpkin
// spots, so stones stand in the same place in every theme) and by the Halloween overlay (which draws the pumpkins).
// Nothing here draws or names a theme; default code must import nothing under themes/.
import { FIRE, isWalkable, type MapLayout, type Pt } from './map.ts';
import { Rng } from './rng.ts';
import { type Box, seatBox, boxesHit } from './boxes.ts';

export interface Pumpkin extends Pt { variant: 0 | 1 | 2; scale: number }
export const SEAT_CLEAR = 52;          // min distance from a pumpkin to any seat centre (seat, legs, speaking ring)
export const RING_MARGIN = { x: 30, y: 18 };   // seated ring = seats' ellipse + this margin: no decoration inside
// The seated ring as an ellipse around the fire (from the seats themselves, so it follows the player count).
export function seatRing(map: MapLayout): { rx: number; ry: number } {
  let rx = 0, ry = 0;
  for (const s of map.seats) { rx = Math.max(rx, Math.abs(s.x - FIRE.x)); ry = Math.max(ry, Math.abs(s.y - FIRE.y)); }
  return { rx: rx + RING_MARGIN.x, ry: ry + RING_MARGIN.y };
}
export function inSeatRing(map: MapLayout, p: Pt): boolean {
  const r = seatRing(map);
  return ((p.x - FIRE.x) / r.rx) ** 2 + ((p.y - FIRE.y) / r.ry) ** 2 < 1;
}
export const nearSeat = (map: MapLayout, p: Pt, d = SEAT_CLEAR): boolean => map.seats.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < d);

// Screen-space boxes (world units). A seated camper occupies its stump + speaking ring up to the top of tall headgear;
// a pumpkin its own size. Decorations must not overlap any seat box, in front or behind (depth sort is not enough:
// a pumpkin behind a seat would sit at the camper's head).
export const pumpkinBox = (p: Pick<Pumpkin, 'x' | 'y' | 'scale'>): Box => ({ x0: p.x - 16 * p.scale, y0: p.y - 28 * p.scale, x1: p.x + 16 * p.scale, y1: p.y + 5 });
export const onSeat = (map: MapLayout, b: Box): boolean => map.seats.some((s) => boxesHit(seatBox(s), b));


// Pumpkin spots (Halloween decorations): gaps between seats just outside the seated ring, clear of every seated camper's
// box; a few beside tents. Deterministic: `rng` is the decoration layout's generator (pumpkins draw from it first).
export function pumpkinSpots(map: MapLayout, rng: Rng = new Rng(31)): Pumpkin[] {
  const ring = seatRing(map), n = map.seats.length;
  const pumpkins: Pumpkin[] = [];
  // around the fire: gaps between seats, just outside the seated ring, clear of every seated camper's box; every other one
  const ang = map.seats.map((s) => Math.atan2((s.y - FIRE.y) / ring.ry, (s.x - FIRE.x) / ring.rx)).sort((a, b) => a - b);
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const a0 = ang[i]!, a1 = i + 1 < n ? ang[i + 1]! : ang[0]! + Math.PI * 2, a = (a0 + a1) / 2;
    const scale = rng.range(0.85, 1.05);
    // closest to the ring that clears every seat box (tight rings push the pumpkin a little further out)
    const p = [[26, 16], [48, 30], [70, 44]].map(([dx, dy]) => ({ x: FIRE.x + Math.cos(a) * (ring.rx + dx!), y: FIRE.y + Math.sin(a) * (ring.ry + dy!), scale }))
      .find((q) => !nearSeat(map, q) && !inSeatRing(map, q) && isWalkable(map, q.x, q.y) && !onSeat(map, pumpkinBox(q)));
    if (!p) continue;
    if (ok++ % 2 === 0) pumpkins.push({ ...p, variant: (pumpkins.length % 3) as 0 | 1 | 2 });
  }
  // beside every third tent (off the door, which campers walk to at night)
  map.tents.forEach((t, i) => {
    if (i % 3 !== 1) return;
    const p = { x: t.x + 52, y: t.y + 8, scale: rng.range(0.75, 0.9) };
    if (isWalkable(map, p.x, p.y) && !nearSeat(map, p, SEAT_CLEAR * 2) && !onSeat(map, pumpkinBox(p))) pumpkins.push({ ...p, variant: 2 });
  });

  return pumpkins;
}
