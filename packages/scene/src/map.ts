// Camp map layout and walkability. PURE: no DOM, no Pixi. The server may import this
// (`@moonveil/scene/map`) to validate client moves with the same geometry the renderer draws.
import { Rng } from './rng.ts';

export const WORLD = { w: 1700, h: 1400 } as const;
export const FIRE = { x: 800, y: 760 } as const;
// The camera frames this rectangle on every screen; outside is forest and stream margin.
export const CORE = { x: 280, y: 240, w: 1140, h: 820 } as const;
export const BRIDGE_Y = 760;
// Camera frame: the core, taller when a third tent row exists (> 12 players).
export function frameRect(map: MapLayout): { x: number; y: number; w: number; h: number } {
  return map.tents.length > 10 ? { x: CORE.x, y: 150, w: CORE.w, h: CORE.h + 90 } : { ...CORE };
}
export const WALK_BOUNDS = { minX: 40, maxX: WORLD.w - 40, minY: 120, maxY: WORLD.h - 30 } as const;
// Muted canvas tones (olive, slate, rust, khaki, umber, moss, charcoal, teal); never bright.
export const TENT_COLORS = [0x5e6a4a, 0x4e5a66, 0x7a4a3a, 0x8a7a56, 0x5a4a3c, 0x46584a, 0x4a4a4e, 0x3e5a5c, 0x6a5a48, 0x56626a, 0x6a4e44, 0x4c5c50, 0x7a6a4e, 0x44504a, 0x5c4c52, 0x505a60] as const;

export function streamX(y: number): number {
  return 1440 - 0.09 * (y - 760) + 50 * Math.sin(y / 220);
}

export interface Pt { x: number; y: number }
export interface Tent extends Pt { color: number; door: Pt; lanternAt: Pt }
export interface Seat extends Pt { sit: Pt; kind: 'stump' | 'log' }
export interface Tree extends Pt { kind: 'pine' | 'round'; variant: number; scale: number; phase: number; tintMix: number }
export interface Bush extends Pt { variant: number; scale: number }
export interface Blocker extends Pt { rx: number; ry: number }

export interface MapLayout {
  playerCount: number;
  seed: number;
  tents: Tent[];
  seats: Seat[];
  lanterns: Pt[];          // lantern post base positions
  trees: Tree[];
  bushes: Bush[];
  blockers: Blocker[];
}

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;

