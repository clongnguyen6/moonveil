// "Cute Halloween" preview theme: where decorations go. PURE (node-testable). Opt-in theme (themes/index.ts).
// Rules: nothing on a seat, its speaking ring or the ring of seats around the fire; nothing on the fire pit,
// the fire-ring dirt (leaves) or the stream. Labels are in their own layer above all of this (labels.ts STAGE_ORDER).
import { FIRE, isWalkable, streamX, type MapLayout, type Pt } from '../map.ts';
import { Rng } from '../rng.ts';

export interface Pumpkin extends Pt { variant: 0 | 1 | 2; scale: number }
export interface Bulb extends Pt { color: 'orange' | 'purple' }
export interface Strand { a: Pt; b: Pt; sag: number; bulbs: Bulb[]; ghosts: Pt[] }   // ghosts: thread tops on the wire
export interface Leaf extends Pt { variant: 0 | 1 | 2; rot: number; scale: number }
export interface HalloweenLayout { pumpkins: Pumpkin[]; strands: Strand[]; leaves: Leaf[] }

export const SEAT_CLEAR = 52;          // min distance from a pumpkin to any seat centre (seat, legs, speaking ring)
export const RING_MARGIN = { x: 30, y: 18 };   // seated ring = seats' ellipse + this margin: no decoration inside
export const FIRE_DIRT = { rx: 250, ry: 150 };  // fire-ring dirt: kept clear of leaves

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
export interface Box { x0: number; y0: number; x1: number; y1: number }
export const seatBox = (s: Pt): Box => ({ x0: s.x - 30, y0: s.y - 108, x1: s.x + 30, y1: s.y + 18 });
export const pumpkinBox = (p: Pick<Pumpkin, 'x' | 'y' | 'scale'>): Box => ({ x0: p.x - 16 * p.scale, y0: p.y - 28 * p.scale, x1: p.x + 16 * p.scale, y1: p.y + 5 });
export const BOX_MARGIN = 8;
export const boxesHit = (a: Box, b: Box, m = BOX_MARGIN): boolean => a.x0 - m < b.x1 && b.x0 - m < a.x1 && a.y0 - m < b.y1 && b.y0 - m < a.y1;
export const onSeat = (map: MapLayout, b: Box): boolean => map.seats.some((s) => boxesHit(seatBox(s), b));

// point on a sagging wire a→b at t (quadratic, lowest at the middle)
export function wireAt(s: Pick<Strand, 'a' | 'b' | 'sag'>, t: number): Pt {
  return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t + s.sag * 4 * t * (1 - t) };
}

const apex = (p: Pt): Pt => ({ x: p.x - 6, y: p.y - 92 });   // tent ridge top (tent art scaled 1.25)

export function halloweenLayout(map: MapLayout): HalloweenLayout {
  const rng = new Rng(31);
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

  // sparse string lights: between neighbouring back-row tents (behind the camp, far from the seats); at most two strands
  const rows = map.tents.length > 10 ? 3 : 2;
  const back = map.tents.filter((_, i) => i % rows === rows - 1).sort((p, q) => p.x - q.x);
  const pairs: [Pt, Pt][] = [];
  if (back.length >= 2) pairs.push([back[0]!, back[1]!]);
  if (back.length >= 4) pairs.push([back[back.length - 2]!, back[back.length - 1]!]);
  const strands: Strand[] = pairs.map(([p, q], k) => {
    const a = apex(p), b = apex(q), len = Math.hypot(b.x - a.x, b.y - a.y), sag = Math.min(40, len * 0.12);
    const m = Math.max(4, Math.min(8, Math.round(len / 48)));
    const s = { a, b, sag };
    const bulbs: Bulb[] = Array.from({ length: m }, (_, j) => ({ ...wireAt(s, (j + 0.5) / m), color: (j + k) % 3 === 1 ? 'purple' : 'orange' }));   // amber majority, purple accent (2:1)
    return { ...s, bulbs, ghosts: [wireAt(s, k % 2 ? 0.38 : 0.62)] };
  });

  // dry leaves: a few small clusters at the camp's edge (beside outer tents and toward the forest), not confetti over
  // the camp; never on the fire-ring dirt, the seated ring or the stream (PALETTE.md: 30-60 leaves in 5-8 clusters)
  const leaves: Leaf[] = [];
  const centres: Pt[] = [
    ...map.tents.filter((_, i) => i % 3 === 0).map((t) => ({ x: t.x - 70, y: t.y + 20 })),
    { x: FIRE.x - 420, y: FIRE.y + 260 }, { x: FIRE.x + 330, y: FIRE.y + 300 }, { x: FIRE.x - 120, y: FIRE.y + 380 },
  ].slice(0, 8);
  for (const c of centres) for (let i = 0, made = 0; i < 20 && made < 7; i++) {
    const x = c.x + rng.range(-45, 45), y = c.y + rng.range(-24, 24);
    if (Math.abs(x - streamX(y)) < 95 || inSeatRing(map, { x, y })) continue;
    if (((x - FIRE.x) / FIRE_DIRT.rx) ** 2 + ((y - FIRE.y) / FIRE_DIRT.ry) ** 2 < 1) continue;
    leaves.push({ x, y, variant: (leaves.length % 3) as 0 | 1 | 2, rot: rng.range(0, Math.PI * 2), scale: rng.range(0.7, 1.15) }); made++;
  }
  return { pumpkins, strands, leaves };
}
