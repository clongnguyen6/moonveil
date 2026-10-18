// The costume seam. A costume module draws its pieces through `Brush` into named layers of the unchanged base rig.
// It never sees Pixi, the avatar display object, or other seats. Colours pass through `ctx.color` so every piece
// gets the ghost treatment for free. Pieces are validated against a drawing box so art cannot break the rig.
// PURE except PixiBrush (which adapts to a Pixi Graphics at bake time).

import type { Graphics } from 'pixi.js';

export type Color = number;   // 0xRRGGBB

// Base geometry (feet at 0,0, facing +x). Costume pieces read it; nothing may change it.
export const RIG = {
  head: { x: 0, y: -60, r: 15 },
  torso: { x: -16, y: -48, w: 32, h: 34, r: 10 },
  armL: { x: -21, y: -44, w: 8, h: 22 }, armR: { x: 13, y: -44, w: 8, h: 22 },
  legL: { x: -10, y: -16, w: 9, h: 16 }, legR: { x: 1, y: -16, w: 9, h: 16 },
  shoulderY: -48, crownY: -75, feetY: 0,
  labelAnchorY: -78,         // name label bottom (before layout); tall headgear raises it, see rigCrown()
  // allowed drawing box for costume pieces (world units, base coordinates)
  box: { minX: -40, maxX: 40, minY: -96, maxY: 4 },
  // keep the band beside the head clear for the speaking arcs (drawn at x ≈ ±17..30, y ≈ -72..-48)
  arcsBand: { minX: 20, maxX: 32, minY: -74, maxY: -46 },
} as const;

export type CostumeLayer = 'back' | 'hoodBack' | 'front' | 'hatFront';
// Draw order of the full rig (base slots in lower case, costume slots in brackets):
//   [back] → [hoodBack] → base legs → base torso/arms → base scarf/backpack straps → [front] → base head
//   → base hair (unless hidesHair) → base face → base hat (unless hidesHat) → [hatFront]
export const LAYER_ORDER: readonly CostumeLayer[] = ['back', 'hoodBack', 'front', 'hatFront'];

export interface Brush {
  roundRect(x: number, y: number, w: number, h: number, r: number): Brush;
  circle(x: number, y: number, r: number): Brush;
  ellipse(x: number, y: number, rx: number, ry: number): Brush;
  poly(points: readonly number[]): Brush;
  moveTo(x: number, y: number): Brush; lineTo(x: number, y: number): Brush;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): Brush; closePath(): Brush;
  fill(color: Color, alpha?: number): Brush;
  stroke(color: Color, width?: number, alpha?: number): Brush;
}

// The player's choices for this outfit (wire contract ADR 0011 proposal: variant, color, hat, front, back).
// Pieces branch on them to draw the chosen headgear / items; ids are the art owner's catalog ids.
export interface CostumeChoice { variant: string; color: Color; hat: string; front: string; back: string }

export interface CostumeContext {
  readonly b: Brush;            // draw here; base coordinates, facing +x (the rig flips the whole texture)
  readonly rig: typeof RIG;
  readonly ghost: boolean;
  readonly seed: number;        // per-seat hash for harmless variation; never role-related
  readonly choice: CostumeChoice;
  color(c: Color): Color;       // maps a design colour to the ghost palette when ghost, else returns it
  outline(c: Color): Color;     // the base's soft outline colour for a fill colour
}

export interface Costume {
  id: string;                   // lowercase, stable
  top?: Color;                  // body/top colour override (design colour; ghost-mapped by the rig); choice.color wins when set
  hidesHair?: boolean;          // hoods and full caps
  hidesHat?: boolean;           // replaces the base hat slot
  crownY?: number | ((choice: CostumeChoice) => number);   // highest point the headgear reaches (negative, e.g. -90); default RIG.crownY
  pieces: Partial<Record<CostumeLayer, (ctx: CostumeContext) => void>>;
}
export const DEFAULT_CHOICE: CostumeChoice = { variant: 'default', color: 0, hat: 'none', front: 'none', back: 'none' };
export function crownOf(c: Costume | null | undefined, choice: CostumeChoice = DEFAULT_CHOICE): number {
  const v = c?.crownY; return typeof v === 'function' ? v(choice) : v ?? RIG.crownY;
}

// ---- colours ----
export const GHOST = { skin: 0xdbe8ff, top: 0xc3d4f5, pants: 0xb4c6ec, hair: 0xa7b8dd, hat: 0xb9c8ea, extra: 0xd0dcf5 } as const;
export function ghostTint(c: Color): Color {
  // luminance of the design colour picks a tone between the existing ghost palette extremes (hair .. skin):
  // always pale and bluish, keeps light/dark relationships between pieces
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const lo = [0xa7, 0xb8, 0xdd], hi = [0xdb, 0xe8, 0xff];
  const mix = (i: number) => Math.round(lo[i]! + (hi[i]! - lo[i]!) * l);
  return (mix(0) << 16) | (mix(1) << 8) | mix(2);
}
export function shadeColor(c: Color, f: number): Color {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (k((c >> 16) & 255) << 16) | (k((c >> 8) & 255) << 8) | k(c & 255);
}

export function makeContext(b: Brush, ghost: boolean, seed: number, choice: CostumeChoice = DEFAULT_CHOICE): CostumeContext {
  return { b, rig: RIG, ghost, seed, choice, color: (c) => (ghost ? ghostTint(c) : c), outline: (c) => shadeColor(c, 0.55) };
}

