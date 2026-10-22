// "Cute Halloween" preview theme: where decorations go. PURE (node-testable). Dev-only theme (themes/index.ts).
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

// point on a sagging wire a→b at t (quadratic, lowest at the middle)
export function wireAt(s: Pick<Strand, 'a' | 'b' | 'sag'>, t: number): Pt {
  return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t + s.sag * 4 * t * (1 - t) };
}

const apex = (p: Pt): Pt => ({ x: p.x - 6, y: p.y - 92 });   // tent ridge top (tent art scaled 1.25)

export function halloweenLayout(map: MapLayout): HalloweenLayout {
  const rng = new Rng(31);
  const ring = seatRing(map), n = map.seats.length;
  const pumpkins: Pumpkin[] = [];
  // around the fire: in every other gap between seats, just outside the seated ring
  const ang = map.seats.map((s) => Math.atan2((s.y - FIRE.y) / ring.ry, (s.x - FIRE.x) / ring.rx)).sort((a, b) => a - b);
  for (let i = 0; i < n; i += 2) {
    const a0 = ang[i]!, a1 = i + 1 < n ? ang[i + 1]! : ang[0]! + Math.PI * 2, a = (a0 + a1) / 2;
    const p = { x: FIRE.x + Math.cos(a) * (ring.rx + 26), y: FIRE.y + Math.sin(a) * (ring.ry + 16) };
    if (!nearSeat(map, p) && !inSeatRing(map, p) && isWalkable(map, p.x, p.y)) pumpkins.push({ ...p, variant: (pumpkins.length % 3) as 0 | 1 | 2, scale: rng.range(0.85, 1.1) });
  }
  // beside every third tent (off the door, which campers walk to at night)
  map.tents.forEach((t, i) => {
    if (i % 3 !== 1) return;
    const p = { x: t.x + 52, y: t.y + 8 };
    if (isWalkable(map, p.x, p.y) && !nearSeat(map, p, SEAT_CLEAR * 2)) pumpkins.push({ ...p, variant: 2, scale: rng.range(0.75, 0.9) });
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
    const bulbs: Bulb[] = Array.from({ length: m }, (_, j) => ({ ...wireAt(s, (j + 0.5) / m), color: (j + k) % 2 ? 'purple' : 'orange' }));
    return { ...s, bulbs, ghosts: [wireAt(s, k % 2 ? 0.38 : 0.62)] };
  });

  // dry leaves on the ground: not on the fire-ring dirt, not in the stream
  const leaves: Leaf[] = [];
  for (let i = 0; i < 400 && leaves.length < 150; i++) {
    const x = rng.range(220, 1480), y = rng.range(260, 1180);
    if (Math.abs(x - streamX(y)) < 95) continue;
    if (((x - FIRE.x) / FIRE_DIRT.rx) ** 2 + ((y - FIRE.y) / FIRE_DIRT.ry) ** 2 < 1) continue;
    leaves.push({ x, y, variant: (i % 3) as 0 | 1 | 2, rot: rng.range(0, Math.PI * 2), scale: rng.range(0.7, 1.2) });
  }
  return { pumpkins, strands, leaves };
}
