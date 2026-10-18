// Name-label layout in screen space. PURE. Labels are clamped inside the visible area (minus HUD safe insets)
// and nudged upward so neighbours never overlap. Used every frame for ≤ 16 labels; O(n²) with n ≤ 16 is fine.
export interface LabelRect { id: string; x: number; y: number; w: number; h: number }   // x,y = centre-bottom anchor, screen px
export interface Viewport { w: number; h: number; top: number; right: number; bottom: number; left: number }
export interface LabelOffset { id: string; dx: number; dy: number; displaced: boolean }   // displaced: moved enough that a leader line helps

const PAD = 4;
export const DEFAULT_MAX_LIFT = 1;   // at most this many label heights of upward nudge (v1 used 3)
const LEADER_THRESHOLD = 6;          // px of displacement from which a leader line is drawn

export function layoutLabels(labels: readonly LabelRect[], vp: Viewport, maxLift = DEFAULT_MAX_LIFT): LabelOffset[] {
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
    // 2. resolve overlaps: lift up to maxLift label heights, then slide sideways away from whatever is hit
    let lifts = 0, slides = 0;
    for (let guard = 0; guard < 40; guard++) {
      const l = cx - hw, r = cx + hw, t = bottom - lb.h, b = bottom;
      const hit = placed.find((p) => l < p.r - 1 && r > p.l + 1 && t < p.b - 1 && b > p.t + 1);
      if (!hit) break;
      if (lifts < maxLift && bottom - lb.h - (lb.h + 2) >= minY) { bottom = hit.t - 2; lifts++; continue; }
      if (slides >= 8) break;   // accept a residual overlap rather than loop forever (extremely dense rings)
      const hitCx = (hit.l + hit.r) / 2, dir = slides % 2 === 0 ? (cx < hitCx ? -1 : 1) : (cx < hitCx ? 1 : -1);
      const needed = hw + (hit.r - hit.l) / 2 - Math.abs(cx - hitCx) + 2;
      const next = cx + dir * needed;
      cx = Math.min(Math.max(next, minX + hw), maxX - hw);
      slides++;
    }
    placed.push({ id: lb.id, l: cx - hw, r: cx + hw, t: bottom - lb.h, b: bottom, ox: cx - lb.x, oy: bottom - lb.y });
    const dx = cx - lb.x, dy = bottom - lb.y;
    out.push({ id: lb.id, dx, dy, displaced: Math.hypot(dx, dy) >= LEADER_THRESHOLD });
  }
  return out;
}

// Stage layers bottom to top; the scene builds its stage from this list. Name labels (+ leaders) come after every
// layer that draws scene effects or light (fire, glow, sparks, smoke, fog, fireflies, ghost aura), so effects never cover them.
export const STAGE_ORDER = ['world', 'lighting', 'nightTint', 'emissive', 'fx', 'labels', 'vignette'] as const;
export type StageLayer = (typeof STAGE_ORDER)[number];
export const EFFECT_LAYERS: readonly StageLayer[] = ['world', 'lighting', 'nightTint', 'emissive', 'fx'];
export function labelsAboveEffects(order: readonly string[]): boolean {
  const at = order.indexOf('labels');
  return at >= 0 && EFFECT_LAYERS.every((l) => { const i = order.indexOf(l); return i >= 0 && i < at; });
}
