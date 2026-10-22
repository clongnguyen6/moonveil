// "Cute Halloween" theme overlay (player opt-in, see themes/index.ts). A separate lazy chunk: the scene imports this
// module only when the theme is first chosen.
// Everything is baked once; sprites are static. Per frame: nothing on `low` or reduced motion unless the night level
// changed; on `high`, gentle pumpkin flicker, bulb twinkle and ornament sway.
// Layers: pumpkins, ornaments and wires in the world (depth-sorted); leaves on the ground; glows in `emissive`;
// pumpkin light in the lightmap. All below the label layer.
import { Container, Graphics, Sprite } from 'pixi.js';
import { type TextureBank, type Baked, spriteOf } from '../textures.ts';
import type { Lighting } from '../lighting.ts';
import type { World } from '../world.ts';
import { halloweenLayout, type HalloweenLayout } from './halloween-layout.ts';

// Palette (docs/visual/halloween/PALETTE.md, art-halloween 5333b83): warm, cosy, a little mysterious. One place to swap.
export const HALLOWEEN = {
  pumpkin: 0xf08a24, pumpkinShade: 0xc9661b, pumpkinLight: 0xffb35a, stem: 0x6b8a3a, carve: 0x4a2412, carveGlow: 0xffd36b,
  bulbOrange: 0xffa040, bulbPurple: 0xb07ae8, wire: 0x3a2e2a,
  ghost: 0xfff5e6, ghostShade: 0xefdcc4, ghostLine: 0xa88a6e, ghostEye: 0x3a2a2a, blush: 0xf4a29a, bow: 0xf08a24,
  leaves: [0xd9772a, 0xb0582a, 0xe3a838] as const,
} as const;
const P = HALLOWEEN;
// Night colours (scene base: ambient 0x3a3c92, wash 0x6a5aa8). Warmer plum kept to the night shadows; the stream stays
// blue and the grass green (PALETTE.md: plum accent #302436, no global purple wash).
export const HALLOWEEN_NIGHT = { ambient: 0x40387c, wash: 0x5c3a5e } as const;
const soft = (c: number, w = 1.6) => ({ width: w, color: c, alpha: 0.7, join: 'round' as const, cap: 'round' as const });

// Pumpkin, base at (0,0), ~28 wide. variant 0: carved grin, 1: happy closed eyes, 2: plain.
export function drawPumpkin(variant: 0 | 1 | 2, faceOnly = false): Graphics {
  const g = new Graphics();
  if (!faceOnly) {
    g.ellipse(0, -1, 15, 4).fill({ color: 0x000000, alpha: 0.18 });
    for (const [dx, rx, c] of [[-7, 8, P.pumpkinShade], [7, 8, P.pumpkinShade], [-3.5, 8, P.pumpkin], [3.5, 8, P.pumpkin], [0, 6.5, P.pumpkinLight]] as const) g.ellipse(dx, -10, rx, 10).fill(c);
    g.ellipse(0, -10, 14, 10).stroke(soft(P.pumpkinShade, 1.4));
    g.moveTo(0, -19).quadraticCurveTo(1, -24, 3, -26).stroke({ width: 3, color: P.stem, cap: 'round' });
    g.moveTo(2, -24).quadraticCurveTo(8, -27, 7, -22).stroke({ width: 1.2, color: P.stem, cap: 'round' });
  }
  const c = faceOnly ? P.carveGlow : P.carve;
  if (variant === 0) {
    g.poly([-8, -12, -4, -12, -6, -16]).fill(c); g.poly([4, -12, 8, -12, 6, -16]).fill(c);
    g.moveTo(-7, -8).quadraticCurveTo(0, -3, 7, -8).quadraticCurveTo(0, -5.5, -7, -8).fill(c);
  } else if (variant === 1) {
    g.moveTo(-8, -12).quadraticCurveTo(-5.5, -15, -3, -12).stroke({ width: 1.6, color: c, cap: 'round' });
    g.moveTo(3, -12).quadraticCurveTo(5.5, -15, 8, -12).stroke({ width: 1.6, color: c, cap: 'round' });
    g.moveTo(-3, -8).quadraticCurveTo(0, -5, 3, -8).stroke({ width: 1.6, color: c, cap: 'round' });
  }
  return g;
}

