// Adapters between the scene's world-unit poses and the server's wire poses. PURE.
// Server today (foundation-3): `move {x, y ∈ [0,1], facing: number, moving}` and `poses` with the same shape (PROVISIONAL).
// Proposal in docs/visual/POSES.md: the server adopts world units from `@moonveil/scene/map`. Until then, convert here.
import { WORLD } from './map.ts';
import type { Pose, PoseFrame, SeatId } from './types.ts';

export interface WirePose { seat: SeatId; x: number; y: number; facing: number; moving: boolean }
export interface WireMove { x: number; y: number; facing: number; moving: boolean }
export type PoseUnits = 'world' | 'normalized';

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function facingSign(f: number): 1 | -1 { return f < 0 ? -1 : 1; }

// Scene → server `move` payload.
export function toWireMove(p: Pose, units: PoseUnits): WireMove {
  if (units === 'world') return { x: Math.round(p.x), y: Math.round(p.y), facing: p.facing, moving: p.moving };
  return { x: +clamp01(p.x / WORLD.w).toFixed(4), y: +clamp01(p.y / WORLD.h).toFixed(4), facing: p.facing, moving: p.moving };
}

// Server `poses` frame → scene PoseFrame (world units).
export function fromWirePoses(poses: readonly WirePose[], units: PoseUnits): PoseFrame {
  return {
    poses: poses.map((w) => ({
      seat: w.seat,
      x: units === 'world' ? w.x : clamp01(w.x) * WORLD.w,
      y: units === 'world' ? w.y : clamp01(w.y) * WORLD.h,
      facing: facingSign(w.facing),
      moving: !!w.moving,
    })),
  };
}
