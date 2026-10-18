// The costume seam. A costume module draws its pieces through `Brush` into named layers of the unchanged base rig.
// It never sees Pixi, the avatar display object, or other seats. Colours pass through `ctx.color` so every piece
// gets the ghost treatment for free. Pieces are validated against a drawing box so art cannot break the rig.
// PURE except PixiBrush (which adapts to a Pixi Graphics at bake time).
// Who draws what: the base rig draws body, hair (unless hidesHair) and, for the camper look only, the base hat, scarf and
// backpack. A registered outfit costume draws every item the player chose (hat, front, back); the base draws none of them.

import type { Graphics } from 'pixi.js';
import { TOP_COLORS } from './appearance.ts';
import { TOPS } from './types.ts';

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
//   [back] → camper backpack → camper hood / long hair → [hoodBack] → base legs → base torso/arms → camper scarf → [front] → base head
//   → base hair (unless hidesHair) → base face → camper hat → [hatFront]      (camper = no outfit costume)
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

// The choices a costume draws: its row of the wire catalog (protocol OUTFITS), colour ids optional (default: all).
// Inspection runs every combination. Omit only if no piece reads ctx.choice (inspection checks that).
export interface CostumeOptions { variants: readonly string[]; hats: readonly string[]; fronts: readonly string[]; backs: readonly string[]; colors?: readonly string[] }

export interface Costume {
  id: string;                   // = wire OutfitId (camelCase, e.g. 'bowCat'), stable
  top?: Color;                  // body/top colour override (design colour; ghost-mapped by the rig); choice.color wins when set
  hidesHair?: boolean;          // hoods and full caps
  /** @deprecated no effect: an outfit costume never gets the base hat, scarf or backpack (it draws its own) */
  hidesHat?: boolean;
  crownY?: number | ((choice: CostumeChoice) => number);   // highest point the headgear reaches (negative, e.g. -90); default RIG.crownY
  options?: CostumeOptions;
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
  // ghost outlines take the ghost tint too (of the shaded colour, so they stay darker than the fill)
  return { b, rig: RIG, ghost, seed, choice, color: (c) => (ghost ? ghostTint(c) : c), outline: (c) => (ghost ? ghostTint(shadeColor(c, 0.55)) : shadeColor(c, 0.55)) };
}

// crown of the full rig for a costume (used for label clearance): the label sits 6 above it when taller than the base
export function rigCrown(c: Costume | null | undefined, choice: CostumeChoice = DEFAULT_CHOICE): number { return Math.min(RIG.crownY, crownOf(c, choice)); }
export function labelAnchorFor(c: Costume | null | undefined, choice: CostumeChoice = DEFAULT_CHOICE): number {
  const crown = rigCrown(c, choice);
  return crown < RIG.crownY ? Math.min(RIG.labelAnchorY, crown - 6) : RIG.labelAnchorY;   // only headgear taller than the base crown lifts the label
}