// Decorative ghost ornament: a small warm-ivory sheet ghost hanging on a thread with an orange bow.
// Hang point (thread top) at (0,0); ~18 wide, ~32 tall incl. thread. Unlike a real ghost (pale blue camper,
// ~80 tall, arms, tail, aura, wisps): no head/arms/tail, warm colour, no glow, tied to the string lights.
export function drawGhostOrnament(): Graphics {
  const g = new Graphics();
  g.moveTo(0, 0).lineTo(0, 10).stroke({ width: 1, color: P.wire, alpha: 0.8 });
  const top = 10;
  g.moveTo(-9, top + 22).lineTo(-9, top + 10).quadraticCurveTo(-9, top, 0, top).quadraticCurveTo(9, top, 9, top + 10).lineTo(9, top + 22)
    .quadraticCurveTo(7.5, top + 19, 6, top + 22).quadraticCurveTo(4.5, top + 19, 3, top + 22).quadraticCurveTo(1.5, top + 19, 0, top + 22)
    .quadraticCurveTo(-1.5, top + 19, -3, top + 22).quadraticCurveTo(-4.5, top + 19, -6, top + 22).quadraticCurveTo(-7.5, top + 19, -9, top + 22)
    .closePath().fill(P.ghost).stroke(soft(P.ghostLine, 1.2));
  g.ellipse(4.5, top + 13, 3, 7).fill({ color: P.ghostShade, alpha: 0.8 });
  g.circle(-3, top + 9, 1.3).fill(P.ghostEye); g.circle(3, top + 9, 1.3).fill(P.ghostEye);
  g.ellipse(-5, top + 12, 1.6, 1).fill({ color: P.blush, alpha: 0.8 }); g.ellipse(5, top + 12, 1.6, 1).fill({ color: P.blush, alpha: 0.8 });
  g.moveTo(-1.3, top + 12).quadraticCurveTo(0, top + 13.4, 1.3, top + 12).stroke({ width: 0.9, color: P.ghostEye, cap: 'round' });
  g.poly([0, top, -4, top - 3, -4, top + 2]).fill(P.bow); g.poly([0, top, 4, top - 3, 4, top + 2]).fill(P.bow); g.circle(0, top, 1.2).fill(P.pumpkinShade);
  return g;
}

function drawLeaves(layout: HalloweenLayout): Graphics {
  const g = new Graphics();
  for (const l of layout.leaves) {
    const c = P.leaves[l.variant], s = l.scale, cs = Math.cos(l.rot) * s, sn = Math.sin(l.rot) * s;
    const pt = (x: number, y: number) => [l.x + x * cs - y * sn, l.y + x * sn + y * cs] as const;
    const shape = l.variant === 0 ? [[0, -6], [2, -2], [6, -3], [3, 1], [4, 5], [0, 3], [-4, 5], [-3, 1], [-6, -3], [-2, -2]] : [[0, -5], [3, -1], [0, 5], [-3, -1]];
    g.poly(shape.flatMap(([x, y]) => pt(x!, y!))).fill({ color: c, alpha: 0.9 });
    g.moveTo(...pt(0, -4)).lineTo(...pt(0, 4)).stroke({ width: 0.6, color: 0x5a3418, alpha: 0.5 });
  }
  return g;
}

export class HalloweenOverlay {
  readonly animate: boolean;
  readonly id = 'halloween';
  readonly night = HALLOWEEN_NIGHT;
  private bank: TextureBank;
  private tex: { pumpkin: Baked[]; face: Baked[]; ghost: Baked } | null = null;
  private owned: { parent: Container; child: Container }[] = [];
  private faces: Sprite[] = []; private glows: Sprite[] = []; private lights: Sprite[] = [];
  private bulbs: Sprite[] = []; private ornaments: Sprite[] = [];
  private lastLevel = -1;
  layout: HalloweenLayout | null = null;

  constructor(bank: TextureBank, animate: boolean) { this.bank = bank; this.animate = animate; }