// crown of the full rig for a costume (used for label clearance): the label sits 6 above it when taller than the base
export function rigCrown(c: Costume | null | undefined, choice: CostumeChoice = DEFAULT_CHOICE): number { return Math.min(RIG.crownY, crownOf(c, choice)); }
export function labelAnchorFor(c: Costume | null | undefined, choice: CostumeChoice = DEFAULT_CHOICE): number {
  const crown = rigCrown(c, choice);
  return crown < RIG.crownY ? Math.min(RIG.labelAnchorY, crown - 6) : RIG.labelAnchorY;   // only headgear taller than the base crown lifts the label
}

// ---- recording brush (node-testable): records commands and tracks bounds ----
export interface Recorded { ops: string[]; minX: number; maxX: number; minY: number; maxY: number; fills: Color[] }
export class RecordingBrush implements Brush {
  rec: Recorded = { ops: [], minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, fills: [] };
  private pt(x: number, y: number) { const r = this.rec; r.minX = Math.min(r.minX, x); r.maxX = Math.max(r.maxX, x); r.minY = Math.min(r.minY, y); r.maxY = Math.max(r.maxY, y); }
  roundRect(x: number, y: number, w: number, h: number, r: number) { this.rec.ops.push('roundRect'); this.pt(x, y); this.pt(x + w, y + h); void r; return this; }
  circle(x: number, y: number, r: number) { this.rec.ops.push('circle'); this.pt(x - r, y - r); this.pt(x + r, y + r); return this; }
  ellipse(x: number, y: number, rx: number, ry: number) { this.rec.ops.push('ellipse'); this.pt(x - rx, y - ry); this.pt(x + rx, y + ry); return this; }
  poly(points: readonly number[]) { this.rec.ops.push('poly'); for (let i = 0; i + 1 < points.length; i += 2) this.pt(points[i]!, points[i + 1]!); return this; }
  moveTo(x: number, y: number) { this.rec.ops.push('moveTo'); this.pt(x, y); return this; }
  lineTo(x: number, y: number) { this.rec.ops.push('lineTo'); this.pt(x, y); return this; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.rec.ops.push('quad'); this.pt(cx, cy); this.pt(x, y); return this; }
  closePath() { this.rec.ops.push('closePath'); return this; }
  fill(color: Color, alpha?: number) { this.rec.ops.push('fill'); this.rec.fills.push(color); void alpha; return this; }
  stroke(color: Color, width?: number, alpha?: number) { this.rec.ops.push('stroke'); void color; void width; void alpha; return this; }
}

export interface CostumeReport { id: string; layers: CostumeLayer[]; bounds: { minX: number; maxX: number; minY: number; maxY: number }; insideBox: boolean; arcsClear: boolean; crownOk: boolean; ghostPale: boolean }

// Runs every piece of a costume through recording brushes (living and ghost) and checks the rules.
export function inspectCostume(c: Costume, seed = 1): CostumeReport {
  const layers: CostumeLayer[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let arcsClear = true;
  let ghostPale = true;
  for (const layer of LAYER_ORDER) {
    const piece = c.pieces[layer]; if (!piece) continue;
    layers.push(layer);
    for (const ghost of [false, true]) {
      const b = new RecordingBrush(); piece(makeContext(b, ghost, seed));
      const r = b.rec;
      if (r.ops.length === 0) continue;
      minX = Math.min(minX, r.minX); maxX = Math.max(maxX, r.maxX); minY = Math.min(minY, r.minY); maxY = Math.max(maxY, r.maxY);
      if (layer === 'hatFront' || layer === 'front') {
        // headgear must not intrude into the speaking-arcs band beside the head
        const a = RIG.arcsBand;
        if (r.maxX > a.minX && r.minX < a.maxX && r.maxY > a.minY && r.minY < a.maxY && layer === 'hatFront' && r.maxX > a.minX + 4) arcsClear = false;
      }
      if (ghost) for (const f of r.fills) { const rr = (f >> 16) & 255, gg = (f >> 8) & 255, bb = f & 255; if (bb < rr || bb < gg || rr + gg + bb < 3 * 120) ghostPale = false; }
    }
  }
  const box = RIG.box;
  const insideBox = minX >= box.minX && maxX <= box.maxX && minY >= box.minY && maxY <= box.maxY;
  const crownOk = crownOf(c) <= minY + 2;   // declared crown must cover the drawn top
  return { id: c.id, layers, bounds: { minX, maxX, minY, maxY }, insideBox, arcsClear, crownOk, ghostPale };
}

// ---- Pixi brush (bake time) ----
export class PixiBrush implements Brush {
  private g: Graphics;
  constructor(g: Graphics) { this.g = g; }
  roundRect(x: number, y: number, w: number, h: number, r: number) { this.g.roundRect(x, y, w, h, r); return this; }
  circle(x: number, y: number, r: number) { this.g.circle(x, y, r); return this; }
  ellipse(x: number, y: number, rx: number, ry: number) { this.g.ellipse(x, y, rx, ry); return this; }
  poly(points: readonly number[]) { this.g.poly([...points]); return this; }
  moveTo(x: number, y: number) { this.g.moveTo(x, y); return this; }
  lineTo(x: number, y: number) { this.g.lineTo(x, y); return this; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.g.quadraticCurveTo(cx, cy, x, y); return this; }
  closePath() { this.g.closePath(); return this; }
  fill(color: Color, alpha = 1) { this.g.fill({ color, alpha }); return this; }
  stroke(color: Color, width = 2, alpha = 0.6) { this.g.stroke({ color, width, alpha, join: 'round', cap: 'round' }); return this; }
}
