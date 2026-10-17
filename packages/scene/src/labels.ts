// Name-label layout in screen space. PURE. Labels are clamped inside the visible area (minus HUD safe insets)
// and nudged upward so neighbours never overlap. Used every frame for ≤ 16 labels; O(n²) with n ≤ 16 is fine.
export interface LabelRect { id: string; x: number; y: number; w: number; h: number }   // x,y = centre-bottom anchor, screen px
export interface Viewport { w: number; h: number; top: number; right: number; bottom: number; left: number }
export interface LabelOffset { id: string; dx: number; dy: number }

const PAD = 4;
const MAX_LIFT = 3;   // at most this many label heights of upward nudge

export function layoutLabels(labels: readonly LabelRect[], vp: Viewport): LabelOffset[] {
  const minX = vp.left + PAD, maxX = vp.w - vp.right - PAD, minY = vp.top + PAD, maxY = vp.h - vp.bottom - PAD;
  // 1. clamp into the visible area
  const placed: { id: string; l: number; r: number; t: number; b: number; ox: number; oy: number }[] = [];
  const out: LabelOffset[] = [];
  // process from the bottom of the screen upward so lower labels keep their place and upper ones move up
  const order = [...labels].sort((a, b) => b.y - a.y);
  for (const lb of order) {
    const hw = lb.w / 2;
    let cx = Math.min(Math.max(lb.x, minX + hw), maxX - hw);
    let bottom = Math.min(Math.max(lb.y, minY + lb.h), maxY);
    // 2. resolve overlaps by lifting
    let lifts = 0;
    for (let guard = 0; guard < 32; guard++) {
      const l = cx - hw, r = cx + hw, t = bottom - lb.h, b = bottom;
      const hit = placed.find((p) => l < p.r - 1 && r > p.l + 1 && t < p.b - 1 && b > p.t + 1);
      if (!hit) break;
      if (lifts >= MAX_LIFT) { // give up lifting: slide sideways instead, away from the hit
        const dir = cx < (hit.l + hit.r) / 2 ? -1 : 1;
        cx = Math.min(Math.max(cx + dir * (hw + (hit.r - hit.l) / 2 - Math.abs(cx - (hit.l + hit.r) / 2) + 2), minX + hw), maxX - hw);
        break;
      }
      bottom = hit.t - 2; lifts++;
      if (bottom - lb.h < minY) { bottom = minY + lb.h; break; }
    }
    placed.push({ id: lb.id, l: cx - hw, r: cx + hw, t: bottom - lb.h, b: bottom, ox: cx - lb.x, oy: bottom - lb.y });
    out.push({ id: lb.id, dx: cx - lb.x, dy: bottom - lb.y });
  }
  return out;
}
