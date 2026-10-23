// "Cute Halloween" preview theme: where decorations go. PURE (node-testable). Opt-in theme (theme-switch.ts); pumpkin spots come from the theme-neutral props-layout.ts.
// Rules: nothing on a seat, its speaking ring or the ring of seats around the fire; nothing on the fire pit,
// the fire-ring dirt (leaves) or the stream. Labels are in their own layer above all of this (labels.ts STAGE_ORDER).
import { FIRE, streamX, type MapLayout, type Pt } from '../map.ts';
import { Rng } from '../rng.ts';
import { type Pumpkin, pumpkinSpots, inSeatRing } from '../props-layout.ts';
// re-exported for the overlay and tests (the placement itself lives in the theme-neutral props-layout.ts)
export { type Pumpkin, SEAT_CLEAR, RING_MARGIN, seatRing, inSeatRing, nearSeat, pumpkinBox, onSeat, pumpkinSpots } from '../props-layout.ts';
export { type Box, seatBox, boxesHit, BOX_MARGIN } from '../boxes.ts';

export interface Bulb extends Pt { color: 'orange' | 'purple' }
export interface Strand { a: Pt; b: Pt; sag: number; bulbs: Bulb[]; ghosts: Pt[] }   // ghosts: thread tops on the wire
export interface Leaf extends Pt { variant: 0 | 1 | 2; rot: number; scale: number }
export interface HalloweenLayout { pumpkins: Pumpkin[]; strands: Strand[]; leaves: Leaf[] }

export const FIRE_DIRT = { rx: 250, ry: 150 };  // fire-ring dirt: kept clear of leaves

// point on a sagging wire a→b at t (quadratic, lowest at the middle)
export function wireAt(s: Pick<Strand, 'a' | 'b' | 'sag'>, t: number): Pt {
  return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t + s.sag * 4 * t * (1 - t) };
}

const apex = (p: Pt): Pt => ({ x: p.x - 6, y: p.y - 92 });   // tent ridge top (tent art scaled 1.25)

export function halloweenLayout(map: MapLayout): HalloweenLayout {
  const rng = new Rng(31);
  const pumpkins = pumpkinSpots(map, rng);   // first draws from rng (props-layout.ts)
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