// ---- recording brush (node-testable) ----
// rec min/max: extent of all geometry (exact for curves, no stroke width). rec.shapes: each painted shape's extent,
// padded by half its stroke width; the inspection uses these.
export interface Bounds { minX: number; maxX: number; minY: number; maxY: number }
export interface Recorded extends Bounds { ops: string[]; fills: Color[]; strokes: Color[]; shapes: Bounds[] }
const emptyBounds = (): Bounds => ({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
export class RecordingBrush implements Brush {
  rec: Recorded = { ops: [], ...emptyBounds(), fills: [], strokes: [], shapes: [] };
  #path = emptyBounds();
  #painted = false;      // a fill/stroke ends the path; the next geometry starts a new shape
  #cur: [number, number] = [0, 0];
  #pt(x: number, y: number) {
    if (this.#painted) { this.#path = emptyBounds(); this.#painted = false; }
    for (const p of [this.#path, this.rec]) { p.minX = Math.min(p.minX, x); p.maxX = Math.max(p.maxX, x); p.minY = Math.min(p.minY, y); p.maxY = Math.max(p.maxY, y); }
  }
  #shape(pad: number) {
    const p = this.#path;
    this.rec.shapes.push({ minX: p.minX - pad, maxX: p.maxX + pad, minY: p.minY - pad, maxY: p.maxY + pad });
    this.#painted = true;
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) { this.rec.ops.push('roundRect'); this.#pt(x, y); this.#pt(x + w, y + h); void r; return this; }
  circle(x: number, y: number, r: number) { this.rec.ops.push('circle'); this.#pt(x - r, y - r); this.#pt(x + r, y + r); return this; }
  ellipse(x: number, y: number, rx: number, ry: number) { this.rec.ops.push('ellipse'); this.#pt(x - rx, y - ry); this.#pt(x + rx, y + ry); return this; }
  poly(points: readonly number[]) { this.rec.ops.push('poly'); for (let i = 0; i + 1 < points.length; i += 2) this.#pt(points[i]!, points[i + 1]!); return this; }
  moveTo(x: number, y: number) { this.rec.ops.push('moveTo'); this.#pt(x, y); this.#cur = [x, y]; return this; }
  lineTo(x: number, y: number) { this.rec.ops.push('lineTo'); this.#pt(x, y); this.#cur = [x, y]; return this; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.rec.ops.push('quad');
    // exact extent: end point plus the curve's extremum per axis (not the control point)
    const ext = (a: number, c: number, b: number) => { const d = a - 2 * c + b; const t = d ? (a - c) / d : -1; return t > 0 && t < 1 ? (1 - t) ** 2 * a + 2 * t * (1 - t) * c + t * t * b : b; };
    const [sx, sy] = this.#cur;
    this.#pt(x, y); this.#pt(ext(sx, cx, x), ext(sy, cy, y)); this.#cur = [x, y]; return this;
  }
  closePath() { this.rec.ops.push('closePath'); return this; }
  fill(color: Color, alpha?: number) { this.rec.ops.push('fill'); this.rec.fills.push(color); void alpha; this.#shape(0); return this; }
  stroke(color: Color, width = 2, alpha?: number) { this.rec.ops.push('stroke'); this.rec.strokes.push(color); void alpha; this.#shape(width / 2); return this; }
}

export interface CostumeReport { id: string; layers: CostumeLayer[]; bounds: Bounds; insideBox: boolean; arcsClear: boolean; crownOk: boolean; ghostPale: boolean; choicesDeclared: boolean; failures: string[] }

// Every choice combination the costume declares (DEFAULT_CHOICE only when it declares none).
export function choicesOf(c: Costume): CostumeChoice[] {
  const o = c.options;
  if (!o) return [DEFAULT_CHOICE];
  const colors = (o.colors ?? TOPS).map((id) => (TOP_COLORS as Record<string, number>)[id] ?? -1);
  const out: CostumeChoice[] = [];
  for (const variant of o.variants) for (const color of colors) for (const hat of o.hats) for (const front of o.fronts) for (const back of o.backs) out.push({ variant, color, hat, front, back });
  return out;
}

const pale = (f: Color) => { const r = (f >> 16) & 255, g = (f >> 8) & 255, b = f & 255; return b >= r && b >= g && r + g + b >= 3 * 120; };
const overlaps = (s: Bounds, a: Bounds) => s.maxX > a.minX && s.minX < a.maxX && s.maxY > a.minY && s.minY < a.maxY;
// true when any piece or crownY reads a field of ctx.choice (then the costume must declare its options)
function readsChoice(c: Costume): boolean {
  let read = false;
  const probe = new Proxy({ ...DEFAULT_CHOICE }, { get: (t, k) => { read = true; return t[k as keyof CostumeChoice]; } });
  crownOf(c, probe);
  for (const l of LAYER_ORDER) for (const ghost of [false, true]) c.pieces[l]?.(makeContext(new RecordingBrush(), ghost, 1, probe));
  return read;
}

// Runs every piece of a costume, for every declared choice, through recording brushes (living and ghost) and checks
// the rules: drawing box, speaking-arcs band (all layers), declared crown covers the drawing, ghost fills and outlines pale.
export function inspectCostume(c: Costume, seed = 1): CostumeReport {
  const layers = new Set<CostumeLayer>();
  const all = emptyBounds();
  const failures: string[] = [];
  const fail = (rule: string, choice: CostumeChoice, layer?: CostumeLayer) => { const m = `${rule} ${JSON.stringify(choice)}${layer ? ' ' + layer : ''}`; if (!failures.includes(m)) failures.push(m); };
  let insideBox = true, arcsClear = true, crownOk = true, ghostPale = true;
  const choicesDeclared = !!c.options || !readsChoice(c);
  if (!choicesDeclared) failures.push('pieces read ctx.choice but the costume declares no options');
  for (const choice of choicesOf(c)) {
    if (choice.color < 0) { failures.push(`unknown colour id in options ${JSON.stringify(c.options?.colors)}`); continue; }
    let top = Infinity;
    for (const layer of LAYER_ORDER) {
      const piece = c.pieces[layer]; if (!piece) continue;
      for (const ghost of [false, true]) {
        const b = new RecordingBrush(); piece(makeContext(b, ghost, seed, choice));
        const rec = b.rec;
        if (rec.shapes.length === 0) continue;   // nothing painted
        const r = rec.shapes.reduce((u, s) => ({ minX: Math.min(u.minX, s.minX), maxX: Math.max(u.maxX, s.maxX), minY: Math.min(u.minY, s.minY), maxY: Math.max(u.maxY, s.maxY) }), emptyBounds());
        layers.add(layer);
        all.minX = Math.min(all.minX, r.minX); all.maxX = Math.max(all.maxX, r.maxX); all.minY = Math.min(all.minY, r.minY); all.maxY = Math.max(all.maxY, r.maxY);
        top = Math.min(top, r.minY);
        const box = RIG.box;
        if (r.minX < box.minX || r.maxX > box.maxX || r.minY < box.minY || r.maxY > box.maxY) { insideBox = false; fail('outside box', choice, layer); }
        if (rec.shapes.some((s) => overlaps(s, RIG.arcsBand))) { arcsClear = false; fail('in speaking-arcs band', choice, layer); }
        if (ghost && ![...rec.fills, ...rec.strokes].every(pale)) { ghostPale = false; fail('ghost colour not pale', choice, layer); }
      }
    }
    if (top < Infinity && crownOf(c, choice) > top + 2) { crownOk = false; fail(`crownY ${crownOf(c, choice)} below drawn top ${top}`, choice); }
  }
  const order = LAYER_ORDER.filter((l) => layers.has(l));
  return { id: c.id, layers: order, bounds: all, insideBox, arcsClear, crownOk, ghostPale, choicesDeclared, failures };
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