  attach(world: World, emissive: Container, lighting: Lighting) {
    this.detach();
    const b = this.bank;
    this.tex ??= {
      pumpkin: ([0, 1, 2] as const).map((v) => b.bake(drawPumpkin(v), 0, 0, 3)),
      face: ([0, 1, 2] as const).map((v) => b.bake(drawPumpkin(v, true), 0, 0, 3)),
      ghost: b.bake(drawGhostOrnament(), 0, 0, 3),
    };
    const t = this.tex, L = (this.layout = halloweenLayout(world.map));
    const own = (parent: Container, child: Container) => { parent.addChild(child); this.owned.push({ parent, child }); return child; };
    own(world.ground, drawLeaves(L));
    for (const p of L.pumpkins) {
      const s = own(world.objects, spriteOf(t.pumpkin[p.variant]!)) as Sprite; s.position.set(p.x, p.y); s.scale.set(p.scale); s.zIndex = p.y;
      if (p.variant !== 2) { const f = own(emissive, spriteOf(t.face[p.variant]!)) as Sprite; f.position.set(p.x, p.y); f.scale.set(p.scale); f.blendMode = 'add'; f.alpha = 0; this.faces.push(f); }
      const gl = own(emissive, new Sprite(b.lightSoft)) as Sprite; gl.anchor.set(0.5); gl.position.set(p.x, p.y - 10); gl.scale.set(0.16 * p.scale); gl.tint = P.carveGlow; gl.blendMode = 'add'; gl.alpha = 0; this.glows.push(gl);
      const li = lighting.addLight(0xffa04a, 0.55 * p.scale, 0); li.position.set(p.x, p.y - 8); this.owned.push({ parent: lighting.lights, child: li }); this.lights.push(li);
    }
    for (const st of L.strands) {
      const w = new Graphics();
      w.moveTo(st.a.x, st.a.y).quadraticCurveTo((st.a.x + st.b.x) / 2, (st.a.y + st.b.y) / 2 + st.sag * 2, st.b.x, st.b.y).stroke({ width: 1.4, color: P.wire, alpha: 0.85 });
      for (const bu of st.bulbs) { w.roundRect(bu.x - 1.2, bu.y - 1, 2.4, 2.4, 0.6).fill(P.wire); w.ellipse(bu.x, bu.y + 3, 2.2, 3).fill(bu.color === 'orange' ? P.bulbOrange : P.bulbPurple); }
      w.zIndex = Math.max(st.a.y, st.b.y) + 92 - 1;   // just in front of the two tents it hangs from
      own(world.objects, w);
      for (const bu of st.bulbs) { const g = own(emissive, new Sprite(b.dot)) as Sprite; g.anchor.set(0.5); g.position.set(bu.x, bu.y + 3); g.scale.set(0.42); g.tint = bu.color === 'orange' ? P.bulbOrange : P.bulbPurple; g.blendMode = 'add'; g.alpha = 0; this.bulbs.push(g); }
      for (const gh of st.ghosts) { const o = own(world.objects, spriteOf(t.ghost)) as Sprite; o.position.set(gh.x, gh.y); o.zIndex = w.zIndex + 1; this.ornaments.push(o); }
    }
    this.lastLevel = -1;
  }

  counts() { const L = this.layout; return { pumpkins: L?.pumpkins.length ?? 0, bulbs: this.bulbs.length, ornaments: this.ornaments.length, leaves: L?.leaves.length ?? 0 }; }

  // night: 0 day .. 1 night (moonlight level). Static modes return at once unless the level changed.
  update(time: number, night: number) {
    if (!this.animate && night === this.lastLevel) return;
    this.lastLevel = night;
    const a = this.animate;
    this.faces.forEach((f, i) => { f.alpha = night * (a ? 0.85 + Math.sin(time * 7.3 + i * 1.7) * 0.08 + Math.sin(time * 13.1 + i) * 0.05 : 0.9); });
    this.glows.forEach((g, i) => { g.alpha = (0.15 + 0.6 * night) * (a ? 0.9 + Math.sin(time * 5.1 + i * 2.3) * 0.1 : 1); });
    this.lights.forEach((l, i) => { l.alpha = night * 0.8 * (a ? 0.92 + Math.sin(time * 6.7 + i) * 0.08 : 1); });
    this.bulbs.forEach((g, i) => { g.alpha = (0.1 + 0.8 * night) * (a ? 0.85 + Math.sin(time * 1.3 + i * 1.9) * 0.15 : 1); });
    if (a) this.ornaments.forEach((o, i) => { o.rotation = Math.sin(time * 1.1 + i * 2) * 0.07; });
  }

  detach() {
    // destroy() keeps textures (shared baked ones stay in this.tex for the next attach)
    for (const { parent, child } of this.owned) { parent.removeChild(child); child.destroy(); }
    this.owned = []; this.faces = []; this.glows = []; this.lights = []; this.bulbs = []; this.ornaments = [];
  }
}