export function createMap(playerCount: number, seed = 2026): MapLayout {
  const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.floor(playerCount)));
  const rng = new Rng(seed);
  const blockers: Blocker[] = [];
  // tents on the upper arc around the fire; staggered rows so they never overlap (2 rows ≤ 12, 3 rows above)
  const rows = n > 10 ? 3 : 2;
  const radii = rows === 3 ? [[400, 270], [550, 375], [700, 480]] : [[430, 290], [560, 380]];
  const arc = rows === 3 ? [186, 132] : [198, 144];   // start angle, span (degrees); the right end stays off the stream
  const tents: Tent[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((arc[0]! + (arc[1]! * i) / (n - 1)) * Math.PI) / 180;
    const r = radii[i % rows] ?? radii[0]!;
    let x = FIRE.x + Math.cos(a) * r[0]!;
    const y = FIRE.y + Math.sin(a) * r[1]!;
    x = Math.min(x, streamX(y) - 125); // keep tents and their doors off the stream bank
    tents.push({ x, y, color: TENT_COLORS[i % TENT_COLORS.length]!, door: { x, y: y + 8 }, lanternAt: { x: x + 30, y: y - 40 } });
    blockers.push({ x, y: y - 30, rx: 60, ry: 34 });
  }
  // seats around the fire; ring grows with the player count
  const rx = 150 + Math.max(0, n - 10) * 9, ry = 90 + Math.max(0, n - 10) * 5;
  const seats: Seat[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((-90 + (360 * i) / n + 18) * Math.PI) / 180;
    const x = FIRE.x + Math.cos(a) * (rx + 15), y = FIRE.y + Math.sin(a) * (ry + 8);
    seats.push({ x, y, sit: { x, y: y - 10 }, kind: i % 3 === 1 ? 'log' : 'stump' });
  }
  blockers.push({ x: FIRE.x, y: FIRE.y, rx: 62, ry: 38 });

  const lanterns: Pt[] = [
    { x: streamX(BRIDGE_Y) - 150, y: BRIDGE_Y + 40 },
    { x: FIRE.x - 330, y: FIRE.y + 180 },
    { x: FIRE.x + 300, y: FIRE.y - 290 },
  ];
  for (const l of lanterns) blockers.push({ x: l.x, y: l.y, rx: 8, ry: 5 });

  const bushes: Bush[] = [];
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(1, 1.25);
    const x = CORE.x + CORE.w / 2 + Math.cos(a) * CORE.w * 0.5 * r, y = CORE.y + CORE.h / 2 + Math.sin(a) * CORE.h * 0.5 * r;
    if (Math.abs(x - streamX(y)) < 100) continue;
    if (tents.some((t) => Math.hypot(t.x - x, (t.y - y) * 1.4) < 110)) continue;
    bushes.push({ x, y, variant: rng.int(0, 1), scale: rng.range(0.8, 1.2) });
    blockers.push({ x, y: y - 10, rx: 28, ry: 14 });
  }

  const trees: Tree[] = [];
  const placed: Pt[] = [];
  let tries = 0;
  const outerRx = rows === 3 ? 760 : 660, outerRy = rows === 3 ? 540 : 470;
  while (trees.length < 420 && tries++ < 14000) {
    const x = rng.range(-400, WORLD.w + 400), y = rng.range(-560, WORLD.h + 640);
    const inCore = x > CORE.x - 20 && x < CORE.x + CORE.w + 20 && y > CORE.y - 20 && y < CORE.y + CORE.h + 30;
    if (inCore && rng.next() > 0.08) continue;
    if (Math.hypot((x - FIRE.x) / outerRx, (y - FIRE.y) / outerRy) < 1) continue;
    if (tents.some((t) => Math.hypot(t.x - x, (t.y - y) * 1.4) < 120)) continue;
    if (Math.abs(x - streamX(y)) < 110 || (Math.abs(y - BRIDGE_Y) < 70 && x > streamX(y) - 200)) continue;
    if (Math.abs(x - 760) < 60 && y > 1150) continue; // bottom path
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 54)) continue;
    placed.push({ x, y });
    const pine = rng.next() < 0.7;
    const scale = rng.range(0.85, 1.3) * (inCore ? 0.9 : 1);
    trees.push({ x, y, kind: pine ? 'pine' : 'round', variant: pine ? rng.int(0, 2) : rng.int(0, 1), scale, phase: rng.range(0, 6.28), tintMix: rng.range(0, 0.25) });
    blockers.push({ x, y, rx: 20 * scale, ry: 10 * scale });
  }
  return { playerCount: n, seed, tents, seats, lanterns, trees, bushes, blockers };
}

export function isWalkable(map: MapLayout, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < WALK_BOUNDS.minX || x > WALK_BOUNDS.maxX || y < WALK_BOUNDS.minY || y > WALK_BOUNDS.maxY) return false;
  const inStream = Math.abs(x - streamX(y)) < 68;
  if (inStream && Math.abs(y - BRIDGE_Y) > 30) return false;
  for (const b of map.blockers) if (((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 < 1) return false;
  return true;
}

// Ghosts cross anything but stay inside the world.
export function inWorld(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= -200 && x <= WORLD.w + 200 && y >= -200 && y <= WORLD.h + 200;
}

// Random walkable point in the camp core (near bank only), away from `avoid` points.
export function wanderPoint(map: MapLayout, rng: Rng, avoid: readonly Pt[] = []): Pt {
  for (let i = 0; i < 60; i++) {
    const x = rng.range(CORE.x + 40, CORE.x + CORE.w - 40), y = rng.range(CORE.y + 140, CORE.y + CORE.h + 120);
    if (x > streamX(y) - 95) continue;
    if (!isWalkable(map, x, y)) continue;
    if (avoid.some((p) => Math.hypot(p.x - x, p.y - y) < 110)) continue;
    return { x, y };
  }
  return { x: FIRE.x, y: FIRE.y + 200 };
}
