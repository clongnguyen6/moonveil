// Memorials at dead players' campfire seats (when and where: staging.ts + memorial.ts). A small rounded headstone with a
// white flower (Normal) or a tiny pumpkin (Halloween), and the player's name in the label layer (muted italic, laid out
// with the seat labels). Static: baked once per variant; per frame only fades in progress.
import { Container, Graphics, Text } from 'pixi.js';
import { type TextureBank, type Baked, spriteOf } from './textures.ts';
import { memorialAt } from './memorial.ts';
import type { MapLayout } from './map.ts';
import type { Sprite } from 'pixi.js';

export type MemorialVariant = 'normal' | 'halloween';
const STONE = 0x9aa0a6, STONE_FACE = 0xb4b9bd, STONE_LINE = 0x5d6267, MOSS = 0x6f8f4e;

// base at (0,0): tablet 17 wide, 22 tall; decoration tucked inside the 22 x 24 footprint (memorial.ts STONE)
export function drawMemorial(variant: MemorialVariant): Graphics {
  const g = new Graphics();
  g.ellipse(0, 0, 11, 3).fill({ color: 0x000000, alpha: 0.2 });
  g.moveTo(-8.5, 0).lineTo(-8.5, -14).quadraticCurveTo(-8.5, -22, 0, -22).quadraticCurveTo(8.5, -22, 8.5, -14).lineTo(8.5, 0).closePath()
    .fill(STONE).stroke({ width: 1.4, color: STONE_LINE, alpha: 0.7, join: 'round' });
  g.moveTo(-5, -2).lineTo(-5, -13).quadraticCurveTo(-5, -18, 0, -18).quadraticCurveTo(5, -18, 5, -13).lineTo(5, -2).closePath().fill({ color: STONE_FACE, alpha: 0.7 });
  g.moveTo(-2.5, -12).lineTo(2.5, -12).stroke({ width: 1, color: STONE_LINE, alpha: 0.6, cap: 'round' });
  g.moveTo(-2.5, -9).lineTo(2.5, -9).stroke({ width: 1, color: STONE_LINE, alpha: 0.45, cap: 'round' });
  g.ellipse(-6, -1, 3.5, 1.4).fill({ color: MOSS, alpha: 0.9 });
  if (variant === 'normal') {
    g.moveTo(7, 0).lineTo(7.5, -4.5).stroke({ width: 1, color: 0x4f7a3a });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.circle(7.5 + Math.cos(a) * 1.8, -5.5 + Math.sin(a) * 1.8, 1.25).fill(0xf6f1e4); }
    g.circle(7.5, -5.5, 0.9).fill(0xf0c060);
  } else {
    g.ellipse(7, -2.8, 3.8, 2.9).fill(0xe8862a); g.ellipse(7, -2.8, 1.4, 2.9).fill({ color: 0xc9661b, alpha: 0.8 });
    g.moveTo(7, -5.5).lineTo(7.5, -7).stroke({ width: 1.1, color: 0x6b8a3a, cap: 'round' });
  }
  return g;
}

interface Entry { stone: Sprite; label: Text; alpha: number; to: number; labelAt: { x: number; y: number }; index: number }

export class Memorials {
  private bank: TextureBank; private objects: Container; private labels: Container;
  private tex = new Map<MemorialVariant, Baked>();
  private variant: MemorialVariant = 'normal';
  readonly entries = new Map<string, Entry>();
  constructor(bank: TextureBank, objects: Container, labels: Container) { this.bank = bank; this.objects = objects; this.labels = labels; }

  private texture(v: MemorialVariant): Baked { let b = this.tex.get(v); if (!b) { b = this.bank.bake(drawMemorial(v), 0, 0, 3); this.tex.set(v, b); } return b; }

  set(seat: string, index: number, name: string, on: boolean, fade: boolean, map: MapLayout) {
    const cur = this.entries.get(seat);
    if (!on) { if (cur) { cur.stone.destroy(); cur.label.destroy(); this.entries.delete(seat); } return; }
    const at = memorialAt(map, index); if (!at || cur) return;
    const stone = spriteOf(this.texture(this.variant)); stone.position.set(at.base.x, at.base.y); stone.zIndex = at.base.y - 1;   // behind the empty stump
    const label = new Text({ text: name, style: { fontFamily: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif', fontSize: 12, fontWeight: '600', fontStyle: 'italic', fill: 0xe4ded2, stroke: { color: 0x1a1410, width: 3 }, align: 'center' } });
    label.anchor.set(0.5, 1); label.resolution = 2; label.position.set(at.labelAt.x, at.labelAt.y); label.zIndex = at.base.y;
    const a = fade ? 0 : 1; stone.alpha = a; label.alpha = a;
    this.objects.addChild(stone); this.labels.addChild(label);
    this.entries.set(seat, { stone, label, alpha: a, to: 1, labelAt: at.labelAt, index });
  }

  setVariant(v: MemorialVariant) {
    if (v === this.variant) return; this.variant = v;
    for (const e of this.entries.values()) e.stone.texture = this.texture(v).texture;
  }

  // world container replaced (map rebuild, lobby only): move the stones over
  attachTo(objects: Container) { for (const e of this.entries.values()) objects.addChild(e.stone); this.objects = objects; }

  // fades in progress; label scale/size follow the seat labels
  update(dt: number, labelScale: number, fontPx: number) {
    for (const e of this.entries.values()) {
      if (e.alpha < e.to) { e.alpha = Math.min(e.to, e.alpha + dt / 0.6); e.stone.alpha = e.alpha; }
      e.label.scale.set(labelScale);
      if (e.label.style.fontSize !== fontPx) e.label.style.fontSize = fontPx;
    }
  }
  // final label alpha: fade progress x name policy (memorial.ts memorialNameShown)
  showName(seat: string, shown: boolean) { const e = this.entries.get(seat); if (e) { e.label.visible = shown; e.label.alpha = e.alpha * 0.92; } }
}
