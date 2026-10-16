// Pose interpolation buffer. PURE. Keeps the last two poses per seat and samples between them with a small delay.
import type { Pose, PoseFrame, SeatId } from './types.ts';

export const POSE_DELAY_MS = 120;     // render this far behind the newest pose to interpolate across 10 Hz frames
export const POSE_STALE_MS = 3000;    // no pose for this long: the seat is no longer shown (ghosts) or frozen (lobby)

interface Entry { prev: Pose | null; prevAt: number; next: Pose; nextAt: number }

export class PoseBuffer {
  private entries = new Map<SeatId, Entry>();

  push(frame: PoseFrame, now: number): void {
    for (const p of frame.poses) {
      const e = this.entries.get(p.seat);
      if (e) { e.prev = e.next; e.prevAt = e.nextAt; e.next = p; e.nextAt = now; }
      else this.entries.set(p.seat, { prev: null, prevAt: now, next: p, nextAt: now });
    }
  }

  has(seat: SeatId): boolean { return this.entries.has(seat); }
  drop(seat: SeatId): void { this.entries.delete(seat); }
  seats(): SeatId[] { return [...this.entries.keys()]; }

  fresh(seat: SeatId, now: number): boolean {
    const e = this.entries.get(seat);
    return !!e && now - e.nextAt < POSE_STALE_MS;
  }

  sample(seat: SeatId, now: number): Pose | null {
    const e = this.entries.get(seat);
    if (!e) return null;
    const t = now - POSE_DELAY_MS;
    if (!e.prev || t >= e.nextAt || e.nextAt === e.prevAt) return { ...e.next, moving: e.next.moving && now - e.nextAt < POSE_STALE_MS };
    if (t <= e.prevAt) return e.prev;
    const u = (t - e.prevAt) / (e.nextAt - e.prevAt);
    return { seat, x: e.prev.x + (e.next.x - e.prev.x) * u, y: e.prev.y + (e.next.y - e.prev.y) * u, facing: e.next.facing, moving: e.prev.moving || e.next.moving };
  }
}
